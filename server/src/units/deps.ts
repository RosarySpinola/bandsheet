import type { UnitPurpose } from "@bandsheet/core";
import type { Deps } from "../deps";
import type { KeyLookup } from "../auth/keys";
import type { Broadcast } from "../auth/posting";
import type { NonceCheck } from "../auth/store";
import type { SentTx, Signer } from "../chain/port";
import { AppError } from "../errors";
import type { UnitsChain } from "./chain";
import type { UnitsConfig } from "./config";
import type { UnitStore } from "./store";

/** Everything the units routes need; absent when the host has no AUTH_DB, and then they answer 503. */
export interface UnitsDeps {
  cfg: UnitsConfig;
  chain: UnitsChain;
  store: UnitStore;
  keys: KeyLookup;
  broadcast?: Broadcast;
  /** fetch used for DNS-over-HTTPS (tests inject one). */
  doh?: typeof fetch;
  now?: () => number;
  /** Poll interval when reading back a just-sent transaction's effect (tests set 0). */
  pollMs?: number;
}

/** The parts of the contract's UnitView the server reads. */
export interface UnitView {
  id: number;
  name: string;
  creator: string;
  council: string[];
  invite_code_hash: string;
  threshold: number;
  dkim_domains: string[];
  issuers: { domain: string; selector: string; source: string; key_sha256: string }[];
  members: number;
  synthetic_members: number;
  synthetic_added: number;
  entries: number;
  proposals: number;
  releases: number;
  in_flight: unknown;
  [k: string]: unknown;
}

export const SYNTHETIC_CAP = 8;

export const nowOf = (u: UnitsDeps) => (u.now ?? Date.now)();

export function registrarOf(u: UnitsDeps): Signer {
  if (!u.cfg.registrar) throw new AppError(503, "the units registrar key is not configured on this server", "REGISTRAR_KEY_MISSING");
  return u.cfg.registrar;
}

export const readFail = () => new AppError(502, "could not read NEAR testnet", "CHAIN_READ");

export function unitIdOf(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 100_000) throw new AppError(400, "unit id must be a positive integer", "BAD_UNIT_ID");
  return n;
}

export async function readUnit(u: UnitsDeps, id: number): Promise<UnitView> {
  const unit = await u.chain.view<UnitView | null>("get_unit", { unit_id: id }).catch(() => {
    throw readFail();
  });
  if (!unit) throw new AppError(404, `there is no unit ${id}`, "UNIT_NOT_FOUND");
  return unit;
}

const NONCE_ERR: Record<Exclude<NonceCheck, "ok" | "relayed">, [400 | 401 | 409, string, string]> = {
  unknown: [400, "this nonce was not issued here", "NONCE_UNKNOWN"],
  expired: [401, "this nonce has expired; ask for a new one", "NONCE_EXPIRED"],
  used: [409, "this nonce was already used", "NONCE_USED"],
  wrong_purpose: [400, "this nonce was issued for something else", "NONCE_WRONG_PURPOSE"],
};

export async function consume(u: UnitsDeps, nonce: string, purpose: UnitPurpose): Promise<void> {
  const v = await u.store.consumeNonce(nonce, purpose, nowOf(u));
  if (v === "ok") return;
  const [status, msg, code] = NONCE_ERR[v as keyof typeof NONCE_ERR] ?? NONCE_ERR.unknown;
  throw new AppError(status, msg, code);
}

export function txOut(u: UnitsDeps, hash: string) {
  return { hash, url: `${u.cfg.explorer.tx}${hash}` };
}

/** A refused chain call becomes a 422 with the contract's own sentence (they are written to be shown). */
export function refused(tx: SentTx, code = "CHAIN_REJECTED"): AppError {
  return new AppError(422, tx.error ? `the chain refused: ${tx.error}` : "the chain refused the transaction", code);
}

export async function sendOrFail(p: Promise<SentTx>): Promise<SentTx> {
  const tx = await p.catch(() => {
    throw new AppError(502, "NEAR testnet did not accept the transaction just now; try again", "CHAIN_WRITE");
  });
  if (!tx.ok) throw refused(tx);
  return tx;
}

export async function body<T>(c: { req: { json: () => Promise<unknown> } }, schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }): Promise<T> {
  const p = schema.safeParse(await c.req.json().catch(() => null));
  if (!p.success) throw new AppError(400, "invalid request", "BAD_REQUEST");
  return p.data as T;
}

export function need(deps: Deps): UnitsDeps {
  if (!deps.units) throw new AppError(503, "units are not configured on this server", "UNITS_NOT_CONFIGURED");
  return deps.units;
}
