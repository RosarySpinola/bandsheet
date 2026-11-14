import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import type { Signer } from "../chain/port";
import type { Deps } from "../deps";
import { AppError } from "../errors";
import type { KeyLookup } from "../auth/keys";
import { addMemberKey, memberSlot, revokeMemberKey } from "../auth/members";
import { relayNearAuthSign } from "../auth/near-auth";
import { type Broadcast, readPostingTx } from "../auth/posting";
import { PURPOSES, type Purpose, statementTxBytes } from "../auth/statement";
import type { AuthStore, NonceCheck } from "../auth/store";
import { verifyClaim } from "../auth/verify";

/** Everything the auth routes need; absent when the host has no AUTH_DB, and then every route answers 503. */
export interface AuthDeps {
  store: AuthStore;
  keys: KeyLookup;
  owner: Signer | undefined;
  /** Broadcasts a wallet member's posting-key `submit` after their wallet signature is verified. */
  broadcast?: Broadcast;
  now?: () => number;
}

const ACCOUNT = z.string().min(2).max(64).regex(/^[a-z0-9._-]+$/);
const ED25519 = z.string().regex(/^ed25519:[1-9A-HJ-NP-Za-km-z]{32,50}$/);
const NONCE = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const B64 = z.string().regex(/^[A-Za-z0-9+/=_-]+$/).max(200);
const HEX64 = z.string().regex(/^[0-9a-f]{64}$/);

const Claim = z.object({
  scheme: z.enum(["nep413", "near-tx"]),
  account_id: ACCOUNT,
  public_key: ED25519,
  signature: B64,
  nonce: NONCE,
});
const JoinBody = Claim.extend({ member_public_key: ED25519, method: z.enum(["near-auth", "near-connect"]) });
/** A wallet-signed entry: the wallet's claim over sha256(ciphertext JSON) plus the posting key's signed, unsent submit. */
const EntryBody = Claim.extend({ signed_tx: z.string().regex(/^[A-Za-z0-9+/=]+$/).max(24_000), method: z.enum(["near-auth", "near-connect"]) });
const RelayBody = z.object({
  purpose: z.enum(PURPOSES),
  subject: z.string().min(1).max(80),
  nonce: NONCE,
  account_id: ACCOUNT,
  public_key: ED25519,
  guard_id: z.string().max(120),
  verify_payload: z.string().min(20).max(8000),
  sign_payload: z.string().max(4000),
});

const NONCE_ERR: Record<Exclude<NonceCheck, "ok">, [400 | 401 | 409, string, string]> = {
  unknown: [400, "this nonce was not issued here", "NONCE_UNKNOWN"],
  expired: [401, "this nonce has expired; ask for a new one", "NONCE_EXPIRED"],
  used: [409, "this nonce was already used", "NONCE_USED"],
  wrong_purpose: [400, "this nonce was issued for something else", "NONCE_WRONG_PURPOSE"],
  relayed: [409, "this nonce was already sent to NEAR Auth", "NONCE_RELAYED"],
};
const nonceError = (v: NonceCheck): AppError => {
  const [status, msg, code] = NONCE_ERR[v as Exclude<NonceCheck, "ok">];
  return new AppError(status, msg, code);
};

const body = async <T>(c: { req: { json: () => Promise<unknown> } }, schema: z.ZodType<T>): Promise<T> => {
  const p = schema.safeParse(await c.req.json().catch(() => null));
  if (!p.success) throw new AppError(400, "invalid request", "BAD_REQUEST");
  return p.data;
};

/**
 * /api/auth: sign-in with a NEAR account (NEAR Auth or a NEAR Connect wallet) proves who joins, and the
 * server registers a member key the browser generated. The account <-> slot link stays in D1, never on chain.
 */
