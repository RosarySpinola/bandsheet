import { Mail, MailX, ShieldCheck } from "lucide-react"
import type { ExtractResponse } from "@/lib/api"
import { useIssuers, useRequireDkim } from "@/lib/dkim"
import { cn } from "@/lib/utils"
import { CtaLink } from "../links"
import type { SampleKind } from "./use-submit-flow"

type Preview = NonNullable<ExtractResponse["dkim_preview"]>

/** The forged sample's one edited digit, shown in place. */
export function ForgedLine({ className }: { className?: string }) {
  return (
    <code className={cn("font-mono text-[0.9375rem] text-ink", className)}>
      Gross pay (month): EUR <mark className="bg-lav-mid px-0.5 font-semibold text-ink underline decoration-2 underline-offset-2">6</mark>,908.33
    </code>
  )
}

/**
 * What the payslip email claims about its employer signature. The server only previews the header;
 * the real DKIM verification happens inside the OutLayer enclave at release time.
 */
export function DkimCard({ preview, email, sample }: { preview?: Preview | null; email: boolean; sample: SampleKind | null }) {
  const issuers = useIssuers()
  const required = useRequireDkim().data
  const trusted =
    preview?.domain && preview.selector
      ? issuers.data?.some((i) => i.domain === preview.domain && i.selector === preview.selector)
      : undefined

  if (!email) {
    return (
      <Card icon={<MailX className="size-5" />} title="No employer signature on a photo or PDF">
        {required
          ? "This chapel requires a signed payroll email. A photo or PDF can be read and sealed, but the engine will not count it at release."
          : "Without the payroll email there is no employer signature to check, so this entry rests on your word."}
      </Card>
    )
  }
  if (!preview?.has_signature) {
    return (
      <Card icon={<MailX className="size-5" />} title="This email is not signed">
        There is no DKIM signature in it, so the engine will refuse it at release as coming from an untrusted sender.
      </Card>
    )
  }
  return (
    <div className="flex flex-col gap-0">
      <Card
        icon={<Mail className="size-5" />}
        title={
          <>
            Signed by {preview.domain} · selector {preview.selector}
          </>
        }
      >
        <span className="block">The engine checks this signature inside the enclave at release time.</span>
        {preview.signed_headers.length > 0 && (
          <span className="mt-2 block text-[0.8125rem] text-muted-foreground">Signed headers: {preview.signed_headers.join(", ")}</span>
        )}
        {trusted !== undefined && (
          <span className="mt-3 flex items-center gap-2 text-[0.9375rem] font-medium text-ink">
            <ShieldCheck className="size-4 shrink-0" />
            {trusted
              ? "This employer key is on the chapel's trusted list, added by DAO vote."
              : "This sender is not on the chapel's trusted list, so the engine will refuse it."}
          </span>
        )}
        <CtaLink to="/unit/verify#trusted-employers" className="mt-4 text-[0.9375rem]">
          See the trusted-issuer record
        </CtaLink>
      </Card>
      {sample === "forged" && (
        <div className="flex flex-col gap-3 border-x-2 border-b-2 border-ink bg-white p-5 md:p-6">
          <p className="text-[1rem] font-semibold text-ink">This is the forged sample.</p>
          <ForgedLine />
          <p className="text-[0.9375rem] leading-relaxed text-foreground">
            After Harbour Courier signed this email, its monthly gross was edited from EUR 4,908.33 to EUR 6,908.33. The signature header
            still looks right, which is why this preview can't tell. It will be sealed and sent like any entry, and the enclave will refuse
            it at release because the body no longer matches the signature.
          </p>
          <CtaLink to="/unit/attack#cheat" className="text-[0.9375rem]">
            See the real refusal in release #3
          </CtaLink>
        </div>
      )}
    </div>
  )
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 border-2 border-ink bg-band p-5 md:p-6">
      <span className="grid size-10 shrink-0 place-items-center bg-ink text-white">{icon}</span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-[1.0625rem] leading-snug font-semibold break-words text-ink">{title}</p>
        <div className="text-[0.9375rem] leading-relaxed text-foreground">{children}</div>
      </div>
    </div>
  )
}
