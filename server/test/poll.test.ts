import { describe, expect, it } from "vitest";
import { decodeProposal } from "../src/chain/dao";

describe("decodeProposal: chapel business that is not a contract call", () => {
  const unit = "bandsheet-3f36b7.testnet";
  it("a Sputnik Vote proposal is a poll, summarised by its description", () => {
    expect(decodeProposal("Vote", unit, "Chapel poll: publish Release #4 after the November payroll closes")).toEqual({
      kind: "poll", summary: "Chapel poll: publish Release #4 after the November payroll closes", query: null,
    });
  });
  it("council seat changes are listed as council proposals", () => {
    expect(decodeProposal({ AddMemberToRole: { member_id: "rosary-qa.testnet", role: "council" } }, unit)?.summary).toBe("Give rosary-qa.testnet a council seat");
    expect(decodeProposal({ RemoveMemberFromRole: { member_id: "bs-c3-3f36b7.testnet", role: "council" } }, unit)?.kind).toBe("council");
  });
  it("transfers and calls to other contracts stay out of the chapel's list", () => {
    expect(decodeProposal({ Transfer: { receiver_id: "x.testnet", amount: "1" } }, unit)).toBeUndefined();
  });
});
