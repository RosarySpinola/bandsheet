import { useState } from "react"
import { Check, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { CopyButton } from "../copy-button"

/** Article 7 letter in a framed paper block, with copy and a .txt download. */
export function Letter({ subject, body: raw, source, reference }: { subject: string; body: string; source: "model" | "fallback"; reference?: string }) {
  const [withRef, setWithRef] = useState(true)
  /** Put the outside reference before the sign-off, or at the end if there is no recognisable sign-off. */
  const body = !reference || !withRef ? raw : insertBeforeSignoff(raw, reference)
  const text = `Subject: ${subject}\n\n${body}\n`
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "article-7-pay-information-request.txt"
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="border-2 border-ink bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3 md:px-8">
          <p className="min-w-0 truncate text-[0.9375rem] font-semibold text-ink">{subject}</p>
          <div className="flex shrink-0 items-center gap-1">
            <CopyButton value={text} label="Copy the letter" />
            <button
              type="button"
              onClick={download}
              aria-label="Download as .txt"
              title="Download as .txt"
              className="inline-grid size-8 cursor-pointer place-items-center text-ink/55 transition-colors duration-[400ms] ease-gl hover:bg-lav-soft hover:text-ink"
            >
              <Download className="size-4" />
            </button>
          </div>
        </div>
        <div className="max-h-[32rem] overflow-y-auto px-5 py-6 md:px-8">
          <p className="font-serif text-[1.0625rem] leading-[1.7] whitespace-pre-wrap text-ink">{body}</p>
        </div>
      </div>
      {reference && (
        <button
          type="button"
          role="checkbox"
          aria-checked={withRef}
          onClick={() => setWithRef((v) => !v)}
          className="group flex w-fit cursor-pointer items-start gap-3 text-left text-[0.9375rem] text-ink"
        >
          <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center border-2 border-ink transition-colors duration-[400ms] ease-gl", withRef ? "bg-ink text-white" : "bg-white")}>
            {withRef && <Check className="size-3.5" strokeWidth={3} />}
          </span>
          <span className="wipe group-hover:after:scale-x-100">Include the Eurostat reference in the letter</span>
        </button>
      )}
      <p className="text-[0.875rem] text-muted-foreground">
        {source === "model"
          ? "Drafted inside NEAR AI Cloud's enclave. Your pay figure is deliberately left out; fill the bracketed parts before sending."
          : "Drafted from Bandsheet's template, because the model's draft did not pass our checks. Fill the bracketed parts before sending."}
      </p>
    </div>
  )
}

function insertBeforeSignoff(body: string, para: string): string {
  const m = body.match(/\n\s*(Yours (sincerely|faithfully)|Kind regards|Best regards|Sincerely|Thank you)[^\n]*/i)
  if (!m || m.index === undefined) return `${body.trimEnd()}\n\n${para}`
  return `${body.slice(0, m.index).trimEnd()}\n\n${para}\n${body.slice(m.index)}`
}
