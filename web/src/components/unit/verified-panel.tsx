import { useState } from "react"
import { Check as Tick, ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Verified } from "@/lib/api"
import { when } from "@/lib/format"
import { HashValue } from "./copy-button"
import { Fact } from "./page-header"

/** Pass/fail mark: filled ink tick, or an ink-outlined cross (red is reserved for exposed salaries). */
export function PassMark({ pass, className }: { pass: boolean; className?: string }) {
  return (
    <span
      className={cn("inline-grid size-6 shrink-0 place-items-center", pass ? "bg-ink text-white" : "border-2 border-ink bg-white text-ink", className)}
      aria-label={pass ? "passed" : "failed"}
    >
      {pass ? <Tick className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}
    </span>
  )
}

/**
 * Everything the server verified before and after the NEAR AI Cloud call: the attestation checks,
 * the model, the fresh nonce, the chat id and the signers that signed the response.
 */
export function VerifiedPanel({ verified, title, defaultOpen = false, className }: { verified: Verified; title?: string; defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen)
  const passed = verified.checks.filter((c) => c.pass).length
  const total = verified.checks.length
  const ok = verified.all_passed
  const signers = [...new Set(verified.signers.model)]

  return (
    <section className={cn("border-t-2 bg-band", "border-ink", className)} aria-label="Verification">
      <div className="flex flex-col gap-5 p-6 md:p-8">
        <div className="flex items-start gap-4">
          <PassMark pass={ok} className="mt-0.5 size-8" />
          <div className="flex flex-col gap-1">
            <p className={cn("text-[1.125rem] leading-snug font-semibold", "text-ink")}>
              {title ?? (ok ? "Verified inside NEAR AI Cloud's enclave" : "Verification incomplete")}
            </p>
            <p className="text-[0.9375rem] text-muted-foreground">
              {passed} of {total} checks passed · {when(new Date(verified.verified_at))}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <Fact label="Model">
            <span className="break-all">{verified.model}</span>
            {verified.owned_by && <span className="text-muted-foreground"> · hosted by {verified.owned_by}</span>}
          </Fact>
          <Fact label="Fresh nonce">
            <HashValue value={verified.nonce} />
          </Fact>
          <Fact label="Chat id">{verified.chat_id ? <HashValue value={verified.chat_id} head={10} /> : "—"}</Fact>
          <Fact label="Signature">{verified.signature_kind ?? "—"}</Fact>
          <Fact label="Gateway signer">{verified.signers.gateway ? <HashValue value={verified.signers.gateway} /> : "—"}</Fact>
          <Fact label={signers.length > 1 ? `Model signers (${signers.length})` : "Model signer"}>
            {signers.length === 0 ? (
              "—"
            ) : (
              <span className="flex flex-col">
                {signers.map((s) => (
                  <HashValue key={s} value={s} />
                ))}
              </span>
            )}
          </Fact>
        </dl>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cn(
            "flex cursor-pointer items-center justify-between border-t border-border pt-4 text-left text-[1rem] font-semibold transition-colors duration-[400ms] ease-gl",
            open ? "text-ink" : "text-[var(--gray-300)] hover:text-ink",
          )}
        >
          {open ? "Hide the checks" : `Show all ${total} checks`}
          <ChevronDown className={cn("size-5 transition-transform duration-200 ease-out", open && "rotate-180")} />
        </button>
        <div className={cn("grid transition-[grid-template-rows] duration-200", open ? "grid-rows-[1fr] ease-out" : "grid-rows-[0fr] ease-in")}>
          <ul className="overflow-hidden">
            {verified.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-3 border-b border-border py-3 last:border-b-0">
                <PassMark pass={c.pass} className="mt-0.5 size-5" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[0.9375rem] text-ink">{c.label}</span>
                  {c.detail && <code className="font-mono text-[0.75rem] break-all text-muted-foreground">{c.detail}</code>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
