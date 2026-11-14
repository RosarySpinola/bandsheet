import type { Api, Release } from "./api.js";
import { type ToolOut, cellId, cellLabel, eur, findRelease, matchesCell } from "./format.js";

type Verdict = "PASS" | "FAIL" | "SKIP";
interface Check {
  id: string;
  verdict: Verdict;
  detail: string;
}
const HEX64 = /^[0-9a-f]{64}$/;

/** PASS/FAIL/SKIP list for one on-chain release record, checked against the unit's policy and DAO. */
export async function verifyRelease(api: Api, releaseId: number): Promise<ToolOut> {
  const [releases, unit, proposals] = await Promise.all([api.releases(), api.unit(), api.proposals()]);
  const r = findRelease(releases, releaseId);
  const k = unit.policy.k ?? 3;
  const checks: Check[] = [];
  const add = (id: string, ok: boolean, detail: string): void => void checks.push({ id, verdict: ok ? "PASS" : "FAIL", detail });

  add("status", ["released", "partially_released", "refused"].includes(r.status), `status is ${r.status}`);
  add("input_hash", Boolean(r.input_hash) && r.input_hash === r.input_sha256,
    "the input hash the enclave reported equals the SHA-256 the contract computed over the exact input it sent");
  add("output_hash_logged", HEX64.test(r.output_sha256 ?? ""), `contract logged SHA-256 of the exact enclave output: ${(r.output_sha256 ?? "missing").slice(0, 16)}...`);
  const small = r.cells.filter((c) => c.n < k);
  add("no_small_cells", small.length === 0, small.length ? `${small.length} published cell(s) have n < ${k}` : `every published cell has n >= ${k}`);
  const overlap = r.cells.filter((c) => r.suppressed.some((s) => cellId(s.key) === cellId(c.key)));
  add("no_overlap", overlap.length === 0, overlap.length ? `${overlap.length} cell(s) both published and withheld` : "no cell is both published and withheld");
  const bare = r.suppressed.filter((s) => !s.reason || !s.witness);
  add("witnesses", bare.length === 0, `${r.suppressed.length} withheld cell(s), each with a reason and witness`);
  add("requested_by_dao", r.requested_by === unit.dao, `requested by ${r.requested_by ?? "unknown"}; the unit's DAO is ${unit.dao}`);
  const want = JSON.stringify(r.query?.group_by ?? []);
  const voted = proposals.filter((p) => p.status === "Approved" && JSON.stringify(p.query?.group_by ?? []) === want);
  add("dao_vote", voted.length > 0, voted.length ? `DAO proposal #${voted.map((p) => p.id).join(", #")} approved the same query` : "no approved DAO proposal matches this query");

  const att = (r.proof as { attestation?: { input_hash?: string; output_hash?: string; wasm_hash?: string } } | undefined)?.attestation;
  if (att) {
    checks.push({ id: "attestation_input", verdict: att.input_hash === r.input_sha256 ? "PASS" : "FAIL", detail: "OutLayer attestation input hash vs the record's input SHA-256" });
    checks.push({ id: "attestation_output", verdict: att.output_hash === r.output_sha256 ? "PASS" : "FAIL", detail: "OutLayer attestation output hash vs the record's output SHA-256" });
    if (att.wasm_hash && unit.policy.wasm_sha256) {
      checks.push({ id: "attestation_wasm", verdict: att.wasm_hash === unit.policy.wasm_sha256 ? "PASS" : "FAIL", detail: "attested enclave build vs the wasm hash pinned in the unit policy" });
    }
  } else {
    checks.push({
      id: "attestation", verdict: "SKIP",
      detail: "this record carries no OutLayer attestation fields (proof is empty), so the TEE hashes cannot be compared here; use the OutLayer attestation by transaction hash",
    });
  }

  const failed = checks.filter((c) => c.verdict === "FAIL").length;
  const head = `Release #${releaseId}: ${failed === 0 ? "PASS" : `FAIL (${failed} check${failed > 1 ? "s" : ""})`}${checks.some((c) => c.verdict === "SKIP") ? " with skipped checks" : ""}`;
  return {
    text: [head, ...checks.map((c) => `  ${c.verdict}  ${c.id}: ${c.detail}`)].join("\n"),
    data: { release_id: releaseId, overall: failed === 0 ? "PASS" : "FAIL", checks },
  };
}

function find(r: Release, cell: string) {
  return { published: r.cells.find((c) => matchesCell(c.key, cell)), withheld: r.suppressed.find((s) => matchesCell(s.key, cell)) };
}

