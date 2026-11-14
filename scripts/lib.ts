// Shared helpers for the testnet scripts. TESTNET ONLY: every network call goes to testnet endpoints.
// Secrets live in ../keys (gitignored) and are never printed. Script output (links, results) is the point.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Account, actions, JsonRpcProvider, KeyPair, type KeyPairString, teraToGas } from "near-api-js";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const KEYS = join(ROOT, "keys");
export const WASM = join(ROOT, "contracts/bandsheet/out");
export const STATE_FILE = join(ROOT, "scripts/deployed.json");
export const EXPLORER = "https://testnet.nearblocks.io";
export const SPUTNIK_FACTORY = "sputnik-v2.testnet";

export const RPC = "https://near-testnet.drpc.org"; // 14 Nov: FastNEAR 429s this machine
const RPC_ALT = "https://archival-rpc.testnet.fastnear.com"; // second opinion (separate quota) when the first returns 429

// FastNEAR rate-limits bursts: space RPC calls out and retry on 429 (HTTP or JSON-RPC code -429).
const realFetch = globalThis.fetch;
let lastCall = 0;
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  if (!url.startsWith(RPC)) return realFetch(input, init);
  for (let i = 0; i < 10; i++) {
    const wait = Math.max(0, lastCall + 300 - Date.now());
    lastCall = Date.now() + wait;
    if (wait) await new Promise((r) => setTimeout(r, wait));
    // a dropped connection must not hang a run: time out each attempt and retry
    if (process.env.SCRIPT_DEBUG) process.stderr.write(`rpc ${String(init?.body).slice(0, 140)}\n`);
    const target = i % 2 === 1 ? RPC_ALT : url;
    const res = await realFetch(target, { ...init, signal: AbortSignal.timeout(25_000) }).catch(() => null);
    if (!res) { await new Promise((r) => setTimeout(r, 1000 * (i + 1))); continue; }
    const limited = res.status === 429 || (await res.clone().text().then((t) => t.includes('"code": -429') || t.includes('"code":-429')).catch(() => false));
    if (!limited) return res;
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return realFetch(input, init);
}) as typeof fetch;
export const provider = new JsonRpcProvider({ url: RPC }, { retries: 8, backoff: 2, wait: 1500 });

/** Raw view_account (quiet: a missing account is just null). Paced and retried on rate limits. */
async function rawAccount(accountId: string): Promise<{ amount: string } | null> {
  for (let i = 0; i < 8; i++) {
    const r = await fetch(RPC, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "view_account", finality: "final", account_id: accountId } }),
    });
    const j = (await r.json().catch(() => ({}))) as { result?: { amount: string }; error?: { cause?: { name?: string }; code?: number } };
    if (j.result) return j.result;
    if (j.error?.cause?.name === "UNKNOWN_ACCOUNT") return null;
    await sleep(1500 * (i + 1));
  }
  throw new Error(`RPC view_account failed for ${accountId}`);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const txLink = (hash: string) => `${EXPLORER}/txns/${hash}`;
export const near = (n: number | string) => BigInt(Math.round(Number(n) * 1e6)) * 10n ** 18n;

export interface State {
  run: string;
  owner: string;
  unit: string;
  dao: string;
  council: string[];
  outsider: string;
  outlayer: string;
  mockOutlayer?: string;
  [k: string]: unknown;
}
export function loadState(): State {
  if (!existsSync(STATE_FILE)) throw new Error("scripts/deployed.json is missing: run scripts/setup.ts first");
  return JSON.parse(readFileSync(STATE_FILE, "utf8")) as State;
}
export function saveState(patch: Partial<State> & Record<string, unknown>): State {
  const cur = existsSync(STATE_FILE) ? (JSON.parse(readFileSync(STATE_FILE, "utf8")) as State) : ({} as State);
  const next = { ...cur, ...patch };
  writeFileSync(STATE_FILE, JSON.stringify(next, null, 2) + "\n");
  return next;
}

