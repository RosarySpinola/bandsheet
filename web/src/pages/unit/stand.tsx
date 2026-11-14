import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Navigate } from "react-router"
import { joinHref, useMember } from "@/components/unit/session"
import { askStand, getContext, plainError, StandRequestSchema } from "@/lib/api"
import { useReleases } from "@/lib/chain"
import { Page } from "@/components/unit/page"
import { PageHeader, Section } from "@/components/unit/page-header"
import { GlField, GlSelect } from "@/components/unit/gl-select"
import { SquareButton } from "@/components/unit/links"
import { EmptyState, ErrorState, Shimmer } from "@/components/unit/states"
import { VerifiedPanel } from "@/components/unit/verified-panel"
import { PositionCard } from "@/components/unit/stand/position"
import { Letter } from "@/components/unit/stand/letter"
import { bandSource, bandSourceText } from "@/components/unit/stand/band-source"

const GRADES = ["Junior", "Reporter", "Senior", "Editor", "Chief"].map((g) => ({ value: g, label: g }))

export default function Stand() {
  const [gross, setGross] = useState("")
  const [grade, setGrade] = useState<string | undefined>()
  const [tried, setTried] = useState(false)
  const releases = useReleases()
  const ask = useMutation({ mutationFn: askStand })
  const member = useMember()
  const context = useQuery({ queryKey: ["context", "MT", "OC2"], queryFn: () => getContext("MT", "OC2"), staleTime: Infinity, retry: 1 })

  const parsed = StandRequestSchema.safeParse({ gross_annual_eur: Number(gross), grade, country: "MT" })
  const grossOk = gross !== "" && Number(gross) >= 1000
  const latest = releases.data?.latest
  const source = grade && releases.data ? bandSource(releases.data.releases, grade) : undefined

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (parsed.success && grossOk) ask.mutate(parsed.data)
  }

  if (!member) return <Navigate to={joinHref("/unit/stand")} replace />

  return (
    <Page>
      <PageHeader
        glyph="stand"
        eyebrow="Private to you · synthetic demo"
        title="Where do I stand"
        lede="Compare your pay with your grade's published band. The answer and a pay-information letter are written inside NEAR AI Cloud's enclave."
      />

      <div className="grid grid-cols-1 gap-12 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:gap-16">
        <form onSubmit={submit} className="flex flex-col gap-7 self-start" noValidate>
          <GlField
            label="Your gross annual pay"
            prefix="€"
            inputMode="numeric"
            placeholder="70000"
            value={gross}
            onChange={(e) => setGross(e.target.value.replace(/[^\d]/g, ""))}
            invalid={tried && !grossOk}
            hint={tried && !grossOk ? "Enter a whole number of euros, before tax." : "Before tax, for a full year."}
          />
          <GlSelect label="Your grade" value={grade} onChange={setGrade} options={GRADES} invalid={tried && !grade} />
          {tried && !grade && <p className="-mt-4 text-[0.875rem] font-medium text-indigo">Choose your grade.</p>}
          <div className="flex flex-col gap-3">
            <SquareButton type="submit" disabled={ask.isPending} className="w-full sm:w-fit">
              {ask.isPending ? "Asking privately…" : "Ask privately"}
            </SquareButton>
            <p className="text-[0.9375rem] font-medium text-ink">Your figure is not stored.</p>
            <p className="text-[0.875rem] leading-relaxed text-muted-foreground">
              It goes to an attested model with the public bands, and the reply comes back to this page only. It is not written to the chain,
              the server or this browser.
            </p>
          </div>
          <div className="flex flex-col gap-2 border-t border-border pt-4 text-[0.875rem] leading-relaxed text-muted-foreground">
            <p>
              Asking as slot <code className="font-mono text-ink">{member.slot.slice(0, 10)}…</code>.
            </p>
            {latest && (
              <p>
                {grade && source !== undefined
                  ? bandSourceText(source, grade, latest.release_id)
                  : `Each grade's band is the newest one the engine could publish safely, from releases #1 to #${latest.release_id}.`}
              </p>
            )}
          </div>
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
            <ErrorState
              error={ask.error}
              tone={plainError(ask.error).code === "ATTESTATION_FAILED" ? "alarm" : "calm"}
              onRetry={plainError(ask.error).code === "SPEND_CAP" ? undefined : () => parsed.success && ask.mutate(parsed.data)}
            />
          ) : ask.data ? (
            <div className="flex flex-col gap-12">
              {ask.data.position ? (
                <PositionCard
                  p={ask.data.position}
                  context={context.data}
                  origin={releases.data ? bandSourceText(bandSource(releases.data.releases, ask.data.position.grade), ask.data.position.grade, latest?.release_id) : undefined}
                />
              ) : (
                <EmptyState
                  title={`No safe band for ${grade} yet`}
                  body="The chapel could not publish an average for your grade without exposing someone, so there is nothing to compare with. The letter below asks your employer directly."
                />
              )}
              <Section title="Your private answer">
                <p className="max-w-[44rem] font-serif text-[1.25rem] leading-[1.6] text-ink md:text-[1.3125rem]">{ask.data.answer}</p>
              </Section>
              <Section title="Article 7 pay-information request" aside="Directive (EU) 2023/970">
                <Letter
                  subject={ask.data.letter.subject}
                  body={ask.data.letter.body}
                  source={ask.data.source}
                  reference={
                    context.data
                      ? `For context, Eurostat's Structure of Earnings Survey (${context.data.year}) puts the median gross monthly earnings of ${context.data.isco_label.toLowerCase()} in ${context.data.country_name} at EUR ${context.data.median_monthly_eur.toLocaleString("en-IE")} (${context.data.source_url}). I understand this is a broad category and an older survey year.`
                      : undefined
                  }
                />
              </Section>
              <VerifiedPanel verified={ask.data.verified} />
            </div>
          ) : (
            <EmptyState
              title="Your answer appears here"
              body="Enter your gross annual pay and grade. You get your position against the band, a plain-language answer and a draft letter asking your employer for pay information under Article 7 of the EU Pay Transparency Directive."
            />
          )}
        </div>
      </div>
    </Page>
  )
}
