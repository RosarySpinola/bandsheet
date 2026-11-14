import { useEffect, useState } from "react"
import type { Ciphertext } from "@bandsheet/core"
import { Spinner } from "@/components/ui/spinner"
import { ErrorState, SquareButton } from "@/components/unit"
import { bindEntry, sha256Hex, type EntryBinding } from "./auth-api"
import { shortAccount, useIdentity } from "./identity"
import { approveStatement, prepareStatement, type PreparedStatement } from "./near-auth"
import { WalletCancelled, walletSignStatement } from "./near-connect"

/** The ciphertext JSON exactly as the contract stores it (submission key order, compact), so anyone can match the hash on chain. */
export const storedText = (c: Ciphertext) => JSON.stringify({ epk: c.epk, nonce: c.nonce, ct: c.ct })

type State =
  | { s: "idle" }
  | { s: "busy" }
  | { s: "done"; b: EntryBinding }
  | { s: "cancelled" }
  | { s: "error"; error: unknown }

/**
 * After a signed-in member submits: their NEAR account signs "Bandsheet entry: <sha256 of the sealed entry>".
 * The server checks the signature, that the hash is on the contract, and that it came from this account's slot,
 * then records the binding off chain. The gas-free submit itself is unchanged. Renders nothing for the demo member.
 */
export function BindEntry({ ciphertext, slot }: { ciphertext: Ciphertext | null; slot: string | undefined }) {
  const who = useIdentity()
  const [hash, setHash] = useState<string | null>(null)
  const [prepared, setPrepared] = useState<PreparedStatement | null>(null)
  const [state, setState] = useState<State>({ s: "idle" })
  const mine = Boolean(who && ciphertext && slot && who.slot === slot)

  useEffect(() => {
    if (!mine || !ciphertext) return
    void sha256Hex(storedText(ciphertext)).then(setHash)
  }, [mine, ciphertext])

  // NEAR Auth opens a consent popup, which must start inside the click: fetch the nonce and build the statement first.
  useEffect(() => {
    if (!mine || !hash || who?.method !== "near-auth") return
    prepareStatement("entry", hash, { accountId: who.account_id, publicKey: who.public_key }).then(setPrepared, (error) => setState({ s: "error", error }))
  }, [mine, hash, who])

  if (!mine || !who || !hash) return null

  const sign = () => {
    setState({ s: "busy" })
    const claim =
      who.method === "near-auth"
        ? prepared
          ? approveStatement(prepared)
          : Promise.reject(new Error("still preparing"))
        : walletSignStatement(who.wallet_id ?? "", "entry", hash, who.account_id)
    claim
      .then((c) => bindEntry(c, hash, slot!, who.method))
      .then((b) => setState({ s: "done", b }))
      .catch((error) => setState(error instanceof WalletCancelled || /popup closed|cancelled/i.test(String(error?.message)) ? { s: "cancelled" } : { s: "error", error }))
  }

  return (
    <section className="flex flex-col gap-3 border-l-2 border-ink bg-white px-6 py-5">
      <p className="text-[1rem] font-semibold text-ink">Vouch for this entry with {shortAccount(who.account_id)}</p>
      <p className="text-[0.9375rem] leading-relaxed text-foreground">
        Your account signs <code className="font-mono text-[0.8125rem] break-all">Bandsheet entry: {hash.slice(0, 16)}…</code>, the hash of the sealed entry the
        contract now holds. Bandsheet records it privately; nothing that names you goes on chain.
      </p>
      {state.s === "done" ? (
        <p className="text-[0.9375rem] text-ink">Signed and recorded at {new Date(state.b.signed_at).toLocaleTimeString()}.</p>
      ) : state.s === "busy" ? (
        <p className="flex items-center gap-2 text-[0.9375rem] text-ink" role="status"><Spinner className="size-3.5" /> Approve in the {who.method === "near-auth" ? "NEAR Auth" : "wallet"} window…</p>
      ) : (
        <SquareButton variant="line" onClick={sign} disabled={who.method === "near-auth" && !prepared} className="w-full sm:w-fit">
          Sign this entry
        </SquareButton>
      )}
      {state.s === "cancelled" && <p className="text-[0.875rem] text-muted-foreground">Cancelled. The entry stays filed; it is just not vouched for.</p>}
      {state.s === "error" && <ErrorState error={state.error} title="The entry was not vouched for. It is still filed." />}
    </section>
  )
}
