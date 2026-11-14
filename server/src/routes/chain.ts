import { Hono } from "hono";
import { z } from "zod";
import { councilSigner } from "../chain/config";
import { ProposeSchema, VoteSchema, listReleaseProposals, proposeRelease, voteRelease } from "../chain/dao";
import type { Deps } from "../deps";
import { AppError } from "../errors";

interface PolicyView {
  unit: string;
  owner: string;
  dao: string;
  demo_owner_override: boolean;
  policy: { enclave_pubkey?: string } & Record<string, unknown>;
  outlayer: { account?: string; source?: string };
  members: number;
  entries: number;
  releases: number;
  in_flight: unknown;
}

const readFail = (): AppError => new AppError(502, "could not read NEAR testnet", "CHAIN_READ");
const json = async (c: { req: { json: () => Promise<unknown> } }): Promise<unknown> => c.req.json().catch(() => null);

export function chainRoutes(deps: Deps): Hono {
  const { chain, chainCfg: cfg } = deps;
  const app = new Hono();
  const txOut = (hash: string) => ({ hash, url: `${cfg.explorer.tx}${hash}` });

  app.get("/unit", async (c) => {
    const p = await chain.view<PolicyView>(cfg.unit, "get_policy").catch(() => {
      throw readFail();
    });
    return c.json({
      network: "testnet",
      unit: cfg.unit,
      dao: cfg.dao,
      council: cfg.council,
      owner: p.owner,
      policy: p.policy,
      enclave_pubkey: p.policy.enclave_pubkey ?? null,
      outlayer: { account: p.outlayer?.account ?? null, source: p.outlayer?.source ?? null },
      member_count: p.members,
      entry_count: p.entries,
      release_count: p.releases,
      in_flight: p.in_flight ?? null,
      explorer: {
        ...cfg.explorer,
        unit_url: `${cfg.explorer.address}${cfg.unit}`,
        dao_url: `${cfg.explorer.address}${cfg.dao}`,
        council_urls: cfg.council.map((id) => `${cfg.explorer.address}${id}`),
      },
    });
  });

  app.get("/dao/proposals", async (c) => {
    const q = z.coerce.number().int().min(1).max(200).catch(50).parse(c.req.query("limit"));
    const proposals = await listReleaseProposals(chain, cfg, q).catch(() => {
      throw readFail();
    });
    return c.json({ dao: cfg.dao, proposals });
  });

  app.post("/dao/propose", async (c) => {
    const parsed = ProposeSchema.safeParse(await json(c));
    if (!parsed.success) throw new AppError(400, "invalid request", "BAD_REQUEST");
    const signer = councilSigner(cfg, 1);
    if (!signer) throw new AppError(503, "council key 1 is not configured on this server", "COUNCIL_KEY_MISSING");
    const r = await proposeRelease(chain, cfg, signer, parsed.data);
    return c.json({ proposal_id: r.proposal_id, description: r.description, proposer: signer.accountId, tx: txOut(r.tx.hash) });
  });

  app.post("/dao/vote", async (c) => {
    const parsed = VoteSchema.safeParse(await json(c));
    if (!parsed.success) throw new AppError(400, "invalid request", "BAD_REQUEST");
    const signer = councilSigner(cfg, parsed.data.member);
    if (!signer) throw new AppError(503, `council key ${parsed.data.member} is not configured on this server`, "COUNCIL_KEY_MISSING");
    const r = await voteRelease(chain, cfg, signer, parsed.data);
    return c.json({
      proposal_id: parsed.data.proposal_id,
      voter: signer.accountId,
      action: parsed.data.action,
      status: r.status,
      votes: r.votes,
      tx: txOut(r.tx.hash),
      note: r.status === "Approved" ? "Vote passed: the contract has called OutLayer; the release record lands in /api/releases shortly." : undefined,
    });
  });

  return app;
}
