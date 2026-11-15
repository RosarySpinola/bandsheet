// Move testnet NEAR between our own units accounts (keys in keys/). TESTNET ONLY.
// Usage: scripts/run.sh units-transfer.ts <from.testnet> <to.testnet> <near>
import { actions } from "near-api-js";
import { account, balanceNear, near, say, sendActions, step } from "./lib";

const [from, to, amount] = process.argv.slice(2);
if (!from?.endsWith(".testnet") || !to || !Number(amount)) throw new Error("usage: units-transfer.ts <from> <to> <near>");
const s = await sendActions(account(from), to, [actions.transfer(near(Number(amount))) as ReturnType<typeof actions.functionCall>]);
step(`Transfer ${amount} NEAR ${from} -> ${to}`, s);
say(`${from}: ${await balanceNear(from)} NEAR, ${to}: ${await balanceNear(to)} NEAR`);
