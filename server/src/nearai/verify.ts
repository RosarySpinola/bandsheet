import { createHash } from "node:crypto";

/** One line of the UI's "Verified" panel. */
export interface Check {
  id: string;
  label: string;
  pass: boolean;
  detail?: string;
}

export interface Identity {
  address: string;
  algo: string;
}

/** What we read out of a DCAP-verified TDX quote. */
export interface QuoteInfo {
  status: string;
  advisoryIds: string[];
  reportData: Uint8Array;
  mrConfigId: Uint8Array;
  rtMr3: Uint8Array;
  tdAttributes: Uint8Array;
}
export type QuoteVerifier = (quote: Uint8Array) => Promise<QuoteInfo>;
export type GpuVerifier = (payload: unknown, nonce: string) => Promise<{ ok: boolean; detail: string }>;

export interface VerifyDeps {
  verifyQuote: QuoteVerifier;
  verifyGpu: GpuVerifier;
  /** TCB statuses accepted by policy. */
  acceptedTcb: readonly string[];
}

export const DEFAULT_ACCEPTED_TCB = ["UpToDate", "SWHardeningNeeded"] as const;

/** Loose shape of gateway_attestation and model_attestations[] entries. */
export interface AttestationReport {
  intel_quote?: string;
  event_log?: unknown;
  request_nonce?: string;
  report_data?: string;
  signing_address?: string;
  signing_algo?: string;
  tls_cert_fingerprint?: string;
  nvidia_payload?: unknown;
  info?: { tcb_info?: unknown };
}

const hex = (v: string): Buffer => Buffer.from(v.replace(/^0x/i, ""), "hex");
const parse = (v: unknown): unknown => (typeof v === "string" ? JSON.parse(v) : v);
const h = (alg: string, ...parts: (Buffer | Uint8Array | string)[]): Buffer => {
  const x = createHash(alg);
  for (const p of parts) x.update(p);
  return x.digest();
};
const eq = (a: Uint8Array, b: Uint8Array): boolean => Buffer.from(a).equals(Buffer.from(b));

interface EventRow {
  imr: number;
  event_type: number;
  event: string;
  event_payload?: string;
  digest?: string;
}

/** Replay the RTMR3 event log: RTMR3 = SHA384(RTMR3 || SHA384(type_le32 ':' event ':' payload)). */
export function replayRtmr3(eventLog: unknown): Buffer {
  let rtmr3: Buffer = Buffer.alloc(48);
  for (const ev of parse(eventLog) as EventRow[]) {
    if (ev.imr !== 3) continue;
    const t = Buffer.alloc(4);
    t.writeUInt32LE(ev.event_type);
    const digest = h("sha384", t, ":", Buffer.from(ev.event, "utf8"), ":", hex(ev.event_payload ?? ""));
    if (ev.digest && !hex(ev.digest).equals(digest)) throw new Error(`digest mismatch for event ${ev.event}`);
    rtmr3 = h("sha384", rtmr3, digest);
  }
  return rtmr3;
}

/** MRCONFIGID = 0x01 || SHA256(app_compose) || 15 zero bytes. */
export function expectedMrConfigId(appCompose: string): Buffer {
  return Buffer.concat([Buffer.from([1]), h("sha256", Buffer.from(appCompose, "utf8")), Buffer.alloc(15)]);
}

export interface ReportResult {
  checks: Check[];
  /** Present only when every check on this report passed. */
  identity?: Identity;
}

/**
 * Verify one attestation report (gateway or one model TEE) against our fresh nonce.
 * Follows https://docs.near.ai/cloud/verification: nonce echo, DCAP quote and TCB, quote report
 * data binding signer and nonce, MRCONFIGID against app_compose, RTMR3 event-log replay and,
 * for model TEEs, NVIDIA GPU evidence.
 */
export async function verifyReport(
  scope: "gateway" | "model",
  r: AttestationReport,
  nonce: string,
  deps: VerifyDeps,
): Promise<ReportResult> {
  const checks: Check[] = [];
  const add = (id: string, label: string, pass: boolean, detail?: string): void => {
    checks.push({ id: `${scope}.${id}`, label, pass, ...(detail ? { detail } : {}) });
  };
  const who = scope === "gateway" ? "Gateway" : "Model";
  const guard = async (id: string, label: string, fn: () => Promise<string | undefined | void>): Promise<void> => {
    try {
      const detail = await fn();
      add(id, label, true, detail || undefined);
    } catch (e) {
      add(id, label, false, (e as Error).message);
    }
  };

  const algo = r.signing_algo ?? "";
  const addr = r.signing_address ?? "";
  let quote: QuoteInfo | undefined;

  await guard("nonce_echo", `${who} report echoes our fresh nonce`, async () => {
    if ((r.request_nonce ?? "").toLowerCase() !== nonce.toLowerCase()) throw new Error("request_nonce differs");
  });

  await guard("tdx_quote", `${who} Intel TDX quote verifies (DCAP, TCB policy, no debug)`, async () => {
    if (!r.intel_quote) throw new Error("no intel_quote");
    quote = await deps.verifyQuote(hex(r.intel_quote));
    if (!deps.acceptedTcb.includes(quote.status)) {
      throw new Error(`TCB status ${quote.status} not accepted ${quote.advisoryIds.join(",")}`.trim());
    }
    if ((quote.tdAttributes[0] ?? 0) & 1) throw new Error("TDX debug mode is enabled");
    return `TCB ${quote.status}`;
  });

  await guard("report_data", `${who} quote binds signing key and our nonce`, async () => {
    if (!quote) throw new Error("no verified quote");
    const want = { ecdsa: 20, ed25519: 32 }[algo];
    const ident = hex(addr);
    if (want === undefined || ident.length !== want) throw new Error("unsupported signing identity");
    const bound = r.tls_cert_fingerprint
      ? h("sha256", ident, hex(r.tls_cert_fingerprint))
      : Buffer.concat([ident, Buffer.alloc(32 - ident.length)]);
    if (!eq(quote.reportData, Buffer.concat([bound, hex(nonce)]))) throw new Error("report data mismatch");
    return `${algo} signer ${addr}`;
  });

  await guard("compose_hash", `${who} measured config matches app_compose (MRCONFIGID)`, async () => {
    if (!quote) throw new Error("no verified quote");
    const info = parse(r.info?.tcb_info) as { app_compose?: string } | undefined;
    if (!info?.app_compose) throw new Error("no app_compose");
    if (!eq(quote.mrConfigId, expectedMrConfigId(info.app_compose))) throw new Error("MRCONFIGID mismatch");
  });

  await guard("rtmr3", `${who} event log replays to the quote's RTMR3`, async () => {
    if (!quote) throw new Error("no verified quote");
    if (!eq(replayRtmr3(r.event_log), quote.rtMr3)) throw new Error("RTMR3 mismatch");
  });

  if (scope === "model") {
    await guard("gpu", "NVIDIA GPU attestation (NRAS) passes with our nonce", async () => {
      if (!r.nvidia_payload) throw new Error("no nvidia_payload");
      const res = await deps.verifyGpu(r.nvidia_payload, nonce);
      if (!res.ok) throw new Error(res.detail);
      return res.detail;
    });
  }

  const identity = checks.every((c) => c.pass) ? { address: addr, algo } : undefined;
  return { checks, ...(identity ? { identity } : {}) };
}
