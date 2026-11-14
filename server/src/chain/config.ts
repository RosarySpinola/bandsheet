import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Invite, parseInvite } from "@bandsheet/core/near";
import { z } from "zod";
import { REPO_ROOT } from "../env";
import type { Signer } from "./port";

export interface ChainConfig {
  unit: string;
  dao: string;
  council: string[];
  councilKeys: Record<string, string>;
  demoInvite: Invite | undefined;
  explorer: { base: string; address: string; tx: string };
}

const KeyFile = z.object({ account_id: z.string(), private_key: z.string().startsWith("ed25519:") });
const Deployed = z.object({ unit: z.string(), dao: z.string(), council: z.array(z.string()).length(3) });

const readJson = (p: string): unknown => JSON.parse(readFileSync(p, "utf8"));

const assertTestnet = (ids: string[]): void => {
  for (const id of ids) if (!id.endsWith(".testnet")) throw new Error(`refusing non-testnet account ${id}`);
};

/**
 * Chain wiring. Production hosts supply secrets through env (BANDSHEET_UNIT, BANDSHEET_DAO,
 * BANDSHEET_COUNCIL, COUNCIL_KEYS_JSON, DEMO_INVITE_JSON); on a dev machine it falls back to
 * scripts/deployed.json and keys/ (gitignored). Testnet accounts only.
 */
export function loadChainConfig(env: NodeJS.ProcessEnv = process.env): ChainConfig {
  const deployedPath = resolve(REPO_ROOT, "scripts/deployed.json");
  const file = existsSync(deployedPath) ? Deployed.safeParse(readJson(deployedPath)) : undefined;
  const unit = env.BANDSHEET_UNIT || env.BANDSHEET_CONTRACT || file?.data?.unit;
  const dao = env.BANDSHEET_DAO || file?.data?.dao;
  const council = env.BANDSHEET_COUNCIL ? env.BANDSHEET_COUNCIL.split(",").map((s) => s.trim()) : file?.data?.council;
  if (!unit || !dao || !council || council.length !== 3) {
    throw new Error("chain config missing: set BANDSHEET_UNIT, BANDSHEET_DAO, BANDSHEET_COUNCIL or provide scripts/deployed.json");
  }
  assertTestnet([unit, dao, ...council]);

  const councilKeys: Record<string, string> = {};
  if (env.COUNCIL_KEYS_JSON) {
    Object.assign(councilKeys, z.record(z.string(), z.string()).parse(JSON.parse(env.COUNCIL_KEYS_JSON)));
  } else {
    for (const id of council) {
      const p = resolve(REPO_ROOT, "keys", `${id}.json`);
      if (existsSync(p)) councilKeys[id] = KeyFile.parse(readJson(p)).private_key;
    }
  }

  let demoInvite: Invite | undefined;
  const demoPath = resolve(REPO_ROOT, "keys/invites/demo-member.json");
  if (env.DEMO_INVITE_JSON) demoInvite = parseInvite(JSON.parse(env.DEMO_INVITE_JSON), unit);
  else if (existsSync(demoPath)) demoInvite = parseInvite(readJson(demoPath), unit);
  if (demoInvite && demoInvite.contractId !== unit) throw new Error("demo invite targets a different contract");

  const base = "https://testnet.nearblocks.io";
  return { unit, dao, council, councilKeys, demoInvite, explorer: { base, address: `${base}/address/`, tx: `${base}/txns/` } };
}

export function councilSigner(cfg: ChainConfig, member: 1 | 2 | 3): Signer | undefined {
  const accountId = cfg.council[member - 1]!;
  const privateKey = cfg.councilKeys[accountId];
  return privateKey ? { accountId, privateKey } : undefined;
}
