// Testnet setup: accounts, Sputnik DAO "harbour-chapel", the bandsheet contract. Safe to re-run (resumes).
// Funded by one owner account (keys/owner/<id>.json); every other account is created from it.
// Usage: tsx setup.ts      Optional env: ENCLAVE_PUBKEY (hex/base64 X25519), ENCLAVE_WASM_SHA256, DAO_NAME
import { readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { actions, KeyPair } from "near-api-js";
import { generateX25519Keypair, toB64 } from "../packages/core/src/index";
import {
  account, accountWithKey, balanceNear, callTx, exists, keyPath, loadState, near, ownerKeyFile, saveKey, saveState,
  say, sendActions, SPUTNIK_FACTORY, step, view, WASM, writeSecret,
} from "./lib";

const POLICY_TEXT = "Bandsheet policy v1: mean pay by group; no cell under k=3 members; no cell released if it lets any member's salary be solved from this release plus every earlier one.";
const owner = ownerKeyFile();
const R = (loadStateSafe()?.run as string | undefined) ?? randomBytes(3).toString("hex");
const names = {
  unit: `bandsheet-${R}.testnet`,
  council: [1, 2, 3].map((i) => `bs-c${i}-${R}.testnet`),
  outsider: `bs-guest-${R}.testnet`,
};

function loadStateSafe() { try { return loadState(); } catch { return undefined; } }

async function createTop(ownerAcc: ReturnType<typeof accountWithKey>, id: string, fundNear: number) {
  if (await exists(id)) return null;
  const kp = KeyPair.fromRandom("ed25519");
  const f = saveKey(keyPath(id), id, kp);
  const sent = await callTx(ownerAcc, "testnet", "create_account", { new_account_id: id, new_public_key: f.public_key }, 60, near(fundNear));
  if (!sent.ok) throw new Error(`create ${id}: ${sent.error}`);
  return sent;
}

async function main() {
  const ownerAcc = accountWithKey(owner.account_id, owner);
  const bal = await balanceNear(owner.account_id).catch(() => 0);
  step(`Owner ${owner.account_id.slice(0, 12)}... holds ${bal} NEAR`);
  if (bal < 12) throw new Error("owner needs at least about 12 NEAR; fund it first");
  saveState({ run: R, owner: owner.account_id, unit: names.unit, council: names.council, outsider: names.outsider, outlayer: "outlayer.testnet" });

  for (const [id, fund] of [[names.unit, 3.2], ...names.council.map((c) => [c, 0.3] as const), [names.outsider, 0.2]] as const) {
    const s = await createTop(ownerAcc, id, fund);
    if (s) step(`Created ${id} (${fund} NEAR)`, s);
  }

  // Sputnik DAO: three council members, a majority (2 of 3) executes. Council can do everything; nobody else can act.
  const daoName = process.env.DAO_NAME ?? "harbour-chapel";
  let dao = (loadStateSafe()?.dao as string | undefined) ?? "";
  if (!dao) {
    dao = (await exists(`${daoName}.${SPUTNIK_FACTORY}`)) ? `${daoName}-${R}.${SPUTNIK_FACTORY}` : `${daoName}.${SPUTNIK_FACTORY}`;
    const name = dao.split(".")[0]!;
    const policy = {
      roles: [{ name: "council", kind: { Group: names.council }, permissions: ["*:*"], vote_policy: {} }],
      default_vote_policy: { weight_kind: "RoleWeight", quorum: "0", threshold: [1, 2] },
      proposal_bond: "0",
      proposal_period: "604800000000000",
      bounty_bond: "100000000000000000000000",
      bounty_forgiveness_period: "86400000000000",
    };
    const inner = { config: { name, purpose: "Harbour Courier newsroom chapel: releases pay bands only by council vote", metadata: "" }, policy };
    const args = { name, args: Buffer.from(JSON.stringify(inner)).toString("base64") };
    const s = await callTx(ownerAcc, SPUTNIK_FACTORY, "create", args, 150, near(6));
    step(`Created DAO ${dao} (council 2 of 3)`, s);
    if (!(await exists(dao))) throw new Error(`DAO ${dao} was not created: ${s.error}`);
    saveState({ dao, dao_create_tx: s.hash });
  }

  // Contract
  const unitAcc = account(names.unit);
  const have = await view(names.unit, "get_policy").then(() => true).catch(() => false);
  if (!have) {
    let pub = process.env.ENCLAVE_PUBKEY ?? "";
    if (!pub) {
      const kp = generateX25519Keypair();
      pub = toB64(kp.publicKey);
      writeSecret("enclave-mock.json", { note: "MOCK enclave key for local testing only", public_key: pub, secret_key: toB64(kp.secretKey) });
      say("no ENCLAVE_PUBKEY given: generated a mock enclave key (keys/enclave-mock.json)");
    }
    const wasm = readFileSync(`${WASM}/bandsheet.wasm`);
    const init = {
      owner: owner.account_id, dao, k: 3, enclave_pubkey: pub,
      wasm_sha256: process.env.ENCLAVE_WASM_SHA256 ?? "00".repeat(32),
      policy_hash: createHash("sha256").update(POLICY_TEXT).digest("hex"),
    };
    const s = await sendActions(unitAcc, names.unit, [actions.deployContract(wasm), actions.functionCall("new", init, 30n * 10n ** 12n, 0n)]);
    step(`Deployed bandsheet to ${names.unit} and initialised it`, s);
    if (!s.ok) throw new Error(s.error);
    saveState({ unit_deploy_tx: s.hash, wasm_sha256: createHash("sha256").update(wasm).digest("hex") });
  }
  step("Done");
  const p = await view<{ unit: string; dao: string; policy: { k: number } }>(names.unit, "get_policy");
  say(`unit ${p.unit}  dao ${p.dao}  k=${p.policy.k}`);
  say(`balances: unit ${await balanceNear(names.unit)}  owner ${await balanceNear(owner.account_id)}`);
}
main().catch((e) => { process.stderr.write(`setup failed: ${(e as Error).message}\n`); process.exit(1); });
