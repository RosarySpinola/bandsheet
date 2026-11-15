import { createHash } from "node:crypto";
import { KeyPair, KeyPairSigner } from "near-api-js";
import { inviteHashOf, slotIdFromNearPublicKey } from "@bandsheet/core";
import { createApp } from "../src/app";
import type { KeyLookup, KeyStatus } from "../src/auth/keys";
import type { SentTx, Signer } from "../src/chain/port";
import type { Deps } from "../src/deps";
import { SpendGuard } from "../src/spend";
import type { UnitCall, UnitsChain } from "../src/units/chain";
import { MemoryUnitStore } from "../src/units/store";
import { chainCfg, config, mockChain } from "./helpers";

export const UNITS = "bandsheet-units-test.testnet";
export const REGISTRAR: Signer = { accountId: "bsu-registrar-test.testnet", privateKey: KeyPair.fromRandom("ed25519").toString() };
export const SPONSOR: Signer = { accountId: "bsu-sponsor-test.testnet", privateKey: KeyPair.fromRandom("ed25519").toString() };
export const SECRET = "Zm9yIHRoZSB1bml0IHRlc3Q";
export const CREATOR = "maria-lopes.testnet";
export const ENCLAVE_PUB = "Kn0bVgYSbpi5A3d/ldGgeVoUQr/zxTccybuYjC2JE0Y=";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export interface MockUnit {
  id: number;
  name: string;
  creator: string;
  council: string[];
  invite_code_hash: string;
  threshold: number;
  dkim_domains: string[];
  issuers: { domain: string; selector: string; source: string; key_sha256: string; key: string }[];
  members: number;
  synthetic_members: number;
  synthetic_added: number;
  entries: number;
  proposals: number;
  releases: number;
  in_flight: null;
}

/** In-memory units contract with the same refusals as contracts/units for the calls the server makes. */
export function unitsChain(opts: { balances?: Record<string, bigint>; failSubmit?: boolean } = {}) {
  const units = new Map<number, MockUnit>();
  const slots = new Map<string, { unit: number; synthetic: boolean }>();
  const calls: { signer: string; calls: UnitCall[] }[] = [];
  const submits: { key: string; ciphertext: object }[] = [];
  const transfers: { to: string; yocto: bigint }[] = [];
  const balances = new Map<string, bigint>(Object.entries({ [SPONSOR.accountId]: 2n * 10n ** 24n, ...opts.balances }));
  let n = 0;
  const ok = (value?: unknown): SentTx => ({ hash: `TX${++n}`, ok: true, error: "", value });
  const no = (error: string): SentTx => ({ hash: `TX${++n}`, ok: false, error, value: undefined });
  units.set(1, {
    id: 1, name: "Night desk", creator: CREATOR, council: [CREATOR], invite_code_hash: inviteHashOf(SECRET), threshold: 1,
    dkim_domains: ["harbourcourier.example"], issuers: [], members: 0, synthetic_members: 0, synthetic_added: 0, entries: 0, proposals: 0, releases: 1, in_flight: null,
  });
  const releases = [{ id: 1, unit_id: 1, status: "partially_released", cells: [{ key: { grade: "Senior" }, n: 5, mean_eur: 58_000 }], suppressed: [],
    counts: { entries: 5, synthetic: 4, dkim_verified: 0, self_attested: 1, rejected: 0 } }];

  const exec = (signer: Signer, c: UnitCall): SentTx => {
    const a = c.args as Record<string, unknown>;
    if (signer.accountId !== REGISTRAR.accountId) return no("Refused: only the units registrar can do this");
    const u = units.get(Number(a.unit_id));
    if (!u) return no(`No unit ${a.unit_id}`);
    if (c.method === "unit_add_member") {
      if (!a.synthetic && sha(String(a.invite_code)) !== u.invite_code_hash) return no("Refused: the invite code does not match this unit");
      if (a.synthetic && u.synthetic_added >= 8) return no("A unit has at most 8 synthetic colleagues");
      const slot = slotIdFromNearPublicKey(String(a.public_key));
      if (slots.has(slot)) return no("That key is already a member of a unit");
      slots.set(slot, { unit: u.id, synthetic: Boolean(a.synthetic) });
      u.members++;
      if (a.synthetic) (u.synthetic_added++, u.synthetic_members++);
      return ok(u.members);
    }
    if (c.method === "unit_remove_member") {
      slots.delete(slotIdFromNearPublicKey(String(a.public_key)));
      u.members--;
      return ok();
    }
    if (c.method === "unit_add_issuer") {
      if (!u.dkim_domains.includes(String(a.domain))) return no(`${a.domain} is not one of unit ${u.id}'s DKIM domains`);
      const key = String(a.public_key_pem_or_fingerprint);
      u.issuers.push({ domain: String(a.domain), selector: String(a.selector), source: String(a.source), key_sha256: sha(key), key });
      return ok();
    }
    return no(`unmocked ${c.method}`);
  };

  const chain: UnitsChain = {
    async view<T>(method: string, args: Record<string, unknown> = {}) {
      if (method === "get_unit") return (units.get(Number(args.unit_id)) ?? null) as T;
      if (method === "get_policy") return { k: 3, enclave_pubkey: ENCLAVE_PUB, wasm_sha256: "69".repeat(32), registrar: REGISTRAR.accountId } as T;
      if (method === "get_unit_proposals") return [] as T;
      if (method === "get_unit_releases") return (Number(args.unit_id) === 1 ? releases : []) as T;
      if (method === "get_units_of") return [...units.values()].filter((u) => u.council.includes(String(args.account_id))) as T;
      throw new Error(`unmocked view ${method}`);
    },
    async call(signer, cs) {
      calls.push({ signer: signer.accountId, calls: cs });
      // a multi-action transaction is all or nothing
      const results = cs.map((c) => exec(signer, c));
      return results.find((r) => !r.ok) ?? results[results.length - 1]!;
    },
    async submitAs(key, ciphertext) {
      submits.push({ key, ciphertext });
      if (opts.failSubmit) return no("Refused: this key is not a member of any unit");
      const slot = slotIdFromNearPublicKey(KeyPair.fromString(key as `ed25519:${string}`).getPublicKey().toString());
      const s = slots.get(slot);
      if (!s) return no("Refused: this key is not a member of any unit");
      units.get(s.unit)!.entries++;
      return ok(units.get(s.unit)!.entries);
    },
    async transfer(signer, to, yocto) {
      transfers.push({ to, yocto });
      balances.set(to, (balances.get(to) ?? 0n) + yocto);
      balances.set(signer.accountId, (balances.get(signer.accountId) ?? 0n) - yocto);
      return ok();
    },
    async balance(id) {
      return balances.get(id) ?? null;
    },
  };
  return { chain, units, slots, calls, submits, transfers, balances };
}

