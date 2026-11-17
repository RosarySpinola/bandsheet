import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { EmptyState, ErrorState, GlField, GlSelect, Page, PageHeader, Section, Shimmer, SquareButton, VerifiedPanel } from "@/components/unit"
import { PositionCard } from "@/components/unit/stand/position"
import { Letter } from "@/components/unit/stand/letter"
import { bandSource, bandSourceText } from "@/components/unit/stand/band-source"
import { SyntheticNotice } from "@/components/units/badges"
import { UnitGate } from "@/components/units/unit-states"
import { getContext, plainError } from "@/lib/api"
import { units, type StandBody, type UnitView } from "@/lib/units"
import { useUnitOutlet } from "./shell"

const GRADES = ["Junior", "Reporter", "Senior", "Editor", "Chief"].map((g) => ({ value: g, label: g }))
const COUNTRIES = [
  { value: "MT", label: "Malta" },
  { value: "IE", label: "Ireland" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "GR", label: "Greece" },
]

export default function UnitStand() {
  const { view } = useUnitOutlet()
  return (
    <Page>
      <PageHeader glyph="stand" eyebrow={view.data ? `Private to you · ${view.data.unit.name}` : "Private to you"} title="Where do I stand" lede="Compare your pay with your grade's band in your own unit. The answer and a pay-information letter are written inside NEAR AI Cloud's enclave." />
      <UnitGate view={view}>{view.data && <Body v={view.data} />}</UnitGate>
    </Page>
  )
}

function Body({ v }: { v: UnitView }) {
  const [gross, setGross] = useState("")
  const [grade, setGrade] = useState<string | undefined>()
  const [country, setCountry] = useState<StandBody["country"]>("MT")
  const [tried, setTried] = useState(false)
  const ask = useMutation({ mutationFn: (b: StandBody) => units.stand(b) })
  const context = useQuery({ queryKey: ["context", country, "OC2"], queryFn: () => getContext(country, "OC2"), staleTime: Infinity, retry: 1 })
  const releases = [...v.releases].sort((a, b) => a.id - b.id)
  const latestId = releases.at(-1)?.id
  const grossOk = gross !== "" && Number(gross) >= 1000 && Number(gross) <= 10_000_000
  const source = grade ? bandSource(releases, grade) : undefined
  const fromRelease = source ? releases.find((r) => r.id === source.from) : undefined
  const body = (): StandBody | null => (grossOk && grade ? { gross_annual_eur: Number(gross), grade: grade as StandBody["grade"], country, unit_id: v.unit.id } : null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    const b = body()
    if (b) return ask.mutate(b)
    // Take the member to the first field that needs them; the errors below say what is missing.
    document.getElementById(grossOk ? "sel-your-grade" : "fld-your-gross-annual-pay")?.focus()
  }
  const missing = [!grossOk && "enter your gross annual pay", !grade && "choose your grade"].filter(Boolean).join(" and ")

  return (
    <div className="grid grid-cols-1 gap-12 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:gap-16">
      <form onSubmit={submit} className="flex flex-col gap-7 self-start" noValidate>
        <GlField label="Your gross annual pay" prefix="€" inputMode="numeric" placeholder="52000" value={gross} onChange={(e) => setGross(e.target.value.replace(/[^\d]/g, ""))} invalid={tried && !grossOk} hint={tried && !grossOk ? "Enter your full-year gross in whole euros, at least €1,000." : "Before tax, for a full year."} />
        <div className="flex flex-col gap-2">
          <GlSelect label="Your grade" value={grade} onChange={setGrade} options={GRADES} invalid={tried && !grade} />
          {tried && !grade && <p className="text-[0.875rem] font-medium text-indigo">Choose your grade.</p>}
        </div>
        <GlSelect label="Country, for the Eurostat context" value={country} onChange={(c) => setCountry(c as StandBody["country"])} options={COUNTRIES} />
        <div className="flex flex-col gap-3">
          <SquareButton type="submit" disabled={ask.isPending} className="w-full sm:w-fit">{ask.isPending ? "Asking privately…" : "Ask privately"}</SquareButton>
          {tried && missing && <p role="alert" className="text-[0.9375rem] font-medium text-indigo">To ask, {missing}.</p>}
          <p className="text-[0.9375rem] font-medium text-ink">Your figure is not stored.</p>
          <p className="text-[0.875rem] leading-relaxed text-muted-foreground">It goes to an attested model with your unit's public bands, and the reply comes back to this page only.</p>
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-4 text-[0.875rem] leading-relaxed text-muted-foreground">
          {releases.length === 0 ? <p>Your unit has no release yet, so there is no band to compare with. The letter still works.</p> : grade ? <p>{bandSourceText(source ?? null, grade, latestId)}</p> : <p>Each grade's band is the newest one your unit could publish safely.</p>}
        </div>
        {fromRelease && <SyntheticNotice n={fromRelease.counts.synthetic} />}
      </form>

      <div aria-live="polite">
        {ask.isPending ? (
          <div className="flex flex-col gap-6" aria-busy="true">
            <div className="flex flex-col gap-4 bg-lav-soft p-6 md:p-10">
              <p className="font-serif text-[1.75rem] leading-tight text-ink">Thinking it through inside NEAR AI Cloud's enclave…</p>
              <p className="text-[0.9375rem] text-foreground">Checking the attestation, then drafting your answer and letter. About 15 seconds.</p>
            </div>
            <Shimmer className="h-40" />
            <Shimmer className="h-72" />
          </div>
        ) : ask.isError ? (
          <ErrorState error={ask.error} tone={plainError(ask.error).code === "ATTESTATION_FAILED" ? "alarm" : "calm"} onRetry={() => { const b = body(); if (b) ask.mutate(b) }} />
        ) : ask.data ? (
          <div className="flex flex-col gap-12">
            {ask.data.position ? (
              <PositionCard p={ask.data.position} context={context.data} origin={bandSourceText(bandSource(releases, ask.data.position.grade), ask.data.position.grade, latestId)} />
            ) : (
              <EmptyState title={`No safe band for ${grade} yet`} body="Your unit could not publish an average for your grade without exposing someone, so there is nothing to compare with. The letter below asks your employer directly." />
            )}
            <Section title="Your private answer">
              <p className="max-w-[44rem] font-serif text-[1.25rem] leading-[1.6] text-ink md:text-[1.3125rem]">{ask.data.answer}</p>
            </Section>
            <Section title="Article 7 pay-information request" aside="Directive (EU) 2023/970">
              <Letter subject={ask.data.letter.subject} body={ask.data.letter.body} source={ask.data.source} />
            </Section>
            <VerifiedPanel verified={ask.data.verified} />
          </div>
        ) : (
          <EmptyState title="Your answer appears here" body="Enter your gross annual pay and grade. You get your position against your unit's band, a plain-language answer and a draft letter asking your employer for pay information under Article 7 of the EU Pay Transparency Directive." />
        )}
      </div>
    </div>
  )
}
