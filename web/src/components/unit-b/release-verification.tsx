import { MailCheck, MailX } from "lucide-react"
import { int } from "@/lib/format"
import { rejectionText, type ReleaseExtras } from "@/lib/dkim"

/** Which entries the engine counted: payslips it verified by employer signature, and the ones it refused (no identities). */
export function ReleaseVerification({ extras: x }: { extras: ReleaseExtras }) {
  if (!x.requireDkim && x.entriesVerified === null && x.rejections.length === 0) {
    return (
      <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
        Released before the chapel required employer-signed payslips, so entries were counted as members sealed them.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-4 bg-band p-5 md:p-6">
      {x.entriesVerified !== null && (
        <div className="flex items-baseline gap-3">
          <span className="gl-num text-[2.25rem] leading-none text-ink">{int(x.entriesVerified)}</span>
          <span className="text-[0.9375rem] text-foreground">payslips verified by employer signature inside the enclave</span>
        </div>
      )}
      {x.rejections.length > 0 ? (
        <ul className="flex flex-col gap-2 border-t border-border pt-4">
          {x.rejections.map((r) => (
            <li key={r.reason} className="flex items-start gap-3 text-[0.9375rem] font-medium text-ink">
              <MailX className="mt-0.5 size-4 shrink-0" />
              {rejectionText(r)}
            </li>
          ))}
          <li className="text-[0.8125rem] text-muted-foreground">Refused entries are left out of every cell. The record names no one.</li>
        </ul>
      ) : (
        <p className="flex items-center gap-3 border-t border-border pt-4 text-[0.9375rem] text-foreground">
          <MailCheck className="size-4 shrink-0" /> No entry was refused.
        </p>
      )}
      {x.issuers.length > 0 && (
        <p className="text-[0.8125rem] text-muted-foreground">
          Trusted at release time: {x.issuers.map((i) => `${i.domain} (${i.selector})`).join(", ")}
        </p>
      )}
    </div>
  )
}
