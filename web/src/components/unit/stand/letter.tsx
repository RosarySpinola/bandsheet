import { Download } from "lucide-react"
import { CopyButton } from "../copy-button"

/** Article 7 letter in a framed paper block, with copy and a .txt download. */
export function Letter({ subject, body, source }: { subject: string; body: string; source: "model" | "fallback" }) {
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
      <p className="text-[0.875rem] text-muted-foreground">
        {source === "model"
          ? "Drafted inside NEAR AI Cloud's enclave. Your pay figure is deliberately left out; fill the bracketed parts before sending."
          : "Drafted from Bandsheet's template, because the model's draft did not pass our checks. Fill the bracketed parts before sending."}
      </p>
    </div>
  )
}
