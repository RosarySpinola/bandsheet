import { useCallback, useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { Invite } from "@bandsheet/core/near"
import type { Ciphertext, Entry } from "@bandsheet/core"
import { demoSubmit, extractPayslip, type ExtractResponse } from "@/lib/api"
import type { Policy } from "@/lib/chain"
import { checkKey, nearLib } from "../key-check"
import type { Member } from "../session"
import { isEml } from "../dropzone"

async function fileB64(f: File): Promise<string> {
  const bytes = new Uint8Array(await f.arrayBuffer())
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

export type Step = 1 | 2 | 3 | 4 | 5
export type Fields = { gross_annual_eur: string; grade?: Entry["grade"]; gender?: Entry["gender"]; site?: Entry["site"] }
export type Receipt = { tx: string | null; via: "browser" | "server"; count: number | null; before: number | null }
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
    setEmlB64(isEml(f) ? await fileB64(f) : null)
    setExtract({ status: "busy" })
    try {
      const res = await extractPayslip(f)
      setExtract({ status: "done", data: res })
      setFields((prev) => ({
        ...prev,
        gross_annual_eur: res.extracted.gross_annual_eur ? String(res.extracted.gross_annual_eur) : prev.gross_annual_eur,
        grade: res.extracted.grade_guess ?? prev.grade,
      }))
    } catch (error) {
      setExtract({ status: "error", error })
    }
  }, [])

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

  /** Sign `submit` with the member key in the browser; for the demo key, fall back to the server signer. */
  const sendSealed = useCallback(async () => {
    if (!sealed || invite.status !== "done" || !invite.data) return
    const before = policy?.entries ?? null
    setSend({ status: "busy" })
    const { invite: inv, demo } = invite.data
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
  }, [sealed, invite, policy, qc, go])

  const restart = useCallback(() => {
    setFile(null)
    setEmlB64(null)
    setSample(null)
    setExtract(idle)
    setSealed(null)
    setSend(idle)
    setFields({ gross_annual_eur: "" })
    go(2)
  }, [go])

  return {
    step, reached, go, invite, resetInvite,
    file, extract, runExtract, trySample, fields, setFields, emlB64, sample,
    sealed, seal, send, sendSealed, restart,
  }
}

export type SubmitFlow = ReturnType<typeof useSubmitFlow>
