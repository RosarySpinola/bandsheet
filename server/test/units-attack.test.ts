import { describe, expect, it } from "vitest";
import { KeyPair } from "near-api-js";
import type { KeyStatus } from "../src/auth/keys";
import { CREATOR, REGISTRAR, setupUnits, walletSign } from "./units-helpers";

const kp = KeyPair.fromRandom("ed25519");
const OUTSIDER = "pedro-alves.testnet";
const okp = KeyPair.fromRandom("ed25519");
const keys = { [`${CREATOR}|${kp.getPublicKey().toString()}`]: "full_access" as KeyStatus, [`${OUTSIDER}|${okp.getPublicKey().toString()}`]: "full_access" as KeyStatus };

type Cell = Record<string, string>;
const cellText = (k: Cell) => [k.grade, k.gender, k.site].filter(Boolean).join(" ");

const prep = async (s: ReturnType<typeof setupUnits>, cell: Cell = { grade: "Senior" }, release = 1, who = kp, account = CREATOR, signed?: string) => {
  const nonce = await s.nonce("unit_synthetic");
  const statement = signed ?? `Bandsheet synthetic 1: attack release ${release}: ${cellText(cell)}`;
  return s.post("/units/1/attack-prep", { ...(await walletSign(who, account, statement, nonce)), release_id: release, cell });
};

const withQuery = (s: ReturnType<typeof setupUnits>) => {
  s.releases[0]!.query = { group_by: ["grade"], stat: "mean", id: 1 };
  return s;
};

describe("POST /api/units/:id/attack-prep", () => {
  it("adds exactly one synthetic colleague to the published cell and shows only that sample figure", async () => {
    const s = withQuery(setupUnits(keys));
    const r = await prep(s);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ action: "add", release_id: 1, cell: { key: { grade: "Senior" }, n: 5, mean_eur: 58_000 }, expected_n: 6 });
    expect(r.body.query).toBe('{"group_by":["grade"],"stat":"mean"}');
    const col = r.body.colleague as Record<string, unknown>;
    expect(col).toMatchObject({ grade: "Senior", synthetic: true, label: "synthetic colleague, sample figure" });
    expect(col.gross_annual_eur).toBeGreaterThanOrEqual(52_000);
    expect(col.gross_annual_eur).toBeLessThanOrEqual(63_000);
    // one registrar add (flagged synthetic) and one sealed submit
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0]).toMatchObject({ signer: REGISTRAR.accountId, calls: [{ method: "unit_add_member", args: { synthetic: true } }] });
    expect(s.submits).toHaveLength(1);
    expect(s.units.get(1)!.synthetic_added).toBe(1);
    expect((r.body.txs as unknown[]).length).toBe(2);
    // kept for the result screen
    const list = await s.get("/units/1/attacks");
    expect(list.body.attacks).toEqual([expect.objectContaining({ action: "add", release_id: 1, cell: { grade: "Senior" }, colleague: col })]);
  });

  it("puts the colleague inside the request's filter as well as the cell", async () => {
    const s = setupUnits(keys);
    s.releases[0]!.query = { group_by: ["grade"], filter: { site: "Port" }, stat: "mean" };
    const r = await prep(s);
    expect(r.status).toBe(200);
    expect(r.body.colleague).toMatchObject({ grade: "Senior", site: "Port" });
  });

  it("refuses a seat outside the council, a statement over another cell, and a cell the release did not publish", async () => {
    const s = withQuery(setupUnits(keys));
    expect((await prep(s, { grade: "Senior" }, 1, okp, OUTSIDER)).body.code).toBe("NOT_COUNCIL");
    expect((await prep(s, { grade: "Senior" }, 1, kp, CREATOR, "Bandsheet synthetic 1: attack release 1: Junior")).body.code).toBe("SIGNATURE_INVALID");
    expect((await prep(s, { grade: "Junior" })).body.code).toBe("CELL_NOT_PUBLISHED");
    expect((await prep(s, { grade: "Senior" }, 7)).body.code).toBe("RELEASE_NOT_FOUND");
    expect(s.calls).toHaveLength(0);
  });

  it("validates its input", async () => {
    const s = withQuery(setupUnits(keys));
    const n = await s.nonce("unit_synthetic");
    const claim = await walletSign(kp, CREATOR, "Bandsheet synthetic 1: attack release 1: Senior", n);
    expect((await s.post("/units/1/attack-prep", { ...claim, release_id: 1, cell: {} })).body.code).toBe("BAD_REQUEST");
    expect((await s.post("/units/1/attack-prep", { ...claim, release_id: 1, cell: { grade: "Intern" } })).body.code).toBe("BAD_REQUEST");
    expect((await s.post("/units/1/attack-prep", { ...claim, release_id: 1, cell: { grade: "Senior", salary: "1" } })).body.code).toBe("BAD_REQUEST");
  });

  it("at the synthetic cap removes a colleague the lab added to that cell, or explains why it cannot", async () => {
    const s = withQuery(setupUnits(keys));
    expect((await prep(s)).status).toBe(200);
    s.units.get(1)!.synthetic_added = 8;
    s.advance(60_000);
    const r = await prep(s);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ action: "remove", expected_n: 4 });
    const added = (await s.get("/units/1/attacks")).body.attacks as { action: string; colleague: unknown }[];
    expect(added[0]!.action).toBe("remove");
    expect(r.body.colleague).toEqual(added[1]!.colleague);
    expect(s.calls.at(-1)).toMatchObject({ calls: [{ method: "unit_remove_member" }] });
    // nothing of the lab's left in that cell
    expect((await prep(s)).body.code).toBe("ATTACK_CAP");
  });
});