// ---- keys ----
export interface KeyFile { account_id: string; public_key: string; private_key: KeyPairString }
export function saveKey(path: string, accountId: string, kp: KeyPair): KeyFile {
  mkdirSync(dirname(path), { recursive: true });
  const f: KeyFile = { account_id: accountId, public_key: kp.getPublicKey().toString(), private_key: kp.toString() as KeyPairString };
  writeFileSync(path, JSON.stringify(f, null, 2) + "\n", { mode: 0o600 });
  return f;
}
export const keyPath = (accountId: string) => join(KEYS, `${accountId}.json`);
/** Write a secret file under keys/ (0600). */
export function writeSecret(name: string, data: unknown): void {
  mkdirSync(KEYS, { recursive: true });
  writeFileSync(join(KEYS, name), JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
}
export function readKey(path: string): KeyFile {
  return JSON.parse(readFileSync(path, "utf8")) as KeyFile;
}
export function account(accountId: string): Account {
  return new Account(accountId, provider, readKey(keyPath(accountId)).private_key);
}
/** The coordinator-funded owner: keys/owner/<implicit id>.json (the only file in that folder). */
export function ownerKeyFile(): KeyFile {
  const dir = join(KEYS, "owner");
  const f = readdirSync(dir).find((n) => n.endsWith(".json"));
  if (!f) throw new Error("keys/owner/ has no key file");
  return readKey(join(dir, f));
}
export function accountWithKey(accountId: string, k: KeyFile): Account {
  return new Account(accountId, provider, k.private_key);
}

export async function exists(accountId: string): Promise<boolean> {
  return (await rawAccount(accountId)) !== null;
}
export async function balanceNear(accountId: string): Promise<number> {
  const a = await rawAccount(accountId);
  if (!a) throw new Error(`${accountId} does not exist`);
  return Number(BigInt(a.amount) / 10n ** 21n) / 1000;
}

// ---- sending ----
export interface Sent { hash: string; ok: boolean; error: string; value: unknown; logs: string[]; link: string }

function decodeValue(status: unknown): unknown {
  const s = status as { SuccessValue?: string };
  if (s?.SuccessValue === undefined) return undefined;
  const text = Buffer.from(s.SuccessValue, "base64").toString("utf8");
  try { return JSON.parse(text); } catch { return text; }
}
function failureText(status: unknown): string {
  const f = (status as { Failure?: unknown })?.Failure;
  if (!f) return "";
  const j = JSON.stringify(f);
  const m = /Smart contract panicked: ([^"\\]*)/.exec(j) ?? /"ExecutionError":"([^"]*)"/.exec(j);
  return m ? m[1]! : j.slice(0, 300);
}

export async function sendActions(from: Account, receiverId: string, acts: ReturnType<typeof actions.functionCall>[]): Promise<Sent> {
  const res = await from.signAndSendTransaction({ receiverId, actions: acts, waitUntil: "FINAL", throwOnFailure: false });
  const hash = res.transaction.hash as string;
  const outcomes = [res.transaction_outcome, ...(res.receipts_outcome ?? [])];
  const logs = outcomes.flatMap((o) => o.outcome.logs as string[]);
  // the first failure anywhere in the receipt tree is the reason
  const failed = outcomes.map((o) => failureText(o.outcome.status)).find(Boolean) ?? failureText(res.status);
  return { hash, ok: !failed, error: failed, value: decodeValue(res.status), logs, link: txLink(hash) };
}

export function callTx(from: Account, contract: string, method: string, args: unknown, tgas = 100, depositNear: bigint = 0n): Promise<Sent> {
  return sendActions(from, contract, [actions.functionCall(method, args as object, teraToGas(tgas), depositNear)]);
}

export async function view<T = unknown>(contractId: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
  return (await provider.callFunction({ contractId, method, args })) as T;
}

export function step(title: string, s?: { link: string; ok: boolean; error: string }): void {
  process.stdout.write(`\n== ${title}\n`);
  if (s) process.stdout.write(`   ${s.ok ? "ok" : "REFUSED"}${s.error ? `: ${s.error}` : ""}\n   ${s.link}\n`);
}
export function say(msg: string): void {
  process.stdout.write(`   ${msg}\n`);
}
