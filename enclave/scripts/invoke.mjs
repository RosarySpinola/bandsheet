// Calls OutLayer on TESTNET exactly the way the Bandsheet contract must: request_execution on
// outlayer.testnet with a Project source, the project's secret, response_format Json.
//
//   node enclave/scripts/invoke.mjs --input <file|-> [--out result.json] [--account bandsheet-enclave.testnet]
//        [--project bandsheet-enclave.testnet/bandsheet-enclave] [--deposit-near 0.05] [--gas-tera 200]
//
// Prints the tx hash and writes the contract-visible result (the guest's JSON output) to --out.
// Refuses any non-testnet account or RPC. The key is read from keys/<account>.json, never printed.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, "../../packages/core/package.json"));
const { Account, JsonRpcProvider, teraToGas, nearToYocto } = await import(require.resolve("near-api-js"));

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith("--") ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const accountId = args.account ?? "bandsheet-enclave.testnet";
const project = args.project ?? "bandsheet-enclave.testnet/bandsheet-enclave";
const rpc = args.rpc ?? "https://test.rpc.fastnear.com";
if (!accountId.endsWith(".testnet") || /mainnet|^https:\/\/(rpc\.)?mainnet|\/\/rpc\.near\.org/.test(rpc) || !args.input) {
  console.error("testnet accounts/RPC only; --input required");
  process.exit(2);
}
const input = args.input === "-" ? readFileSync(0, "utf8") : readFileSync(args.input, "utf8");
JSON.parse(input); // fail early on bad JSON
const keyFile = JSON.parse(readFileSync(join(here, "../../keys", `${accountId}.json`), "utf8"));
const account = new Account(accountId, new JsonRpcProvider({ url: rpc }), keyFile.private_key ?? keyFile.secret_key);

const request = {
  source: { Project: { project_id: project, version_key: null } },
  resource_limits: { max_instructions: 2_000_000_000, max_memory_mb: 128, max_execution_seconds: 60 },
  input_data: input,
  secrets_ref: { profile: "default", account_id: project.split("/")[0] },
  response_format: "Json",
  payer_account_id: null,
  params: null,
};
const res = await account.callFunctionRaw({
  contractId: "outlayer.testnet",
  methodName: "request_execution",
  args: request,
  gas: teraToGas(args["gas-tera"] ?? 200),
  deposit: nearToYocto(args["deposit-near"] ?? "0.05"),
  waitUntil: "FINAL",
});
const ok = res.status?.SuccessValue !== undefined;
console.error(`tx ${res.transaction.hash} ${ok ? "ok" : "FAILED"}`);
if (!ok) {
  console.error(JSON.stringify(res.status).slice(0, 600));
  process.exit(1);
}
const raw = Buffer.from(res.status.SuccessValue, "base64").toString("utf8");
const out = args.out ?? "-";
if (out === "-") process.stdout.write(raw + "\n");
else writeFileSync(out, raw + "\n");
console.error(`tx_hash=${res.transaction.hash} result_bytes=${raw.length}`);
