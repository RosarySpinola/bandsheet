// OPTIONAL, TESTNET ONLY stand-in for outlayer.testnet, to exercise the chain path (DAO vote -> contract ->
// callback -> record) before the real enclave is live. Its answers are canned: it proves the contract plumbing,
// not the audit. The real demo points the union at outlayer.testnet with set-outlayer.ts.
// Usage: tsx mock-outlayer.ts deploy | push '<enclave output json>'
import { readFileSync } from "node:fs";
import { actions } from "near-api-js";
import { account, accountWithKey, callTx, exists, keyPath, loadState, near, ownerKeyFile, saveKey, saveState, say, sendActions, step, WASM } from "./lib";
import { KeyPair } from "near-api-js";

const st = loadState();
const id = `bs-mock-${st.run}.testnet`;
const cmd = process.argv[2];
if (cmd === "deploy") {
  if (!(await exists(id))) {
    const f = saveKey(keyPath(id), id, KeyPair.fromRandom("ed25519"));
    const owner = ownerKeyFile();
    const s = await callTx(accountWithKey(owner.account_id, owner), "testnet", "create_account", { new_account_id: id, new_public_key: f.public_key }, 60, near(1.5));
    step(`Created ${id}`, s);
  }
  const s = await sendActions(account(id), id, [actions.deployContract(readFileSync(`${WASM}/mock_outlayer.wasm`)), actions.functionCall("new", {}, 30n * 10n ** 12n, 0n)]);
  step(`Deployed mock OutLayer to ${id}`, s);
  saveState({ mockOutlayer: id });
} else if (cmd === "push") {
  JSON.parse(process.argv[3]!);
  const s = await callTx(account(id), id, "push_response", { response: process.argv[3] }, 30);
  step("Mock response queued", s);
} else { say("usage: tsx mock-outlayer.ts deploy | push '<json>'"); }
