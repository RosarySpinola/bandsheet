import { extractText, getDocumentProxy } from "unpdf";

/** Text layer of a PDF, or "" when it is a scan (no text). Runs locally; nothing leaves the server. */
export async function pdfTextLayer(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.replace(/[ \t]+/g, " ").trim().slice(0, 6000);
}
