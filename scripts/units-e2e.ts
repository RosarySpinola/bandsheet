// Live end-to-end run of "start your own unit" on TESTNET, through the real server code (createApp, in process)
// and the deployed units contract: sponsor a fresh wallet, create a unit, add a second seat, join with NEP-413, submit a
// sealed self-attested entry, add 4 synthetic colleagues, record the employer's DKIM key (DNS first, then the supplied-key
// seam for the fictional domain), submit a DKIM-signed payslip entry, propose, vote, let the real OutLayer engine run, and
// read the release back. Every tx hash goes to scripts/units-e2e.json. Keys are read from keys/ and never printed.
// Usage: scripts/run.sh units-e2e.ts                 full run on a new unit
//        scripts/run.sh units-e2e.ts --continue <id>   on an existing unit: sponsor, 4 synthetic colleagues, propose, vote, read
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KeyPair, KeyPairSigner, type KeyPairString } from "near-api-js";
import { encryptUnitEntry, newUnitInvite, parseEnclavePublicKey, slotIdFromNearPublicKey } from "../packages/core/src/index";
import { TESTNET_RPCS, generateMemberKey, signSubmitTx } from "../packages/core/src/near";
import { createApp } from "../server/src/app";
import { createKeyLookup } from "../server/src/auth/keys";
import { createBroadcast } from "../server/src/auth/posting";
import { loadChainConfig } from "../server/src/chain/config";
import { createChainPort } from "../server/src/chain/port";
import type { Deps } from "../server/src/deps";
import { getConfig } from "../server/src/env";
import { SpendGuard } from "../server/src/spend";
import { createUnitsChain } from "../server/src/units/chain";
import { loadUnitsConfig } from "../server/src/units/config";
import { MemoryUnitStore } from "../server/src/units/store";
import { ROOT, account, callTx, keyPath, readKey, sleep, txLink, view } from "./lib";
import { UNITS, WALLET, WALLET2 } from "./units-lib";

const log: { step: string; tx?: string; link?: string; ok: boolean; detail?: unknown }[] = [];
const record = (step: string, ok: boolean, tx?: string, detail?: unknown) => {
  log.push({ step, ok, tx, link: tx ? txLink(tx) : undefined, detail });
  process.stdout.write(`\n== ${step}\n   ${ok ? "ok" : "REFUSED"}${tx ? `\n   ${txLink(tx)}` : ""}${detail ? `\n   ${JSON.stringify(detail).slice(0, 400)}` : ""}\n`);
};
const CONT = process.argv.includes("--continue") ? Number(process.argv[process.argv.indexOf("--continue") + 1]) : undefined;
const OUT = join(ROOT, `scripts/units-e2e${CONT ? `-continue-${CONT}` : ""}.json`);
const save = () => writeFileSync(OUT, JSON.stringify({ run_at: new Date().toISOString(), contract: UNITS, steps: log }, null, 2) + "\n");

