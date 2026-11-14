import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const REPO_ROOT = resolve(SERVER_DIR, "..");

let loaded = false;
/** Load <repo>/.env.local into process.env once. A missing file is fine (fixture mode). */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  const p = resolve(REPO_ROOT, ".env.local");
  if (existsSync(p)) process.loadEnvFile(p);
}

export interface Config {
  hasKey: boolean;
  baseUrl: string;
  contract: string | undefined;
  releasesMethod: string;
  rpcUrl: string;
  port: number;
  visionModel: string;
  textModel: string;
  ledgerPath: string;
  corsOrigin: string;
}

/** The key is read at call time by `apiKey()`, never stored in the config object. */
export function apiKey(): string | undefined {
  loadEnv();
  return process.env.NEARAI_API_KEY || undefined;
}

export function getConfig(): Config {
  loadEnv();
  const e = process.env;
  return {
    hasKey: Boolean(apiKey()),
    baseUrl: (e.NEARAI_BASE_URL || "https://cloud-api.near.ai").replace(/\/$/, ""),
    contract: e.BANDSHEET_CONTRACT || undefined,
    releasesMethod: e.BANDSHEET_RELEASES_METHOD || "get_releases",
    rpcUrl: e.NEAR_RPC_URL || "https://test.rpc.fastnear.com",
    port: Number(e.PORT || 8787),
    visionModel: "Qwen/Qwen3-VL-30B-A3B-Instruct",
    textModel: "z-ai/glm-5.3-flash",
    ledgerPath: e.SPEND_LEDGER_PATH || resolve(SERVER_DIR, ".spend.json"),
    corsOrigin: e.CORS_ORIGIN || "*",
  };
}
