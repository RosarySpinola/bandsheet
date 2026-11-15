// Deploy the units contract (contracts/units/out/bandsheet_units.wasm) to its own new account, deploy + init in ONE
// transaction (init is private, so nobody can front-run it), then give the registrar account a function-call key
// limited to unit_add_member / unit_remove_member / unit_add_issuer (keys/units-registrar.json, the server's key).
// The judged demo contract and DAO are not touched. TESTNET ONLY.
// Usage: scripts/run.sh units-deploy.ts            (accounts must exist: see faucet-account.ts)
//        scripts/run.sh units-deploy.ts --upgrade  redeploy the code only (state layout unchanged), no init
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KeyPair, actions, teraToGas } from "near-api-js";
import { KEYS, ROOT, account, balanceNear, exists, near, saveKey, say, sendActions, step, view } from "./lib";
import { ENGINE_SHA, PROJECT, REGISTRAR, SECRETS_REF, SPONSOR, STATE, UNITS, source } from "./units-lib";
const WASM = join(ROOT, "contracts/units/out/bandsheet_units.wasm");
type Act = ReturnType<typeof actions.functionCall>;

{
  for (const id of [UNITS, REGISTRAR, SPONSOR]) {
    if (!(await exists(id))) throw new Error(`${id} does not exist yet`);
    say(`${id}: ${await balanceNear(id)} NEAR`);
  }
  const demo = await view<{ policy: { enclave_pubkey: string; wasm_sha256: string; policy_hash: string; k: number } }>("bandsheet-3f36b7.testnet", "get_policy");
  if (demo.policy.wasm_sha256 !== ENGINE_SHA) throw new Error("the demo policy pins a different engine; stop");
  const code = readFileSync(WASM);
  const codeHash = createHash("sha256").update(code).digest("hex");
  const state: Record<string, unknown> = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
  const init = {
    owner: REGISTRAR,
    k: demo.policy.k,
    enclave_pubkey: demo.policy.enclave_pubkey,
    wasm_sha256: ENGINE_SHA,
    policy_hash: demo.policy.policy_hash,
    outlayer: {
      account: "outlayer.testnet",
      source: JSON.stringify(source(true)),
      secrets_ref: JSON.stringify(SECRETS_REF),
      run_deposit: (near(0.05)).toString(),
    },
  };
  const upgrade = process.argv.includes("--upgrade");
  const s = await sendActions(account(UNITS), UNITS, upgrade ? [actions.deployContract(code) as Act] : [
    actions.deployContract(code) as Act,
    actions.functionCall("new", init, teraToGas(100), 0n),
  ]);
  step(`${upgrade ? "Upgrade to" : "Deploy"} ${codeHash.slice(0, 16)}...${upgrade ? "" : " and init (one transaction)"} on ${UNITS}`, s);
  if (!s.ok) process.exit(1);
  const policy = await view<{ registrar: string; enclave_pubkey: string; wasm_sha256: string; outlayer: { source: string } }>(UNITS, "get_policy");
  say(`registrar ${policy.registrar}, enclave key ${policy.enclave_pubkey}, engine ${policy.wasm_sha256.slice(0, 12)}..., source ${policy.outlayer.source}`);

  const regFile = join(KEYS, "units-registrar.json");
  let regTx = state.registrar_key_tx as string | undefined;
  if (!existsSync(regFile)) {
    const kp = KeyPair.fromRandom("ed25519");
    const add = actions.addFunctionCallAccessKey(kp.getPublicKey(), UNITS, ["unit_add_member", "unit_remove_member", "unit_add_issuer"], near(1));
    const r = await sendActions(account(REGISTRAR), REGISTRAR, [add as Act]);
    step(`Registrar key on ${REGISTRAR} (unit_add_member, unit_remove_member, unit_add_issuer only)`, r);
    if (!r.ok) process.exit(1);
    saveKey(regFile, REGISTRAR, kp);
    regTx = r.hash;
  }
  writeFileSync(
    STATE,
    JSON.stringify({ ...state, ...(upgrade ? { upgrades: [...((state.upgrades as unknown[]) ?? []), { tx: s.hash, code_sha256: codeHash, at: new Date().toISOString() }] } : { deploy_tx: s.hash }), contract: UNITS, registrar: REGISTRAR, sponsor: SPONSOR, code_sha256: codeHash, registrar_key_tx: regTx,
      outlayer_project: PROJECT, engine_sha256: ENGINE_SHA, deployed_at: new Date().toISOString() }, null, 2) + "\n",
  );
  say(`wrote ${STATE}`);
}
