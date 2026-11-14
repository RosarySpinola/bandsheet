// DKIM entries. Each member resubmits their entry WITH the employer's signed payslip email (eml_b64), encrypted to
// the enclave key, signed with their own invite key. Resubmission replaces, so the count does not change.
//   tsx dkim-submit.ts all        the 36 seeded members and the joiner, each with their own signed email
//   tsx dkim-submit.ts forged     the demo member submits forged.eml (one digit edited after signing)
// The contract cannot read the ciphertext, so it accepts the forged entry; the enclave rejects it.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { SEED_JOINER, SEED_MEMBERS, EntrySchema, encryptBytes, seedEntry, type SeedMember } from "../packages/core/src/index";
import { ROOT, accountWithKey, callTx, loadState, say, step, view } from "./lib";
import { enclaveKey, invitePath, readInvite, type Invite } from "./members";

const FIX = `${ROOT}/fixtures/dkim/emails`;
const LOG = `${ROOT}/scripts/demo-log.json`;
const PROGRESS = `${ROOT}/scripts/dkim-progress.json`;
const st = loadState();
const note = (stage: string, link: string) => {
  const log: Record<string, string[]> = existsSync(LOG) ? JSON.parse(readFileSync(LOG, "utf8")) : {};
  log[stage] = [...(log[stage] ?? []), link];
  writeFileSync(LOG, JSON.stringify(log, null, 2) + "\n");
};

async function submitWithEml(inv: Invite, entry: ReturnType<typeof seedEntry>, eml: Buffer, pub: Uint8Array) {
  const body = { ...EntrySchema.parse(entry), eml_b64: eml.toString("base64") };
  const ct = encryptBytes(pub, new TextEncoder().encode(JSON.stringify(body)));
  const signer = accountWithKey(inv.contract_id, { account_id: inv.contract_id, public_key: inv.public_key, private_key: inv.private_key });
  return callTx(signer, inv.contract_id, "submit", { ciphertext: ct }, 30);
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]!); }));
}

const progress = (): Record<string, string[]> => (existsSync(PROGRESS) ? JSON.parse(readFileSync(PROGRESS, "utf8")) : {});
const mode = process.argv[2];
const pol = await view<{ policy: { enclave_pubkey: string } }>(st.unit, "get_policy");
const keyId = pol.policy.enclave_pubkey;
const pub = await enclaveKey();
const at = Math.floor(Date.now() / 1000);

if (mode === "all") {
  const done = new Set<string>(progress()[keyId] ?? []);
  const members: SeedMember[] = [...SEED_MEMBERS, SEED_JOINER];
  const todo = members.map((m) => ({ m, inv: readInvite(m.name)! })).filter((t) => !done.has(t.inv.slot));
  say(`${todo.length} of ${members.length} members still to resubmit with their payslip email`);
  let n = 0;
  await pool(todo, 2, async ({ m, inv }) => {
    const slug = invitePath(m.name).split("/").pop()!.replace(".json", "");
    const s = await submitWithEml(inv, seedEntry(m, inv.slot, at), readFileSync(`${FIX}/${slug}.eml`), pub);
    if (!s.ok) throw new Error(`submit ${m.name}: ${s.error}`);
    done.add(inv.slot);
    writeFileSync(PROGRESS, JSON.stringify({ ...progress(), [keyId]: [...done] }));
    note("dkim_resubmit", s.link);
    say(`${++n}/${todo.length} ${m.name}  ${s.link}`);
  });
  step("All members have resubmitted with their signed payslip email");
  say(`entry_count = ${await view<number>(st.unit, "entry_count")} (replaced, not added)`);
} else if (mode === "forged") {
  const inv = JSON.parse(readFileSync(`${ROOT}/keys/invites/demo-member.json`, "utf8")) as Invite;
  const claim = { slot: inv.slot, gross_annual_eur: 82_900, grade: "Senior" as const, gender: "F" as const, site: "City" as const, submitted_at: at };
  const s = await submitWithEml(inv, claim, readFileSync(`${FIX}/forged.eml`), pub);
  step("Demo member submits forged.eml (one digit of the monthly gross edited after signing)", s);
  note("dkim_forged_submit", s.link);
  say("the contract accepts the ciphertext: it cannot read it. The enclave is what rejects it.");
  say(`entry_count = ${await view<number>(st.unit, "entry_count")}`);
} else {
  step("usage: tsx dkim-submit.ts all | forged");
}
