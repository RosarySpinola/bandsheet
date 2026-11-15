// Balances of the units accounts (TESTNET).
import { balanceNear } from "./lib";
import { REGISTRAR, SPONSOR, UNITS, WALLET, WALLET2 } from "./units-lib";
let total = 0;
for (const a of [UNITS, REGISTRAR, SPONSOR, WALLET, WALLET2]) {
  const b = await balanceNear(a);
  total += b;
  process.stdout.write(`${a}: ${b} NEAR\n`);
}
process.stdout.write(`total ${total.toFixed(3)} NEAR (of 50 from the faucet)\n`);