export function authRoutes(deps: Deps): Hono {
  const { chain, chainCfg: cfg } = deps;
  const app = new Hono();
  const need = (): AuthDeps => {
    if (!deps.auth) throw new AppError(503, "sign-in is not configured on this server", "AUTH_NOT_CONFIGURED");
    return deps.auth;
  };
  const ownerOf = (a: AuthDeps): Signer => {
    if (!a.owner) throw new AppError(503, "the committee key is not configured on this server", "OWNER_KEY_MISSING");
    return a.owner;
  };
  const now = (a: AuthDeps) => (a.now ?? Date.now)();
  const nonceBytes = (n: string) => Uint8Array.from(Buffer.from(n, "base64url"));
  const txOut = (hash: string) => ({ hash, url: `${cfg.explorer.tx}${hash}` });

  app.post("/nonce", async (c) => {
    const a = need();
    const { purpose } = await body(c, z.object({ purpose: z.enum(PURPOSES) }));
    const nonce = randomBytes(32).toString("base64url");
    const expires = await a.store.issueNonce(nonce, purpose, now(a));
    return c.json({ nonce, purpose, recipient: cfg.unit, expires_at: new Date(expires).toISOString() });
  });

  /** NEAR Auth only: relay the approved statement to fast-auth.testnet and return the MPC signature. */
  app.post("/near-auth/sign", async (c) => {
    const a = need();
    const b = await body(c, RelayBody);
    const subject = b.purpose === "join" ? ED25519.parse(b.subject) : HEX64.parse(b.subject);
    const expected = statementTxBytes({
      accountId: b.account_id, publicKey: b.public_key, recipient: cfg.unit, purpose: b.purpose, subject, nonce: nonceBytes(b.nonce),
    });
    const relayer = ownerOf(a);
    const marked = await a.store.markRelayed(b.nonce, b.purpose as Purpose, now(a));
    if (marked !== "ok") throw nonceError(marked);
    const signPayload = Uint8Array.from(Buffer.from(b.sign_payload, "base64"));
    const out = await relayNearAuthSign(chain, relayer, { guard_id: b.guard_id, verify_payload: b.verify_payload, sign_payload: signPayload }, expected);
    return c.json({ signature: Buffer.from(out.signature).toString("base64"), tx: txOut(out.tx) });
  });

  app.post("/join", async (c) => {
    const a = need();
    const b = await body(c, JoinBody);
    const owner = ownerOf(a);
    const slot = memberSlot(b.member_public_key);
    const used = await a.store.consumeNonce(b.nonce, "join", now(a));
    if (used !== "ok") throw nonceError(used);
    const who = await verifyClaim(b, { purpose: "join", subject: b.member_public_key, nonce: nonceBytes(b.nonce), recipient: cfg.unit }, a.keys);

    // One active key per account: revoke the previous key first, then add the new one.
    const prev = await a.store.getMember(who.account_id);
    if (prev?.member_public_key === b.member_public_key) throw new AppError(409, "that member key is already registered", "ALREADY_MEMBER");
    const revoked = prev ? await revokeMemberKey(chain, cfg, owner, prev.member_public_key) : null;
    const added = await addMemberKey(chain, cfg, owner, b.member_public_key);
    await a.store.putMember({
      account_id: who.account_id, member_public_key: b.member_public_key, slot, method: b.method, joined_at: now(a), add_tx: added.hash,
    });
    return c.json({
      account_id: who.account_id,
      implicit_unfunded: who.implicit_unfunded,
      member_public_key: b.member_public_key,
      slot,
      tx: txOut(added.hash),
      replaced: prev ? { slot: prev.slot, tx: revoked ? txOut(revoked.hash) : null } : null,
    });
  });

  /**
   * Wallet-signed entry, in this order: the wallet's signature over the entry hash is verified, the posting key's
   * transaction is checked to be that same entry from this account's slot, and only then is it broadcast and the
   * binding recorded. A missing or wrong wallet signature means nothing is posted.
   */
  app.post("/entry", async (c) => {
    const a = need();
    const b = await body(c, EntryBody);
    if (!a.broadcast) throw new AppError(503, "posting is not configured on this server", "POSTING_NOT_CONFIGURED");
    const post = readPostingTx(b.signed_tx, cfg.unit);
    const used = await a.store.consumeNonce(b.nonce, "entry", now(a));
    if (used !== "ok") throw nonceError(used);
    const who = await verifyClaim(b, { purpose: "entry", subject: post.ctSha256, nonce: nonceBytes(b.nonce), recipient: cfg.unit }, a.keys);
    const m = await a.store.getMember(who.account_id);
    if (!m) throw new AppError(404, "this account has not joined with a posting key", "NOT_JOINED");
    if (m.slot !== post.slot) throw new AppError(409, "this entry is signed by a different posting key than this account's", "SLOT_MISMATCH");
    const tx = await a.broadcast(post.bytes).catch(() => {
      throw new AppError(502, "NEAR testnet did not accept the transaction just now; nothing was recorded", "CHAIN_READ");
    });
    if (!tx.ok) throw new AppError(422, `the chain refused: ${tx.error || "submit failed"}`, "CHAIN_REJECTED");
    const signed_at = now(a);
    await a.store.addBinding({ account_id: who.account_id, slot: m.slot, ct_sha256: post.ctSha256, method: b.method, signed_at });
    const count = Number(tx.value);
    return c.json({
      account_id: who.account_id, slot: m.slot, ct_sha256: post.ctSha256, signed_at: new Date(signed_at).toISOString(),
      tx: txOut(tx.hash), entry_count: Number.isFinite(count) ? count : null,
    });
  });

  return app;
}
