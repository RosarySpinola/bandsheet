import type { Policy } from "@/lib/chain"
import { outlayerProject } from "@/lib/chain"
import { int } from "@/lib/format"
import { Fact, Figure } from "../page-header"
import { HashValue } from "../copy-button"
import { AccountLink } from "../links"
import { Shimmer } from "../states"

/** Members, entries, k, releases as serif figures; policy and WASM hashes below. */
export function UnitCard({ policy, verified }: { policy: Policy; verified?: { n: number | null; release: number | null } }) {
  return (
    <div className="flex flex-col gap-8 bg-band p-6 md:p-10">
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3 xl:grid-cols-5">
        <Figure value={int(policy.members)} caption="members with a key" />
        <Figure value={int(policy.entries)} caption="sealed entries" />
        <Figure value={<>k = {policy.policy.k}</>} caption="smallest group ever shown" />
        <Figure value={int(policy.releases)} caption={policy.releases === 1 ? "release logged" : "releases logged"} />
        <Figure
          value={verified?.n != null ? int(verified.n) : "—"}
          caption={
            verified?.n != null
              ? `payslips verified by employer signature, release #${verified.release}`
              : "payslips verified by employer signature (from the first DKIM release)"
          }
        />
      </div>
      <dl className="grid grid-cols-1 gap-x-10 gap-y-5 border-t border-border pt-6 sm:grid-cols-2">
        <Fact label="Policy hash">
          <HashValue value={policy.policy.policy_hash} />
        </Fact>
        <Fact label="Engine WASM sha256">
          <HashValue value={policy.policy.wasm_sha256} />
        </Fact>
        <Fact label="Contract">
          <AccountLink id={policy.unit} />
        </Fact>
        <Fact label="Chapel DAO">
          <AccountLink id={policy.dao} />
        </Fact>
        <Fact label="Sealed engine (OutLayer)" className="sm:col-span-2">
          <span className="font-mono text-[0.875rem] break-all">{outlayerProject(policy)}</span>
        </Fact>
      </dl>
    </div>
  )
}

export function UnitCardSkeleton() {
  return (
    <div className="flex flex-col gap-8 bg-band p-6 md:p-10" aria-busy="true" aria-label="Loading the unit">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Shimmer className="h-11 w-24 bg-white" />
            <Shimmer className="h-4 w-32 bg-white" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 border-t border-border pt-6 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Shimmer key={i} className="h-10 bg-white" />
        ))}
      </div>
    </div>
  )
}
