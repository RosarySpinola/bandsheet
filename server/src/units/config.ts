import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { Signer } from "../chain/port";
import { REPO_ROOT } from "../env";

/** The units contract this server serves (contracts/units/INTERFACE.md). Env UNITS_CONTRACT overrides it. */
export const DEFAULT_UNITS_CONTRACT = "bandsheet-units-2d3f96.testnet";
export const DEFAULT_SPONSOR = "bsu-sponsor-2d3f96.testnet";

export interface UnitsConfig {
  contract: string;
  /** Function-call key on the registrar account: unit_add_member, unit_remove_member, unit_add_issuer only. */
  registrar: Signer | undefined;
  /** Full-access key of the low-value gas sponsor account. */
  sponsor: Signer | undefined;
  explorer: { tx: string; address: string };
}

const KeyFile = z.object({ account_id: z.string().min(2), private_key: z.string().startsWith("ed25519:") });

const fromJson = (text: string | undefined): Signer | undefined => {
  if (!text) return undefined;
  const k = KeyFile.parse(JSON.parse(text));
  return { accountId: k.account_id, privateKey: k.private_key };
};

const fromFile = (name: string): Signer | undefined => {
  const p = resolve(REPO_ROOT, "keys", name);
  return existsSync(p) ? fromJson(readFileSync(p, "utf8")) : undefined;
};

/**
 * Production hosts set UNITS_REGISTRAR_KEY_JSON and SPONSOR_KEY_JSON ({account_id, private_key}) as Pages secrets; a dev
 * machine falls back to keys/units-registrar.json and keys/<sponsor>.json (gitignored). Testnet accounts only.
 */
export function loadUnitsConfig(env: NodeJS.ProcessEnv = process.env): UnitsConfig {
  const contract = env.UNITS_CONTRACT || DEFAULT_UNITS_CONTRACT;
  if (!contract.endsWith(".testnet")) throw new Error(`refusing non-testnet units contract ${contract}`);
  const registrar = fromJson(env.UNITS_REGISTRAR_KEY_JSON) ?? fromFile("units-registrar.json");
  const sponsor = fromJson(env.SPONSOR_KEY_JSON) ?? fromFile(`${env.UNITS_SPONSOR || DEFAULT_SPONSOR}.json`);
  for (const s of [registrar, sponsor]) if (s && !s.accountId.endsWith(".testnet")) throw new Error("refusing a non-testnet signer");
  const base = "https://testnet.nearblocks.io";
  return { contract, registrar, sponsor, explorer: { tx: `${base}/txns/`, address: `${base}/address/` } };
}
