import { useEffect, useRef, type ReactNode } from "react"
import { useLocation } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { KeyRound, MailWarning } from "lucide-react"
import { z } from "zod"
import { Reveal } from "@/components/gl/reveal"
import { txHashOf, useDemoLog, useReleases } from "@/lib/chain"
import { extras, rejectionText } from "@/lib/dkim"
import { int } from "@/lib/format"
import { CtaLink, Shimmer, TxLink } from "@/components/unit"
import { ForgedLine } from "@/components/unit/submit/dkim-card"
import { READ_RPCS } from "@/lib/rpc"

const OUTSIDER_TX = "7eo7pKcCMJLtCy9fX3NT6gGkZAmkRwfK6mYut4ZGHPfb"
const OUTSIDER = "bs-guest-3f36b7.testnet"
const RPCS = READ_RPCS

const TxStatus = z.object({ result: z.object({ status: z.record(z.string(), z.unknown()) }) })

/** The contract's own panic message for the outsider's submit, read from the transaction on testnet. */
function useRefusal() {
  return useQuery({
    queryKey: ["chain", "tx", OUTSIDER_TX],
    staleTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tx", params: { tx_hash: OUTSIDER_TX, sender_account_id: OUTSIDER, wait_until: "NONE" } })
      for (const url of RPCS) {
        const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body }).catch(() => null)
        const p = TxStatus.safeParse(await res?.json().catch(() => null))
        if (!p.success) continue
        const m = JSON.stringify(p.data.result.status).match(/Smart contract panicked: ([^"]+)/)
        return m ? m[1]! : null
      }
      return null
    },
  })
}

/** "Try to cheat": a forged payslip refused inside the enclave, and an outsider key refused by the contract. */
export function CheatSection() {
  const releases = useReleases()
  const log = useDemoLog()
  const refusal = useRefusal()
  const forgedTx = log.data?.dkim_forged_submit?.at(-1)
  const dkimRelease = [...(releases.data?.releases ?? [])].sort((a, b) => b.id - a.id).find((r) => extras(r).requireDkim)
  const x = dkimRelease ? extras(dkimRelease) : null
  const { hash } = useLocation()
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (hash === "#cheat") ref.current?.scrollIntoView({ block: "start" })
  }, [hash])

  return (
    <section ref={ref} id="cheat" className="flex scroll-mt-8 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-serif text-[2.25rem] leading-tight font-medium text-ink md:text-[2.75rem]">Try to cheat</h2>
        <p className="max-w-[44rem] text-[1.0625rem] leading-relaxed text-foreground">
          Poisoning the bands is the other attack. Both of these were tried for real on testnet, and both were refused.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal>
          <Card icon={<MailWarning className="size-5" />} title="A forged payslip" kicker="Refused inside the enclave">
            <div className="border border-border bg-white p-4 font-mono text-[0.8125rem] leading-relaxed text-muted-foreground">
              <p>From: Harbour Courier Payroll &lt;payroll@harbourcourier.example&gt;</p>
              <p>DKIM-Signature: d=harbourcourier.example; s=payroll2026; …</p>
              <p className="mt-2">Employee ID: HC-2977 · Grade: Senior · Period: 2026-10</p>
              <ForgedLine className="mt-1 block text-[0.8125rem]" />
            </div>
            <p className="text-[0.9375rem] leading-relaxed text-foreground">
              One digit of a real signed payslip was changed after signing, EUR 4,908.33 to 6,908.33, and a member sealed it with a claim of
              EUR 82,900 a year. The header still looks signed. The enclave recomputes the signature over the body and it no longer matches.
            </p>
            {releases.isPending ? (
              <Shimmer className="h-20" />
            ) : x && dkimRelease ? (
              <div className="flex flex-col gap-2 bg-lav-soft p-4">
                <p className="text-[0.8125rem] font-semibold tracking-[0.04em] text-ink uppercase">Release #{dkimRelease.id}, on chain</p>
                {x.rejections.length > 0 ? (
                  x.rejections.map((r) => (
                    <p key={r.reason} className="text-[1rem] font-semibold text-ink">
                      {rejectionText(r)}
                    </p>
                  ))
                ) : (
                  <p className="text-[1rem] text-ink">No entry was refused in this release.</p>
                )}
                {x.entriesVerified !== null && <p className="text-[0.9375rem] text-foreground">{int(x.entriesVerified)} payslips verified and counted.</p>}
                <CtaLink to={`/unit/releases#r${dkimRelease.id}`} className="text-[0.9375rem]">
                  Open release #{dkimRelease.id} in the ledger
                </CtaLink>
              </div>
            ) : (
              <p className="bg-band p-4 text-[0.9375rem] text-foreground">
                The forged entry is sealed on chain and waiting. The next release, the first with signed payslips required, will show its
                refusal here.
              </p>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]">
              {forgedTx && <TxLink tx={txHashOf(forgedTx)} label="Forged entry submitted (tx)" />}
              <CtaLink to="/unit/submit" className="text-[0.9375rem]">
                Try a forged one yourself
              </CtaLink>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={200}>
          <Card icon={<KeyRound className="size-5" />} title="A key that isn't a member" kicker="Refused by the contract">
            <p className="text-[0.9375rem] leading-relaxed text-foreground">
              An outside account, <code className="font-mono text-[0.875rem]">{OUTSIDER}</code>, called <code className="font-mono">submit</code>{" "}
              on the chapel's contract with a well-formed sealed entry. The contract checks the caller before it stores anything.
            </p>
            <div className="flex flex-col gap-2 bg-lav-soft p-4">
              <p className="text-[0.8125rem] font-semibold tracking-[0.04em] text-ink uppercase">The contract's answer, on chain</p>
              {refusal.isPending ? (
                <Shimmer className="h-10" />
              ) : (
                <p className="font-mono text-[0.875rem] leading-relaxed break-words text-ink">
                  {refusal.data ?? `Refused: ${OUTSIDER} is outside the union. Entries are accepted only from a member key.`}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]">
              <TxLink tx={OUTSIDER_TX} label="The refused transaction" />
              <CtaLink to="/unit/join" className="text-[0.9375rem]">
                Try a key that isn't a member
              </CtaLink>
            </div>
          </Card>
        </Reveal>
      </div>
    </section>
  )
}

function Card({ icon, title, kicker, children }: { icon: ReactNode; title: string; kicker: string; children: ReactNode }) {
  return (
    <article className="flex h-full flex-col gap-5 border-t-2 border-ink bg-band p-6 md:p-8">
      <div className="flex items-center gap-4">
        <span className="grid size-11 shrink-0 place-items-center bg-ink text-white">{icon}</span>
        <div className="flex flex-col">
          <h3 className="text-[1.375rem] leading-tight font-semibold text-ink">{title}</h3>
          <span className="text-[0.875rem] text-muted-foreground">{kicker}</span>
        </div>
      </div>
      {children}
    </article>
  )
}