// ---- the server, in process, wired to testnet exactly as the Pages worker is ----
process.env.UNITS_CONTRACT = UNITS;
const ucfg = loadUnitsConfig();
if (!ucfg.registrar || !ucfg.sponsor) throw new Error("keys/units-registrar.json or the sponsor key is missing");
const config = getConfig();
const deps: Deps = {
  config, guard: new SpendGuard({ path: config.ledgerPath, getPrice: async () => ({ prompt: 0, completion: 0 }) }),
  chat: async () => { throw new Error("no AI in this run"); }, view: async () => [], chain: createChainPort(), chainCfg: loadChainConfig(),
  units: { cfg: ucfg, chain: createUnitsChain(UNITS), store: new MemoryUnitStore(), keys: createKeyLookup(), broadcast: createBroadcast(TESTNET_RPCS) },
};
const app = createApp(deps);
let ipN = 1;
async function api(path: string, body?: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await app.request(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.77.0.${ipN++}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}
const txOf = (b: Record<string, unknown>, k = "tx") => (b[k] as { hash?: string } | undefined)?.hash;

/** A wallet's NEP-413 signMessage over a unit statement, with a server-issued nonce. */
async function claim(accountId: string, purpose: string, message: string) {
  const nonce = String((await api("/units/nonce", { purpose })).body.nonce);
  const kp = KeyPair.fromString(readKey(keyPath(accountId)).private_key as KeyPairString);
  const s = await new KeyPairSigner(kp).signNep413Message(accountId, { message, recipient: UNITS, nonce: Uint8Array.from(Buffer.from(nonce, "base64url")) });
  return { scheme: "nep413", account_id: accountId, public_key: kp.getPublicKey().toString(), signature: Buffer.from(s.signature).toString("base64"), nonce };
}

async function joinAndSubmit(who: string, unit: number, secret: string, entry: { grade: "Senior"; gross_annual_eur: number; eml?: Buffer }, label: string) {
  const mk = generateMemberKey();
  const j = await api(`/units/${unit}/join`, { ...(await claim(who, "unit_join", `Bandsheet join unit ${unit}: ${mk.publicKey}`)), member_public_key: mk.publicKey, invite_code: secret });
  record(`${label}: ${who} joins unit ${unit} with NEP-413 (registrar adds the posting key; no wallet on chain)`, j.status === 200, txOf(j.body), j.status === 200 ? { slot: j.body.slot } : j.body);
  if (j.status !== 200) throw new Error("join failed");
  const policy = await view<{ enclave_pubkey: string }>(UNITS, "get_policy");
  const ct = encryptUnitEntry(parseEnclavePublicKey(policy.enclave_pubkey), {
    slot: slotIdFromNearPublicKey(mk.publicKey), gross_annual_eur: entry.gross_annual_eur, grade: entry.grade, gender: "F", site: "City",
    submitted_at: Math.floor(Date.now() / 1000), ...(entry.eml ? { eml_b64: entry.eml.toString("base64") } : {}),
  });
  const invite = { accountId: UNITS, contractId: UNITS, privateKey: mk.privateKey, publicKey: mk.publicKey, slot: mk.slot, rpcUrl: TESTNET_RPCS[0]! };
  await sleep(3000); // the new access key must be visible to the RPC that builds the transaction
  const { signedTxB64, ctText } = await signSubmitTx(invite, ct);
  const sha = (await import("node:crypto")).createHash("sha256").update(ctText).digest("hex");
  const e = await api(`/units/${unit}/entry`, { ...(await claim(who, "unit_entry", `Bandsheet unit ${unit} entry: ${sha}`)), signed_tx: signedTxB64 });
  record(`${label}: sealed entry submitted by the posting key, bound to ${who} in the server store only`, e.status === 200, txOf(e.body), e.status === 200 ? { entry_count: e.body.entry_count } : e.body);
  if (e.status !== 200) throw new Error("entry failed");
}

try {
  // 0. gas sponsorship for a brand-new wallet (an implicit account with 0 NEAR)
  const fresh = KeyPair.fromRandom("ed25519");
  const implicit = Buffer.from(fresh.getPublicKey().data).toString("hex");
  const sp = await api("/sponsor", { account_id: implicit });
  record("Sponsor: a fresh implicit wallet with 0 NEAR gets 0.05 testnet NEAR once", sp.body.funded === true, txOf(sp.body), { balance: sp.body.balance });
  const sp2 = await api("/sponsor", { account_id: implicit });
  record("Sponsor: the same wallet asking again is not paid twice", sp2.body.funded === false, undefined, { reason: sp2.body.reason });

  let unit = CONT ?? 0;
  if (CONT === undefined) {
  // 1. create (a real wallet transaction), then a second council seat
  const invite = newUnitInvite();
  const c = await callTx(account(WALLET), UNITS, "create_unit", { name: "Harbour Courier night desk (E2E)", invite_code_hash: invite.hash, dkim_domains: ["harbourcourier.example"] }, 50);
  unit = Number(c.value);
  record(`create_unit by ${WALLET} (seat 1) -> unit ${unit}`, c.ok, c.hash, { unit_id: unit });
  if (!c.ok) throw new Error(c.error);
  const a = await callTx(account(WALLET), UNITS, "unit_add_council", { unit_id: unit, account_id: WALLET2 }, 30);
  record(`unit_add_council ${WALLET2} -> ${a.value}`, a.ok, a.hash);

  // 2. join + a self-attested sealed entry (a generated payslip would be this)
  await joinAndSubmit(WALLET, unit, invite.secret, { grade: "Senior", gross_annual_eur: 58_400 }, "Member 1");
  }

  // 3. four synthetic colleagues (council-signed)
  const syn = await api(`/units/${unit}/synthetic`, { ...(await claim(WALLET, "unit_synthetic", `Bandsheet synthetic ${unit}: 4`)), n: 4, grade: "Senior" });
  record("Synthetic colleagues: 4 flagged keys added by the registrar, each submits one sealed sample entry", syn.status === 200 && syn.body.submitted === 4, txOf(syn.body, "add_tx"),
    { submitted: syn.body.submitted, txs: (syn.body.txs as { hash: string }[] | undefined)?.map((t) => t.hash) });
  for (const t of (syn.body.add_txs as { hash: string }[] | undefined) ?? []) log.push({ step: "synthetic unit_add_member (registrar, flagged synthetic)", ok: true, tx: t.hash, link: txLink(t.hash) });
  for (const t of (syn.body.txs as { hash: string }[] | undefined) ?? []) log.push({ step: "synthetic submit (single-use posting key)", ok: true, tx: t.hash, link: txLink(t.hash) });

  if (CONT === undefined) {
  // 4. employer DKIM key: DNS first (the fictional domain has no record), then the supplied-key seam
  const eml = readFileSync(join(ROOT, "fixtures/dkim/emails/noor-haddad.eml"));
  const dns = await api(`/units/${unit}/issuer`, { eml: eml.toString("utf8") });
  record("Issuer over DNS-over-HTTPS for harbourcourier.example (fictional: expected DNS_NO_KEY)", dns.body.code === "DNS_NO_KEY", undefined, dns.body);
  const issuer = JSON.parse(readFileSync(join(ROOT, "fixtures/dkim/issuer.json"), "utf8")) as { rsa_pubkey_spki_b64: string };
  const sup = await api(`/units/${unit}/issuer`, {
    eml: eml.toString("utf8"), supplied_key: issuer.rsa_pubkey_spki_b64,
    claim: await claim(WALLET, "unit_issuer", `Bandsheet issuer ${unit}: harbourcourier.example payroll2026`),
  });
  record("Issuer key supplied by a council member for the listed domain (recorded as 'supplied', not DNS)", sup.status === 200, txOf(sup.body), { source: sup.body.source, key_sha256: sup.body.key_sha256 });

  // 5. a second real member submits the DKIM-signed payslip email (Senior, EUR 5,833.33 a month)
  await joinAndSubmit(WALLET2, unit, invite.secret, { grade: "Senior", gross_annual_eur: 70_000, eml }, "Member 2 (DKIM)");
  }

  const before = (await view<{ releases: number }>(UNITS, "get_unit", { unit_id: unit })).releases;
  // 6. propose (1 of 2 seats: open), vote (2 of 2: approved) with cheap 30 Tgas wallet calls, then the server's /run
  //    relays the 300 Tgas unit_run from the sponsor, so a sponsored wallet with 0.05 NEAR can do all of it
  const p = await callTx(account(WALLET), UNITS, "unit_propose_release", { unit_id: unit, query: JSON.stringify({ group_by: ["grade"] }) }, 30).catch((e) => ({ ok: false, hash: "", value: undefined, error: String(e) }));
  record(`unit_propose_release by ${WALLET} (30 Tgas) -> proposal ${p.value}`, p.ok, p.hash || undefined);
  if (!p.ok) throw new Error(p.error);
  const v = await callTx(account(WALLET2), UNITS, "unit_vote", { unit_id: unit, proposal_id: Number(p.value), approve: true }, 30).catch((e) => ({ ok: false, hash: "", value: undefined, error: String(e) }));
  record(`unit_vote by ${WALLET2} (30 Tgas) -> ${v.value} (2 of 2 seats)`, v.ok, v.hash || undefined);
  if (!v.ok) throw new Error(v.error);
  const run = await api(`/units/${unit}/run`, { proposal_id: Number(p.value) });
  record("POST /api/units/:id/run: the sponsor relays unit_run (300 Tgas): the real OutLayer engine runs, plus the DKIM count run", run.status === 200, txOf(run.body), run.status === 200 ? undefined : run.body);

  // 7. read the release back
  let rel: Record<string, unknown> | undefined;
  for (let i = 0; i < 40 && !rel; i++) {
    await sleep(6000);
    rel = (await view<Record<string, unknown> | null>(UNITS, "get_unit_release", { unit_id: unit, release_id: before + 1 })) ?? undefined;
  }
  record("Release read back from the units contract", Boolean(rel && rel.status !== "error"), undefined,
    rel && { status: rel.status, cells: rel.cells, suppressed: rel.suppressed, counts: rel.counts, note: rel.note, count_note: rel.count_note, input_sha256: rel.input_sha256, input_hash: rel.input_hash, output_sha256: rel.output_sha256 });
  const view2 = await api(`/units/${unit}`);
  record("GET /api/units/:id aggregates unit, proposals, releases and latest bands", view2.status === 200, undefined, { latest_bands: view2.body.latest_bands, counts: view2.body.counts });
} catch (e) {
  record("run stopped", false, undefined, String(e).slice(0, 300));
  process.exitCode = 1;
} finally {
  save();
}
