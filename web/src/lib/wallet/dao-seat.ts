import type { NearWalletBase } from "@hot-labs/near-connect"
import { z } from "zod"
import { ApiError } from "@/lib/api"
import { DAO, view } from "@/lib/chain"

/** Sputnik v2 reads and the one write a council seat makes from its own wallet: act_proposal. */

const Role = z.object({ name: z.string(), kind: z.union([z.object({ Group: z.array(z.string()) }), z.unknown()]) }).passthrough()
const Policy = z.object({ roles: z.array(Role) }).passthrough()
const Proposal = z
  .object({ id: z.number(), status: z.string(), kind: z.unknown(), votes: z.record(z.string(), z.string()).optional() })
  .passthrough()
export type ChainProposal = z.infer<typeof Proposal>

/** Accounts in the DAO's "council" role, read from get_policy (never assumed). */
export async function councilMembers(): Promise<string[]> {
  const p = Policy.parse(await view(DAO, "get_policy"))
  const council = p.roles.find((r) => r.name === "council")
  const kind = council?.kind as { Group?: string[] } | undefined
  return kind?.Group ?? []
}

export async function readProposal(id: number): Promise<ChainProposal> {
  return Proposal.parse(await view(DAO, "get_proposal", { id }))
}

const VOTE_GAS = "270000000000000"

/**
 * Sign act_proposal with the connected wallet, then read the proposal back from the chain. The DAO's own policy
 * decides whether the vote counts; nothing here can change the council or the 2-of-3 threshold.
 */
export async function voteFromWallet(
  wallet: NearWalletBase,
  accountId: string,
  id: number,
  action: "VoteApprove" | "VoteReject",
): Promise<{ txHash: string | null; status: string; votes: Record<string, string> }> {
  const before = await readProposal(id)
  if (before.status !== "InProgress") throw new ApiError(`Proposal #${id} is already ${before.status}.`, "PROPOSAL_CLOSED")
  if (before.votes?.[accountId]) throw new ApiError("This seat has already voted on this proposal.", "ALREADY_VOTED")
  const out = await wallet.signAndSendTransaction({
    network: "testnet",
    signerId: accountId,
    receiverId: DAO,
    actions: [{ type: "FunctionCall", params: { methodName: "act_proposal", args: { id, action, proposal: before.kind as object }, gas: VOTE_GAS, deposit: "0" } }],
  })
  const failure = JSON.stringify((out as { status?: unknown } | undefined)?.status ?? {}).match(/"Failure"/)
  const txHash = (out as { transaction?: { hash?: string } } | undefined)?.transaction?.hash ?? null
  if (failure) throw new ApiError("The DAO refused the vote.", "CHAIN_REJECTED")
  const after = await readProposal(id)
  return { txHash, status: after.status, votes: after.votes ?? {} }
}
