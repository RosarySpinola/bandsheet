import { randomBytes } from "node:crypto";
import { AppError } from "../errors";
import type { SpendGuard, Usage } from "../spend";
import { type SignatureResponse, verifyResponseSignature } from "./signature";
import { type AttestationReport, type Check, type Identity, type VerifyDeps, verifyReport } from "./verify";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}
export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens: number;
  temperature?: number;
  /** Reasoning models (glm-5.3-flash) otherwise spend the whole budget thinking; "low" keeps it minimal. */
  reasoning_effort?: "low";
  /** Upper-bound estimate of input tokens, used only to project spend before the call. */
  estimatedInputTokens: number;
}

/** What the UI's Verified panel renders. */
export interface Verified {
  all_passed: boolean;
  model: string;
  owned_by?: string;
  nonce: string;
  chat_id?: string;
  signature_kind?: string;
  signers: { gateway?: string; model: string[] };
  checks: Check[];
  verified_at: string;
}

export interface VerifiedChat {
  content: string;
  usage: Usage;
  verified: Verified;
}

export interface NearAiOptions {
  baseUrl: string;
  guard: SpendGuard;
  deps: VerifyDeps;
  ownedBy?: (model: string) => Promise<string | undefined>;
  /** Called at request time so the key is never held in a long-lived object. */
  apiKey: () => string | undefined;
  /** When true (default) the payslip is never sent unless every preflight check passed. */
  requireAttestation?: boolean;
  fetchImpl?: typeof fetch;
  signatureRetryMs?: number;
  /** Test seam: replaces the random 32-byte nonce (never set in production). */
  nonceFn?: () => string;
  /** Test seam: receives the raw exchange so a real run can be saved as a fixture. */
  record?: (r: RecordedExchange) => void;
}

export interface RecordedExchange {
  nonce: string;
  attestation: unknown;
  requestBody: string;
  responseText: string;
  signature: SignatureResponse | undefined;
}

const upstream = (status: number, what: string): AppError => {
  const e = new AppError(502, `NEAR AI Cloud ${what} failed (HTTP ${status})`, "UPSTREAM");
  (e as unknown as { unbilled: boolean }).unbilled = status >= 400 && status < 500;
  return e;
};

