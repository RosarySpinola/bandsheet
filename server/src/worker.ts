import type { Hono } from "hono";
import { createApp } from "./app";
import { loadChainConfig } from "./chain/config";
import { createChainPort } from "./chain/port";
import type { Deps } from "./deps";
import { apiKey, getConfig } from "./env";
import { AppError } from "./errors";
import { NearAiClient } from "./nearai/client";
import { verifyGpuNras, verifyQuoteDcap } from "./nearai/dcap";
import { createPriceSource } from "./nearai/models";
import { DEFAULT_ACCEPTED_TCB } from "./nearai/verify";
import { SpendGuard } from "./spend";
import { D1LedgerStore, type D1Like } from "./spend-d1";
import { createKeyLookup } from "./auth/keys";
import { loadOwnerSigner } from "./auth/owner";
import { type AuthD1, D1AuthStore } from "./auth/store";

/**
 * Cloudflare worker entry (Pages Functions mount this). Bindings:
 *  - DB: D1 database holding the NEAR AI spend ledger
 *  - AUTH_DB (optional): D1 database for sign-in nonces and account -> slot rows (deploy/migrations-auth); secret OWNER_KEY_JSON
 *  - secrets/vars (strings): NEARAI_API_KEY, COUNCIL_KEYS_JSON, DEMO_INVITE_JSON, BANDSHEET_CONTRACT,
 *    BANDSHEET_DAO, BANDSHEET_COUNCIL, optional NEAR_RPC_URLS, CORS_ORIGIN
 */
export interface WorkerEnv {
  DB?: D1Like;
  AUTH_DB?: AuthD1;
  [k: string]: unknown;
}

interface Timings {
  dcapMs: number;
  dcapCalls: number;
}

let cached: { deps: Deps; app: Hono; timings: Timings } | undefined;

function build(env: WorkerEnv): NonNullable<typeof cached> {
  if (!env.DB) throw new AppError(503, "spend ledger (D1 binding DB) is not configured", "NO_LEDGER");
  // Config readers use process.env; copy the string bindings in (nodejs_compat provides it).
  const strings = Object.fromEntries(Object.entries(env).filter((e): e is [string, string] => typeof e[1] === "string"));
  Object.assign(process.env, strings);

  const chainCfg = loadChainConfig(strings as NodeJS.ProcessEnv);
  const config = { ...getConfig(), ...(getConfig().contract ? {} : { contract: chainCfg.unit }) };
  const chain = createChainPort(strings.NEAR_RPC_URLS?.split(",").map((u) => u.trim()));
  const prices = createPriceSource(config.baseUrl);
  const guard = new SpendGuard({ store: new D1LedgerStore(env.DB), getPrice: prices.getPrice });
  const timings: Timings = { dcapMs: 0, dcapCalls: 0 };
  const client = new NearAiClient({
    baseUrl: config.baseUrl,
    guard,
    apiKey,
    ownedBy: prices.ownedBy,
    deps: {
      // Wall time (includes the PCCS collateral fetch). Workers clocks only advance on I/O, so this is not CPU time.
      verifyQuote: async (q) => {
        const t0 = Date.now();
        try {
          return await verifyQuoteDcap(q);
        } finally {
          timings.dcapMs += Date.now() - t0;
          timings.dcapCalls += 1;
        }
      },
      verifyGpu: verifyGpuNras,
      acceptedTcb: DEFAULT_ACCEPTED_TCB,
    },
  });
  const deps: Deps = {
    config,
    guard,
    chat: async (req) => {
      if (!config.hasKey) throw new AppError(503, "NEARAI_API_KEY is not configured", "NO_API_KEY");
      return client.verifiedChat(req);
    },
    chain,
    chainCfg,
    view: (contractId, method, args) => chain.view(contractId, method, args),
    auth: env.AUTH_DB
      ? { store: new D1AuthStore(env.AUTH_DB), keys: createKeyLookup(strings.NEAR_RPC_URLS?.split(",").map((u) => u.trim())), owner: loadOwnerSigner(strings as NodeJS.ProcessEnv) }
      : undefined,
  };
  return { deps, app: createApp(deps), timings };
}

export async function handle(request: Request, env: WorkerEnv): Promise<Response> {
  const t0 = Date.now();
  try {
    cached ??= build(env);
  } catch (err) {
    const e = err instanceof AppError ? err : new AppError(503, "server is not configured", "NOT_CONFIGURED");
    return Response.json(e.body(), { status: e.status });
  }
  const { app, timings } = cached;
  timings.dcapMs = 0;
  timings.dcapCalls = 0;
  const res = await app.fetch(request);
  if (timings.dcapCalls > 0) {
    const out = new Response(res.body, res);
    out.headers.set("server-timing", `dcap;dur=${timings.dcapMs};desc="${timings.dcapCalls} quote(s), wall",total;dur=${Date.now() - t0}`);
    return out;
  }
  return res;
}
