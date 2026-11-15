// Optional: `pnpm verify --units` adds checks of the units contract (start your own unit). The 19 judged checks are
// unchanged and run without this flag.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { base58ToHex, sha256Hex, viewAccount, viewCall } from "./lib.mjs";

const line = (id, ok, text) => ({ id, ok, text });

export async function checkUnits(root, docs) {
  const p = join(root, "scripts/units-deployed.json");
  if (!existsSync(p)) return [line("u1", false, "scripts/units-deployed.json is missing (units contract not deployed)")];
  const d = JSON.parse(readFileSync(p, "utf8"));
  const acct = await viewAccount(d.contract);
  const chain = base58ToHex(acct.code_hash);
  const wasm = join(root, "contracts/units/out/bandsheet_units.wasm");
  const local = existsSync(wasm) ? sha256Hex(readFileSync(wasm)) : null;
  const policy = await viewCall(d.contract, "get_policy");
  const src = JSON.parse(policy.outlayer.source);
  return [
    line("u1", chain === d.code_sha256 && (local === null || local === chain), `units contract ${d.contract} code ${chain.slice(0, 12)}... equals units-deployed.json${local ? " and the local build" : ""}`),
    line("u2", policy.wasm_sha256 === docs.engine && policy.enclave_pubkey === docs.pubB64, "same engine build and enclave key as the demo chapel (enclave/README.md)"),
    line("u3", src.Project?.project_id === "bandsheet-enclave.testnet/bandsheet-enclave" && src.Project?.version_key === docs.engine, "OutLayer source is the same project, pinned to that build"),
    line("u4", policy.registrar === d.registrar, `registrar is ${d.registrar} (the only caller of the member and issuer methods)`),
  ];
}
