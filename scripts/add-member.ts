// Add one member: generate a keypair, have the committee add it as a function-call key on the union
// account (method submit only), write keys/invites/<name>.json (gitignored).
// Usage: tsx add-member.ts <name>
import { addMembers, invitePath, makeInvite, readInvite } from "./members";
import { say, step } from "./lib";

const name = process.argv[2];
if (!name) { process.stderr.write("usage: tsx add-member.ts <name>\n"); process.exit(1); }
if (readInvite(name)) { process.stderr.write(`an invite for ${name} already exists at ${invitePath(name)}\n`); process.exit(1); }
const inv = makeInvite(name);
const s = await addMembers([inv]);
step(`Added member ${name}`, s);
if (!s.ok) process.exit(1);
say(`slot ${inv.slot}`);
say(`invite written to ${invitePath(name)}`);
