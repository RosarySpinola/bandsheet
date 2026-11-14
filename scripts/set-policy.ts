// Update the enclave public key / wasm hash in the policy (owner only; allowed only before the first release).
// Usage: tsx set-policy.ts <enclave_pubkey hex|base64> <wasm_sha256> [k=3]
import { accountWithKey, callTx, loadState, ownerKeyFile, step, view } from "./lib";

const [pub, wasm, k = "3"] = process.argv.slice(2);
if (!pub || !wasm) { process.stderr.write("usage: tsx set-policy.ts <enclave_pubkey> <wasm_sha256> [k]\n"); process.exit(1); }
const st = loadState();
const cur = await view<{ policy: { policy_hash: string } }>(st.unit, "get_policy");
const owner = ownerKeyFile();
const s = await callTx(accountWithKey(owner.account_id, owner), st.unit, "set_policy",
  { k: Number(k), enclave_pubkey: pub, wasm_sha256: wasm, policy_hash: cur.policy.policy_hash }, 30);
step("Policy updated", s);
if (!s.ok) process.exit(1);
