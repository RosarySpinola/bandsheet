import { createHash } from "node:crypto";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import type { Check, Identity } from "./verify";

/** GET /v1/signature/{chat_id} response. */
export interface SignatureResponse {
  text: string;
  signature: string;
  signing_address: string;
  signing_algo: string;
  signature_kind?: string;
}

export const sha256Hex = (data: string | Uint8Array): string => createHash("sha256").update(data).digest("hex");

const hex = (v: string): Uint8Array => new Uint8Array(Buffer.from(v.replace(/^0x/i, ""), "hex"));

/** EIP-191 personal_sign recovery: returns the lowercase 0x address, or throws. */
export function recoverEthAddress(text: string, signatureHex: string): string {
  const body = Buffer.from(text, "utf8");
  const digest = keccak_256(Buffer.concat([Buffer.from(`\x19Ethereum Signed Message:\n${body.length}`), body]));
  const sig = hex(signatureHex);
  if (sig.length !== 65) throw new Error("signature must be 65 bytes");
  const v = sig[64]!;
  const rec = v >= 27 ? v - 27 : v;
  if (rec !== 0 && rec !== 1) throw new Error("bad recovery id");
  const recovered = Uint8Array.from([rec, ...sig.slice(0, 64)]);
  const compressed = secp256k1.recoverPublicKey(recovered, digest, { prehash: false });
  const uncompressed = secp256k1.Point.fromBytes(compressed).toBytes(false);
  return `0x${Buffer.from(keccak_256(uncompressed.slice(1)).slice(12)).toString("hex")}`;
}

export interface SignatureContext {
  /** Exact request body string that was sent. */
  requestBody: string;
  /** Exact response bytes received. */
  responseBytes: Uint8Array;
  /** Canonical model id from the original request. */
  model: string;
  /** Identities from reports whose checks all passed during preflight. */
  gateway: Identity[];
  models: Identity[];
}

/** Verify a response signature against exact bytes and the preflight-verified signers. */
export function verifyResponseSignature(sig: SignatureResponse, ctx: SignatureContext): Check[] {
  const checks: Check[] = [];
  const add = (id: string, label: string, pass: boolean, detail?: string): void => {
    checks.push({ id: `signature.${id}`, label, pass, ...(detail ? { detail } : {}) });
  };
  const kind = sig.signature_kind;
  const kindKnown = kind === "provider_tee" || kind === "gateway";
  add("kind", "Signature declares its signer (model TEE or gateway TEE)", kindKnown, kindKnown ? kind : "signature_kind missing or unknown");

  const reqHash = sha256Hex(ctx.requestBody);
  const resHash = sha256Hex(ctx.responseBytes);
  const expected = kind === "provider_tee" ? `${ctx.model}:${reqHash}:${resHash}` : `${reqHash}:${resHash}`;
  const textOk = kindKnown && sig.text === expected;
  add("hashes", "Signed text commits to the SHA-256 of our exact request and response bytes", textOk,
    textOk ? `request ${reqHash.slice(0, 12)}..., response ${resHash.slice(0, 12)}...` : "signed text differs from expected");

  let signerOk = false;
  let detail: string | undefined;
  try {
    if (sig.signing_algo === "ecdsa") {
      const rec = recoverEthAddress(sig.text, sig.signature);
      signerOk = rec.toLowerCase() === sig.signing_address.toLowerCase();
      detail = `recovered ${rec}`;
    } else if (sig.signing_algo === "ed25519") {
      signerOk = ed25519.verify(hex(sig.signature), new TextEncoder().encode(sig.text), hex(sig.signing_address));
    } else {
      detail = `unsupported algorithm ${sig.signing_algo}`;
    }
  } catch (e) {
    detail = (e as Error).message;
  }
  add("valid", "Signature is valid for the stated signer", signerOk, detail);

  const pool = kind === "gateway" ? ctx.gateway : kind === "provider_tee" ? ctx.models : [];
  // Instances of one model share a signing key, so several verified candidates can carry the same
  // identity. Compare unique (address, algo) identities: exactly one must match.
  const matches = new Set(
    pool
      .filter((i) => i.algo === sig.signing_algo && i.address.toLowerCase() === sig.signing_address.toLowerCase())
      .map((i) => `${i.algo}:${i.address.toLowerCase()}`),
  );
  const matchOk = matches.size === 1;
  add("signer_attested", "Signer is the TEE whose attestation we verified before sending", matchOk,
    matchOk ? sig.signing_address : "signer does not match exactly one verified attestation");
  return checks;
}
