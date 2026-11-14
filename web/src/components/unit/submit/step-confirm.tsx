import { useState } from "react"
import { eur } from "@/lib/format"
import { GlField, GlSelect } from "../gl-select"
import { SquareButton, CtaButton } from "../links"
import { VerifiedPanel } from "../verified-panel"
import { DkimCard } from "./dkim-card"
import type { SubmitFlow } from "./use-submit-flow"

const GRADES = ["Junior", "Reporter", "Senior", "Editor", "Chief"].map((g) => ({ value: g, label: g }))
const GENDERS = [
  { value: "F", label: "Woman" },
  { value: "M", label: "Man" },
  { value: "X", label: "Another gender or prefer not to say" },
]
const SITES = [
  { value: "City", label: "City newsroom" },
  { value: "Port", label: "Port bureau" },
]
const PERIOD: Record<string, string> = { monthly: "a month", annual: "a year", weekly: "a week", biweekly: "every two weeks", fourweekly: "every four weeks" }

/** Step 3: the member checks what was read, fills what a payslip doesn't say, and sees the attestation. */
export function StepConfirm({ flow }: { flow: SubmitFlow }) {
  const [tried, setTried] = useState(false)
  const [sealError, setSealError] = useState<string | null>(null)
  const f = flow.fields
  const ex = flow.extract.status === "done" ? flow.extract.data : undefined
  const n = Number(f.gross_annual_eur)
  const grossOk = Number.isInteger(n) && n >= 1000 && n <= 10_000_000
  const ok = grossOk && f.grade && f.gender && f.site

  const submit = async () => {
    setTried(true)
    if (!ok) return
    try {
      setSealError(null)
      await flow.seal()
    } catch (e) {
      setSealError(e instanceof Error ? e.message : "could not seal the entry")
    }
  }

  return (
    <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-8">
        {ex ? (
          <div className="flex flex-col gap-2 bg-band p-6">
            <p className="text-[0.8125rem] font-medium tracking-[0.02em] text-muted-foreground uppercase">Read from your payslip</p>
            <p className="text-[1.0625rem] leading-relaxed text-ink">
              {ex.extracted.currency} {ex.extracted.gross_amount.toLocaleString("en-IE", { minimumFractionDigits: 2 })} gross{" "}
              {PERIOD[ex.extracted.period]}
              {ex.extracted.gross_annual_eur ? <>, so {eur(ex.extracted.gross_annual_eur)} a year</> : null}
              {ex.extracted.role_text ? <> · {ex.extracted.role_text}</> : null}
            </p>
            {ex.extracted.warnings.map((w) => (
              <p key={w} className="text-[0.9375rem] font-medium text-indigo">
                {w}
              </p>
            ))}
          </div>
        ) : (
          <p className="bg-band p-6 text-[1rem] text-foreground">Enter your figures by hand. Nothing was read from a payslip.</p>
        )}
        <DkimCard preview={ex?.dkim_preview} email={Boolean(flow.emlB64)} sample={flow.sample} />

        <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
          <GlField
            label="Gross annual pay"
            prefix="€"
            inputMode="numeric"
            value={f.gross_annual_eur}
            onChange={(e) => flow.setFields({ ...f, gross_annual_eur: e.target.value.replace(/[^\d]/g, "") })}
            invalid={tried && !grossOk}
            hint={tried && !grossOk ? "Enter a whole number of euros, e.g. 70000." : "Before tax, for a full year."}
            className="sm:col-span-2"
          />
          <GlSelect label="Grade" value={f.grade} onChange={(v) => flow.setFields({ ...f, grade: v as typeof f.grade })} options={GRADES} invalid={tried && !f.grade} />
          <GlSelect label="Site" value={f.site} onChange={(v) => flow.setFields({ ...f, site: v as typeof f.site })} options={SITES} invalid={tried && !f.site} />
          <GlSelect
            label="Gender"
            value={f.gender}
            onChange={(v) => flow.setFields({ ...f, gender: v as typeof f.gender })}
            options={GENDERS}
            invalid={tried && !f.gender}
            className="sm:col-span-2"
          />
        </div>
        <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
          Gender and site are not on a payslip. They let the chapel ask for gaps by gender or site, and the engine still refuses any cell
          that would expose someone. These four fields, your slot and, if you used one, the payroll email are all that get sealed.
        </p>
        {tried && !ok && <p className="text-[0.9375rem] font-medium text-indigo" role="alert">Fill in all four fields to continue.</p>}
        {sealError && <p className="text-[0.9375rem] font-medium text-indigo" role="alert">Could not seal the entry: {sealError}</p>}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <SquareButton onClick={submit}>Seal to the engine</SquareButton>
          <CtaButton onClick={flow.anotherPayslip}>Use another payslip</CtaButton>
        </div>
      </div>

      <div>{ex ? <VerifiedPanel verified={ex.verified} /> : null}</div>
    </div>
  )
}
