import { Account, JsonRpcProvider, KeyPair, type KeyPairString, teraToGas } from "near-api-js";
import { z } from "zod";
import { slotIdFromNearPublicKey } from "./slot";
import { type Ciphertext, CiphertextSchema } from "./schemas";

export const TESTNET_RPC = "https://test.rpc.fastnear.com";

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
): Promise<{ result: unknown }> {
  if (/mainnet|near\.org\/?$/i.test(invite.rpcUrl) && !/testnet/i.test(invite.rpcUrl)) {
    throw new Error("refusing non-testnet RPC");
  }
  const body = CiphertextSchema.parse(ciphertext);
  const provider = new JsonRpcProvider({ url: invite.rpcUrl });
  const account = new Account(invite.accountId, provider, invite.privateKey);
  const result = await account.callFunction({
    contractId: invite.contractId,
    methodName: opts.method ?? "submit",
    args: { ciphertext: body },
    gas: teraToGas(opts.gasTeras ?? 30),
    deposit: 0n,
  });
  return { result };
}

/** Read-only contract view call over NEAR RPC (no key needed). */
export async function viewCall<T = unknown>(
  contractId: string,
  method: string,
  args: Record<string, unknown> = {},
  rpcUrl: string = TESTNET_RPC,
): Promise<T> {
  const provider = new JsonRpcProvider({ url: rpcUrl });
  return (await provider.callFunction({ contractId, method, args })) as T;
}

/** Fresh ed25519 member key (used by scripts and tests). */
export function generateMemberKey(): { privateKey: KeyPairString; publicKey: string; slot: string } {
  const kp = KeyPair.fromRandom("ed25519");
  const publicKey = kp.getPublicKey().toString();
  return { privateKey: kp.toString() as KeyPairString, publicKey, slot: slotIdFromNearPublicKey(publicKey) };
}
