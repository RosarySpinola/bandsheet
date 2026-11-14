// Member helpers shared by add-member, revoke-member and seed-demo.
// A member is a function-call access key on the union account (method `submit`, small gas allowance).
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KeyPair, type KeyPairString } from "near-api-js";
import { encryptEntry, parseEnclavePublicKey, seedEntry, slotIdFromNearPublicKey, type SeedMember } from "../packages/core/src/index";
import { account, accountWithKey, callTx, KEYS, loadState, ownerKeyFile, provider, type Sent, view } from "./lib";

export const INVITES = join(KEYS, "invites");

export interface Invite {
  account_id: string; // the union account: the key lives on it
  contract_id: string;
  network: "testnet";
  rpc_url: string;
  name: string;
  public_key: string;
  private_key: KeyPairString;
  slot: string;
}

export function invitePath(name: string): string {
  return join(INVITES, `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.json`);
}
export function readInvite(name: string): Invite | null {
  const p = invitePath(name);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Invite) : null;
}

/** Generate a keypair and write the invite file (gitignored). Does not touch the chain. */
export function makeInvite(name: string): Invite {
  const unit = loadState().unit;
  const kp = KeyPair.fromRandom("ed25519");
  const public_key = kp.getPublicKey().toString();
  const inv: Invite = {
    account_id: unit, contract_id: unit, network: "testnet", rpc_url: "https://near-testnet.drpc.org", name,
    public_key, private_key: kp.toString() as KeyPairString, slot: slotIdFromNearPublicKey(public_key),
  };
  mkdirSync(INVITES, { recursive: true });
  writeFileSync(invitePath(name), JSON.stringify(inv, null, 2) + "\n", { mode: 0o600 });
  return inv;
}

/** Committee call: register keys as members (the contract adds the access keys to itself). */
export async function addMembers(invites: Invite[]): Promise<Sent> {
  const st = loadState();
  const owner = ownerKeyFile();
  return callTx(accountWithKey(owner.account_id, owner), st.unit, "add_members", { public_keys: invites.map((i) => i.public_key) }, 250);
}

export async function enclaveKey(): Promise<Uint8Array> {
  const p = await view<{ policy: { enclave_pubkey: string } }>(loadState().unit, "get_policy");
  return parseEnclavePublicKey(p.policy.enclave_pubkey);
}

/** The member signs `submit` with their own access key. Gas is paid from the union account. */
export async function submitAs(inv: Invite, m: SeedMember, pub: Uint8Array, submittedAt: number): Promise<Sent> {
  const ct = encryptEntry(pub, seedEntry(m, inv.slot, submittedAt));
  return callTx(accountWithKey(inv.contract_id, { account_id: inv.contract_id, public_key: inv.public_key, private_key: inv.private_key }), inv.contract_id, "submit", { ciphertext: ct }, 30);
}

export async function counts(): Promise<{ members: number; entries: number; releases: number }> {
  const p = await view<{ members: number; entries: number; releases: number }>(loadState().unit, "get_policy");
  return { members: p.members, entries: p.entries, releases: p.releases };
}
export { account, provider };
