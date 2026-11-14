// Full demo on NEAR testnet: 36 seeded members + a 37th joiner (Senior, EUR 70,000), encrypted entries submitted
// with each member's own access key, a refused fake submit, a replacing resubmit, Release #1 and Release #2 via
// the Sputnik DAO. Re-runnable: it skips what is already on chain. Synthetic data only.
// Usage: tsx seed-demo.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { SEED_JOINER, SEED_MEMBERS, encryptEntry, seedEntry, type SeedMember } from "../packages/core/src/index";
import { account, callTx, loadState, provider, say, step, view, ROOT } from "./lib";
import { addMembers, counts, enclaveKey, makeInvite, readInvite, submitAs, type Invite } from "./members";
import { runRelease, type Query } from "./dao";
import { queueRealOutput } from "./local-enclave";

const LOG = `${ROOT}/scripts/demo-log.json`;
const log: Record<string, string[]> = existsSync(LOG) ? JSON.parse(readFileSync(LOG, "utf8")) : {};
const note = (stage: string, ...links: string[]) => { log[stage] = [...(log[stage] ?? []), ...links]; writeFileSync(LOG, JSON.stringify(log, null, 2) + "\n"); };
const st = loadState();
const prep = (q: Query) => () => queueRealOutput(q);

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]!); }));
}

async function ensureMembers(members: SeedMember[]): Promise<Invite[]> {
  const invs = members.map((m) => readInvite(m.name) ?? makeInvite(m.name));
  // one call: the union's access keys tell who is already a member
  const onChain = new Set((await provider.viewAccessKeyList({ accountId: st.unit })).keys.map((k) => String(k.public_key)));
  const fresh = invs.filter((inv) => !onChain.has(inv.public_key));
  for (let i = 0; i < fresh.length; i += 12) {
    const s = await addMembers(fresh.slice(i, i + 12));
    step(`Committee adds ${Math.min(12, fresh.length - i)} member keys to ${st.unit} (function-call keys, method submit only)`, s);
    if (!s.ok) throw new Error(s.error);
    note("add_members", s.link);
  }
  return invs;
}

async function submitAll(members: SeedMember[], invs: Invite[]) {
  const pub = await enclaveKey();
  const todo = members.map((m, i) => ({ m, inv: invs[i]! }));
  // the local log remembers who submitted (saves a view call per member on a rate-limited RPC)
  const done = new Set(log["submitted"] ?? []);
  const pending = todo.filter((t) => !done.has(t.inv.slot));
  const at = Math.floor(Date.now() / 1000);
  let ok = 0;
  await pool(pending, 2, async ({ m, inv }) => {
    const s = await submitAs(inv, m, pub, at);
    if (!s.ok) throw new Error(`submit ${m.name}: ${s.error}`);
    ok++;
    say(`${ok}/${pending.length} ${m.name}`);
    note("submit", s.link);
    note("submitted", inv.slot);
  });
  step(`${ok} encrypted entries submitted, each signed by the member's own access key (gas-free for members)`);
  say(`first: ${log["submit"]?.[0]}`);
}

async function main() {
  step(`Union ${st.unit} | DAO ${st.dao}`);
  const before = await counts();
  say(`start: ${before.members} members, ${before.entries} entries, ${before.releases} releases`);

  const invs = await ensureMembers([...SEED_MEMBERS]);
  await submitAll([...SEED_MEMBERS], invs);
  say(`entry_count = ${await view<number>(st.unit, "entry_count")}`);

  // A fake entry from an outside account is refused.
  const pub = await enclaveKey();
  const fake = encryptEntry(pub, seedEntry({ ...SEED_MEMBERS[0]!, gross_annual_eur: 999_999 }, "0".repeat(64), Math.floor(Date.now() / 1000)));
  const f1 = await callTx(account(st.outsider), st.unit, "submit", { ciphertext: fake }, 30);
  step("Outside account tries to add a fake entry", f1);
  note("fake_submit_outsider", f1.link);
  // Even the committee's own full-access key on the union account cannot forge: it is not a member key.
  const f2 = await callTx(account(st.unit), st.unit, "submit", { ciphertext: fake }, 30);
  step("Union's own full-access key tries to forge an entry (not a registered member key)", f2);
  note("fake_submit_unit_key", f2.link);
  if (f1.ok || f2.ok) throw new Error("a fake entry was accepted: stop");

  // Resubmission replaces; count unchanged.
  const c0 = await view<number>(st.unit, "entry_count");
  const m0 = SEED_MEMBERS[0]!;
  const rs = await submitAs(invs[0]!, { ...m0, gross_annual_eur: m0.gross_annual_eur + 100 }, pub, Math.floor(Date.now() / 1000));
  step(`${m0.name} resubmits a corrected entry`, rs);
  note("resubmit", rs.link);
  say(`entry_count before ${c0}, after ${await view<number>(st.unit, "entry_count")} (replaced, not added)`);
  // restore the original value so the Senior and Junior means stay as seeded
  const rs2 = await submitAs(invs[0]!, m0, pub, Math.floor(Date.now() / 1000));
  note("resubmit", rs2.link);

  let n = await view<number>(st.unit, "release_count");
  if (n < 1) {
    const q: Query = { group_by: ["grade"], stat: "mean" };
    const r = await runRelease(q, "Release #1: mean pay by grade", prep(q));
    note("release_1", ...r.links);
    n = await view<number>(st.unit, "release_count");
  }
  if (n < 2) {
    const [ji] = await ensureMembers([SEED_JOINER]);
    step(`${SEED_JOINER.name} (Senior, EUR 70,000) joins`);
    await submitAll([SEED_JOINER], [ji!]);
    say(`entry_count = ${await view<number>(st.unit, "entry_count")}`);
    const q: Query = { group_by: ["grade"], stat: "mean" };
    const r = await runRelease(q, "Release #2: mean pay by grade (after one member joined)", prep(q));
    note("release_2", ...r.links);
  }
  step("Explorer links by stage (also in scripts/demo-log.json)");
  for (const [k, v] of Object.entries(log)) say(`${k}: ${v.length > 3 ? `${v.length} txs, first ${v[0]}` : v.join("  ")}`);
  say(`contract: https://testnet.nearblocks.io/address/${st.unit}`);
  say(`dao:      https://testnet.nearblocks.io/address/${st.dao}`);
}
main().catch((e) => { process.stderr.write(`seed-demo failed: ${(e as Error).message}\n`); process.exit(1); });
