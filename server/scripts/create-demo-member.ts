/**
 * One-off admin step: create (or verify) the member reserved for the web demo.
 * Writes keys/invites/demo-member.json (gitignored, same format as the other invites) and has the
 * committee (owner key in keys/owner/) register it with add_members, which gives it a function-call
 * access key limited to `submit` on the unit account. Testnet only. Idempotent.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { KeyPair } from "near-api-js";
import { slotIdFromNearPublicKey } from "@bandsheet/core";
import { TESTNET_RPCS } from "@bandsheet/core/near";
import { loadChainConfig } from "../src/chain/config";
import { createChainPort } from "../src/chain/port";
import { REPO_ROOT } from "../src/env";

const out = (s: string): void => void process.stdout.write(`${s}\n`);
const cfg = loadChainConfig();
const chain = createChainPort();
const path = resolve(REPO_ROOT, "keys/invites/demo-member.json");

let invite: Record<string, string>;
if (existsSync(path)) invite = JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
else {
  const kp = KeyPair.fromRandom("ed25519");
  const public_key = kp.getPublicKey().toString();
  invite = {
    account_id: cfg.unit, contract_id: cfg.unit, network: "testnet", rpc_url: TESTNET_RPCS[0]!, name: "Demo Member (reserved for the web demo)",
    public_key, private_key: kp.toString(), slot: slotIdFromNearPublicKey(public_key),
  };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(invite, null, 2)}\n`, { mode: 0o600 });
  out(`wrote ${path}`);
}

if (await chain.view<boolean>(cfg.unit, "is_member", { slot: invite.slot! })) {
  out(`already a member (slot ${invite.slot})`);
} else {
  const dir = resolve(REPO_ROOT, "keys/owner");
  const f = readdirSync(dir).find((n) => n.endsWith(".json"));
  if (!f) throw new Error("keys/owner has no key file");
  const owner = JSON.parse(readFileSync(resolve(dir, f), "utf8")) as { account_id: string; private_key: string };
  const tx = await chain.send({ accountId: owner.account_id, privateKey: owner.private_key }, cfg.unit, "add_members", { public_keys: [invite.public_key] }, { tgas: 250 });
  out(tx.ok ? `added member: ${cfg.explorer.tx}${tx.hash}` : `FAILED: ${tx.error}`);
  if (!tx.ok) process.exit(1);
}
const p = await chain.view<{ members: number; entries: number }>(cfg.unit, "get_policy");
out(`unit ${cfg.unit}: members=${p.members} entries=${p.entries}`);
