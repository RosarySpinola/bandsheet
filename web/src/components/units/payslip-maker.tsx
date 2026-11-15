import { useEffect, useMemo, useState } from "react"
import { Download, FileText, PenLine } from "lucide-react"
import { GlField, GlSelect, SquareButton } from "@/components/unit"
import { CtaButton } from "@/components/unit/links"
import { cn } from "@/lib/utils"
import { PayslipFormSchema, payslipFileName, payslipPdf, type PayslipForm } from "@/lib/units/payslip-pdf"
import { EntryBadge } from "./badges"

const GRADES = ["Junior", "Reporter", "Senior", "Editor", "Chief"].map((g) => ({ value: g, label: g }))

function lastMonths(n = 12) {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    return { value, label: d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) }
  })
}

type Draft = { name: string; employer: string; grade?: string; role: string; period?: string; gross: string }

/**
 * "Make a payslip": a form that builds a clean PDF payslip in this browser. The person downloads it and uploads it
 * like any payslip (or reads it straight away), so the real NEAR AI read runs on it. It is labelled generated and
 * self-attested, on screen and on the PDF itself.
 */
export function PayslipMaker({ onUse, disabled, className }: { onUse: (f: File) => void; disabled?: boolean; className?: string }) {
  const months = useMemo(() => lastMonths(), [])
  const [open, setOpen] = useState(false)
  const [d, setD] = useState<Draft>({ name: "", employer: "", role: "", gross: "", period: months[0]?.value })
  const [tried, setTried] = useState(false)
  const [made, setMade] = useState<{ file: File; url: string } | null>(null)
  useEffect(() => () => void (made && URL.revokeObjectURL(made.url)), [made])

  const parsed = PayslipFormSchema.safeParse({ name: d.name, employer: d.employer, grade: d.grade, role: d.role || undefined, period: d.period, monthly_gross_eur: d.gross ? Number(d.gross) : undefined })
  const err = (k: keyof PayslipForm) => (tried && !parsed.success ? parsed.error.issues.find((i) => i.path[0] === k)?.message : undefined)

  const make = () => {
    setTried(true)
    if (!parsed.success) return
    const blob = payslipPdf(parsed.data)
    const file = new File([blob], payslipFileName(parsed.data), { type: "application/pdf" })
    setMade({ file, url: URL.createObjectURL(blob) })
  }
  const set = (patch: Partial<Draft>) => {
    setD((x) => ({ ...x, ...patch }))
    setMade(null)
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={cn("group flex w-full cursor-pointer items-center gap-4 border border-border bg-white px-4 py-4 text-left transition-colors duration-[400ms] ease-gl hover:border-ink hover:bg-band disabled:opacity-50", className)}
      >
        <span className="grid size-10 shrink-0 place-items-center bg-band text-ink transition-colors duration-[400ms] group-hover:bg-ink group-hover:text-white">
          <PenLine className="size-5" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="wipe w-fit text-[1rem] font-semibold text-ink group-hover:after:scale-x-100">No payslip to hand? Make a payslip</span>
          <span className="text-[0.875rem] leading-snug text-muted-foreground">Type your figures and get a PDF to upload. It counts as self-attested.</span>
        </span>
      </button>
    )

  return (
    <section aria-labelledby="maker-title" className={cn("flex flex-col gap-6 border-2 border-ink bg-white p-6 md:p-8", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 id="maker-title" className="font-serif text-[1.625rem] leading-tight text-ink">Make a payslip</h3>
          <p className="max-w-[34rem] text-[0.9375rem] text-foreground">A one-page PDF built in this browser. Nothing is sent until you upload it.</p>
        </div>
        <EntryBadge kind="self" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <GlField label="Name on the payslip" placeholder="Inês Duarte" value={d.name} onChange={(e) => set({ name: e.target.value })} invalid={Boolean(err("name"))} hint={err("name")} />
        <GlField label="Employer" placeholder="Atlântico Media Lda" value={d.employer} onChange={(e) => set({ employer: e.target.value })} invalid={Boolean(err("employer"))} hint={err("employer")} />
        <GlSelect label="Grade" value={d.grade} onChange={(v) => set({ grade: v })} options={GRADES} invalid={Boolean(err("grade"))} />
        <GlField label="Role (optional)" placeholder="Senior reporter" value={d.role} onChange={(e) => set({ role: e.target.value })} />
        <GlSelect label="Pay month" value={d.period} onChange={(v) => set({ period: v })} options={months} invalid={Boolean(err("period"))} />
        <GlField label="Monthly gross pay" prefix="€" inputMode="numeric" placeholder="4200" value={d.gross} onChange={(e) => set({ gross: e.target.value.replace(/[^\d]/g, "") })} invalid={Boolean(err("monthly_gross_eur"))} hint={err("monthly_gross_eur") ?? "Before tax, for one month."} />
      </div>
      {!made ? (
        <SquareButton onClick={make} className="w-full sm:w-fit">
          <FileText className="size-4" /> Make the PDF
        </SquareButton>
      ) : (
        <div className="flex flex-col gap-4 bg-band p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center bg-white text-ink"><FileText className="size-5" /></span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[0.9375rem] font-semibold text-ink">{made.file.name}</span>
              <span className="text-[0.8125rem] text-muted-foreground">Generated payslip · self-attested · {Math.max(1, Math.round(made.file.size / 1024))} KB</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <a href={made.url} download={made.file.name} className="inline-flex min-h-12 items-center gap-2 bg-ink px-6 text-[1rem] font-semibold text-white transition-colors duration-[400ms] ease-gl hover:bg-indigo">
              <Download className="size-4" /> Download PDF
            </a>
            <CtaButton onClick={() => onUse(made.file)} disabled={disabled}>Upload it now</CtaButton>
          </div>
          <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">Download it and drop it in the upload area above, or upload it now. Either way the same NEAR AI read runs on it.</p>
        </div>
      )}
    </section>
  )
}
