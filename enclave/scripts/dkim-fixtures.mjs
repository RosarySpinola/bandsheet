// Generates the synthetic DKIM payslip fixtures (fixtures/dkim/**). SYNTHETIC: Harbour Courier Ltd is fictional.
//
//   node enclave/scripts/dkim-fixtures.mjs
//
// Private keys go ONLY to keys/dkim/ (gitignored) and are created once (kept if present). Re-running with the
// same keys reproduces every .eml byte for byte (RSA PKCS#1 v1.5 signatures are deterministic).
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { signMessage } from "./dkim-sign.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const { SEED_MEMBERS, SEED_JOINER } = await import(join(root, "packages/core/src/seed.ts"));
const keyDir = join(root, "keys/dkim");
const outDir = join(root, "fixtures/dkim");
mkdirSync(keyDir, { recursive: true });
mkdirSync(join(outDir, "emails"), { recursive: true });

function loadKey(name) {
  const path = join(keyDir, name + ".pem");
  if (!existsSync(path)) {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    writeFileSync(path, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  }
  return createPrivateKey(readFileSync(path));
}
const spki = (priv) => createPublicKey(priv).export({ type: "spki", format: "der" }).toString("base64");

const DOMAIN = "harbourcourier.example", SELECTOR = "payroll2026";
const keys = { issuer: loadKey("harbourcourier"), other: loadKey("untrusted"), attacker: loadKey("attacker") };
const PERIOD = "2026-10";
const eur = (cents) => "EUR " + (Math.floor(cents / 100)).toLocaleString("en-US") + "." + String(cents % 100).padStart(2, "0");
const slug = (n) => n.toLowerCase().replace(/[^a-z]+/g, "-");
const slotOf = (s) => createHash("sha256").update(`bandsheet-dkim-fixture/${s}`).digest("hex");
const TS = 1761811200; // Fri 30 Oct 2026 08:00:00 UTC

const used = new Set(["HC-0412"]);
function employeeId(name) {
  if (name === SEED_JOINER.name) return "HC-0412";
  let n = 1000 + (parseInt(createHash("sha256").update("HC/" + name).digest("hex").slice(0, 8), 16) % 8999);
  while (used.has(`HC-${n}`)) n++;
  used.add(`HC-${n}`);
  return `HC-${n}`;
}

function payslip({ name, id, grade, annual, domain = DOMAIN, selector = SELECTOR, key = keys.issuer, canon, msgSuffix = "", date = "Fri, 30 Oct 2026 08:00:00 +0000", sign = true, pdf = false }) {
  const monthlyCents = Math.round((annual * 100) / 12);
  const lines = [
    `Dear ${name},`, "", "Your payslip for October 2026 is ready.", "",
    `Employee ID: ${id}`, `Grade: ${grade}`, `Period: ${PERIOD}`, `Gross pay (month): ${eur(monthlyCents)}`, "",
    "Harbour Courier Payroll (synthetic demo data)", "",
  ];
  const text = lines.join("\r\n");
  const boundary = "hc-payslip-boundary-2026-10";
  const body = pdf
    ? [`--${boundary}`, "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 7bit", "", text, `--${boundary}`,
       'Content-Type: application/pdf; name="payslip-2026-10.pdf"', "Content-Transfer-Encoding: base64",
       'Content-Disposition: attachment; filename="payslip-2026-10.pdf"', "", tinyPdf(lines.slice(4, 8)).toString("base64").replace(/(.{76})/g, "$1\r\n"), `--${boundary}--`, ""].join("\r\n")
    : text;
  const local = slug(name).replace(/-/g, ".");
  const headers = [
    ["From", `Harbour Courier Payroll <payroll@${domain}>`],
    ["To", `${name} <${local}@${DOMAIN}>`],
    ["Subject", "Your payslip for October 2026"],
    ["Date", date],
    ["Message-ID", `<${id.toLowerCase()}-${PERIOD}${msgSuffix}@${domain}>`],
    ["MIME-Version", "1.0"],
    ["Content-Type", pdf ? `multipart/mixed; boundary="${boundary}"` : "text/plain; charset=utf-8"],
  ];
  if (!sign) return headers.map(([k, v]) => `${k}: ${v}`).join("\r\n") + "\r\n\r\n" + body;
  return signMessage({ headers, body, domain, selector, key, canon, t: TS });
}

function tinyPdf(textLines) {
  const content = "BT /F1 12 Tf 72 720 Td 14 TL " + textLines.map((l) => `(${l}) Tj T*`).join(" ") + " ET";
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let pdf = "%PDF-1.4\n";
  const offs = objs.map((o, i) => { const at = pdf.length; pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
  return Buffer.from(pdf + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`, "latin1");
}

const write = (file, raw) => writeFileSync(join(outDir, "emails", file), raw);
const manifest = { synthetic: true, issuer: null, period: PERIOD, members: [], negatives: [], variants: [] };

for (const m of [...SEED_MEMBERS, SEED_JOINER]) {
  const id = employeeId(m.name);
  const file = slug(m.name) + ".eml";
  write(file, payslip({ name: m.name, id, grade: m.grade, annual: m.gross_annual_eur }));
  manifest.members.push({ name: m.name, slug: slug(m.name), employee_id: id, grade: m.grade, gender: m.gender, site: m.site, gross_annual_eur: m.gross_annual_eur,
    monthly_eur: Math.round((m.gross_annual_eur * 100) / 12) / 100, slot: slotOf(slug(m.name)), eml: `emails/${file}`, joiner: m.name === SEED_JOINER.name });
}

// ---- negatives: each carries the entry fields an attacker would claim, and the reason the enclave must give.
const byName = (n) => manifest.members.find((x) => x.name === n);
const neg = (file, reason, who, claim, note) => {
  manifest.negatives.push({ file, eml: `emails/${file}`, expect: reason, note, claim: { slot: slotOf(who), grade: claim.grade, gender: "F", site: "City", gross_annual_eur: claim.annual, submitted_at: 1762000000 + manifest.negatives.length } });
};

// forged.eml: Ingrid Halvorsen's genuine payslip, one digit of the gross changed after signing (4,908.33 -> 6,908.33).
const ingrid = byName("Ingrid Halvorsen");
const genuine = payslip({ name: ingrid.name, id: ingrid.employee_id, grade: ingrid.grade, annual: ingrid.gross_annual_eur });
const forged = genuine.replace("EUR 4,908.33", "EUR 6,908.33");
if (forged === genuine) throw new Error("forge failed");
write("forged.eml", forged);
neg("forged.eml", "dkim_bad_signature", "forged-poisoner", { grade: "Senior", annual: 82900 }, "one digit of the monthly gross edited after signing; the entry claims the edited annual figure");

write("untrusted.eml", payslip({ name: "Mirela Costa", id: "HC-9001", grade: "Senior", annual: 95000, domain: "harbourcourier-payroll.example", selector: "s1", key: keys.other }));
neg("untrusted.eml", "untrusted_issuer", "untrusted-signer", { grade: "Senior", annual: 95000 }, "validly signed, but by another domain and key that the chapel never trusted");

write("wrongkey.eml", payslip({ name: "Tobias Reinhardt", id: "HC-9002", grade: "Senior", annual: 91000, key: keys.attacker }));
neg("wrongkey.eml", "dkim_bad_signature", "wrongkey-signer", { grade: "Senior", annual: 91000 }, "claims the trusted domain and selector but is signed with a different private key");

write("unsigned.eml", payslip({ name: "Selma Aydin", id: "HC-9003", grade: "Senior", annual: 88000, sign: false }));
neg("unsigned.eml", "untrusted_issuer", "unsigned-sender", { grade: "Senior", annual: 88000 }, "no DKIM-Signature header at all");

// duplicate.eml: Declan Murphy's payslip re-issued (new Message-ID and Date, fresh signature) and submitted from another slot.
const declan = byName("Declan Murphy");
write("duplicate.eml", payslip({ name: declan.name, id: declan.employee_id, grade: declan.grade, annual: declan.gross_annual_eur, msgSuffix: "-reissue", date: "Mon, 02 Nov 2026 09:30:00 +0000" }));
neg("duplicate.eml", "duplicate_payslip", "duplicate-reuser", { grade: "Senior", annual: declan.gross_annual_eur }, "the same employee id and period re-issued and submitted again from a different slot");
manifest.negatives[manifest.negatives.length - 1].duplicates = declan.slug;

// ---- variants: valid, not part of the full set (same payslip as Noor Haddad in other encodings).
const noor = byName("Noor Haddad");
const variant = (file, note, extra) => {
  write(file, payslip({ name: noor.name, id: noor.employee_id, grade: noor.grade, annual: noor.gross_annual_eur, ...extra }));
  manifest.variants.push({ file, eml: `emails/${file}`, expect: "verified", note, employee_id: noor.employee_id });
};
variant("variant-simple-canon.eml", "c=simple/simple instead of relaxed/relaxed", { canon: "simple/simple" });
variant("variant-with-pdf.eml", "multipart/mixed with a PDF payslip attachment (for the NEAR AI Cloud reading path); the enclave trusts only the signed text part", { pdf: true });

manifest.issuer = { domain: DOMAIN, selector: SELECTOR, rsa_pubkey_spki_b64: spki(keys.issuer), key_bits: 2048 };
writeFileSync(join(outDir, "issuer.json"), JSON.stringify({ synthetic: true, ...manifest.issuer, other_issuer: { domain: "harbourcourier-payroll.example", selector: "s1", rsa_pubkey_spki_b64: spki(keys.other) } }, null, 2) + "\n");
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.error(`wrote ${manifest.members.length} payslips, ${manifest.negatives.length} negatives, ${manifest.variants.length} variants to fixtures/dkim`);
