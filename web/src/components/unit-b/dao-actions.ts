import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ApiError, api, postJson } from "@/lib/api"
import { ProposeResponse, VoteResponse, type DaoProposal, type ProposeResult, type VoteResult } from "./data"
import { daoError, describeQuery } from "./format"

export type ProposeInput = { group_by: ("grade" | "gender" | "site")[]; filter?: Record<string, string> }
export type VoteInput = { proposal_id: number; member: 1 | 2 | 3; action: "approve" | "reject" }

const KEY = ["dao", "release-proposals"]
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fakeHash = () => `MOCK${Math.random().toString(36).slice(2, 12).toUpperCase()}`

/** Mock flavours for QA: "1" succeeds, "gas" and "rate" fail like the server would. */
function mockFailure(mock: string): unknown {
  if (mock === "gas") return daoError(new ApiError("low balance", "LOW_GAS_BALANCE", 503))
  if (mock === "rate") return daoError(new ApiError("rate limited", "RATE_LIMITED", 429))
  return null
}

/**
 * Propose and vote. In mock mode (?mock=1) nothing leaves the browser: the call waits like a
 * testnet tx would, then the cached proposal list is updated locally. Live mode posts to the server.
 */
export function useDaoActions({ mock, council }: { mock: string | null; council: string[] }) {
  const qc = useQueryClient()

  const propose = useMutation({
    mutationFn: async (input: ProposeInput): Promise<ProposeResult> => {
      if (!mock) {
        try {
          return await api("/dao/propose", ProposeResponse, postJson(input))
        } catch (e) {
          throw daoError(e)
        }
      }
      await sleep(3500)
      const fail = mockFailure(mock)
      if (fail) throw fail
      const list = qc.getQueryData<DaoProposal[]>(KEY) ?? []
      const id = Math.max(-1, ...list.map((p) => p.id)) + 1
      const description = describeQuery(input).replace(/^Mean/, "Release mean")
      const p: DaoProposal = { id, description, proposer: council[0] ?? "council seat 1", status: "InProgress", query: input, votes: {}, submission_time: new Date().toISOString() }
      qc.setQueryData<DaoProposal[]>(KEY, [p, ...list])
      return { proposal_id: id, description, proposer: p.proposer, tx: { hash: fakeHash(), url: "" } }
    },
    onSuccess: () => {
      if (!mock) void qc.invalidateQueries({ queryKey: KEY })
    },
  })

  const vote = useMutation({
    mutationFn: async (input: VoteInput): Promise<VoteResult> => {
      if (!mock) {
        try {
          return await api("/dao/vote", VoteResponse, postJson(input))
        } catch (e) {
          throw daoError(e)
        }
      }
      await sleep(4500)
      const fail = mockFailure(mock)
      if (fail) throw fail
      const voter = council[input.member - 1] ?? `seat ${input.member}`
      const list = qc.getQueryData<DaoProposal[]>(KEY) ?? []
      let status = "InProgress"
      qc.setQueryData<DaoProposal[]>(
        KEY,
        list.map((p) => {
          if (p.id !== input.proposal_id) return p
          const votes = { ...p.votes, [voter]: input.action === "approve" ? "Approve" : "Reject" }
          const yes = Object.values(votes).filter((v) => v === "Approve").length
          const no = Object.values(votes).filter((v) => v === "Reject").length
          status = yes >= 2 ? "Approved" : no >= 2 ? "Rejected" : "InProgress"
          return { ...p, votes, status }
        }),
      )
      return { proposal_id: input.proposal_id, voter, action: input.action, status, tx: { hash: fakeHash(), url: "" } }
    },
    onSuccess: () => {
      if (!mock) void qc.invalidateQueries({ queryKey: KEY })
    },
  })

  return { propose, vote }
}
