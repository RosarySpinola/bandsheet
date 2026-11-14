import { Navigate } from "react-router"
import { usePolicy } from "@/lib/chain"
import { joinHref, useMember } from "@/components/unit/session"
import { Page } from "@/components/unit/page"
import { PageHeader, Section } from "@/components/unit/page-header"
import { ErrorState } from "@/components/unit/states"
import { StepsNav } from "@/components/unit/submit/steps-nav"
import { StepKey } from "@/components/unit/submit/step-key"
import { StepUpload } from "@/components/unit/submit/step-upload"
import { StepConfirm } from "@/components/unit/submit/step-confirm"
import { StepDone, StepSend } from "@/components/unit/submit/step-send"
import { useSubmitFlow } from "@/components/unit/submit/use-submit-flow"

const PATH = [
  { n: "1", title: "Read inside an enclave", body: "NEAR AI Cloud reads the payslip in a TEE whose attestation is checked before anything is sent." },
  { n: "2", title: "Sealed in your browser", body: "Four fields are encrypted to the engine's key. The payslip itself never goes on-chain." },
  { n: "3", title: "Opened only by the engine", body: "The OutLayer engine decrypts entries in its own TEE and publishes only bands that expose no one." },
]

export default function Submit() {
  const member = useMember()
  const policy = usePolicy()
  const flow = useSubmitFlow(policy.data, member)
  if (!member) return <Navigate to={joinHref("/unit/submit")} replace />
  const busy = flow.extract.status === "busy" || flow.send.status === "busy"

  return (
    <Page>
      <PageHeader
        glyph="submit"
        eyebrow="Members only · synthetic demo"
        title="Submit a payslip"
        lede="Add your pay to the chapel's pool without anyone, the chapel included, seeing your figure."
      />

      <StepsNav step={flow.step} reached={flow.reached} onStep={flow.go} locked={busy} />

      {policy.isError && flow.step >= 3 && (
        <ErrorState error={policy.error} title="The engine's public key could not be read, so nothing can be sealed yet." onRetry={() => policy.refetch()} />
      )}

      <div key={flow.step} className="animate-in fade-in-0 slide-in-from-bottom-6 duration-500 ease-gl">
        {flow.step === 1 && <StepKey flow={flow} />}
        {flow.step === 2 && <StepUpload flow={flow} />}
        {flow.step === 3 && <StepConfirm flow={flow} />}
        {flow.step === 4 && <StepSend flow={flow} policy={policy.data} />}
        {flow.step === 5 && <StepDone flow={flow} />}
      </div>

      <Section title="Where your payslip goes" band>
        <ol className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {PATH.map((p) => (
            <li key={p.n} className="flex gap-4">
              <span className="grid size-9 shrink-0 place-items-center bg-lav-mid text-[0.9375rem] font-semibold text-ink">{p.n}</span>
              <span className="flex flex-col gap-1.5">
                <span className="text-[1.0625rem] font-semibold text-ink">{p.title}</span>
                <span className="text-[0.9375rem] leading-relaxed text-foreground">{p.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </Section>
    </Page>
  )
}
