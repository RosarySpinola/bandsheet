import { AppError } from "../errors";

/** d= and s= of each DKIM-Signature header in a raw .eml, in order. Header folding is undone first. */
export function dkimSignatures(eml: string): { domain: string; selector: string }[] {
  const head = eml.replace(/\r\n/g, "\n").split(/\n\n/)[0] ?? "";
  const unfolded = head.replace(/\n[ \t]+/g, " ");
  const out: { domain: string; selector: string }[] = [];
  for (const line of unfolded.split("\n")) {
    const m = /^dkim-signature:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const tags = new Map<string, string>();
    for (const part of m[1]!.split(";")) {
      const eq = part.indexOf("=");
      if (eq > 0) tags.set(part.slice(0, eq).trim().toLowerCase(), part.slice(eq + 1).replace(/\s+/g, ""));
    }
    const domain = tags.get("d")?.toLowerCase();
    const selector = tags.get("s");
    if (domain && selector && /^[a-z0-9.-]{1,253}$/.test(domain) && /^[A-Za-z0-9._-]{1,63}$/.test(selector)) out.push({ domain, selector });
  }
  return out;
}

/** The p= value of a DKIM TXT record (the strings of one record joined), if it is an RSA key. */
export function dkimKeyFromTxt(txt: string): string | undefined {
  const joined = txt.includes('"') ? [...txt.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).join("") : txt;
  const tags = new Map<string, string>();
  for (const part of joined.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) tags.set(part.slice(0, eq).trim().toLowerCase(), part.slice(eq + 1).replace(/\s+/g, ""));
  }
  const k = tags.get("k");
  if (k && k.toLowerCase() !== "rsa") return undefined;
  const p = tags.get("p");
  return p && /^[A-Za-z0-9+/=]{200,2048}$/.test(p) ? p : undefined;
}

interface DohAnswer {
  Status?: number;
  Answer?: { type?: number; data?: string }[];
}

const DOH = ["https://cloudflare-dns.com/dns-query", "https://dns.google/resolve"];

/** Fetch `<selector>._domainkey.<domain>` TXT over DNS-over-HTTPS (JSON API), trying two resolvers. */
export async function fetchDkimKey(domain: string, selector: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const name = `${selector}._domainkey.${domain}`;
  let lastStatus: number | undefined;
  for (const base of DOH) {
    let body: DohAnswer;
    try {
      const res = await fetchFn(`${base}?name=${encodeURIComponent(name)}&type=TXT`, { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      body = (await res.json()) as DohAnswer;
    } catch {
      continue;
    }
    lastStatus = body.Status;
    for (const a of body.Answer ?? []) {
      if (a.type !== undefined && a.type !== 16) continue;
      const key = a.data ? dkimKeyFromTxt(a.data) : undefined;
      if (key) return key;
    }
    if (body.Status === 3 || body.Status === 0) break;
  }
  if (lastStatus === undefined) throw new AppError(502, "DNS-over-HTTPS did not answer", "DNS_UNAVAILABLE");
  throw new AppError(422, `no RSA DKIM key is published at ${name}`, "DNS_NO_KEY");
}
