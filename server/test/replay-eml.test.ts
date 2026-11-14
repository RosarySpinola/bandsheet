import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Quote } from "@phala/dcap-qvl";
import { describe, expect, it } from "vitest";
import { SERVER_DIR } from "../src/env";
import { extractJsonObject } from "../src/json";
import { NearAiClient } from "../src/nearai/client";
import { DEFAULT_ACCEPTED_TCB, type QuoteVerifier } from "../src/nearai/verify";
import { SpendGuard } from "../src/spend";

/**
 * Replays a REAL exchange recorded by `pnpm --filter server verify:live --only-eml`: a DKIM-signed synthetic
 * payslip .eml read by glm-5.3-flash inside NEAR AI Cloud's TEE (reasoning_effort low), with a real
 * provider_tee signature. Intel's certificate chain is not re-checked offline (parse-only stand-in).
 */
const rec = JSON.parse(readFileSync(resolve(SERVER_DIR, "fixtures/recorded-eml.json"), "utf8"));
const parseOnly: QuoteVerifier = async (raw) => {
  const td = Quote.parse(raw).report.asTd10()!;
  return { status: "UpToDate", advisoryIds: [], reportData: td.reportData, mrConfigId: td.mrConfigId, rtMr3: td.rtMr3, tdAttributes: td.tdAttributes };
};

describe("verifiedChat on the recorded .eml extraction", () => {
  it("verifies attestation, byte-exact request/response hashes and the signature; the model read EUR 3,433.33", async () => {
    const guard = new SpendGuard({ path: join(mkdtempSync(join(tmpdir(), "replay-eml-")), ".spend.json"), getPrice: async () => ({ prompt: 8e-8, completion: 5e-7 }) });
    const sent: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/v1/attestation/report")) return Response.json(rec.attestation);
      if (u.includes("/v1/chat/completions")) { sent.push(String(init?.body)); return new Response(rec.responseText); }
      if (u.includes("/v1/signature/")) return Response.json(rec.signature);
      return new Response("nope", { status: 404 });
    }) as typeof fetch;
    const client = new NearAiClient({
      baseUrl: "https://example.invalid", guard, apiKey: () => "k", fetchImpl, signatureRetryMs: 1, nonceFn: () => rec.nonce,
      deps: { verifyQuote: parseOnly, verifyGpu: async () => ({ ok: true, detail: "stub" }), acceptedTcb: DEFAULT_ACCEPTED_TCB },
    });
    const orig = JSON.parse(rec.requestBody) as { model: string; messages: never[]; max_tokens: number; temperature: number; reasoning_effort: "low" };
    const out = await client.verifiedChat({ ...orig, estimatedInputTokens: 900 });
    expect(sent[0]).toBe(rec.requestBody);
    expect(out.verified.all_passed).toBe(true);
    expect(orig.reasoning_effort).toBe("low");
    expect(JSON.stringify(orig.messages)).toContain("Employee ID: HC-8407");
    expect(extractJsonObject(out.content)).toMatchObject({ gross_amount: 3433.33, period: "monthly", currency: "EUR", grade_guess: "Reporter" });
  });
});
