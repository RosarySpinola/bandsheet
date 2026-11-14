// Reverse of seat-swap (testnet only): <accountId> leaves the council and bs-c3-3f36b7.testnet returns to seat 3.
//   (a) RemoveMemberFromRole <accountId> from council; seats 1 and 2 approve
//   (b) AddMemberToRole bs-c3-3f36b7.testnet to council; seats 1 and 2 approve
// The poll from seat-swap stays on record. Usage: tsx scripts/seat-restore.ts <accountId>
import { loadState, say } from "./lib";
import { runProposal } from "./dao";
import { OLD_SEAT, council, testnetAccount } from "./seat-swap";

const target = testnetAccount(process.argv[2]);
const st = loadState();
if (!st.dao.endsWith(".testnet")) throw new Error("refusing a non-testnet DAO");
const before = await council(st.dao);
say(`council before: ${before.join(", ")}`);
if (!before.includes(target)) throw new Error(`${target} holds no council seat`);
if (before.includes(OLD_SEAT)) throw new Error(`${OLD_SEAT} already holds a seat`);

const out = await runProposal({ RemoveMemberFromRole: { member_id: target, role: "council" } }, `Seat change: ${target} steps down from council seat 3`);
if (out.status !== "Approved") throw new Error(`removal proposal #${out.id} is ${out.status}; stopping`);
const inn = await runProposal({ AddMemberToRole: { member_id: OLD_SEAT, role: "council" } }, `Seat change: ${OLD_SEAT} returns to council seat 3`);
if (inn.status !== "Approved") throw new Error(`add proposal #${inn.id} is ${inn.status}; stopping`);

const after = await council(st.dao);
say(`council after: ${after.join(", ")} (${after.length} seats, 2 of 3 to pass)`);
for (const l of [...out.links, ...inn.links]) say(l);
