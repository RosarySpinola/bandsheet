import { z } from "zod"
import { GRADES } from "@bandsheet/core"

/**
 * "Make a payslip": a one-page PDF payslip built in this browser (no library, no upload). It has a real text layer,
 * so the same NEAR AI read runs on it as on any payslip. It says on its face that it was generated and self-attested.
 */

export const PayslipFormSchema = z.object({
  name: z.string().trim().min(2, "Enter the name on the payslip.").max(60),
  employer: z.string().trim().min(2, "Enter your employer.").max(80),
  grade: z.enum(GRADES, { message: "Choose a grade." }),
  role: z.string().trim().max(60).optional(),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose the pay month."),
  monthly_gross_eur: z.number({ message: "Enter the monthly gross in euros." }).int("Whole euros, please.").min(100, "That is under €100 a month.").max(800_000),
})
export type PayslipForm = z.infer<typeof PayslipFormSchema>

const money = (n: number) => n.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const monthName = (p: string) => new Date(`${p}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
/** PDF strings: printable ASCII only; brackets and backslashes escaped. */
const pdfText = (s: string) => s.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/([\\()])/g, "\\$1")

type Line = { x: number; y: number; size: number; bold?: boolean; text: string }

function layout(f: PayslipForm): { lines: Line[]; rules: number[] } {
  const gross = f.monthly_gross_eur
  const tax = Math.round(gross * 0.21 * 100) / 100
  const social = Math.round(gross * 0.1 * 100) / 100
  const net = Math.round((gross - tax - social) * 100) / 100
  const ref = `PS-${f.period.replace("-", "")}-${Math.abs([...f.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 100000}`
  const L: Line[] = [
    { x: 56, y: 780, size: 20, bold: true, text: f.employer },
    { x: 56, y: 756, size: 11, text: "Payslip" },
    { x: 400, y: 780, size: 10, text: `Pay period: ${monthName(f.period)}` },
    { x: 400, y: 765, size: 10, text: `Reference: ${ref}` },
    { x: 56, y: 712, size: 10, bold: true, text: "Employee" },
    { x: 160, y: 712, size: 10, text: f.name },
    { x: 56, y: 694, size: 10, bold: true, text: "Grade" },
    { x: 160, y: 694, size: 10, text: f.grade },
    { x: 56, y: 676, size: 10, bold: true, text: "Role" },
    { x: 160, y: 676, size: 10, text: f.role?.trim() || f.grade },
    { x: 56, y: 630, size: 10, bold: true, text: "Description" },
    { x: 420, y: 630, size: 10, bold: true, text: "Amount (EUR)" },
    { x: 56, y: 606, size: 11, text: "Gross pay (month)" },
    { x: 420, y: 606, size: 11, text: `EUR ${money(gross)}` },
    { x: 56, y: 586, size: 11, text: "Income tax (estimate)" },
    { x: 420, y: 586, size: 11, text: `-EUR ${money(tax)}` },
    { x: 56, y: 566, size: 11, text: "Social security (estimate)" },
    { x: 420, y: 566, size: 11, text: `-EUR ${money(social)}` },
    { x: 56, y: 536, size: 12, bold: true, text: "Net pay" },
    { x: 420, y: 536, size: 12, bold: true, text: `EUR ${money(net)}` },
    { x: 56, y: 500, size: 10, text: `Gross annual pay (12 x monthly): EUR ${money(gross * 12)}` },
    { x: 56, y: 120, size: 9, bold: true, text: "Generated payslip - self-attested" },
    { x: 56, y: 106, size: 9, text: "Made with Bandsheet's Make a payslip form from figures the employee typed. No employer signed it," },
    { x: 56, y: 94, size: 9, text: "so Bandsheet counts it as self-attested, never as DKIM-verified." },
  ]
  return { lines: L, rules: [742, 640, 552] }
}

/** Build the PDF bytes: 2 standard fonts, 1 page, 1 uncompressed content stream, a correct xref table. */
export function payslipPdf(form: PayslipForm): Blob {
  const { lines, rules } = layout(form)
  const content = [
    "0.06 0.19 0.15 RG 0.8 w",
    ...rules.map((y) => `56 ${y} m 540 ${y} l S`),
    "0.06 0.19 0.15 rg",
    ...lines.map((l) => `BT /${l.bold ? "F2" : "F1"} ${l.size} Tf ${l.x} ${l.y} Td (${pdfText(l.text)}) Tj ET`),
  ].join("\n")
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /Title (${pdfText(`Payslip ${monthName(form.period)} - ${form.name}`)}) /Producer (Bandsheet Make a payslip) /Subject (Generated, self-attested payslip) >>`,
  ]
  let out = "%PDF-1.4\n"
  const offsets: number[] = []
  objects.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new Blob([out], { type: "application/pdf" })
}

export const payslipFileName = (f: PayslipForm) => `payslip-${f.period}-${f.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-generated.pdf`
