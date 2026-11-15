// Create a .testnet account through the public testnet faucet (helper.testnet.near.org) with a fresh key,
// saved to keys/<account>.json (gitignored). TESTNET ONLY. The faucet funds the new account itself.
// Usage: scripts/run.sh faucet-account.ts <account.testnet>
import { KeyPair } from "near-api-js";
import { balanceNear, exists, keyPath, saveKey, say, sleep } from "./lib";

const id = process.argv[2];
if (!id || !/^[a-z0-9-]{2,56}\.testnet$/.test(id)) throw new Error("usage: faucet-account.ts <name>.testnet");
if (await exists(id)) {
  say(`${id} already exists (${await balanceNear(id)} NEAR)`);
  process.exit(0);
}
const kp = KeyPair.fromRandom("ed25519");
saveKey(keyPath(id), id, kp);
const res = await fetch("https://helper.testnet.near.org/account", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ newAccountId: id, newAccountPublicKey: kp.getPublicKey().toString() }),
});
say(`faucet answered HTTP ${res.status}`);
for (let i = 0; i < 10 && !(await exists(id)); i++) await sleep(2000);
if (!(await exists(id))) {
  say(`${id} was not created`);
  process.exit(1);
}
say(`${id} created with ${await balanceNear(id)} NEAR; key in keys/${id}.json`);