export class NearAiClient {
  private readonly f: typeof fetch;
  constructor(private readonly o: NearAiOptions) {
    this.f = o.fetchImpl ?? ((input, init) => fetch(input, init)); // a bare `fetch` called as this.f() throws "Illegal invocation" on Workers
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const key = this.o.apiKey();
    return { accept: "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}), ...extra };
  }

  async fetchAttestation(model: string, nonce: string): Promise<{
    gateway_attestation?: AttestationReport;
    model_attestations?: AttestationReport[];
  }> {
    const q = new URLSearchParams({ model, provider: "near", signing_algo: "ecdsa", nonce, include_tls_fingerprint: "false" });
    let res = await this.f(`${this.o.baseUrl}/v1/attestation/report?${q}`, { headers: this.headers({ "x-no-aliasing": "true" }) });
    if (res.status === 429) {
      const wait = Math.min(5, Number(res.headers.get("retry-after") ?? 1)) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      res = await this.f(`${this.o.baseUrl}/v1/attestation/report?${q}`, { headers: this.headers({ "x-no-aliasing": "true" }) });
    }
    if (!res.ok) throw upstream(res.status, "attestation");
    return (await res.json()) as { gateway_attestation?: AttestationReport; model_attestations?: AttestationReport[] };
  }

  private async fetchSignature(chatId: string, model: string): Promise<SignatureResponse | undefined> {
    const q = new URLSearchParams({ model, signing_algo: "ecdsa" });
    for (let i = 0; i < 5; i++) {
      const res = await this.f(`${this.o.baseUrl}/v1/signature/${encodeURIComponent(chatId)}?${q}`, { headers: this.headers() });
      if (res.ok) {
        const body = (await res.json()) as Partial<SignatureResponse> & { error_code?: unknown };
        if (body.text && body.signature && !body.error_code) return body as SignatureResponse;
      } else if (res.status !== 404) {
        throw upstream(res.status, "signature lookup");
      }
      await new Promise((r) => setTimeout(r, this.o.signatureRetryMs ?? 1000));
    }
    return undefined;
  }

  /**
   * The full verified round trip: fresh-nonce attestation (gateway + model TEE) verified BEFORE the
   * request leaves, the completion on exact bytes, then the response signature checked against the
   * signers we verified. Nothing from the request or response is stored here.
   */
  async verifiedChat(req: ChatRequest): Promise<VerifiedChat> {
    const { guard } = this.o;
    const nonce = this.o.nonceFn ? this.o.nonceFn() : randomBytes(32).toString("hex");
    const checks: Check[] = [];

    const report = await guard.call(req.model, "attestation", { free: true }, async () => ({
      r: await this.fetchAttestation(req.model, nonce),
    }));
    const gw = report.r.gateway_attestation;
    const models = report.r.model_attestations ?? [];
    const gatewayIds: Identity[] = [];
    const modelIds: Identity[] = [];

    if (gw) {
      const res = await verifyReport("gateway", gw, nonce, this.o.deps);
      checks.push(...res.checks);
      if (res.identity) gatewayIds.push(res.identity);
    } else {
      checks.push({ id: "gateway.present", label: "Gateway attestation returned", pass: false });
    }
    checks.push({ id: "model.present", label: "Model TEE attestation(s) returned", pass: models.length > 0, detail: `${models.length} candidate(s)` });
    for (const m of models) {
      const res = await verifyReport("model", m, nonce, this.o.deps);
      checks.push(...res.checks);
      if (res.identity) modelIds.push(res.identity);
    }

    const preflightOk = checks.every((c) => c.pass);
    if (!preflightOk && this.o.requireAttestation !== false) {
      throw new AppError(502, "attestation failed; refusing to send data to an unverified endpoint", "ATTESTATION_FAILED");
    }

    const body = JSON.stringify({
      model: req.model,
      messages: req.messages,
      stream: false,
      max_tokens: req.max_tokens,
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      ...(req.reasoning_effort ? { reasoning_effort: req.reasoning_effort } : {}),
    });
    const out = await guard.call(
      req.model,
      "chat",
      { inputTokens: req.estimatedInputTokens, maxOutputTokens: req.max_tokens },
      async () => {
        const res = await this.f(`${this.o.baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: this.headers({ "content-type": "application/json", "accept-encoding": "identity", "x-no-aliasing": "true" }),
          body,
        });
        if (!res.ok) throw upstream(res.status, "completion");
        const bytes = new Uint8Array(await res.arrayBuffer());
        const json = JSON.parse(Buffer.from(bytes).toString("utf8")) as {
          id?: string;
          choices?: { message?: { content?: string | null } }[];
          usage?: Usage;
        };
        return { bytes, json, usage: json.usage };
      },
    );

    const chatId = out.json.id;
    let kind: string | undefined;
    let recordedSig: SignatureResponse | undefined;
    if (chatId) {
      const sig = await guard.call(req.model, "signature", { free: true }, async () => ({ s: await this.fetchSignature(chatId, req.model) }));
      recordedSig = sig.s;
      if (sig.s) {
        kind = sig.s.signature_kind;
        checks.push(...verifyResponseSignature(sig.s, { requestBody: body, responseBytes: out.bytes, model: req.model, gateway: gatewayIds, models: modelIds }));
      } else {
        checks.push({ id: "signature.available", label: "Response signature available", pass: false, detail: "none returned after retries" });
      }
    } else {
      checks.push({ id: "signature.available", label: "Response signature available", pass: false, detail: "no chat id" });
    }

    this.o.record?.({
      nonce, attestation: report.r, requestBody: body, responseText: Buffer.from(out.bytes).toString("utf8"), signature: recordedSig,
    });
    const owned = await this.o.ownedBy?.(req.model);
    const verified: Verified = {
      all_passed: checks.every((c) => c.pass),
      model: req.model,
      ...(owned ? { owned_by: owned } : {}),
      nonce,
      ...(chatId ? { chat_id: chatId } : {}),
      ...(kind ? { signature_kind: kind } : {}),
      signers: { ...(gatewayIds[0] ? { gateway: gatewayIds[0].address } : {}), model: modelIds.map((i) => i.address) },
      checks,
      verified_at: new Date().toISOString(),
    };
    return { content: out.json.choices?.[0]?.message?.content ?? "", usage: out.usage ?? {}, verified };
  }
}
