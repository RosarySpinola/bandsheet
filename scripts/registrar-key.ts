// Give the hosted sign-in API a narrow key instead of the committee's full-access key.
// Adds a function-call access key on the owner account that can call only add_members and revoke_member
// on the union contract (with a gas allowance), and writes it to keys/registrar.json (gitignored; kept out of keys/owner/ so ownerKeyFile() still finds the full key).
// The hosted server uses it as OWNER_KEY_JSON, so a server compromise cannot repoint the DAO, policy or OutLayer.
// Usage: tsx scripts/registrar-key.ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import { KeyPair, actions } from "near-api-js";
import { KEYS, accountWithKey, loadState, near, ownerKeyFile, saveKey, sendActions, step } from "./lib";

const out = join(KEYS, "registrar.json");
if (existsSync(out)) {
  process.stderr.write(`${out} already exists; revoke it first if you want a new one\n`);
  process.exit(1);
}
const state = loadState();
const owner = ownerKeyFile();
const kp = KeyPair.fromRandom("ed25519");
const add = actions.addFunctionCallAccessKey(kp.getPublicKey(), state.unit, ["add_members", "revoke_member"], near(1));
const s = await sendActions(accountWithKey(owner.account_id, owner), owner.account_id, [add as ReturnType<typeof actions.functionCall>]);
step("Registrar key on the owner account (add_members, revoke_member only)", s);
if (!s.ok) process.exit(1);
saveKey(out, owner.account_id, kp);
