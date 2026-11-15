import { useState } from "react"
import { ErrorState, Page, PageHeader, Section } from "@/components/unit"
import { StepsNav } from "@/components/unit/submit/steps-nav"
import { StepKey } from "@/components/unit/submit/step-key"
import { StepUpload } from "@/components/unit/submit/step-upload"
import { StepConfirm } from "@/components/unit/submit/step-confirm"
import { StepDone, StepSend } from "@/components/unit/submit/step-send"
import { SubmitScopeProvider, type SubmitScope } from "@/components/unit/submit/scope"
import { useSubmitFlow } from "@/components/unit/submit/use-submit-flow"
import { EntryBadge, badgeNote } from "@/components/units/badges"
import { Membership } from "@/components/units/membership"
import { PayslipMaker } from "@/components/units/payslip-maker"
import { UnitDkimCard, useUnitIssuer } from "@/components/units/unit-dkim"
import { UnitGate } from "@/components/units/unit-states"
import { useUnitEntry, useUnitTarget } from "@/components/units/use-unit-entry"
import { WalletGate } from "@/components/units/wallet-gate"
import type { Policy } from "@/lib/chain"
import { shortAccount } from "@/lib/wallet/identity"
import { units, type Conn, type Unit, type UnitsPolicy } from "@/lib/units"
import { memberOf, useUnitKey, type UnitKey } from "@/lib/units/keys"
import { useUnitsPolicy } from "@/lib/units/hooks"
import { disconnectWallet } from "@/lib/units/wallet-store"
import { useUnitOutlet } from "./shell"

const SITES = [
  { value: "City", label: "Main site", hint: "The engine's first site code" },
  { value: "Port", label: "Second site", hint: "Any other office or bureau" },
]

/** The demo flow reads the engine key and entry count from a Policy; a unit supplies its own. */
const asPolicy = (p: UnitsPolicy, u: Unit): Policy => ({
  unit: units.contract,
  owner: "",
  dao: "",
  policy: { k: p.k, enclave_pubkey: p.enclavePubkey, wasm_sha256: p.wasmSha256, policy_hash: p.policyHash ?? "" },
  outlayer: { account: "", source: p.outlayer ?? "" },
  members: u.members,
  entries: u.entries,
  releases: u.releases,
})

export default function UnitSubmit() {
  const { unitId, view } = useUnitOutlet()
  const key = useUnitKey(unitId)
  return (
    <Page>
      <PageHeader glyph="submit" eyebrow={view.data ? `${view.data.unit.name} · members only` : "Members only"} title="Submit a payslip" lede="Add your pay to your unit's pool without anyone, the council included, seeing your figure." />
      <UnitGate view={view}>
        {view.data &&
          (key ? (
            <WalletGate title="Connect the wallet you joined with" body={`Each entry is signed by your wallet before it is posted. This browser's member key was joined by ${shortAccount(key.accountId)}.`}>
              {(conn) => (conn.accountId === key.accountId ? <Flow key={key.slot} unit={view.data!.unit} k={key} conn={conn} /> : <WrongWallet conn={conn} k={key} />)}
            </WalletGate>
          ) : (
            <Section title="Join first">
              <Membership unit={view.data.unit} />
            </Section>
          ))}
      </UnitGate>
    </Page>
  )
}

function WrongWallet({ conn, k }: { conn: Conn; k: UnitKey }) {
  return (
    <div className="flex flex-col gap-3 border-t-2 border-ink bg-lav-soft p-6" role="alert">
      <p className="text-[1.0625rem] font-semibold text-ink">This browser's member key belongs to {shortAccount(k.accountId)}, not {shortAccount(conn.accountId)}.</p>
      <p className="text-[0.9375rem] text-foreground">The server only posts an entry signed by the wallet that joined with this key. Switch wallets to submit.</p>
      <button type="button" onClick={disconnectWallet} className="wipe w-fit cursor-pointer font-semibold text-ink">
        Disconnect {shortAccount(conn.accountId)}
      </button>
    </div>
  )
}

function Flow({ unit, k, conn }: { unit: Unit; k: UnitKey; conn: Conn }) {
  const policy = useUnitsPolicy()
  // Made once per key (the parent keys Flow by slot), so a new last-entry badge does not re-check the key mid-flow.
  const [member] = useState(() => memberOf(k))
  const refs = useUnitTarget(unit)
  const pol = policy.data ? asPolicy(policy.data, unit) : undefined
  const flow = useSubmitFlow(pol, member, refs.target)
  const preview = flow.extract.status === "done" ? flow.extract.data?.dkim_preview : null
  const issuer = useUnitIssuer(unit, flow.emlB64, preview)
  const gate = useUnitEntry(conn, unit, flow, issuer.kind, refs)
  const busy = flow.extract.status === "busy" || flow.send.status === "busy"

  const scope: SubmitScope = {
    unitName: unit.name,
    noun: "unit",
    contract: units.contract,
    switchKeyHref: `/u/${unit.id}`,
    standHref: `/u/${unit.id}/stand`,
    siteOptions: SITES,
    samples: (
      <div className="flex flex-col gap-3">
        <p className="text-[0.9375rem] text-foreground">
          PDF, image or typed payslips count as <strong>self-attested</strong>. A payroll email (.eml) signed by {unit.dkimDomains.length ? unit.dkimDomains.join(" or ") : "a domain the council lists"} counts as <strong>DKIM-verified</strong>.
        </p>
        <PayslipMaker onUse={(f) => flow.runExtract(f)} disabled={busy} />
      </div>
    ),
    dkimCard: (p) => <UnitDkimCard unit={unit} email={p.email} preview={p.preview} state={issuer} />,
    doneNote: (
      <p className="flex flex-col gap-2 border-l-2 border-ink bg-band px-5 py-4 text-[0.9375rem] text-foreground">
        <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">Your entry is <EntryBadge kind={issuer.kind} /></span>
        <span>{badgeNote(issuer.kind)}</span>
      </p>
    ),
    sendGate: gate,
  }

  return (
    <SubmitScopeProvider value={scope}>
      <StepsNav step={flow.step} reached={flow.reached} onStep={flow.go} locked={busy} />
      {policy.isError && flow.step >= 3 && <ErrorState error={policy.error} title="The engine's public key could not be read, so nothing can be sealed yet." onRetry={() => void policy.refetch()} />}
      <div key={flow.step} className="animate-in fade-in-0 slide-in-from-bottom-6 duration-500 ease-gl">
        {flow.step === 1 && <StepKey flow={flow} />}
        {flow.step === 2 && <StepUpload flow={flow} />}
        {flow.step === 3 && <StepConfirm flow={flow} />}
        {flow.step === 4 && <StepSend flow={flow} policy={pol} />}
        {flow.step === 5 && <StepDone flow={flow} />}
      </div>
    </SubmitScopeProvider>
  )
}
