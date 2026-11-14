import { useEffect } from "react"
import { FileText, ImageIcon } from "lucide-react"
import { plainError } from "@/lib/api"
import { Dropzone } from "../dropzone"
import { CtaButton } from "../links"
import { ErrorState } from "../states"
import type { SubmitFlow } from "./use-submit-flow"

const SAMPLES = [
  { path: "/samples/payslip-senior-monthly.png", name: "payslip-senior-monthly.png", type: "image/png", label: "Senior Reporter, monthly", kind: "PNG" },
  { path: "/samples/payslip-editor.pdf", name: "payslip-editor.pdf", type: "application/pdf", label: "Editor", kind: "PDF" },
]

const ALARM = new Set(["ATTESTATION_FAILED"])
const TITLES: Record<string, string> = {
  ATTESTATION_FAILED: "Attestation failed. Your payslip was never sent.",
  SPEND_CAP: "The reading budget for this demo is used up",
  EXTRACT_UNREADABLE: "The payslip could not be read",
}

/** Step 2: custom dropzone or a synthetic sample, read once inside NEAR AI Cloud's enclave. */
export function StepUpload({ flow }: { flow: SubmitFlow }) {
  const ex = flow.extract
  const busy = ex.status === "busy"

  useEffect(() => {
    if (ex.status === "done" && flow.step === 2) flow.go(3)
  }, [ex.status, flow])

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-[38rem] text-[1.0625rem] leading-relaxed text-foreground">
        The server first checks NEAR AI Cloud's attestation with a fresh nonce. Only then does your payslip go to the model, inside its
        enclave, to read four things: gross pay, pay period, currency and job title. Nothing is kept afterwards.
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
        <Dropzone onFile={flow.runExtract} file={flow.file} />
      )}

      {!busy && (
        <div className="flex flex-col gap-3">
          <p className="text-[0.9375rem] font-medium text-ink">No payslip to hand? Use a synthetic sample:</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
            {SAMPLES.map((s) => (
              <button
                key={s.path}
                type="button"
                onClick={() => flow.trySample(s.path, s.name, s.type)}
                className="group flex flex-1 cursor-pointer items-center gap-4 border border-border bg-white px-4 py-4 text-left transition-colors duration-[400ms] ease-gl hover:border-ink hover:bg-band"
              >
                <span className="grid size-10 shrink-0 place-items-center bg-band text-ink transition-colors duration-[400ms] group-hover:bg-ink group-hover:text-white">
                  {s.kind === "PDF" ? <FileText className="size-5" /> : <ImageIcon className="size-5" />}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="wipe w-fit text-[1rem] font-semibold text-ink group-hover:after:scale-x-100">Use a sample payslip</span>
                  <span className="truncate text-[0.875rem] text-muted-foreground">
                    {s.label} · {s.kind} · fictional Harbour Courier Media DAC
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {ex.status === "error" && (
        <ErrorState
          error={ex.error}
          tone={ALARM.has(plainError(ex.error).code) ? "alarm" : "calm"}
          title={TITLES[plainError(ex.error).code]}
          onRetry={plainError(ex.error).code === "SPEND_CAP" ? undefined : () => flow.file && flow.runExtract(flow.file)}
        >
          <CtaButton onClick={() => flow.go(3)} className="w-fit">
            Enter the figures by hand instead
          </CtaButton>
        </ErrorState>
      )}
    </div>
  )
}
