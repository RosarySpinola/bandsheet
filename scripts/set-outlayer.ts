// Point the union at an OutLayer account and program (owner only). Keeps the OutLayer call adjustable without a redeploy.
// Usage: tsx set-outlayer.ts '<source json>' ['<secrets_ref json>' | ''] [run_deposit_near=0.02] [outlayer_account]
//   source examples: '{"Project":{"project_id":"owner.testnet/bandsheet","version_key":null}}'
//                    '{"WasmUrl":{"url":"https://...","hash":"<sha256>","build_target":"wasm32-wasip2"}}'
//   Use outlayer_account=<mock account from mock-outlayer.ts> to run the chain path without the enclave.
import { accountWithKey, callTx, loadState, near, ownerKeyFile, say, step } from "./lib";

const [source, secrets = "", dep = "0.02", ol] = process.argv.slice(2);
if (!source) { process.stderr.write("usage: tsx set-outlayer.ts '<source json>' ['<secrets_ref json>'] [run_deposit_near] [outlayer_account]\n"); process.exit(1); }
JSON.parse(source); if (secrets) JSON.parse(secrets);
const st = loadState();
const owner = ownerKeyFile();
const s = await callTx(accountWithKey(owner.account_id, owner), st.unit, "set_outlayer",
  { account: ol ?? st.outlayer, source, secrets_ref: secrets, run_deposit: near(dep).toString() }, 60);
step(`OutLayer set to ${ol ?? st.outlayer}`, s);
say(`source ${source}`);
if (!s.ok) process.exit(1);
