import { Lock } from "lucide-react"
import { plainError } from "@/lib/api"
import { explorer, type Policy } from "@/lib/chain"
import { int, plural, shortHash } from "@/lib/format"
import { Fact } from "../page-header"
import { HashValue } from "../copy-button"
import { AccountLink, CtaButton, CtaLink, ExtLink, SquareButton, TxLink } from "../links"
import { ErrorState } from "../states"
import type { SubmitFlow } from "./use-submit-flow"
import { WebWalletTip } from "../web-wallet-tip"
import { shortAccount } from "@/lib/wallet/identity"
import { useSubmitScope } from "./scope"

/** Step 4: show the sealed envelope, then sign `submit` with the member key. */
export function StepSend({ flow, policy }: { flow: SubmitFlow; policy?: Policy }) {
  const c = flow.sealed
  const s = flow.send
  const scope = useSubmitScope()
  if (!c) return null
  const refused = s.status === "error" && plainError(s.error).code === "NOT_MEMBER"

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6 bg-ink p-6 text-white md:p-10">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center bg-lav-mid text-ink">
            <Lock className="size-5" />
          </span>
          <p className="text-[1.125rem] font-semibold">Sealed in this browser</p>
        </div>
        <p className="max-w-[38rem] text-[1rem] leading-relaxed text-white/80">
          Your entry{flow.emlB64 ? ", with the signed payroll email inside it," : ""} is encrypted to the engine's public key{" "}
          <code className="font-mono text-lav-mid">{shortHash(policy?.policy.enclave_pubkey, 10, 4)}</code>, read from the contract
          policy. Only the sealed OutLayer engine holds the matching private key. The contract, the {scope.noun} and this server see only the
          envelope below.
        </p>
        <dl className="grid grid-cols-1 gap-4 font-mono text-[0.8125rem] sm:grid-cols-3">
          {(["epk", "nonce", "ct"] as const).map((k) => (
            <div key={k} className="flex min-w-0 flex-col gap-1">
              <dt className="text-white/55">{k === "ct" ? `ciphertext · ${c.ct.length} chars` : k === "epk" ? "ephemeral key" : "nonce"}</dt>
              <dd className="truncate text-white" title={c[k]}>
                {c[k]}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {flow.wallet && flow.prepared.status === "error" && (
        <ErrorState error={flow.prepared.error} title="Your entry could not be prepared for your wallet." onRetry={() => flow.go(3)} />
      )}
      {s.status === "error" &&
        (refused ? (
          <ErrorState error={s.error} tone="alarm" title="Refused by the contract. This key is not a member." />
        ) : (
          <ErrorState error={s.error} onRetry={flow.sendSealed} />
        ))}

      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <SquareButton
          onClick={flow.sendSealed}
          disabled={s.status === "busy" || (flow.wallet !== null && flow.prepared.status !== "done") || (scope.sendGate !== undefined && !scope.sendGate.ready)}
          aria-busy={s.status === "busy"}
        >
          {scope.sendGate
            ? s.status === "busy" ? scope.sendGate.busyLabel : scope.sendGate.label
            : s.status !== "busy"
            ? flow.wallet
              ? flow.prepared.status === "done" ? "Sign with your wallet and post" : "Preparing your entry…"
              : "Sign and send to NEAR"
            : flow.stage === "wallet" ? "Approve in your wallet…" : flow.stage === "posting" ? "Posting…" : "Signing and sending…"}
        </SquareButton>
        <CtaButton onClick={() => flow.go(3)} disabled={s.status === "busy"}>
          Change the fields
        </CtaButton>
      </div>
      {scope.sendGate?.status}
      {scope.sendGate ? (
        scope.sendGate.note
      ) : flow.wallet ? (
        <p className="border-l-2 border-ink bg-band px-5 py-4 text-[0.9375rem] leading-relaxed text-foreground">
          Your wallet ({shortAccount(flow.wallet.account_id)}) signs; the chapel's posting key posts it, so your account never appears next to your entry
          on chain. Bandsheet checks your wallet's signature before anything is posted; if you decline, nothing is posted.
          <WebWalletTip className="mt-2 block" />
        </p>
      ) : (
        <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
          Your posting key signs a call to <code className="font-mono">submit</code> on <AccountLink id={scope.contract} className="text-[0.9375rem]" />.
          The {scope.noun}'s account pays the gas, so you need no tokens.
        </p>
      )}
    </div>
  )
}

/** Step 5: receipt with the transaction and what happened to the entry count. */
export function StepDone({ flow }: { flow: SubmitFlow }) {
  const r = flow.send.status === "done" ? flow.send.data : undefined
  const scope = useSubmitScope()
  if (!r) return null
  const same = r.count !== null && r.before !== null && r.count === r.before
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <p className="font-serif text-[2.25rem] leading-tight text-ink md:text-[2.75rem]">Your entry is filed.</p>
        <p className="max-w-[38rem] text-[1.0625rem] leading-relaxed text-foreground">
          Resubmitting replaces your entry; the count stays the same.
          {r.count !== null &&
            (same
              ? ` The unit still holds ${plural(r.count, "entry", "entries")}, because your slot already had one and this replaced it.`
              : ` The unit now holds ${plural(r.count, "entry", "entries")}.`)}
        </p>
        {scope.doneNote}
      </div>
      <dl className="grid grid-cols-1 gap-6 bg-band p-6 sm:grid-cols-2 md:p-8">
        <Fact label="Transaction">
          {r.tx ? <TxLink tx={r.tx} /> : <ExtLink href={explorer.account(scope.contract)}>Signed in your browser · see the contract</ExtLink>}
        </Fact>
        <Fact label="Signed by">
          {r.via === "wallet"
            ? `Your wallet (${shortAccount(r.account ?? "")}); posted by the ${scope.noun}'s posting key`
            : r.via === "browser" ? "Your posting key, in this browser" : "The demo member key, on the Bandsheet server"}
        </Fact>
        <Fact label="Entries">{r.count !== null ? int(r.count) : "—"}</Fact>
        <Fact label="Your slot">
          {flow.invite.status === "done" && flow.invite.data ? <HashValue value={flow.invite.data.invite.slot} head={12} tail={6} /> : "—"}
        </Fact>
      </dl>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <CtaLink to={scope.standHref} size="lg">
          See where you stand
        </CtaLink>
        <CtaButton onClick={flow.restart}>Submit again</CtaButton>
      </div>
    </div>
  )
}
