import { AccountLink, ErrorState, HashValue, Page, PageHeader, Section, Shimmer } from "@/components/unit"
import { VerifyItem, type Check } from "@/components/unit/verify/verify-item"
import { ReleaseProof } from "@/components/unit-b/release-proof"
import { asQuery, describeQuery } from "@/components/unit-b/format"
import { CountsStrip, SyntheticNotice } from "@/components/units/badges"
import { UnitGate } from "@/components/units/unit-states"
import { usePolicy, OUTLAYER_PROJECT, explorer } from "@/lib/chain"
import { plural } from "@/lib/format"
import { isMock, units, type UnitView } from "@/lib/units"
import { useUnitsPolicy } from "@/lib/units/hooks"
import { useUnitOutlet } from "./shell"

export default function UnitVerify() {
  const { view } = useUnitOutlet()
  return (
    <Page>
      <PageHeader
        glyph="verify"
        eyebrow="Trust nothing on this page"
        title="Verify it yourself"
        lede="Your unit runs on its own contract but the same sealed engine as the example chapel. Here is every value this page relies on, what it proves, and the command to read it without us."
      />
      <UnitGate view={view}>{view.data && <Body v={view.data} />}</UnitGate>
    </Page>
  )
}

function Body({ v }: { v: UnitView }) {
  const p = useUnitsPolicy()
  const demo = usePolicy()
  const C = units.contract
  const { unit } = v
  const sameEngine: Check | undefined =
    p.data && demo.data
      ? p.data.wasmSha256 === demo.data.policy.wasm_sha256 && p.data.enclavePubkey === demo.data.policy.enclave_pubkey
        ? { state: "match", text: "Same engine build and enclave key as the example chapel's contract" }
        : { state: "mismatch", text: "Differs from the example chapel's engine or key" }
      : undefined
  const unitCmd = `near view ${C} get_unit '{"unit_id":${unit.id}}' --networkId testnet`

  return (
    <>
      {isMock() && <p className="border-l-2 border-indigo bg-lav-soft px-5 py-3 text-[0.9375rem] text-indigo">Mock mode: the unit below lives in this browser. The policy values are read live from the example chapel's contract (the same engine).</p>}
      <Section title="The policy" aside="Read live from the units contract">
        {p.isPending ? (
          <Shimmer className="h-64" />
        ) : p.isError ? (
          <ErrorState error={p.error} title="The units contract's policy could not be read." onRetry={() => void p.refetch()} />
        ) : (
          <ol className="flex flex-col">
            <VerifyItem n={1} title={`k = ${p.data.k}`} value={<span className="text-muted-foreground">The smallest group size the engine will publish.</span>} proves="No published average covers fewer than k people. A one-member unit therefore publishes nothing, and the refusal is logged." command={`near view ${C} get_policy '{}' --networkId testnet`} />
            <VerifyItem n={2} title="Enclave public key (X25519)" value={<HashValue value={p.data.enclavePubkey} head={14} tail={6} />} proves="Every entry is sealed to this key in the member's browser. Its private half exists only inside the OutLayer engine's TEE." check={sameEngine} command={`near view ${C} get_policy '{}' --networkId testnet`} />
            <VerifyItem n={3} title="Engine WASM sha256" value={<HashValue value={p.data.wasmSha256} head={12} tail={6} />} proves="The exact engine build the units contract accepts. OutLayer attests the hash of the WASM it ran for each release." check={sameEngine} command="./enclave/build.sh   # rebuilds and prints the sha256" />
            <VerifyItem n={4} title="Units contract" value={<AccountLink id={C} />} proves="Holds each unit's council, posting keys, sealed entries and releases. A unit's entries are only ever sent to the engine with that unit's own releases." links={[{ href: explorer.account(C), label: "Contract on nearblocks" }]} />
            <VerifyItem n={5} title="OutLayer project" value={<code className="font-mono text-[0.9375rem] break-all">{p.data.outlayer ?? OUTLAYER_PROJECT}</code>} proves="The sealed engine: the same OutLayer project as the example chapel, so the same attested build runs your releases." />
          </ol>
        )}
      </Section>

      <Section title={`Unit #${unit.id}`} aside="Read live from get_unit">
        <ol className="flex flex-col">
          <VerifyItem n={6} title="Council" value={<span className="flex flex-col gap-1">{unit.council.map((s) => <AccountLink key={s} id={s} className="text-[0.9375rem]" />)}</span>} proves={`A release runs only when more than half of these ${plural(unit.council.length, "seat")} approve it, each from its own wallet.`} command={unitCmd} />
          <VerifyItem n={7} title="Entries" value={<span>{plural(unit.entries, "sealed entry", "sealed entries")}, of which {unit.synthetic} synthetic</span>} proves="Synthetic entries were added by the council and are flagged synthetic on chain, so a release can always say how many of its figures are sample data." command={unitCmd} />
          <VerifyItem n={8} title="Employer domains" value={unit.dkimDomains.length ? <code className="font-mono text-[0.9375rem]">{unit.dkimDomains.join(", ")}</code> : <span className="text-muted-foreground">none listed</span>} proves="Only a payroll email signed by one of these domains can count as DKIM-verified; the engine checks the signature against the key the registrar recorded." command={unitCmd} />
        </ol>
      </Section>

      <Section title="Each release" aside="Counts, hashes and the OutLayer attestation">
        {v.releases.length === 0 ? (
          <p className="text-[1rem] text-muted-foreground">No releases yet.</p>
        ) : (
          <div className="flex flex-col gap-10">
            {[...v.releases].sort((a, b) => b.id - a.id).map((r) => (
              <article key={r.id} className="flex flex-col gap-5 border-t-2 border-ink pt-6">
                <h3 className="font-serif text-[1.5rem] leading-tight text-ink">
                  No. {String(r.id).padStart(2, "0")} · {describeQuery(asQuery(r.query))}
                </h3>
                <SyntheticNotice n={r.counts.synthetic} />
                <CountsStrip counts={r.counts} compact />
                <ReleaseProof release={r} tx={isMock() ? undefined : (r.txHash ?? undefined)} contract={C} />
              </article>
            ))}
          </div>
        )}
      </Section>
    </>
  )
}
