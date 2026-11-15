import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { ReleaseRecordSchema, UNIT_PURPOSES, inviteCodeOf, inviteHashOf, slotIdFromNearPublicKey } from "@bandsheet/core";
import { readPostingTx } from "../auth/posting";
import type { Deps } from "../deps";
import { AppError } from "../errors";
import { ACCOUNT, ED25519, UnitClaim, verifyUnitClaim } from "../units/claim";
import { type UnitsDeps, body, consume, need, nowOf, readFail, readUnit, registrarOf, sendOrFail, txOut, unitIdOf } from "../units/deps";
import { latestBands } from "./releases";
import { unitAdminRoutes } from "./units-admin";

const JoinBody = UnitClaim.extend({ member_public_key: ED25519, invite_code: z.string().min(8).max(128) });
const EntryBody = UnitClaim.extend({ signed_tx: z.string().regex(/^[A-Za-z0-9+/=]+$/).max(24_000) });

/** A unit's releases, newest page (the contract pages from release 1). */
export async function readUnitReleases(u: UnitsDeps, id: number, total: number) {
  const from = Math.max(0, total - 20);
  const raw = await u.chain.view<unknown[]>("get_unit_releases", { unit_id: id, from, limit: 20 }).catch(() => {
    throw readFail();
  });
  return raw.flatMap((r) => {
    const p = ReleaseRecordSchema.safeParse(r);
    return p.success ? [p.data] : [];
  });
}

/**
 * /api/units: start-your-own-unit. Joins and entries are bound to the wallet with a signed statement (NEP-413 or
 * EIP-191); the registrar adds the posting key; the account <-> slot link stays in D1, never on chain.
 */
