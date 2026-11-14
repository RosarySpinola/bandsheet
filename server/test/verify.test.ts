import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Quote } from "@phala/dcap-qvl";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { describe, expect, it } from "vitest";
import { SERVER_DIR } from "../src/env";
import { type SignatureResponse, recoverEthAddress, sha256Hex, verifyResponseSignature } from "../src/nearai/signature";
import { DEFAULT_ACCEPTED_TCB, type QuoteVerifier, type VerifyDeps, replayRtmr3, verifyReport } from "../src/nearai/verify";

/** REAL report recorded from cloud-api.near.ai (free attestation call) with our nonce. */
const fx = JSON.parse(readFileSync(resolve(SERVER_DIR, "fixtures/attestation-qwen.json"), "utf8"));
const NONCE: string = fx.nonce;

/**
 * Offline stand-in for the Intel DCAP signature-chain check: it parses the real TDX quote and returns
 * its real report fields, but does not validate Intel's certificate chain (that runs live in
 * `pnpm --filter server verify:live` and `scripts/check-fixture.ts`).
 */
const parseOnly: QuoteVerifier = async (raw) => {
  const td = Quote.parse(raw).report.asTd10()!;
  return { status: "UpToDate", advisoryIds: [], reportData: td.reportData, mrConfigId: td.mrConfigId, rtMr3: td.rtMr3, tdAttributes: td.tdAttributes };
};
const deps = (over: Partial<VerifyDeps> = {}): VerifyDeps => ({
  verifyQuote: parseOnly,
  verifyGpu: async () => ({ ok: true, detail: "stub" }),
  acceptedTcb: DEFAULT_ACCEPTED_TCB,
  ...over,
});
const failing = (r: { checks: { id: string; pass: boolean }[] }) => r.checks.filter((c) => !c.pass).map((c) => c.id);

describe("attestation verification on a recorded real report", () => {
  it("passes every gateway and model check", async () => {
    const g = await verifyReport("gateway", fx.report.gateway_attestation, NONCE, deps());
    expect(failing(g)).toEqual([]);
    expect(g.identity?.address).toBe(fx.report.gateway_attestation.signing_address);
    for (const m of fx.report.model_attestations) {
      const r = await verifyReport("model", m, NONCE, deps());
      expect(failing(r)).toEqual([]);
      expect(r.checks.map((c) => c.id)).toContain("model.gpu");
    }
  });

  it("rejects a replayed report (different nonce)", async () => {
    const r = await verifyReport("gateway", fx.report.gateway_attestation, "00".repeat(32), deps());
    expect(failing(r)).toEqual(expect.arrayContaining(["gateway.nonce_echo", "gateway.report_data"]));
    expect(r.identity).toBeUndefined();
  });

  it("rejects a swapped signing address", async () => {
    const bad = { ...fx.report.gateway_attestation, signing_address: "0x" + "11".repeat(20) };
    expect(failing(await verifyReport("gateway", bad, NONCE, deps()))).toContain("gateway.report_data");
  });

  it("rejects a tampered app_compose", async () => {
    const m = structuredClone(fx.report.model_attestations[0]);
    const info = typeof m.info.tcb_info === "string" ? JSON.parse(m.info.tcb_info) : m.info.tcb_info;
    info.app_compose += " ";
    m.info.tcb_info = typeof m.info.tcb_info === "string" ? JSON.stringify(info) : info;
    expect(failing(await verifyReport("model", m, NONCE, deps()))).toContain("model.compose_hash");
  });

  it("rejects a tampered event log", async () => {
    const m = structuredClone(fx.report.model_attestations[0]);
    const log = typeof m.event_log === "string" ? JSON.parse(m.event_log) : m.event_log;
    const i = log.findIndex((e: { imr: number }) => e.imr === 3);
    log[i].event_payload = "00" + log[i].event_payload.slice(2);
    log[i].digest = "";
    m.event_log = typeof m.event_log === "string" ? JSON.stringify(log) : log;
    expect(failing(await verifyReport("model", m, NONCE, deps()))).toContain("model.rtmr3");
    expect(() => replayRtmr3(fx.report.model_attestations[0].event_log)).not.toThrow();
  });

  it("rejects an unaccepted TCB status, debug mode and failing GPU evidence", async () => {
    const stale = deps({ verifyQuote: async (q) => ({ ...(await parseOnly(q)), status: "OutOfDate" }) });
    expect(failing(await verifyReport("gateway", fx.report.gateway_attestation, NONCE, stale))).toContain("gateway.tdx_quote");
    const dbg = deps({ verifyQuote: async (q) => ({ ...(await parseOnly(q)), tdAttributes: Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 0]) }) });
    expect(failing(await verifyReport("gateway", fx.report.gateway_attestation, NONCE, dbg))).toContain("gateway.tdx_quote");
    const gpu = deps({ verifyGpu: async () => ({ ok: false, detail: "nras said no" }) });
    expect(failing(await verifyReport("model", fx.report.model_attestations[0], NONCE, gpu))).toContain("model.gpu");
  });
});

