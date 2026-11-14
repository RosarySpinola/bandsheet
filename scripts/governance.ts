// DAO governance beats for the DKIM integration. Each command is a Sputnik proposal voted by council seats 1 and 2.
//   tsx governance.ts trust-issuer      "Trust Harbour Courier payroll's DKIM key" -> add_issuer (key from fixtures/dkim/issuer.json)
//   tsx governance.ts require-dkim      set_require_dkim(true)
//   tsx governance.ts set-engine <wasm_sha256> [enclave_pubkey_b64]   announce a rebuilt engine (and its key)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { callKind, runProposal } from "./dao";
import { loadState, ROOT, say, step, view } from "./lib";

const LOG = `${ROOT}/scripts/demo-log.json`;
const note = (stage: string, links: string[]) => {
  const log: Record<string, string[]> = existsSync(LOG) ? JSON.parse(readFileSync(LOG, "utf8")) : {};
  log[stage] = [...(log[stage] ?? []), ...links];
  writeFileSync(LOG, JSON.stringify(log, null, 2) + "\n");
};

const [cmd, a, b] = process.argv.slice(2);
const st = loadState();
if (cmd === "trust-issuer") {
  const iss = JSON.parse(readFileSync(`${ROOT}/fixtures/dkim/issuer.json`, "utf8")) as { domain: string; selector: string; rsa_pubkey_spki_b64: string };
  const r = await runProposal(
    callKind(st.unit, "add_issuer", { domain: iss.domain, selector: iss.selector, rsa_pubkey_spki_b64: iss.rsa_pubkey_spki_b64 }),
    "Trust Harbour Courier payroll's DKIM key",
  );
  note("dao_trust_issuer", r.links);
  say(`issuers on chain: ${JSON.stringify((await view<{ domain: string; selector: string }[]>(st.unit, "get_issuers")).map((i) => `${i.selector}._domainkey.${i.domain}`))}`);
} else if (cmd === "require-dkim") {
  const r = await runProposal(callKind(st.unit, "set_require_dkim", { on: true }), "Count only payslips that carry a verified employer email (require DKIM)");
  note("dao_require_dkim", r.links);
  say(`require_dkim on chain: ${await view<boolean>(st.unit, "get_require_dkim")}`);
} else if (cmd === "set-engine" && a) {
  const args: Record<string, unknown> = { wasm_sha256: a };
  if (b) args.enclave_pubkey = b;
  const r = await runProposal(callKind(st.unit, "set_engine", args), `Adopt the rebuilt engine ${a.slice(0, 12)}...`);
  note("dao_set_engine", r.links);
  const p = await view<{ policy: { wasm_sha256: string; enclave_pubkey: string } }>(st.unit, "get_policy");
  say(`policy now: wasm ${p.policy.wasm_sha256.slice(0, 16)}... key ${p.policy.enclave_pubkey.slice(0, 12)}...`);
} else {
  step("usage: tsx governance.ts trust-issuer | require-dkim | set-engine <wasm_sha256> [enclave_pubkey_b64]");
}
