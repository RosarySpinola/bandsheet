import { getCollateralAndVerify } from "@phala/dcap-qvl";
import type { GpuVerifier, QuoteInfo, QuoteVerifier } from "./verify";

/** Real Intel DCAP verification (collateral from Phala's public PCCS). */
export const verifyQuoteDcap: QuoteVerifier = async (quote) => {
  const v = (await getCollateralAndVerify(quote)) as unknown as {
    status: string;
    advisory_ids?: string[];
    report: { type: string; data: Record<string, Uint8Array> };
  };
  if (v.report.type !== "td10") throw new Error("expected a TDX (td10) quote");
  const d = v.report.data;
  const info: QuoteInfo = {
    status: v.status,
    advisoryIds: v.advisory_ids ?? [],
    reportData: d.reportData as Uint8Array,
    mrConfigId: d.mrConfigId as Uint8Array,
    rtMr3: d.rtMr3 as Uint8Array,
    tdAttributes: d.tdAttributes as Uint8Array,
  };
  return info;
};

const NRAS = "https://nras.attestation.nvidia.com/v3/attest/gpu";

function decodeJwtClaims(token: string): Record<string, unknown> {
  const part = token.split(".")[1];
  if (!part) throw new Error("not a JWT");
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

/** Sends the model's GPU evidence to NVIDIA NRAS and checks the overall result and nonce. */
export const verifyGpuNras: GpuVerifier = async (payload, nonce) => {
  const obj = typeof payload === "string" ? (JSON.parse(payload) as Record<string, unknown>) : (payload as Record<string, unknown>);
  if (String(obj.nonce ?? "").toLowerCase() !== nonce.toLowerCase()) {
    return { ok: false, detail: "payload nonce differs from ours" };
  }
  const res = await fetch(NRAS, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(obj),
  });
  if (!res.ok) return { ok: false, detail: `NRAS HTTP ${res.status}` };
  const body = (await res.json()) as unknown[];
  const overallRow = body.find((x) => Array.isArray(x) && x[0] === "JWT") as [string, string] | undefined;
  if (!overallRow) return { ok: false, detail: "NRAS returned no overall JWT" };
  const claims = decodeJwtClaims(overallRow[1]);
  const ok = claims["x-nvidia-overall-att-result"] === true;
  const nonceOk = String(claims.eat_nonce ?? "").toLowerCase() === nonce.toLowerCase();
  const gpus = Object.keys((body.find((x) => !Array.isArray(x)) as Record<string, string>) ?? {}).length;
  return { ok: ok && nonceOk, detail: `${gpus} GPU token(s); overall=${ok}; nonce match=${nonceOk}` };
};