/** Compare what a typical n>=k tool would reveal from two releases with what Bandsheet published. */
export async function trySubtraction(api: Api, a: number, b: number, cell: string): Promise<ToolOut> {
  const releases = await api.releases();
  const ra = findRelease(releases, a);
  const rb = findRelease(releases, b);
  const fa = find(ra, cell);
  const fb = find(rb, cell);
  const label = fa.published ? cellLabel(fa.published.key) : fb.published ? cellLabel(fb.published.key) : fb.withheld ? cellLabel(fb.withheld.key) : cell;
  const lines = [`Subtracting release #${a} from release #${b}, cell ${label}.`, ""];

  const groupBy = ra.query?.group_by ?? [];
  let naiveText = "A typical tool: not reproducible here (the demo covers single-field groupings on the synthetic chapel).";
  let revealed: number | null = null;
  if (groupBy.length === 1 && groupBy[0]) {
    const demo = await api.naive(groupBy[0]).catch(() => undefined);
    const bef = demo?.before.cells.find((c) => matchesCell(c.key, cell));
    const aft = demo?.after.cells.find((c) => matchesCell(c.key, cell));
    const hit = demo?.reveals.find((x) => matchesCell(x.key, cell));
    if (bef && aft && fa.published && bef.n === fa.published.n && bef.mean_eur === fa.published.mean_eur) {
      naiveText = hit
        ? `A typical n>=3 tool would publish ${label} in both releases: #${a} n=${bef.n}, mean ${eur(bef.mean_eur)}; #${b} n=${aft.n}, mean ${eur(aft.mean_eur)}. Then ${hit.equation} = ${eur(hit.revealed_eur)}: exactly one member's salary. (Computed on the synthetic seed chapel, whose release #${a} matches the chain.)`
        : `A typical tool would publish ${label} in both releases, but the two cannot be subtracted to one person here.`;
      revealed = hit?.revealed_eur ?? null;
    } else if (bef && fa.published) {
      naiveText = "A typical tool: the synthetic demo data does not match this chain's release, so no honest reproduction is possible.";
    }
  }
  lines.push(naiveText, "");

  if (fb.published && fa.published) {
    const d = fb.published.n * fb.published.mean_eur - fa.published.n * fa.published.mean_eur;
    lines.push(`Bandsheet published ${label} in BOTH releases (n=${fa.published.n} then n=${fb.published.n}); the difference is ${eur(d)}${Math.abs(fb.published.n - fa.published.n) === 1 ? ", so this pair does leak one member's pay" : ", spread over several members"}.`);
  } else if (fb.withheld) {
    lines.push(`Bandsheet: release #${a} published ${label}${fa.published ? ` (n=${fa.published.n}, mean ${eur(fa.published.mean_eur)})` : ""}; release #${b} WITHHELD it [${fb.withheld.reason}]. Witness: "${fb.withheld.witness}". Nothing to subtract, nothing revealed.`);
  } else if (fa.withheld && !fb.withheld) {
    lines.push(`Bandsheet: release #${a} withheld ${label}; release #${b} ${fb.published ? "published it" : "has no such cell"}. A difference needs two published values, so there is none.`);
  } else {
    lines.push(`Bandsheet: no cell matching "${cell}" was published in release #${a} or #${b}.`);
  }
  return { text: lines.join("\n"), data: { release_a: a, release_b: b, cell: label, naive_revealed_eur: revealed, bandsheet_withheld: Boolean(fb.withheld), bandsheet_published_both: Boolean(fa.published && fb.published) } };
}

export async function payContext(api: Api, country: string, isco = "OC2"): Promise<ToolOut> {
  const c = await api.context(country.toUpperCase(), isco);
  const gap = c.female_vs_male_pct !== null && c.by_sex.male && c.by_sex.female
    ? ` Women's median is ${eur(c.by_sex.female)} against ${eur(c.by_sex.male)} for men (${c.female_vs_male_pct}%).` : "";
  return {
    text: [
      `${c.country_name}, ${c.isco_label} (ISCO-08 ${c.isco08}): median gross monthly earnings ${eur(c.median_monthly_eur)} (${c.unit}), survey year ${c.year}.${gap}`,
      `Source: Eurostat Structure of Earnings Survey, dataset earn_ses_monthly (${c.source_url}). Data source this call: ${c.data_source}. Snapshot sha256 ${c.snapshot_sha256.slice(0, 16)}...`,
      c.caveat,
    ].join("\n"),
    data: { ...c },
  };
}
