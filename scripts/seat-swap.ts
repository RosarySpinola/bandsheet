// Seat swap (testnet only): a member's own wallet takes council seat 3, so they can vote from it.
//   (a) RemoveMemberFromRole bs-c3-3f36b7.testnet from council; seats 1 and 2 approve
//   (b) AddMemberToRole <accountId> to council; seats 1 and 2 approve
//   (c) a signalling `Vote` proposal: "Chapel poll: publish Release #4 after the November payroll closes" (left open)
// The council stays at 3 members with the DAO's 2-of-3 policy. Reverse with scripts/seat-restore.ts <accountId>.
// Usage: tsx scripts/seat-swap.ts <accountId>
import { loadState, say, step, view } from "./lib";
import { proposeKind, runProposal } from "./dao";

export const OLD_SEAT = "bs-c3-3f36b7.testnet";
export const POLL = "Chapel poll: publish Release #4 after the November payroll closes";

interface Policy { roles: { name: string; kind: { Group?: string[] } | string }[] }

export async function council(dao: string): Promise<string[]> {
  const p = await view<Policy>(dao, "get_policy");
  const role = p.roles.find((r) => r.name === "council");
  return typeof role?.kind === "object" ? (role.kind.Group ?? []) : [];
}

/** Testnet only: a named .testnet account, or an implicit (64 hex) account. */
export function testnetAccount(id: string | undefined): string {
  if (!id || !/^(?:[a-z0-9][a-z0-9_-]*\.)*[a-z0-9_-]+\.testnet$|^[0-9a-f]{64}$/.test(id)) {
    process.stderr.write("usage: tsx scripts/<script>.ts <accountId>   (a .testnet or 64-hex implicit account)\n");
    process.exit(1);
  }
  return id;
}

async function main(): Promise<void> {
  const target = testnetAccount(process.argv[2]);
  const st = loadState();
  if (!st.dao.endsWith(".testnet")) throw new Error("refusing a non-testnet DAO");
  const before = await council(st.dao);
  say(`council before: ${before.join(", ")}`);
  if (before.includes(target)) throw new Error(`${target} already holds a council seat`);
  if (!before.includes(OLD_SEAT) || before.length !== 3) throw new Error(`expected a 3-seat council including ${OLD_SEAT}`);

  const out = await runProposal({ RemoveMemberFromRole: { member_id: OLD_SEAT, role: "council" } }, `Seat change: ${OLD_SEAT} steps down from council seat 3`);
  if (out.status !== "Approved") throw new Error(`removal proposal #${out.id} is ${out.status}; stopping`);
  const inn = await runProposal({ AddMemberToRole: { member_id: target, role: "council" } }, `Seat change: ${target} takes council seat 3`);
  if (inn.status !== "Approved") throw new Error(`add proposal #${inn.id} is ${inn.status}; stopping`);
  const poll = await proposeKind("Vote", POLL);
  step(`Proposal #${poll.id}: ${POLL} (open for the council's wallets)`, poll.sent);

  const after = await council(st.dao);
  say(`council after: ${after.join(", ")} (${after.length} seats, 2 of 3 to pass)`);
  for (const l of [...out.links, ...inn.links, poll.sent.link]) say(l);
}

if (process.argv[1]?.endsWith("seat-swap.ts")) await main();
