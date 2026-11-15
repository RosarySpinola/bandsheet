import { createHash } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { GradeSchema } from "@bandsheet/core";
import type { Deps } from "../deps";
import { AppError } from "../errors";
import { UnitClaim, verifyUnitClaim } from "../units/claim";
import { SYNTHETIC_CAP, body, consume, need, nowOf, readFail, readUnit, registrarOf, sendOrFail, txOut, unitIdOf } from "../units/deps";
import { dkimSignatures, fetchDkimKey } from "../units/dkim";
import { makeSynthetic } from "../units/synthetic";

const SyntheticBody = UnitClaim.extend({ n: z.number().int().min(1).max(SYNTHETIC_CAP), grade: GradeSchema.optional() });
const IssuerBody = z.object({
  eml: z.string().min(20).max(400_000),
  /** Test seam: a council member supplies the key for a listed domain that has no DNS record. Recorded as "supplied". */
  supplied_key: z.string().min(200).max(4000).optional(),
  claim: UnitClaim.optional(),
});

/** Base64 SPKI body of a PEM or bare base64 key. */
const spki = (key: string): string => key.split("\n").filter((l) => !l.startsWith("-----")).join("").replace(/\s+/g, "");

export function unitAdminRoutes(deps: Deps): Hono {
  const app = new Hono();

  /**
   * Council-signed: add n synthetic colleagues (sample data). Each gets a fresh posting key flagged synthetic on chain and
   * one sealed entry with a realistic grade and random pay, which exists only inside the ciphertext.
   */
  app.post("/:id/synthetic", async (c) => {
    const u = need(deps);
    const id = unitIdOf(c.req.param("id"));
    const b = await body(c, SyntheticBody);
    const registrar = registrarOf(u);
    await consume(u, b.nonce, "unit_synthetic");
    const account = await verifyUnitClaim(b, { purpose: "unit_synthetic", unitId: id, subject: String(b.n), recipient: u.cfg.contract }, u.keys);
    const unit = await readUnit(u, id);
    if (!unit.council.includes(account)) throw new AppError(403, `${account} is not on unit ${id}'s council`, "NOT_COUNCIL");
    const before = unit.synthetic_added;
    if (before + b.n > SYNTHETIC_CAP) {
      throw new AppError(409, `a unit has at most ${SYNTHETIC_CAP} synthetic colleagues (${before} added)`, "SYNTHETIC_CAP");
    }
    const policy = await u.chain.view<{ enclave_pubkey: string }>("get_policy").catch(() => {
      throw readFail();
    });
    const members = makeSynthetic(b.n, policy.enclave_pubkey, b.grade);
    // one transaction per key: a function-call access key (the registrar's) may sign only single-action transactions
    const adds = [];
    for (const m of members) {
      adds.push(await sendOrFail(u.chain.call(registrar, [{ method: "unit_add_member", args: { unit_id: id, public_key: m.publicKey, invite_code: "", synthetic: true }, tgas: 30 }])));
    }
    const add = adds[0]!;
    const submits = await Promise.all(members.map((m) => u.chain.submitAs(m.privateKey, m.ciphertext).catch(() => null)));
    const landed = submits.filter((s) => s?.ok);
    return c.json({
      unit_id: id,
      synthetic: true,
      added: members.length,
      submitted: landed.length,
      synthetic_total: before + members.length,
      add_tx: txOut(u, add.hash),
      add_txs: adds.map((a) => txOut(u, a.hash)),
      txs: landed.map((s) => txOut(u, s!.hash)),
      note: "Synthetic colleagues are sample data. They are flagged on chain and counted separately in every release.",
    });
  });

  /**
   * Record the employer's DKIM key for a listed domain, read from a payslip email's DKIM-Signature (d=, s=). The key comes
   * from DNS over HTTPS; or, for a test domain with no DNS record, a council member supplies it (flagged "supplied, not DNS").
   */
  app.post("/:id/issuer", async (c) => {
    const u = need(deps);
    const id = unitIdOf(c.req.param("id"));
    const b = await body(c, IssuerBody);
    const registrar = registrarOf(u);
    const unit = await readUnit(u, id);
    const sigs = dkimSignatures(b.eml);
    if (sigs.length === 0) throw new AppError(422, "this email carries no DKIM signature", "NO_DKIM");
    const sig = sigs.find((s) => unit.dkim_domains.includes(s.domain));
    if (!sig) {
      throw new AppError(422, `the email is signed by ${sigs.map((s) => s.domain).join(", ")}, which is not one of this unit's DKIM domains`, "DOMAIN_NOT_LISTED");
    }
    let key: string;
    let source: "dns" | "supplied";
    if (b.supplied_key !== undefined) {
      if (!b.claim) throw new AppError(400, "a supplied key needs a council member's signed claim", "BAD_REQUEST");
      await consume(u, b.claim.nonce, "unit_issuer");
      const account = await verifyUnitClaim(b.claim, { purpose: "unit_issuer", unitId: id, subject: `${sig.domain} ${sig.selector}`, recipient: u.cfg.contract }, u.keys);
      if (!unit.council.includes(account)) throw new AppError(403, `${account} is not on unit ${id}'s council`, "NOT_COUNCIL");
      key = spki(b.supplied_key);
      source = "supplied";
    } else {
      key = await fetchDkimKey(sig.domain, sig.selector, u.doh);
      source = "dns";
    }
    if (!/^[A-Za-z0-9+/=]{200,2048}$/.test(key)) throw new AppError(422, "the issuer key is not a base64 RSA public key", "BAD_KEY");
    const tx = await sendOrFail(
      u.chain.call(registrar, [
        { method: "unit_add_issuer", args: { unit_id: id, domain: sig.domain, selector: sig.selector, public_key_pem_or_fingerprint: key, source }, tgas: 30 },
      ]),
    );
    return c.json({
      unit_id: id, domain: sig.domain, selector: sig.selector, source, key_sha256: createHash("sha256").update(key).digest("hex"), tx: txOut(u, tx.hash),
      note: source === "supplied" ? "Supplied by a council member, not read from DNS." : `Read from DNS: ${sig.selector}._domainkey.${sig.domain}`,
    });
  });

  /**
   * Start the engine run of an approved proposal. A wallet votes with a cheap 30 Tgas call; the passing vote marks the
   * proposal approved, and this route pays the 300 Tgas `unit_run` from the sponsor account. The contract only runs a
   * proposal more than half of its council approved, so no signature is needed here.
   */
  app.post("/:id/run", async (c) => {
    const u = need(deps);
    const id = unitIdOf(c.req.param("id"));
    const b = await body(c, z.object({ proposal_id: z.number().int().min(1).max(1_000_000) }));
    if (!u.cfg.sponsor) throw new AppError(503, "the run relayer is not configured on this server", "SPONSOR_NOT_CONFIGURED");
    const list = await u.chain.view<{ id: number; status: string }[]>("get_unit_proposals", { unit_id: id, from: b.proposal_id - 1, limit: 1 }).catch(() => {
      throw readFail();
    });
    const p = list.find((x) => x.id === b.proposal_id);
    if (!p) throw new AppError(404, `unit ${id} has no proposal ${b.proposal_id}`, "PROPOSAL_NOT_FOUND");
    if (p.status !== "approved") throw new AppError(409, `proposal ${b.proposal_id} is ${p.status}; only an approved proposal runs`, "NOT_APPROVED");
    // returns once included; whether the run started is read back from the contract (the engine itself takes a minute)
    const sent = await u.chain.callIncluded(u.cfg.sponsor, { method: "unit_run", args: { unit_id: id, proposal_id: b.proposal_id }, tgas: 300 }).catch(() => {
      throw new AppError(502, "NEAR testnet did not accept the transaction just now; try again", "CHAIN_WRITE");
    });
    // Kept so the release this run produces can link it (a missing table must not stop the run).
    await u.store.putRun(id, b.proposal_id, sent.hash, nowOf(u)).catch(() => undefined);
    let status = "approved";
    for (let i = 0; i < 10 && status === "approved"; i++) {
      await new Promise((r) => setTimeout(r, i === 0 ? 0 : u.pollMs ?? 1500));
      const now = await u.chain.view<{ id: number; status: string }[]>("get_unit_proposals", { unit_id: id, from: b.proposal_id - 1, limit: 1 }).catch(() => []);
      status = now.find((x) => x.id === b.proposal_id)?.status ?? status;
    }
    if (status === "approved") throw new AppError(422, "the run did not start (the unit may have a run in flight or hit its daily cap); see the transaction", "RUN_NOT_STARTED");
    return c.json({ unit_id: id, proposal_id: b.proposal_id, status, tx: txOut(u, sent.hash), note: "The engine is running; the release lands in about a minute." });
  });

  return app;
}
