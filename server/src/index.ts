import { serve } from "@hono/node-server";
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

export function buildDeps(): Deps {
  const chainCfg = loadChainConfig();
  const config = { ...getConfig(), ...(getConfig().contract ? {} : { contract: chainCfg.unit }) };
  const chain = createChainPort(process.env.NEAR_RPC_URLS?.split(",").map((u) => u.trim()));
  const prices = createPriceSource(config.baseUrl);
  const guard = new SpendGuard({ path: config.ledgerPath, getPrice: prices.getPrice });
  const client = new NearAiClient({
    baseUrl: config.baseUrl,
    guard,
    apiKey,
    ownedBy: prices.ownedBy,
    deps: { verifyQuote: verifyQuoteDcap, verifyGpu: verifyGpuNras, acceptedTcb: DEFAULT_ACCEPTED_TCB },
  });
  return {
    config,
    guard,
    chat: async (req) => {
      if (!config.hasKey) throw new AppError(503, "NEARAI_API_KEY is not configured", "NO_API_KEY");
      return client.verifiedChat(req);
    },
    chain,
    chainCfg,
    view: (contractId, method, args) => chain.view(contractId, method, args),
  };
}

const deps = buildDeps();
serve({ fetch: createApp(deps).fetch, port: deps.config.port });
process.stdout.write(`bandsheet server on :${deps.config.port} (live=${deps.config.hasKey})\n`);
