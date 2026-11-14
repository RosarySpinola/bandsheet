/**
 * Renders synthetic payslips (fictional employer "Harbour Courier Media DAC", fictional people)
 * to server/fixtures/payslips for extraction tests. Run: pnpm --filter server fixtures:payslips
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { SERVER_DIR } from "../src/env";

interface Slip {
  file: string;
  pdf?: boolean;
  layout: "classic" | "table";
  name: string;
  staffNo: string;
  role: string;
  grade: string;
  period: string;
  annual: number;
  tax: number;
  prsi: number;
  usc: number;
  pension: number;
}

const eur = (n: number): string => n.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SLIPS: Slip[] = [
  { file: "payslip-senior-monthly.png", layout: "classic", name: "Noor Haddad", staffNo: "HC-10458", role: "Senior Reporter, Investigations", grade: "Senior", period: "October 2026", annual: 70000, tax: 1318.42, prsi: 233.33, usc: 301.7, pension: 291.67 },
  { file: "payslip-reporter-table.png", layout: "table", name: "Leila Benali", staffNo: "HC-10231", role: "Reporter, City Desk", grade: "Reporter", period: "October 2026", annual: 42100, tax: 612.5, prsi: 140.33, usc: 150.18, pension: 175.42 },
  { file: "payslip-editor.pdf", pdf: true, layout: "classic", name: "Fatima Al-Sayed", staffNo: "HC-10077", role: "Section Editor, Features", grade: "Editor", period: "October 2026", annual: 77200, tax: 1560.1, prsi: 257.33, usc: 340.2, pension: 321.67 },
];

function html(s: Slip): string {
  const m = s.annual / 12;
  const net = m - s.tax - s.prsi - s.usc - s.pension;
  const rows = [
    ["Basic salary", m],
  ] as const;
  const deductions: [string, number][] = [["Income tax (PAYE)", s.tax], ["PRSI", s.prsi], ["USC", s.usc], ["Pension (employee 5%)", s.pension]];
  const head = s.layout === "classic" ? "#12355b" : "#7a1f2b";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:Helvetica,Arial,sans-serif;margin:0;padding:36px 44px;width:720px;color:#1b1b1b;background:#fff}
  .top{display:flex;justify-content:space-between;border-bottom:3px solid ${head};padding-bottom:10px}
  h1{margin:0;font-size:22px;color:${head}} .sub{font-size:11px;color:#555}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin:16px 0;font-size:12px}
  .meta b{display:inline-block;width:110px;color:#555;font-weight:600}
  table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:10px}
  th{background:${head};color:#fff;text-align:left;padding:6px 8px;font-weight:600} td{padding:6px 8px;border-bottom:1px solid #ddd}
  td.n,th.n{text-align:right}
  .tot td{font-weight:700;background:#f3f5f8} .net{margin-top:16px;display:flex;justify-content:space-between;font-size:15px;font-weight:700;border-top:3px solid ${head};padding-top:10px}
  .foot{margin-top:22px;font-size:10px;color:#777}
  </style></head><body>
  <div class="top"><div><h1>Harbour Courier Media DAC</h1><div class="sub">14 Quay Street, Cork, T12 HC14, Ireland. Employer reg. no. 612 408</div></div>
  <div style="text-align:right"><div style="font-size:16px;font-weight:700">PAYSLIP</div><div class="sub">Pay period: ${s.period}</div></div></div>
  <div class="meta"><div><b>Employee</b>${s.name}</div><div><b>Staff no.</b>${s.staffNo}</div>
  <div><b>Position</b>${s.role}</div><div><b>Pay frequency</b>Monthly</div>
  ${s.layout === "table" ? `<div><b>Annual salary</b>EUR ${eur(s.annual)}</div>` : `<div><b>Cost centre</b>Newsroom 210</div>`}
  <div><b>Pay date</b>28 Oct 2026</div></div>
  <table><tr><th>Earnings</th><th class="n">Hours/Units</th><th class="n">Amount (EUR)</th></tr>
  ${rows.map(([l, v]) => `<tr><td>${l}</td><td class="n">1.00</td><td class="n">${eur(v)}</td></tr>`).join("")}
  <tr class="tot"><td>Gross pay</td><td></td><td class="n">${eur(m)}</td></tr></table>
  <table><tr><th>Deductions</th><th class="n"></th><th class="n">Amount (EUR)</th></tr>
  ${deductions.map(([l, v]) => `<tr><td>${l}</td><td></td><td class="n">${eur(v)}</td></tr>`).join("")}
  <tr class="tot"><td>Total deductions</td><td></td><td class="n">${eur(s.tax + s.prsi + s.usc + s.pension)}</td></tr></table>
  <div class="net"><span>Net pay</span><span>EUR ${eur(net)}</span></div>
  <div class="foot">Year to date gross: EUR ${eur(m * 10)}. Synthetic specimen payslip generated for software testing; the employer and employee are fictional.</div>
  </body></html>`;
}

const outDir = resolve(SERVER_DIR, "fixtures/payslips");
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
for (const s of SLIPS) {
  const page = await browser.newPage({ viewport: { width: 810, height: 600 }, deviceScaleFactor: 1.6 });
  await page.setContent(html(s));
  if (s.pdf) await page.pdf({ path: resolve(outDir, s.file), width: "810px", height: "620px", printBackground: true });
  else await page.screenshot({ path: resolve(outDir, s.file), fullPage: true });
  await page.close();
}
await browser.close();
process.stdout.write(`wrote ${SLIPS.length} payslips to ${outDir}\n`);