export function setupUnits(keys: Record<string, KeyStatus> = {}, opts: Parameters<typeof unitsChain>[0] & { doh?: typeof fetch; registrar?: boolean; sponsor?: boolean } = {}) {
  let t = 1_763_000_000_000;
  const store = new MemoryUnitStore();
  const lookup: KeyLookup = { status: async (acct, pk) => keys[`${acct}|${pk}`] ?? keys[acct] ?? "no_such_account" };
  const u = unitsChain(opts);
  const deps: Deps = {
    config, guard: new SpendGuard({ path: config.ledgerPath, getPrice: async () => ({ prompt: 0, completion: 0 }) }),
    chat: async () => { throw new Error("no AI here"); }, view: async () => [], chain: mockChain().chain, chainCfg: chainCfg(),
    units: {
      cfg: { contract: UNITS, registrar: opts.registrar === false ? undefined : REGISTRAR, sponsor: opts.sponsor === false ? undefined : SPONSOR,
        explorer: { tx: "https://testnet.nearblocks.io/txns/", address: "https://testnet.nearblocks.io/address/" } },
      chain: u.chain, store, keys: lookup, doh: opts.doh, now: () => t,
    },
  };
  const app = createApp(deps);
  let ip = 1;
  const req = async (method: string, path: string, body?: unknown, fixedIp?: string) => {
    const res = await app.request(`/api${path}`, {
      method, headers: { "content-type": "application/json", "x-forwarded-for": fixedIp ?? `10.1.${Math.floor(ip / 250)}.${ip++ % 250}` }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const post = (path: string, body: unknown, fixedIp?: string) => req("POST", path, body, fixedIp);
  const nonce = async (purpose: string) => String((await post("/units/nonce", { purpose })).body.nonce);
  return { ...u, store, post, get: (p: string) => req("GET", p), nonce, advance: (ms: number) => (t += ms) };
}

/** A NEAR wallet's NEP-413 signMessage, done with near-api-js (independent of the server's own encoder). */
export async function walletSign(kp: KeyPair, accountId: string, message: string, nonce: string, recipient = UNITS) {
  const s = await new KeyPairSigner(kp).signNep413Message(accountId, { message, recipient, nonce: Uint8Array.from(Buffer.from(nonce, "base64url")) });
  return { scheme: "nep413", account_id: accountId, public_key: kp.getPublicKey().toString(), signature: Buffer.from(s.signature).toString("base64"), nonce };
}

export const memberKey = () => KeyPair.fromRandom("ed25519").getPublicKey().toString();
