import PostalMime from "postal-mime";

export const EML_MAX_BYTES = 1024 * 1024;

/** Display-only summary of the DKIM-Signature header. The enclave does the real verification. */
export interface DkimPreview {
  has_signature: boolean;
  domain: string | null;
  selector: string | null;
  signed_headers: string[];
}

export interface ParsedEml {
  text: string;
  subject: string | null;
  pdf: Uint8Array | undefined;
  dkim_preview: DkimPreview;
}

/** Unfold the header block (everything before the first blank line) into "name: value" strings. */
function headerLines(raw: string): string[] {
  const end = raw.search(/\r?\n\r?\n/);
  const block = end < 0 ? raw : raw.slice(0, end);
  return block.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/);
}

/** Parse the first DKIM-Signature header's tags (d, s, h). Never throws; absent header gives has_signature:false. */
export function dkimPreview(raw: string): DkimPreview {
  const line = headerLines(raw).find((l) => /^dkim-signature\s*:/i.test(l));
  if (!line) return { has_signature: false, domain: null, selector: null, signed_headers: [] };
  const tags = new Map<string, string>();
  for (const part of line.slice(line.indexOf(":") + 1).split(";")) {
    const i = part.indexOf("=");
    if (i > 0) tags.set(part.slice(0, i).trim().toLowerCase(), part.slice(i + 1).replace(/\s+/g, ""));
  }
  const h = tags.get("h");
  return {
    has_signature: true,
    domain: tags.get("d")?.toLowerCase() || null,
    selector: tags.get("s") || null,
    signed_headers: h ? h.toLowerCase().split(":").filter(Boolean) : [],
  };
}

/** Parse an .eml: text/plain body, first PDF attachment (if any), and the DKIM preview. */
export async function parseEml(bytes: Uint8Array): Promise<ParsedEml> {
  const email = await PostalMime.parse(bytes);
  const raw = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const pdf = email.attachments.find(
    (a) => a.mimeType === "application/pdf" || a.filename?.toLowerCase().endsWith(".pdf"),
  );
  const content = pdf?.content;
  return {
    text: (email.text ?? "").replace(/\r\n/g, "\n").trim(),
    subject: email.subject ?? null,
    pdf: content ? (typeof content === "string" ? new TextEncoder().encode(content) : new Uint8Array(content)) : undefined,
    dkim_preview: dkimPreview(raw),
  };
}
