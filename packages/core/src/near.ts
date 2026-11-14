import { Account, FailoverRpcProvider, JsonRpcProvider, KeyPair, type KeyPairString, type Provider, actions, teraToGas } from "near-api-js";
import { z } from "zod";
import { slotIdFromNearPublicKey } from "./slot";
import { type Ciphertext, CiphertextSchema } from "./schemas";

export const TESTNET_RPC = "https://test.rpc.fastnear.com";
/** Tried in order; each endpoint retries with exponential backoff before the next is used. */
export const TESTNET_RPCS: readonly string[] = [
  TESTNET_RPC,
  "https://archival-rpc.testnet.near.org",
  // Added 14 Nov: the two above throttle or answer "deprecated" under load; this one stayed reachable.
  "https://near-testnet.drpc.org",
];

/** Testnet provider with endpoint failover and per-endpoint backoff (the public RPCs rate-limit hard). */
export function makeProvider(urls: readonly string[] = TESTNET_RPCS): Provider {
  for (const u of urls) {
    if (/mainnet/i.test(u) || /^https:\/\/(rpc|archival-rpc)\.near\.org/i.test(u)) throw new Error("refusing non-testnet RPC");
  }
  const mk = (url: string): Provider => new JsonRpcProvider({ url }, { retries: 4, wait: 600, backoff: 1.8 });
  const list = urls.map(mk);
  return list.length === 1 ? list[0]! : new FailoverRpcProvider(list);
}

/** Fields accepted from an invite file, tolerant of snake_case and camelCase. */
const InviteRaw = z
  .object({
    account_id: z.string().optional(),
    accountId: z.string().optional(),
    contract_id: z.string().optional(),
    contractId: z.string().optional(),
    private_key: z.string().optional(),
    privateKey: z.string().optional(),
    secret_key: z.string().optional(),
    network: z.string().optional(),
    rpc_url: z.string().url().optional(),
  })
  .passthrough();

export interface Invite {
  accountId: string;
  contractId: string;
  privateKey: KeyPairString;
  publicKey: string;
  /** hex(sha256(ed25519 public key bytes)) */
  slot: string;
  rpcUrl: string;
}

/**
 * Parse a member invite file: {account_id, contract_id, private_key:"ed25519:...", ...}.
 * The contract id may be omitted when `defaultContractId` is given.
 */
export function parseInvite(json: unknown, defaultContractId?: string): Invite {
  const raw = InviteRaw.parse(json);
  const accountId = raw.account_id ?? raw.accountId;
  const contractId = raw.contract_id ?? raw.contractId ?? defaultContractId;
  const privateKey = raw.private_key ?? raw.privateKey ?? raw.secret_key;
  if (!accountId || !contractId || !privateKey) {
    throw new Error("invite must carry account_id, contract_id and private_key");
  }
  if (!privateKey.startsWith("ed25519:")) throw new Error("invite private_key must be ed25519:...");
  const publicKey = KeyPair.fromString(privateKey as KeyPairString).getPublicKey().toString();
  return {
    accountId,
    contractId,
    privateKey: privateKey as KeyPairString,
    publicKey,
    slot: slotIdFromNearPublicKey(publicKey),
    rpcUrl: raw.rpc_url ?? TESTNET_RPC,
  };
}

export interface SubmitOptions {
  /** Provider override (the server passes its failover provider). */
  provider?: Provider;
  /** Contract method name. Default "submit". */
  method?: string;
  /** Wait milestone. Default EXECUTED_OPTIMISTIC (near-api-js default). */
  gasTeras?: number;
}

/**
 * Sign and send `submit(ciphertext)` as the member, using their FunctionCall access key.
 * Testnet only: refuses any RPC URL that mentions mainnet.
 */
export async function submitEntry(
  invite: Invite,
  ciphertext: Ciphertext,
  opts: SubmitOptions = {},
): Promise<{ result: unknown; txHash?: string }> {
  const body = CiphertextSchema.parse(ciphertext);
  const provider = opts.provider ?? makeProvider([invite.rpcUrl]);
  const account = new Account(invite.accountId, provider, invite.privateKey);
  const out = await account.callFunctionRaw({
    contractId: invite.contractId,
    methodName: opts.method ?? "submit",
    args: { ciphertext: body },
    gas: teraToGas(opts.gasTeras ?? 30),
    deposit: 0n,
  });
  const status = out.status as { SuccessValue?: string; Failure?: unknown } | string;
  if (typeof status === "object" && status && "Failure" in status && status.Failure) {
    throw new Error(`submit refused on chain: ${JSON.stringify(status.Failure).slice(0, 300)}`);
  }
  let result: unknown = undefined;
  const raw = typeof status === "object" ? status?.SuccessValue : undefined;
  if (raw) {
    const text = atob(raw);
    try {
      result = JSON.parse(text);
    } catch {
      result = text;
    }
  }
  return { result, txHash: out.transaction?.hash ?? out.transaction_outcome?.id };
}

/**
 * Sign `submit(ciphertext)` with the posting key but do not send it. A wallet member's server broadcasts these exact
 * bytes only after it has verified the wallet's signature over sha256(ctText). ctText is the ciphertext JSON as the
 * contract will store it.
 */
export async function signSubmitTx(
  invite: Invite,
  ciphertext: Ciphertext,
  opts: SubmitOptions = {},
): Promise<{ signedTxB64: string; ctText: string }> {
  const body = CiphertextSchema.parse(ciphertext);
  // Every testnet RPC with failover: a single public endpoint answering 429 (no CORS headers) reads as "Failed to fetch".
  const provider = opts.provider ?? makeProvider();
  const account = new Account(invite.accountId, provider, invite.privateKey);
  const signed = await account.createSignedTransaction({
    receiverId: invite.contractId,
    actions: [actions.functionCall(opts.method ?? "submit", { ciphertext: body }, teraToGas(opts.gasTeras ?? 30), 0n)],
  });
  let bin = "";
  for (const b of signed.encode()) bin += String.fromCharCode(b);
  return { signedTxB64: btoa(bin), ctText: JSON.stringify(body) };
}

/** Read-only contract view call over NEAR RPC (no key needed). */
export async function viewCall<T = unknown>(
  contractId: string,
  method: string,
  args: Record<string, unknown> = {},
  rpcUrl?: string | Provider,
): Promise<T> {
  const provider = typeof rpcUrl === "object" ? rpcUrl : makeProvider(rpcUrl ? [rpcUrl] : TESTNET_RPCS);
  return (await provider.callFunction({ contractId, method, args })) as T;
}

/** Fresh ed25519 member key (used by scripts and tests). */
export function generateMemberKey(): { privateKey: KeyPairString; publicKey: string; slot: string } {
  const kp = KeyPair.fromRandom("ed25519");
  const publicKey = kp.getPublicKey().toString();
  return { privateKey: kp.toString() as KeyPairString, publicKey, slot: slotIdFromNearPublicKey(publicKey) };
}
