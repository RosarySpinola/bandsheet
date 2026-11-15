import { createHash } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { GradeSchema } from "@bandsheet/core";
import type { Deps } from "../deps";
import { AppError } from "../errors";
import { UnitClaim, verifyUnitClaim } from "../units/claim";
import { SYNTHETIC_CAP, body, consume, need, readFail, readUnit, registrarOf, sendOrFail, txOut, unitIdOf } from "../units/deps";
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
    const add = await sendOrFail(
      u.chain.call(
        registrar,
        members.map((m) => ({ method: "unit_add_member", args: { unit_id: id, public_key: m.publicKey, invite_code: "", synthetic: true }, tgas: 25 })),
      ),
    );
    const submits = await Promise.all(members.map((m) => u.chain.submitAs(m.privateKey, m.ciphertext).catch(() => null)));
    const landed = submits.filter((s) => s?.ok);
    return c.json({
      unit_id: id,
      synthetic: true,
      added: members.length,
      submitted: landed.length,
      synthetic_total: before + members.length,
      add_tx: txOut(u, add.hash),
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

  return app;
}