export function unitsRoutes(deps: Deps): Hono {
  const app = new Hono();

  app.post("/nonce", async (c) => {
    const u = need(deps);
    const { purpose } = await body(c, z.object({ purpose: z.enum(UNIT_PURPOSES) }));
    const nonce = randomBytes(32).toString("base64url");
    const expires = await u.store.issueNonce(nonce, purpose, nowOf(u));
    return c.json({ nonce, purpose, recipient: u.cfg.contract, expires_at: new Date(expires).toISOString() });
  });

  app.get("/policy", async (c) => {
    const u = need(deps);
    const p = await u.chain.view("get_policy").catch(() => {
      throw readFail();
    });
    return c.json(p);
  });

  app.get("/", async (c) => {
    const u = need(deps);
    const account = ACCOUNT.safeParse(c.req.query("account_id"));
    if (!account.success) throw new AppError(400, "account_id is required", "BAD_REQUEST");
    const units = await u.chain.view("get_units_of", { account_id: account.data }).catch(() => {
      throw readFail();
    });
    return c.json({ contract: u.cfg.contract, account_id: account.data, units });
  });

  app.get("/:id", async (c) => {
    const u = need(deps);
    const id = unitIdOf(c.req.param("id"));
    const unit = await readUnit(u, id);
    const [proposals, releases, policy] = await Promise.all([
      u.chain.view<unknown[]>("get_unit_proposals", { unit_id: id, from: Math.max(0, unit.proposals - 50), limit: 50 }),
      readUnitReleases(u, id, unit.releases),
      u.chain.view<{ enclave_pubkey: string; wasm_sha256: string; k: number }>("get_policy"),
    ]).catch((e) => {
      throw e instanceof AppError ? e : readFail();
    });
    const last = releases[releases.length - 1] as { counts?: unknown } | undefined;
    const { invite_code_hash: _hidden, ...shown } = unit;
    return c.json({
      contract: u.cfg.contract,
      network: "testnet",
      unit: shown,
      policy: { k: policy.k, enclave_pubkey: policy.enclave_pubkey, wasm_sha256: policy.wasm_sha256 },
      proposals,
      releases,
      latest_bands: latestBands(releases) ?? null,
      counts: { members: unit.members, synthetic_members: unit.synthetic_members, entries: unit.entries, releases: unit.releases, latest_release: last?.counts ?? null },
      explorer: { contract_url: `${u.cfg.explorer.address}${u.cfg.contract}`, tx: u.cfg.explorer.tx },
    });
  });

  app.post("/:id/join", async (c) => {
    const u = need(deps);
    const id = unitIdOf(c.req.param("id"));
    const b = await body(c, JoinBody);
    const registrar = registrarOf(u);
    let slot: string;
    try {
      slot = slotIdFromNearPublicKey(b.member_public_key);
    } catch {
      throw new AppError(400, "the member key must be an ed25519 public key", "BAD_MEMBER_KEY");
    }
    await consume(u, b.nonce, "unit_join");
    const account = await verifyUnitClaim(b, { purpose: "unit_join", unitId: id, subject: b.member_public_key, recipient: u.cfg.contract }, u.keys);
    const unit = await readUnit(u, id);
    if (inviteHashOf(b.invite_code) !== unit.invite_code_hash) throw new AppError(403, "that invite code is not this unit's", "INVITE_INVALID");
    const prev = await u.store.getMember(account, id);
    if (prev?.member_public_key === b.member_public_key) throw new AppError(409, "that member key is already registered", "ALREADY_MEMBER");
    // one posting key per account and unit: the old key and its entry go first
    const removed = prev
      ? await u.chain.call(registrar, [{ method: "unit_remove_member", args: { unit_id: id, public_key: prev.member_public_key }, tgas: 30 }]).catch(() => null)
      : null;
    const code = inviteCodeOf(b.invite_code);
    const added = await sendOrFail(
      u.chain.call(registrar, [{ method: "unit_add_member", args: { unit_id: id, public_key: b.member_public_key, invite_code: code, synthetic: false }, tgas: 30 }]),
    );
    await u.store.putMember({ account_id: account, unit_id: id, member_public_key: b.member_public_key, slot, joined_at: nowOf(u), add_tx: added.hash });
    return c.json({
      unit_id: id, account_id: account, member_public_key: b.member_public_key, slot, tx: txOut(u, added.hash),
      replaced: prev ? { slot: prev.slot, tx: removed?.ok ? txOut(u, removed.hash) : null } : null,
    });
  });

  /** Wallet-bound entry: the wallet's signature over sha256(ciphertext JSON) is checked before the posting key's submit is broadcast. */
  app.post("/:id/entry", async (c) => {
    const u = need(deps);
    const id = unitIdOf(c.req.param("id"));
    const b = await body(c, EntryBody);
    if (!u.broadcast) throw new AppError(503, "posting is not configured on this server", "POSTING_NOT_CONFIGURED");
    const post = readPostingTx(b.signed_tx, u.cfg.contract);
    await consume(u, b.nonce, "unit_entry");
    const account = await verifyUnitClaim(b, { purpose: "unit_entry", unitId: id, subject: post.ctSha256, recipient: u.cfg.contract }, u.keys);
    const m = await u.store.getMember(account, id);
    if (!m) throw new AppError(404, "this account has not joined this unit", "NOT_JOINED");
    if (m.slot !== post.slot) throw new AppError(409, "this entry is signed by a different posting key than this account's", "SLOT_MISMATCH");
    const tx = await u.broadcast(post.bytes).catch(() => {
      throw new AppError(502, "NEAR testnet did not accept the transaction just now; nothing was recorded", "CHAIN_WRITE");
    });
    if (!tx.ok) throw new AppError(422, `the chain refused: ${tx.error || "submit failed"}`, "CHAIN_REJECTED");
    await u.store.addBinding({ account_id: account, unit_id: id, slot: m.slot, ct_sha256: post.ctSha256, signed_at: nowOf(u) });
    const count = Number(tx.value);
    return c.json({ unit_id: id, account_id: account, slot: m.slot, ct_sha256: post.ctSha256, tx: txOut(u, tx.hash), entry_count: Number.isFinite(count) ? count : null });
  });

  app.route("/", unitAdminRoutes(deps));
  return app;
}
