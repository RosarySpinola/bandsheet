// OPTIONAL, IRREVERSIBLE: delete every full-access key on the union account. After this nobody (not even the
// committee) can redeploy the contract or add an entry outside `submit`; members are added only through the
// owner-gated add_members. Run it last, after the demo. Usage: tsx seal.ts --yes
import { account, loadState, provider, say, step } from "./lib";
import { actions } from "near-api-js";
import { sendActions } from "./lib";

if (process.argv[2] !== "--yes") { say("refusing: pass --yes (this deletes the union's full-access key for good)"); process.exit(1); }
const st = loadState();
const keys = await provider.viewAccessKeyList({ accountId: st.unit });
const full = keys.keys.filter((k) => k.access_key.permission === "FullAccess");
for (const k of full) {
  const s = await sendActions(account(st.unit), st.unit, [actions.deleteKey(k.public_key as never)]);
  step(`Deleted full-access key ${k.public_key}`, s);
}
say(`remaining full-access keys: ${(await provider.viewAccessKeyList({ accountId: st.unit })).keys.filter((k) => k.access_key.permission === "FullAccess").length}`);
