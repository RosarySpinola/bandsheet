import { Hono } from "hono";
import { z } from "zod";
import { CiphertextSchema } from "@bandsheet/core";
import { TESTNET_RPCS } from "@bandsheet/core/near";
import { assertFunded } from "../chain/dao";
import type { Deps } from "../deps";
import { AppError } from "../errors";

const SubmitSchema = z.object({
  ciphertext: CiphertextSchema.refine((c) => c.epk.length + c.nonce.length + c.ct.length < 6000, "ciphertext too large"),
});

/**
 * The demo member: one registered member whose key may only call `submit` on the unit (a function-call
 * access key with a small allowance). Handing it to the browser on testnet is deliberate and harmless.
 */
export function demoRoutes(deps: Deps): Hono {
  const { chain, chainCfg: cfg } = deps;
  const app = new Hono();
  const invite = () => {
    if (!cfg.demoInvite) throw new AppError(503, "no demo member is configured on this server", "DEMO_NOT_CONFIGURED");
    return cfg.demoInvite;
  };

  app.get("/invite", (c) => {
    const i = invite();
    return c.json({
      account_id: i.accountId,
      contract_id: i.contractId,
      network: "testnet",
      rpc_urls: TESTNET_RPCS,
      public_key: i.publicKey,
      private_key: i.privateKey,
      slot: i.slot,
      submit_method: "submit",
      note: "Function-call key: it can only call submit on the unit account (testnet).",
    });
  });

  app.post("/submit", async (c) => {
    const i = invite();
    const parsed = SubmitSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw new AppError(400, "invalid request", "BAD_REQUEST");
    await assertFunded(chain, cfg.unit);
    const tx = await chain.send({ accountId: i.contractId, privateKey: i.privateKey }, i.contractId, "submit", { ciphertext: parsed.data.ciphertext }, { tgas: 30 });
    if (!tx.ok) throw new AppError(422, `the chain refused: ${tx.error || "transaction failed"}`, "CHAIN_REJECTED");
    return c.json({ slot: i.slot, entry_count: Number(tx.value ?? 0) || null, tx: { hash: tx.hash, url: `${cfg.explorer.tx}${tx.hash}` } });
  });

  return app;
}
