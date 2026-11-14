import { CONTRACT, DAO, explorer, outlayerProject, txHashOf, useDemoLog, useDeployed, usePolicy, useReleases } from "@/lib/chain"
import { hexToBase58 } from "@/lib/format"
import { Page } from "@/components/unit/page"
import { PageHeader, Section } from "@/components/unit/page-header"
import { HashValue } from "@/components/unit/copy-button"
import { AccountLink } from "@/components/unit/links"
import { ErrorState, Shimmer } from "@/components/unit/states"
import { VerifyItem, type Check } from "@/components/unit/verify/verify-item"
import { ReleaseAttestation } from "@/components/unit/verify/release-attestations"
import { releaseTxs, useCodeHash } from "@/components/unit/verify/data"

const VIEW = `near view ${CONTRACT} get_policy '{}' --networkId testnet`

export default function Verify() {
  const policy = usePolicy()
  const deployed = useDeployed()
  const log = useDemoLog()
  const releases = useReleases()
  const code = useCodeHash()

  const p = policy.data
  const project = outlayerProject(p)
  const contractSha = deployed.data?.wasm_sha256
  const codeCheck: Check | undefined = !contractSha
    ? undefined
    : code.isPending
      ? { state: "pending", text: "Reading the deployed code hash from testnet…" }
      : code.isError
        ? { state: "error", text: "Could not read the deployed code hash just now." }
        : code.data === hexToBase58(contractSha)
          ? { state: "match", text: <>Matches the code deployed at {CONTRACT} right now ({code.data.slice(0, 10)}… in base58)</> }
          : { state: "mismatch", text: <>The deployed code ({code.data.slice(0, 10)}…) differs from this build.</> }
  const runs = releaseTxs(log.data)

  return (
    <Page>
      <PageHeader
        glyph="verify"
        eyebrow="Trust nothing on this page"
        title="Verify it yourself"
        lede="Every claim Bandsheet makes rests on a value you can read from NEAR testnet or OutLayer directly. Here is each one, what it proves, and how to check it without us."
      />

      {policy.isError && <ErrorState error={policy.error} onRetry={() => policy.refetch()} />}

      <Section title="The policy" aside="Read live from the contract">
        {policy.isPending ? (
          <div className="flex flex-col gap-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <Shimmer key={i} className="h-28" />
            ))}
          </div>
        ) : p ? (
          <ol className="flex flex-col">
            <VerifyItem
              n={1}
              title={`k = ${p.policy.k}`}
              value={<span className="text-muted-foreground">The smallest group size the engine will publish.</span>}
              proves={`No published average covers fewer than ${p.policy.k} people. Bands that would, alone or by subtracting an earlier release, are withheld and the refusal is logged.`}
              command={VIEW}
            />
            <VerifyItem
              n={2}
              title="Enclave public key (X25519)"
              value={<HashValue value={p.policy.enclave_pubkey} head={14} tail={6} />}
              proves="Every entry is sealed to this key in the member's browser. Its private half exists only as an OutLayer secret inside the engine's TEE, so neither the chapel nor this server can read a figure."
              command={VIEW}
            />
            <VerifyItem
              n={3}
              title="Engine WASM sha256"
              value={<HashValue value={p.policy.wasm_sha256} head={12} tail={6} />}
              proves="The exact build of the release engine the contract will accept. OutLayer attests the hash of the WASM it actually ran for each release; the checks below compare the two."
              command="./enclave/build.sh   # rebuilds and prints the sha256"
            />
            <VerifyItem
              n={4}
              title="Contract WASM sha256"
              value={contractSha ? <HashValue value={contractSha} head={12} tail={6} /> : "—"}
              proves="The code running at the unit account: member keys that may only call submit, the DAO gate on releases, and the on-chain release log."
              check={codeCheck}
              command={`near state ${CONTRACT} --networkId testnet   # code_hash is base58(sha256)`}
            />
            <VerifyItem
              n={5}
              title="Contract"
              value={<AccountLink id={p.unit} />}
              proves="Holds the sealed entries, the member list and every release or refusal. Its policy can change only through the owner, and a change resets entries."
              links={[
                ...(deployed.data?.unit_deploy_tx ? [{ href: explorer.tx(deployed.data.unit_deploy_tx), label: "Deploy transaction" }] : []),
                ...(deployed.data?.unit_upgrade_tx ? [{ href: explorer.tx(deployed.data.unit_upgrade_tx), label: "Upgrade transaction" }] : []),
              ]}
            />
            <VerifyItem
              n={6}
              title="Chapel DAO"
              value={<AccountLink id={p.dao || DAO} />}
              proves={`A release runs only after a Sputnik DAO proposal passes. ${deployed.data?.council.length ? `The council has ${deployed.data.council.length} synthetic members.` : ""}`}
              command={`near view ${p.dao || DAO} get_proposals '{"from_index":0,"limit":10}' --networkId testnet`}
              links={deployed.data?.dao_create_tx ? [{ href: explorer.tx(deployed.data.dao_create_tx), label: "DAO creation transaction" }] : []}
            />
            <VerifyItem
              n={7}
              title="OutLayer project"
              value={<code className="font-mono text-[0.9375rem] break-all">{project}</code>}
              proves="The sealed engine is an OutLayer project. Each run executes in a TEE and OutLayer publishes an attestation naming the WASM, input and output hashes."
              links={[{ href: explorer.account(project.split("/")[0] ?? project), label: "Project account" }]}
            />
            <VerifyItem
              n={8}
              title="Policy hash"
              value={<HashValue value={p.policy.policy_hash} head={12} tail={6} />}
              proves="A digest of the whole policy. Every release is bound to it, so a release can never be reread under a different k or key."
              command={VIEW}
            />
          </ol>
        ) : null}
      </Section>

      <Section title="Each release, attested" aside="Fetched live from OutLayer">
        {log.isPending ? (
          <Shimmer className="h-48" />
        ) : runs.length === 0 ? (
          <p className="text-[1rem] text-muted-foreground">No release runs are recorded in this demo log yet.</p>
        ) : (
          <div className="flex flex-col gap-10">
            {runs.map((r) => (
              <ReleaseAttestation
                key={r.id}
                id={r.id}
                exec={txHashOf(r.exec!)}
                txs={r.txs}
                release={releases.data?.releases.find((x) => x.id === r.id)}
                policy={p}
                project={project}
              />
            ))}
          </div>
        )}
      </Section>
    </Page>
  )
}
