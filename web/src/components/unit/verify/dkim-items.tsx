import { useEffect } from "react"
import { useLocation } from "react-router"
import { CONTRACT, explorer, txHashOf, useDemoLog } from "@/lib/chain"
import { useFingerprint, useIssuers, useRequireDkim, type Issuer } from "@/lib/dkim"
import { HashValue } from "../copy-button"
import { Shimmer } from "../states"
import { VerifyItem } from "./verify-item"

const lastTx = (links: string[] | undefined) => (links?.length ? txHashOf(links[links.length - 1]!) : undefined)

/** Verify items for the employer-signature layer: the trusted issuers and the require_dkim flag. */
export function DkimItems({ start }: { start: number }) {
  const issuers = useIssuers()
  const required = useRequireDkim()
  const log = useDemoLog().data
  const trustTx = lastTx(log?.dao_trust_issuer)
  const requireTx = lastTx(log?.dao_require_dkim)
  const { hash } = useLocation()
  useEffect(() => {
    if (hash === "#trusted-employers" && issuers.isSuccess) document.getElementById("trusted-employers")?.scrollIntoView({ block: "start" })
  }, [hash, issuers.isSuccess])

  return (
    <>
          <VerifyItem
            id="trusted-employers"
            n={start}
            title="Trusted employers"
            value={
              issuers.isPending ? (
                <Shimmer className="h-16" />
              ) : issuers.isError ? (
                <span className="text-muted-foreground">The issuer list could not be read just now.</span>
              ) : issuers.data.length === 0 ? (
                <span className="text-muted-foreground">No employer key is trusted yet.</span>
              ) : (
                <ul className="flex flex-col gap-4">
                  {issuers.data.map((i) => (
                    <IssuerRow key={`${i.domain}/${i.selector}`} issuer={i} />
                  ))}
                </ul>
              )
            }
            proves="The employer keys whose DKIM signatures the engine accepts. Only the chapel's DAO can add one, by vote. A payslip signed by any other key, or edited after signing, is refused inside the enclave and never counted."
            command={`near view ${CONTRACT} get_issuers '{}' --networkId testnet\n# fingerprint: echo '<rsa_pubkey_spki_b64>' | base64 -d | shasum -a 256`}
            links={[
              { href: "/unit/vote#p2", label: "Proposal #2 on the chapel vote", internal: true },
              ...(trustTx ? [{ href: explorer.tx(trustTx), label: "DAO vote that trusted this key" }] : []),
            ]}
          />
      <VerifyItem
        n={start + 1}
        title="Signed payslips required"
        value={
          required.isPending ? (
            <Shimmer className="h-6 w-24" />
          ) : (
            <span className="font-semibold">{required.data ? "Yes: require_dkim = true" : "No: require_dkim = false"}</span>
          )
        }
        proves="When on, the engine counts an entry only if it carries an employer-signed payslip email whose figures match the entry. Old releases replay unchanged; the flag applies from the next release."
        command={`near view ${CONTRACT} get_require_dkim '{}' --networkId testnet`}
        links={requireTx ? [{ href: explorer.tx(requireTx), label: "DAO vote that required signatures" }] : []}
      />
    </>
  )
}

function IssuerRow({ issuer }: { issuer: Issuer }) {
  const fp = useFingerprint(issuer.rsa_pubkey_spki_b64)
  return (
    <li className="flex flex-col gap-1 border-l-2 border-ink pl-4">
      <span className="text-[1rem] font-semibold break-all text-ink">{issuer.domain}</span>
      <span className="text-[0.875rem] text-muted-foreground">selector {issuer.selector} · RSA key, sha256 fingerprint</span>
      {fp.data ? <HashValue value={fp.data} head={16} tail={6} /> : <Shimmer className="h-6 w-48" />}
    </li>
  )
}
