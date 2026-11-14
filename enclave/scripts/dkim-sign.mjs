// Minimal DKIM signer (RFC 6376, rsa-sha256) used only to make the synthetic payslip fixtures.
// Independent of the Rust verifier on purpose: the two meet only in the fixtures, and dkimpy
// (a third implementation) cross-checks them (see dkim-crosscheck.py).
import { createHash, sign } from "node:crypto";

export const CRLF = "\r\n";

export function relaxedHeader(name, value) {
  const v = value.replace(/\r\n(?=[ \t])/g, "").replace(/[ \t]+/g, " ").trim();
  return `${name.toLowerCase()}:${v}${CRLF}`;
}
export function simpleHeader(name, value) {
  return `${name}:${value}${CRLF}`;
}

export function relaxedBody(body) {
  const lines = body.split(CRLF).map((l) => l.replace(/[ \t]+/g, " ").replace(/ $/, ""));
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.length ? lines.join(CRLF) + CRLF : "";
}
export function simpleBody(body) {
  const lines = body.split(CRLF);
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join(CRLF) + CRLF;
}

const fold = (s, n = 64) => s.match(new RegExp(`.{1,${n}}`, "g")).join(CRLF + "\t");

/**
 * headers: [[name, value]] in message order (value without leading space, no CRLF).
 * Returns the full raw message: DKIM-Signature first, then headers, blank line, body.
 */
export function signMessage({ headers, body, domain, selector, key, canon = "relaxed/relaxed", signed = ["from", "to", "subject", "date", "message-id"], t }) {
  const [hc, bc] = canon.split("/");
  const canonBody = (bc === "simple" ? simpleBody : relaxedBody)(body);
  const bh = createHash("sha256").update(canonBody).digest("base64");
  const canonHeader = hc === "simple" ? simpleHeader : relaxedHeader;
  const hv = (n) => headers.find(([k]) => k.toLowerCase() === n)?.[1];
  const tpl =
    ` v=1; a=rsa-sha256; c=${canon}; d=${domain}; s=${selector}; t=${t};${CRLF}\t` +
    `h=${signed.join(":")};${CRLF}\tbh=${bh};${CRLF}\tb=`;
  const data = signed.map((n) => canonHeader(headers.find(([k]) => k.toLowerCase() === n)[0], (hc === "simple" ? " " : "") + hv(n))).join("") + canonHeader("DKIM-Signature", tpl).replace(/\r\n$/, "");
  const sig = sign("sha256", Buffer.from(data), key).toString("base64");
  const header = `DKIM-Signature:${tpl}${fold(sig)}`;
  return header + CRLF + headers.map(([k, v]) => `${k}: ${v}`).join(CRLF) + CRLF + CRLF + body;
}
