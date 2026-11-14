// Sputnik DAO flow for a release: propose -> council votes -> execution -> read the logged record.
// CLI: tsx dao.ts propose '<query json>' | vote <proposal id> <council 1-3> | release <id> | status
import { account, callTx, loadState, saveState, say, sleep, step, view, type Sent } from "./lib";

const RELEASE_GAS = "200000000000000"; // 200 Tgas for request_release (it forwards most of it to OutLayer)

export type Query = { id?: number; group_by: string[]; filter?: Record<string, string>; stat?: "mean" };

interface ProposalView { id: number; status: string; kind: unknown; votes: Record<string, string> }
export const releaseKind = (unit: string, query: Query) => ({
  FunctionCall: {
    receiver_id: unit,
    actions: [{ method_name: "request_release", args: Buffer.from(JSON.stringify({ query: JSON.stringify(query) })).toString("base64"), deposit: "0", gas: RELEASE_GAS }],
  },
});

export async function propose(query: Query, description: string): Promise<{ id: number; sent: Sent }> {
  const st = loadState();
  const sent = await callTx(account(st.council[0]!), st.dao, "add_proposal", { proposal: { description, kind: releaseKind(st.unit, query) } }, 60);
  if (!sent.ok || typeof sent.value !== "number") throw new Error(`add_proposal failed: ${sent.error}`);
  return { id: sent.value, sent };
}

export async function vote(id: number, councilIndex: number, action: "VoteApprove" | "VoteReject" = "VoteApprove"): Promise<Sent> {
  const st = loadState();
  const p = await view<ProposalView>(st.dao, "get_proposal", { id });
  const args = { id, action, proposal: p.kind };
  return callTx(account(st.council[councilIndex - 1]!), st.dao, "act_proposal", args, 270);
}

export const proposalStatus = async (id: number) => (await view<ProposalView>(loadState().dao, "get_proposal", { id })).status;

/** Wait until the contract has logged more than `before` releases (OutLayer answered), then return the record. */
export async function waitForRelease(before: number, timeoutMs = 6 * 60_000): Promise<Record<string, any> | null> {
  const unit = loadState().unit;
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const n = await view<number>(unit, "release_count");
    if (n > before) return (await view<Record<string, any>[]>(unit, "get_releases", { from: n - 1, limit: 1 }))[0]!;
    await sleep(5000);
  }
  return null;
}

export function describeRelease(r: Record<string, any>): void {
  say(`release #${r.id}: ${String(r.status).toUpperCase()}   (${new Date(Number(r.block_timestamp) / 1e6).toISOString()})`);
  for (const c of r.cells ?? []) say(`  released  ${JSON.stringify(c.key)}  n=${c.n}  mean EUR ${c.mean_eur}`);
  for (const s of r.suppressed ?? []) say(`  REFUSED   ${JSON.stringify(s.key)}  [${s.reason}]  ${s.witness}`);
  if (r.note) say(`  note: ${r.note}`);
  say(`  input_sha256 ${String(r.input_sha256).slice(0, 16)}...  output_sha256 ${String(r.output_sha256).slice(0, 16)}...`);
}

/** Whole flow: propose, two approvals (a 2-of-3 majority executes), wait for the record. */
export async function runRelease(query: Query, description: string, prepare?: () => Promise<void>): Promise<{ links: string[]; record: Record<string, any> | null }> {
  const st = loadState();
  const unit = st.unit;
  const before = await view<number>(unit, "release_count");
  const links: string[] = [];
  if (prepare) await prepare();
  // resume a proposal this run already created for the same release number (a re-run must not spam the DAO)
  const key = `proposal_for_release_${before + 1}`;
  let id = Number((loadState() as Record<string, unknown>)[key] ?? -1);
  if (id < 0 || (await proposalStatus(id)) !== "InProgress") {
    const p = await propose(query, description);
    id = p.id;
    saveState({ [key]: id });
    step(`Proposal #${id}: ${description}`, p.sent);
    links.push(p.sent.link);
  } else {
    step(`Resuming proposal #${id}: ${description}`);
  }
  for (const i of [1, 2]) {
    const cur = await view<ProposalView>(st.dao, "get_proposal", { id });
    if (cur.status !== "InProgress" || cur.votes[st.council[i - 1]!] === "Approve") continue;
    const v = await vote(id, i);
    step(`Council member ${i} votes approve (proposal #${id})`, v);
    links.push(v.link);
    if (!v.ok) throw new Error(`vote failed: ${v.error}`);
  }
  say(`proposal #${id} status: ${await proposalStatus(id)}`);
  const record = await waitForRelease(before);
  if (!record) say("no record within 6 minutes: OutLayer has not answered (the contract stays retryable)");
  else describeRelease(record);
  return { links, record };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === "propose") { const r = await propose(JSON.parse(a!), "Release pay bands"); console.log(`proposal ${r.id}\n${r.sent.link}`); }
  else if (cmd === "vote") { const r = await vote(Number(a), Number(b ?? 1)); console.log(r.ok ? "voted" : `failed: ${r.error}`, r.link); }
  else if (cmd === "release") { const n = Number(a); const r = (await view<Record<string, any>[]>(loadState().unit, "get_releases", { from: n - 1, limit: 1 }))[0]; if (r) describeRelease(r); else console.log("no such release"); }
  else if (cmd === "status") { const st = loadState(); console.log(JSON.stringify(await view(st.unit, "get_policy"), null, 1)); }
  else { console.log("usage: tsx dao.ts propose '<query json>' | vote <id> <1-3> | release <id> | status"); }
}
