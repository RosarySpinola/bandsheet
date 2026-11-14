import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Quote } from "@phala/dcap-qvl";
import { describe, expect, it } from "vitest";
import { SERVER_DIR } from "../src/env";
import { AppError } from "../src/errors";
import { NearAiClient } from "../src/nearai/client";
import { DEFAULT_ACCEPTED_TCB, type QuoteVerifier } from "../src/nearai/verify";
import { SpendGuard } from "../src/spend";

/**
 * Replays a REAL exchange recorded by `pnpm --filter server verify:live` (glm-5.3-flash, three model
 * TEE candidates sharing one signing key, a real provider_tee signature) through the whole
 * verifiedChat pipeline with a fake fetch. Intel's certificate chain is not re-checked offline
 * (parse-only stand-in); the live script covers it.
 */
const rec = JSON.parse(readFileSync(resolve(SERVER_DIR, "fixtures/recorded-stand.json"), "utf8"));
const parseOnly: QuoteVerifier = async (raw) => {
  const td = Quote.parse(raw).report.asTd10()!;
  return { status: "UpToDate", advisoryIds: [], reportData: td.reportData, mrConfigId: td.mrConfigId, rtMr3: td.rtMr3, tdAttributes: td.tdAttributes };
};

function makeClient(over: { sigBody?: unknown; respText?: string; attest?: unknown } = {}) {
  const guard = new SpendGuard({ path: join(mkdtempSync(join(tmpdir(), "replay-")), ".spend.json"), getPrice: async () => ({ prompt: 8e-8, completion: 5e-7 }) });
  const sent: string[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/v1/attestation/report")) return Response.json(over.attest ?? rec.attestation);
    if (u.includes("/v1/chat/completions")) {
      sent.push(String(init?.body));
      return new Response(over.respText ?? rec.responseText, { headers: { "content-type": "application/json" } });
    }
    if (u.includes("/v1/signature/")) return Response.json(over.sigBody ?? rec.signature);
    return new Response("nope", { status: 404 });
  }) as typeof fetch;
  const client = new NearAiClient({
    baseUrl: "https://example.invalid", guard, apiKey: () => "test-key", fetchImpl, signatureRetryMs: 1, nonceFn: () => rec.nonce,
    deps: { verifyQuote: parseOnly, verifyGpu: async () => ({ ok: true, detail: "stub" }), acceptedTcb: DEFAULT_ACCEPTED_TCB },
  });
  const original = JSON.parse(rec.requestBody) as { model: string; messages: never[]; max_tokens: number; temperature: number };
  const req = { model: original.model, messages: original.messages, max_tokens: original.max_tokens, temperature: original.temperature, estimatedInputTokens: 800 };
  return { client, req, sent, guard };
}

describe("verifiedChat on a recorded real exchange", () => {
  it("verifies attestation, request/response hashes and the real signature end to end", async () => {
    const { client, req, sent, guard } = makeClient();
    const out = await client.verifiedChat(req);
    expect(sent[0]).toBe(rec.requestBody); // byte-identical request
    expect(out.verified.all_passed).toBe(true);
    expect(out.verified.signature_kind).toBe("provider_tee");
    expect(out.verified.checks.filter((c) => c.id === "model.tdx_quote").length).toBe(rec.attestation.model_attestations.length);
    expect(out.verified.signers.gateway).toBe(rec.attestation.gateway_attestation.signing_address);
    expect((await guard.total())).toBeGreaterThan(0); // usage x price was ledgered
  });

  it("flags a response whose bytes were altered after signing", async () => {
    const { client, req } = makeClient({ respText: rec.responseText.replace("assistant", "assistanT") });
    const out = await client.verifiedChat(req);
    expect(out.verified.all_passed).toBe(false);
    expect(out.verified.checks.find((c) => c.id === "signature.hashes")?.pass).toBe(false);
  });

  it("refuses to send anything when attestation fails (wrong nonce echoed)", async () => {
    const att = structuredClone(rec.attestation);
    att.gateway_attestation.request_nonce = "00".repeat(32);
    const { client, req, sent } = makeClient({ attest: att });
    const err = await client.verifiedChat(req).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("ATTESTATION_FAILED");
    expect(sent).toHaveLength(0);
  });

  it("marks a missing signature as unverified", async () => {
    const { client, req } = makeClient({ sigBody: { error_code: "NOT_FOUND", message: "x" } });
    const out = await client.verifiedChat(req);
    expect(out.verified.all_passed).toBe(false);
    expect(out.verified.checks.find((c) => c.id === "signature.available")?.pass).toBe(false);
  });
});
