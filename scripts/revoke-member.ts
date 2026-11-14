// Revoke a member: the committee removes the member and their access key; their entry is dropped, so
// later releases are computed without them. Usage: tsx revoke-member.ts <name>
import { accountWithKey, callTx, loadState, ownerKeyFile, say, step } from "./lib";
import { readInvite } from "./members";

const name = process.argv[2];
const inv = name ? readInvite(name) : null;
if (!inv) { process.stderr.write("usage: tsx revoke-member.ts <name>   (needs keys/invites/<name>.json)\n"); process.exit(1); }
const owner = ownerKeyFile();
const s = await callTx(accountWithKey(owner.account_id, owner), loadState().unit, "revoke_member", { public_key: inv.public_key }, 60);
step(`Revoked member ${name}`, s);
say("the key can no longer sign for the union account");
if (!s.ok) process.exit(1);
