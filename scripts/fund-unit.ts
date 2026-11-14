// Owner tops up the union account (storage for encrypted entries with payslip emails). Usage: tsx fund-unit.ts <near>
import { actions } from "near-api-js";
import { accountWithKey, balanceNear, loadState, near, ownerKeyFile, say, sendActions, step } from "./lib";

const amount = Number(process.argv[2]);
if (!(amount > 0 && amount <= 2)) throw new Error("usage: tsx fund-unit.ts <near, at most 2>");
const st = loadState();
const owner = ownerKeyFile();
const s = await sendActions(accountWithKey(owner.account_id, owner), st.unit, [actions.transfer(near(amount))]);
step(`Owner sends ${amount} NEAR to the union for entry storage`, s);
say(`union ${await balanceNear(st.unit)} NEAR, owner ${await balanceNear(owner.account_id)} NEAR`);
