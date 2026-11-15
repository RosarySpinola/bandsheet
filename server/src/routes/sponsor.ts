import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { AppError } from "../errors";
import { clientIp } from "../ratelimit";
import { need, nowOf, readFail, txOut } from "../units/deps";

/** One-time grant, given only below the threshold; the sponsor keeps a small floor for its own gas. */
export const GRANT = 5n * 10n ** 22n; // 0.05 NEAR
export const BELOW = 2n * 10n ** 22n; // 0.02 NEAR
const SPONSOR_FLOOR = 10n ** 23n; // 0.1 NEAR
export const GRANTS_PER_IP_PER_DAY = 3;

/** Testnet ids only: named .testnet accounts, NEAR implicit (64 hex) and Ethereum implicit (0x + 40 hex). */
const TestnetAccount = z
  .string()
  .min(2)
  .max(64)
  .regex(/^(?:[a-z0-9]+(?:[-_][a-z0-9]+)*\.)+testnet$|^[0-9a-f]{64}$|^0x[0-9a-f]{40}$/);

const near = (y: bigint | null) => (y === null ? 0 : Number(y / 10n ** 21n) / 1000);

/**
 * POST /api/sponsor {account_id}: a wallet that holds (almost) no testnet NEAR gets 0.05 NEAR once, so it can sign its
 * own council transactions. Paid by a dedicated low-value sponsor account; one grant per account, three per IP per day.
 */
export function sponsorRoutes(deps: Deps): Hono {
  const app = new Hono();
  app.post("/", async (c) => {
    const u = need(deps);
    const raw = (await c.req.json().catch(() => null)) as { account_id?: unknown } | null;
    const id = typeof raw?.account_id === "string" ? raw.account_id : "";
    if (/\.near$/.test(id) || /mainnet/.test(id)) throw new AppError(400, "this sponsor funds testnet accounts only", "NOT_TESTNET");
    const parsed = TestnetAccount.safeParse(id);
    if (!parsed.success) throw new AppError(400, "account_id must be a testnet account", "BAD_REQUEST");
    const account = parsed.data;
    const sponsor = u.cfg.sponsor;
    if (!sponsor) throw new AppError(503, "the gas sponsor is not configured on this server", "SPONSOR_NOT_CONFIGURED");

    const balance = await u.chain.balance(account).catch(() => {
      throw readFail();
    });
    if (balance === null && /\.testnet$/.test(account)) throw new AppError(404, `${account} does not exist on testnet`, "UNKNOWN_ACCOUNT");
    if (balance !== null && balance >= BELOW) return c.json({ funded: false, reason: "balance is already 0.02 NEAR or more", balance: near(balance) });
    if (await u.store.getGrant(account)) return c.json({ funded: false, reason: "this account was already sponsored once", balance: near(balance) });

    const ip = clientIp(c);
    if ((await u.store.grantsFromIp(ip, nowOf(u) - 86_400_000)) >= GRANTS_PER_IP_PER_DAY) {
      throw new AppError(429, "this address has had its sponsored accounts for today", "SPONSOR_IP_LIMIT");
    }
    const own = await u.chain.balance(sponsor.accountId).catch(() => null);
    if (own === null || own < GRANT + SPONSOR_FLOOR) throw new AppError(503, "the gas sponsor is empty; try again later", "SPONSOR_EMPTY");
    // reserve first, so two requests for one account cannot both be paid
    if (!(await u.store.putGrant({ account_id: account, ip, tx: "pending", granted_at: nowOf(u) }))) {
      return c.json({ funded: false, reason: "this account was already sponsored once", balance: near(balance) });
    }
    const tx = await u.chain.transfer(sponsor, account, GRANT).catch(() => null);
    if (!tx?.ok) {
      await u.store.dropGrant(account);
      throw new AppError(502, "the transfer did not go through; try again", "CHAIN_WRITE");
    }
    await u.store.finishGrant(account, tx.hash);
    return c.json({ funded: true, tx: txOut(u, tx.hash), balance: near((balance ?? 0n) + GRANT), amount: Number(GRANT / 10n ** 21n) / 1000 });
  });
  return app;
}
