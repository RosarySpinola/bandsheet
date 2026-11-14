// Redeploy the bandsheet wasm on the union account (state is kept; needs the union's full-access key,
// which exists until seal.ts runs). Usage: tsx upgrade.ts
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { actions } from "near-api-js";
import { account, loadState, saveState, say, sendActions, step, WASM } from "./lib";

const st = loadState();
const wasm = readFileSync(`${WASM}/bandsheet.wasm`);
const s = await sendActions(account(st.unit), st.unit, [actions.deployContract(wasm)]);
step(`Redeployed bandsheet on ${st.unit}`, s);
if (!s.ok) process.exit(1);
saveState({ wasm_sha256: createHash("sha256").update(wasm).digest("hex"), unit_upgrade_tx: s.hash });
say(`wasm sha256 ${createHash("sha256").update(wasm).digest("hex")}`);
