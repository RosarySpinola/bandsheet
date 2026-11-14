import { AppError } from "../errors";
import type { ChainPort, Signer } from "../chain/port";

/** NEAR Auth (FastAuth) on testnet, from docs.auth.near.org/resources/testnet. */
export const NEAR_AUTH_TESTNET = {
  contractId: "fast-auth.testnet",
  mpcContractId: "v1.signer-prod.testnet",
  domain: "login.testnet.fast-auth.com",
  guardId: "jwt#https://login.testnet.fast-auth.com/",
  clientId: "np8paqIpMWmNbzT4xAvOOapZBjsOpptl",
} as const;

const SIGN_TGAS = 300;

/** The JWT's `fatxn` claim: the exact bytes Auth0 showed the user and the guard will check against sign_payload. */
export function jwtSignPayload(jwt: string): Uint8Array | null {
  const part = jwt.split(".")[1];
  if (!part) return null;
  try {
    const claims = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as { fatxn?: unknown };
    return Array.isArray(claims.fatxn) && claims.fatxn.every((n) => Number.isInteger(n) && n >= 0 && n < 256)
      ? Uint8Array.from(claims.fatxn as number[])
      : null;
  } catch {
    return null;
  }
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

interface MpcSig {
  signature?: number[];
  big_r?: { affine_point?: string };
  s?: { scalar?: string };
}

/** The 64-byte ed25519 signature from the MPC result (same recovery as FastAuthSignature.recoverEd25519). */
export function recoverEd25519(value: unknown): Uint8Array {
  let v = value as MpcSig | string | null | undefined;
  if (typeof v === "string") {
    try {
      v = JSON.parse(Buffer.from(v, "base64").toString("utf8")) as MpcSig;
    } catch {
      v = null;
    }
  }
  if (!v || typeof v !== "object") throw new AppError(502, "NEAR Auth returned no signature (the guard refused the JWT)", "NEAR_AUTH_NO_SIGNATURE");
  if (Array.isArray(v.signature) && v.signature.length === 64) return Uint8Array.from(v.signature);
  const r = v.big_r?.affine_point;
  const s = v.s?.scalar;
  if (!r || !s) throw new AppError(502, "NEAR Auth returned an unreadable signature", "NEAR_AUTH_NO_SIGNATURE");
  const fit = (b: Buffer) => (b.length > 32 ? b.subarray(b.length - 32) : Buffer.concat([Buffer.alloc(32 - b.length), b]));
  return Uint8Array.from(Buffer.concat([fit(Buffer.from(r, "hex")), fit(Buffer.from(s, "hex"))]));
}

/**
 * Relay one `sign` call to fast-auth.testnet with the owner key (the user's implicit account holds no NEAR).
 * Only the exact statement bytes the server expects are relayed, so this cannot be used to sign anything else.
 */
export async function relayNearAuthSign(
  chain: ChainPort,
  relayer: Signer,
  req: { guard_id: string; verify_payload: string; sign_payload: Uint8Array },
  expected: Uint8Array,
): Promise<{ signature: Uint8Array; tx: string }> {
  if (req.guard_id !== NEAR_AUTH_TESTNET.guardId) throw new AppError(400, "unexpected NEAR Auth guard", "BAD_GUARD");
  if (!sameBytes(req.sign_payload, expected)) {
    throw new AppError(400, "the payload to sign is not the statement this server issued", "PAYLOAD_MISMATCH");
  }
  const claimed = jwtSignPayload(req.verify_payload);
  if (!claimed || !sameBytes(claimed, expected)) {
    throw new AppError(400, "the NEAR Auth approval is for a different payload", "PAYLOAD_MISMATCH");
  }
  const tx = await chain.send(
    relayer,
    NEAR_AUTH_TESTNET.contractId,
    "sign",
    { guard_id: req.guard_id, verify_payload: req.verify_payload, sign_payload: Array.from(req.sign_payload), algorithm: "eddsa" },
    { tgas: SIGN_TGAS, depositYocto: 1n },
  );
  if (!tx.ok) throw new AppError(422, `NEAR Auth refused: ${tx.error || "sign failed"}`, "NEAR_AUTH_REFUSED");
  return { signature: recoverEd25519(tx.value), tx: tx.hash };
}
