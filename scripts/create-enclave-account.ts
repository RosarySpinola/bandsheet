// Create bandsheet-enclave.testnet from the funded owner with the enclave worker's existing PUBLIC key.
// Only the public key is read (from the worker's near-cli credentials file); no new key is made.
// Usage: tsx create-enclave-account.ts [account=bandsheet-enclave.testnet] [fundNear=2.5]
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { accountWithKey, balanceNear, callTx, exists, near, ownerKeyFile, say, step } from "./lib";

const id = process.argv[2] ?? "bandsheet-enclave.testnet";
const fund = Number(process.argv[3] ?? 2.5);
const cred = JSON.parse(readFileSync(join(homedir(), ".near-credentials/testnet", `${id}.json`), "utf8")) as { public_key: string };
if (!/^ed25519:[1-9A-HJ-NP-Za-km-z]+$/.test(cred.public_key)) throw new Error("bad public key in credentials file");
if (await exists(id)) {
  say(`${id} already exists with ${await balanceNear(id)} NEAR`);
} else {
  const owner = ownerKeyFile();
  const s = await callTx(accountWithKey(owner.account_id, owner), "testnet", "create_account", { new_account_id: id, new_public_key: cred.public_key }, 60, near(fund));
  step(`Created ${id} with ${fund} NEAR and key ${cred.public_key}`, s);
  say(`tx ${s.hash}`);
  if (!s.ok) process.exit(1);
}
