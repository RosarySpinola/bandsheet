import { useCallback, useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { Invite } from "@bandsheet/core/near"
import type { Ciphertext, Entry } from "@bandsheet/core"
import { demoSubmit, extractPayslip, type ExtractResponse } from "@/lib/api"
import type { Policy } from "@/lib/chain"
import { checkKey, nearLib } from "../key-check"
import type { Member } from "../session"
import { isEml } from "../dropzone"
import { useIdentity } from "@/lib/wallet/identity"
import { prepareWalletEntry, signAndPostWalletEntry, type PreparedEntry } from "@/lib/wallet/signed-submit"

async function fileB64(f: File): Promise<string> {
  const bytes = new Uint8Array(await f.arrayBuffer())
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

export type Step = 1 | 2 | 3 | 4 | 5
export type Fields = { gross_annual_eur: string; grade?: Entry["grade"]; gender?: Entry["gender"]; site?: Entry["site"] }
export type Receipt = { tx: string | null; via: "browser" | "server" | "wallet"; count: number | null; before: number | null; account?: string }
export type SampleKind = "email" | "forged" | "image"
export type Async<T> = { status: "idle" | "busy" | "done" | "error"; data?: T; error?: unknown }

const idle = { status: "idle" } as const

const coreLib = () => import("@bandsheet/core")

export function useSubmitFlow(policy: Policy | undefined, member: Member | null) {
  const qc = useQueryClient()
  const [step, setStep] = useState<Step>(1)
  const [reached, setReached] = useState<Step>(1)
  const [invite, setInvite] = useState<Async<{ invite: Invite; member: boolean; demo: boolean }>>(idle)
  const [file, setFile] = useState<File | null>(null)
  const [extract, setExtract] = useState<Async<ExtractResponse>>(idle)
  const [fields, setFields] = useState<Fields>({ gross_annual_eur: "" })
  const [sealed, setSealed] = useState<Ciphertext | null>(null)
  const [send, setSend] = useState<Async<Receipt>>(idle)
  /** The raw payroll email (base64) when an .eml was used; sealed with the entry for the enclave's DKIM check. */
  const [emlB64, setEmlB64] = useState<string | null>(null)
  const [sample, setSample] = useState<SampleKind | null>(null)
  /** A member who joined with a NEAR Connect wallet: their wallet must sign each entry before it is posted. */
  const who = useIdentity()
  const wallet = who?.method === "near-connect" && member !== null && who.slot === member.slot ? who : null
  const [stage, setStage] = useState<"wallet" | "posting" | null>(null)
  /** A wallet member's entry, prepared right after sealing so the tap can start the wallet call at once. */
  const [prepared, setPrepared] = useState<Async<PreparedEntry>>(idle)

  const go = useCallback((s: Step) => {
    setStep(s)
    setReached((r) => (s > r ? s : r))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  /** Re-check the stored member key against the contract (it may have been revoked since joining). */
  const checkStored = useCallback(async () => {
    if (!member) return setInvite(idle)
    setInvite({ status: "busy" })
    try {
      const k = await checkKey("stored", member.invite, member.demo)
      setInvite({ status: "done", data: { invite: k.invite, member: k.member, demo: k.demo } })
    } catch (error) {
      setInvite({ status: "error", error })
    }
  }, [member])

  useEffect(() => {
    void checkStored()
  }, [checkStored])

  const resetInvite = checkStored

  /** One NEAR AI Cloud call: the server verifies the enclave before the payslip leaves it. */
  const runExtract = useCallback(async (f: File, kind: SampleKind | null = null) => {
    setFile(f)
    setSample(kind)
    setEmlB64(null)
    setExtract({ status: "busy" })
    try {
      // Read inside the try: a file that can no longer be read (moved, revoked) must show an error, not hang.
      setEmlB64(isEml(f) ? await fileB64(f) : null)
      const res = await extractPayslip(f)
      setExtract({ status: "done", data: res })
      setFields((prev) => ({
        ...prev,
        gross_annual_eur: res.extracted.gross_annual_eur ? String(res.extracted.gross_annual_eur) : prev.gross_annual_eur,
        grade: res.extracted.grade_guess ?? prev.grade,
      }))
      // Advance only on a fresh read. (An effect keyed on "done" would bounce a member who comes back to step 2.)
      go(3)
    } catch (error) {
      setExtract({ status: "error", error })
    }
  }, [go])

  const trySample = useCallback(
    async (path: string, name: string, type: string, kind: SampleKind) => {
      const blob = await (await fetch(path)).blob()
      await runExtract(new File([blob], name, { type }), kind)
    },
    [runExtract],
  )

  /** Encrypt the confirmed entry to the enclave key from the contract policy. Runs in this browser. */
  const seal = useCallback(async () => {
    if (!policy || invite.status !== "done" || !invite.data) return
    const core = await coreLib()
    const entry: Entry = core.EntrySchema.parse({
      slot: invite.data.invite.slot,
      gross_annual_eur: Number(fields.gross_annual_eur),
      grade: fields.grade,
      gender: fields.gender,
      site: fields.site,
      submitted_at: Math.floor(Date.now() / 1000),
    })
    const key = core.parseEnclavePublicKey(policy.policy.enclave_pubkey)
    // With an email, the entry carries it (eml_b64) so the engine can verify the employer's DKIM signature.
    setSealed(
      emlB64
        ? core.encryptBytes(key, new TextEncoder().encode(JSON.stringify({ ...entry, eml_b64: emlB64 })))
        : core.encryptEntry(key, entry),
    )
    setSend(idle)
    go(4)
  }, [policy, invite, fields, emlB64, go])

  // After sealing, a wallet member's posting transaction and wallet call are prepared (no tap needed).
  const invData = invite.status === "done" ? invite.data : undefined
  useEffect(() => {
    if (!wallet || !sealed || !invData) return setPrepared(idle)
    let live = true
    setPrepared({ status: "busy" })
    prepareWalletEntry(invData.invite, sealed, wallet).then(
      (data) => live && setPrepared({ status: "done", data }),
      (error) => live && setPrepared({ status: "error", error }),
    )
    return () => {
      live = false
    }
  }, [wallet, sealed, invData])

  /** Sign `submit` with the member key in the browser; for the demo key, fall back to the server signer. */
  const sendSealed = useCallback(async () => {
    if (!sealed || invite.status !== "done" || !invite.data) return
    const before = policy?.entries ?? null
    const { invite: inv, demo } = invite.data
    if (wallet) {
      if (prepared.status !== "done" || !prepared.data) return
      // The wallet call starts here, synchronously in the tap; nothing awaits before it.
      const posting = signAndPostWalletEntry(prepared.data, () => setStage("posting"))
      setStage("wallet")
      setSend({ status: "busy" })
      try {
        const r = await posting
        setSend({ status: "done", data: { tx: r.tx.hash, via: "wallet", count: r.entry_count, before, account: r.account_id } })
      } catch (error) {
        setSend({ status: "error", error })
        // A used or expired nonce needs a fresh preparation; a decline can reuse the same one.
        if ((error as { code?: string })?.code !== "WALLET_REFUSED") setPrepared(idle)
        if ((error as { code?: string })?.code !== "WALLET_REFUSED" && invData) {
          prepareWalletEntry(invData.invite, sealed, wallet).then((data) => setPrepared({ status: "done", data }), (e) => setPrepared({ status: "error", error: e }))
        }
        return
      } finally {
        setStage(null)
      }
      void qc.invalidateQueries({ queryKey: ["chain", "policy"] })
      go(5)
      return
    }
    setSend({ status: "busy" })
    try {
      const near = await nearLib()
      const out = (await near.submitEntry(inv, sealed)) as { result: unknown; txHash?: string }
      const count = Number(out.result)
      setSend({ status: "done", data: { tx: out.txHash ?? null, via: "browser", count: Number.isFinite(count) ? count : null, before } })
    } catch (browserErr) {
      const msg = browserErr instanceof Error ? browserErr.message : String(browserErr)
      const refused = /not a registered member|outside the union/i.test(msg)
      if (refused || !demo) {
        setSend({ status: "error", error: browserErr })
        return
      }
      try {
        const r = await demoSubmit(sealed)
        setSend({ status: "done", data: { tx: r.tx.hash, via: "server", count: r.entry_count, before } })
      } catch (error) {
        setSend({ status: "error", error })
        return
      }
    }
    void qc.invalidateQueries({ queryKey: ["chain", "policy"] })
    go(5)
  }, [sealed, invite, policy, qc, go, wallet, prepared, invData])

  /** Step 3 -> 2: forget the read payslip (and anything sealed from it) and show an empty upload step. Gender and site stay. */
  const anotherPayslip = useCallback(() => {
    setFile(null)
    setEmlB64(null)
    setSample(null)
    setExtract(idle)
    setSealed(null)
    setSend(idle)
    setFields((prev) => ({ gross_annual_eur: "", gender: prev.gender, site: prev.site }))
    setReached(2)
    go(2)
  }, [go])

  const restart = useCallback(() => {
    setFile(null)
    setEmlB64(null)
    setSample(null)
    setExtract(idle)
    setSealed(null)
    setSend(idle)
    setFields({ gross_annual_eur: "" })
    setReached(2)
    go(2)
  }, [go])

  return {
    step, reached, go, invite, resetInvite,
    file, extract, runExtract, trySample, fields, setFields, emlB64, sample,
    sealed, seal, send, sendSealed, restart, anotherPayslip, wallet, stage, prepared,
  }
}

export type SubmitFlow = ReturnType<typeof useSubmitFlow>
