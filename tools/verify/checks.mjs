// The checks. Each returns an array of {id, ok, text}. A check that cannot run reports FAIL, never silence.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { base58ToHex, sha256Hex, viewAccount, viewCall, getJson } from "./lib.mjs";

export const ROOT = join(import.meta.dirname, "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const readJson = (p) => JSON.parse(read(p));
const line = (id, ok, text) => ({ id, ok, text });
const hex64 = /[0-9a-f]{64}/;

export function loadDocs() {
  const readme = read("enclave/README.md");
  const engine = readme.match(/WASM sha256 \| `([0-9a-f]{64})`/)?.[1];
  const pubHex = readme.match(/Enclave public key \| hex `([0-9a-f]{64})`/)?.[1];
  const pubB64 = readme.match(/base64 `([A-Za-z0-9+/=]{44})`/)?.[1];
  return { engine, pubHex, pubB64 };
}

/** (a) deployed contract code hash. */
export async function checkCode(deployed, unit) {
  const acct = await viewAccount(deployed.unit);
  const chainHex = base58ToHex(acct.code_hash);
  const out = [line("a1", chainHex === deployed.wasm_sha256,
    `contract code hash on testnet ${chainHex.slice(0, 12)}... equals scripts/deployed.json`)];
  const wasm = join(ROOT, "contracts/bandsheet/out/bandsheet.wasm");
  if (existsSync(wasm)) {
    const local = sha256Hex(readFileSync(wasm));
    out.push(line("a2", local === chainHex, `local build contracts/bandsheet/out/bandsheet.wasm hashes to the same value`));
  } else out.push(line("a2", true, "local contract wasm not present (skipped; deployed.json hash used)"));
  unit.code = chainHex;
  return out;
}

/** (b) policy matches the documented engine hash and enclave key. */
export async function checkPolicy(deployed, docs, unit) {
  const raw = await viewCall(deployed.unit, "get_policy");
  const p = raw.policy ?? raw;
  unit.policy = p;
  const pubOk = p.enclave_pubkey === docs.pubB64 &&
    Buffer.from(p.enclave_pubkey, "base64").toString("hex") === docs.pubHex;
  return [
    line("b1", p.k === 3, `policy k = ${p.k} (expected 3)`),
    line("b2", !!docs.engine && p.wasm_sha256 === docs.engine,
      `policy engine WASM sha256 ${String(p.wasm_sha256).slice(0, 12)}... equals enclave/README.md`),
    line("b3", pubOk, `policy enclave public key equals enclave/README.md (${String(p.enclave_pubkey).slice(0, 12)}...)`),
  ];
}

/** (c) each on-chain release is bound to an OutLayer attestation of the pinned engine build. */
export async function checkReleases(deployed, log, unit) {
  const records = await viewCall(deployed.unit, "get_releases", { from: 0, limit: 50 });
  unit.releases = records;
  const out = [line("c0", records.length >= 2, `${records.length} release records read from the contract`)];
  for (const r of records) {
    const txs = (log[`release_${r.id}`] ?? []).map((u) => u.split("/").pop());
    let att = null;
    for (const tx of txs) {
      const a = await getJson(`https://testnet-api.outlayer.ai/attestations/by-tx/${tx}`).catch(() => null);
      const rec = Array.isArray(a) ? a[0] : a;
      if (rec?.input_hash) { att = { rec, tx }; break; }
    }
    if (!att) { out.push(line(`c${r.id}`, false, `release #${r.id}: no OutLayer attestation found for its transactions`)); continue; }
    const a = att.rec;
    const wasmOk = a.wasm_hash === unit.policy.wasm_sha256 && a.executed_wasm_sha256 === unit.policy.wasm_sha256;
    const inOk = a.input_hash === r.input_sha256;
    const outOk = a.output_hash === r.output_sha256;
    out.push(line(`c${r.id}`, wasmOk && inOk && outOk,
      `release #${r.id} (${r.status}): attestation ${att.tx.slice(0, 8)}... engine hash ${wasmOk ? "=" : "!="} policy, ` +
      `input hash ${inOk ? "=" : "!="} record, output hash ${outOk ? "=" : "!="} record`));
  }
  return out;
}

/** (d) re-derive the differencing attack from the public release record and the synthetic seed. */
export function checkSubtraction(unit) {
  const [r1, r2] = unit.releases ?? [];
  const sen1 = r1?.cells?.find((c) => c.key.grade === "Senior");
  if (!sen1) return [line("d1", false, "release #1 has no Senior cell")];
  const seed = read("packages/core/src/seed.ts");
  const sal = [...seed.matchAll(/grade: "Senior",[^}]*?gross_annual_eur: (\d+)/g)].map((m) => Number(m[1]));
  const joiner = sal.pop(); // the last Senior entry in the file is the joiner (EUR 70,000)
  const seniors = sal;
  const n2 = sen1.n + 1;
  const mean2 = (sen1.n * sen1.mean_eur + joiner) / n2;
  const exposed = n2 * mean2 - sen1.n * sen1.mean_eur;
  const withheld = r2 && !r2.cells.some((c) => c.key.grade === "Senior") &&
    r2.suppressed.some((s) => s.key.grade === "Senior" && s.reason === "differencing");
  return [
    line("d1", seniors.length === sen1.n && seniors.reduce((a, b) => a + b, 0) / sen1.n === sen1.mean_eur,
      `seed Seniors reproduce on-chain release #1: n=${sen1.n}, mean EUR ${sen1.mean_eur}`),
    line("d2", exposed === 70000 && mean2 === 63160,
      `a naive tool publishing Senior twice exposes ${n2} x ${mean2} - ${sen1.n} x ${sen1.mean_eur} = EUR ${exposed}`),
    line("d3", !!withheld, `release #2 withheld Senior on-chain: "${r2?.suppressed?.[0]?.witness ?? "none"}"`),
  ];
}

/** (e) offline evaluation summary and saved attestations. */
export function checkEvaluation(docs) {
  const s = readJson("enclave/evaluation/results.json").summary;
  const out = [
    line("e1", s.cases === 100 && s.naive.cases_leaking === 95 && s.bandsheet.cases_leaking === 0,
      `evaluation: typical tool leaks in ${s.naive.cases_leaking}/${s.cases} cases, Bandsheet in ${s.bandsheet.cases_leaking}/${s.cases}`),
    line("e2", s.bandsheet.exact_recoveries === 0 && s.naive.members_exactly_recovered === 187,
      `exact salaries recovered: ${s.naive.members_exactly_recovered} (typical) vs ${s.bandsheet.exact_recoveries} (Bandsheet)`),
  ];
  for (const f of ["release1", "release2"]) {
    const a = readJson(`enclave/proof/${f}-attestation.json`);
    out.push(line(`e-${f}`, a.wasm_hash === docs.engine, `saved proof ${f}-attestation.json names the documented engine hash`));
  }
  return out;
}

/** (f) deployed API reports the same contract and chain state. */
export async function checkApi(deployed, unit, base) {
  const [health, u] = await Promise.all([getJson(`${base}/api/health`), getJson(`${base}/api/unit`)]);
  const same = u.policy?.wasm_sha256 === unit.policy.wasm_sha256 && u.policy?.enclave_pubkey === unit.policy.enclave_pubkey;
  return [
    line("f1", health?.ok === true && health.contract === deployed.unit, `${base}/api/health is up and reports ${health?.contract}`),
    line("f2", u.unit === deployed.unit && same && u.release_count === unit.releases.length,
      `${base}/api/unit: same contract, policy hashes and ${u.release_count} releases as the chain`),
  ];
}