/** SYNTHETIC signer: a locally generated secp256k1 key standing in for a TEE signing key. */
function signEip191(text: string, priv: Uint8Array): { signature: string; address: string } {
  const body = Buffer.from(text, "utf8");
  const digest = keccak_256(Buffer.concat([Buffer.from(`\x19Ethereum Signed Message:\n${body.length}`), body]));
  const rec = secp256k1.sign(digest, priv, { prehash: false, format: "recovered" });
  const sig = Buffer.concat([Buffer.from(rec.slice(1)), Buffer.from([rec[0]! + 27])]);
  const pub = secp256k1.getPublicKey(priv, false).slice(1);
  return { signature: `0x${sig.toString("hex")}`, address: `0x${Buffer.from(keccak_256(pub).slice(12)).toString("hex")}` };
}

describe("response signature verification (synthetic signer)", () => {
  const model = "Qwen/Qwen3-VL-30B-A3B-Instruct";
  const requestBody = JSON.stringify({ model, messages: [{ role: "user", content: "hi" }], stream: false });
  const responseBytes = new TextEncoder().encode('{"id":"chatcmpl-1","choices":[]}');
  const priv = secp256k1.utils.randomSecretKey();
  const make = (kind: "provider_tee" | "gateway", reqB = requestBody, resB: Uint8Array = responseBytes): SignatureResponse => {
    const text = kind === "provider_tee" ? `${model}:${sha256Hex(reqB)}:${sha256Hex(resB)}` : `${sha256Hex(reqB)}:${sha256Hex(resB)}`;
    const { signature, address } = signEip191(text, priv);
    return { text, signature, signing_address: address, signing_algo: "ecdsa", signature_kind: kind };
  };
  const ctx = (addr: string, pool: "models" | "gateway" = "models") => ({
    requestBody, responseBytes, model,
    gateway: pool === "gateway" ? [{ address: addr, algo: "ecdsa" }] : [],
    models: pool === "models" ? [{ address: addr, algo: "ecdsa" }] : [],
  });

  it("recovers the EIP-191 signer", () => {
    const s = make("provider_tee");
    expect(recoverEthAddress(s.text, s.signature).toLowerCase()).toBe(s.signing_address.toLowerCase());
  });
  it("passes for a model-TEE signature matching the attested signer", () => {
    const s = make("provider_tee");
    expect(verifyResponseSignature(s, ctx(s.signing_address)).every((c) => c.pass)).toBe(true);
  });
  it("passes for a gateway signature matching the attested gateway", () => {
    const s = make("gateway");
    expect(verifyResponseSignature(s, ctx(s.signing_address, "gateway")).every((c) => c.pass)).toBe(true);
  });
  it("fails when the response bytes were altered", () => {
    const s = make("provider_tee");
    const c = { ...ctx(s.signing_address), responseBytes: new TextEncoder().encode("tampered") };
    expect(verifyResponseSignature(s, c).find((x) => x.id === "signature.hashes")?.pass).toBe(false);
  });
  it("fails when the signer was not attested, or the kind is missing", () => {
    const s = make("provider_tee");
    expect(verifyResponseSignature(s, ctx("0x" + "22".repeat(20))).find((x) => x.id === "signature.signer_attested")?.pass).toBe(false);
    const { signature_kind: _k, ...noKind } = s;
    expect(verifyResponseSignature(noKind, ctx(s.signing_address)).find((x) => x.id === "signature.kind")?.pass).toBe(false);
  });
  it("fails on a forged signature", () => {
    const s = make("provider_tee");
    const forged = { ...s, signature: signEip191(s.text, secp256k1.utils.randomSecretKey()).signature };
    expect(verifyResponseSignature(forged, ctx(s.signing_address)).find((x) => x.id === "signature.valid")?.pass).toBe(false);
  });
});
