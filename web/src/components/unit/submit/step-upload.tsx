import { Mail, MailWarning } from "lucide-react"
import { plainError } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Dropzone } from "../dropzone"
import { CtaButton } from "../links"
import { ErrorState } from "../states"
import type { SampleKind, SubmitFlow } from "./use-submit-flow"
import { useSubmitScope } from "./scope"

const SAMPLES: { path: string; name: string; kind: SampleKind; title: string; note: string; Icon: typeof Mail }[] = [
  {
    path: "/samples/payroll-email-noor-haddad.eml",
    name: "payroll-email-noor-haddad.eml",
    kind: "email",
    title: "Use a sample payroll email",
    note: "Signed by harbourcourier.example, with a PDF payslip attached",
    Icon: Mail,
  },
  {
    path: "/samples/payroll-email-forged.eml",
    name: "payroll-email-forged.eml",
    kind: "forged",
    title: "Try a forged one",
    note: "Same employer signature, but one digit of the pay was edited afterwards",
    Icon: MailWarning,
  },
]

const ALARM = new Set(["ATTESTATION_FAILED"])
/** Limits that a retry cannot clear: the demo's spend cap and the chapel's monthly read allowance. */
const NO_RETRY = new Set(["SPEND_CAP", "MONTHLY_READS"])
const TITLES: Record<string, string> = {
  ATTESTATION_FAILED: "Attestation failed. Your payslip was never sent.",
  SPEND_CAP: "The reading budget for this demo is used up",
  MONTHLY_READS: "This month's payslip reads are used up",
  EXTRACT_UNREADABLE: "The payslip could not be read",
}

/** Step 2: the payroll email (or a payslip file), read once inside NEAR AI Cloud's enclave. */
export function StepUpload({ flow }: { flow: SubmitFlow }) {
  const ex = flow.extract
  const busy = ex.status === "busy"
  const scope = useSubmitScope()

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-[40rem] text-[1.0625rem] leading-relaxed text-foreground">
        Best is the payslip email exactly as your payroll system sent it: your employer signs it (DKIM), and the sealed engine checks
        that signature before counting your figure. First the server checks NEAR AI Cloud's attestation with a fresh nonce; only then is
        the payslip read inside its enclave. Nothing is kept afterwards.
      </p>

      {busy ? (
        <div className="flex min-h-[13rem] flex-col justify-center gap-5 bg-lav-soft px-6 py-10 md:px-10" aria-busy="true" aria-live="polite">
          <p className="font-serif text-[1.75rem] leading-tight text-ink md:text-[2rem]">Reading inside NEAR AI Cloud's enclave…</p>
          <div className="h-[2px] w-full overflow-hidden bg-lav-mid">
            <div className="h-full w-1/3 animate-pulse bg-ink" />
          </div>
          <ul className="flex flex-col gap-1.5 text-[0.9375rem] text-foreground">
            <li>Checking the gateway and model attestations against a fresh nonce</li>
            <li>Sending {flow.file?.name ?? "the payslip"} only to the attested model</li>
            <li>Verifying the signature on the reply</li>
          </ul>
          <p className="text-[0.875rem] text-muted-foreground">This usually takes 10 to 30 seconds.</p>
        </div>
      ) : (
        <Dropzone onFile={(f) => flow.runExtract(f)} onReject={flow.anotherPayslip} file={flow.file} />
      )}

      {!busy && scope.samples}
      {!busy && !scope.samples && (
        <div className="flex flex-col gap-3">
          <p className="text-[0.9375rem] font-medium text-ink">No payroll email to hand? Synthetic samples from Harbour Courier Ltd:</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SAMPLES.map((s) => (
              <button
                key={s.path}
                type="button"
                onClick={() => flow.trySample(s.path, s.name, "message/rfc822", s.kind)}
                className="group flex cursor-pointer items-center gap-4 border border-border bg-white px-4 py-4 text-left transition-colors duration-[400ms] ease-gl hover:border-ink hover:bg-band"
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center transition-colors duration-[400ms] group-hover:bg-ink group-hover:text-white",
                    s.kind === "forged" ? "bg-lav-mid text-ink" : "bg-band text-ink",
                  )}
                >
                  <s.Icon className="size-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="wipe w-fit text-[1rem] font-semibold text-ink group-hover:after:scale-x-100">{s.title}</span>
                  <span className="text-[0.875rem] leading-snug text-muted-foreground">{s.note}</span>
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => flow.trySample("/samples/payslip-senior-monthly.png", "payslip-senior-monthly.png", "image/png", "image")}
            className="wipe w-fit cursor-pointer text-[0.9375rem] text-muted-foreground transition-colors duration-[400ms] hover:text-ink"
          >
            Or use a payslip image (read, but not counted while the chapel requires signed emails)
          </button>
          <a
            href="/samples/payroll-email-noor-haddad.eml"
            download="payroll-email-noor-haddad.eml"
            className="wipe w-fit text-[0.9375rem] text-muted-foreground transition-colors duration-[400ms] hover:text-ink"
          >
            Download the sample payroll email (.eml) to upload it yourself
          </a>
        </div>
      )}

      {ex.status === "error" && (
        <ErrorState
          error={ex.error}
          tone={ALARM.has(plainError(ex.error).code) ? "alarm" : "calm"}
          title={TITLES[plainError(ex.error).code]}
          onRetry={NO_RETRY.has(plainError(ex.error).code) ? undefined : () => flow.file && flow.runExtract(flow.file, flow.sample)}
        >
          <CtaButton onClick={() => flow.go(3)} className="w-fit">
            Enter the figures by hand instead
          </CtaButton>
        </ErrorState>
      )}
    </div>
  )
}
