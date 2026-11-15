import { describe, expect, it } from "vitest";
import { GRANT } from "../src/routes/sponsor";
import { SPONSOR, setupUnits } from "./units-helpers";

const BROKE = "lucia-santos.testnet";
const IMPLICIT = "ab".repeat(32);

describe("POST /api/sponsor", () => {
  it("funds a wallet under 0.02 NEAR once with 0.05 NEAR from the sponsor account", async () => {
    const s = setupUnits({}, { balances: { [BROKE]: 10n ** 21n } });
    const r = await s.post("/sponsor", { account_id: BROKE });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ funded: true, balance: 0.051, amount: 0.05 });
    expect((r.body.tx as { url: string }).url).toContain("nearblocks.io/txns/");
    expect(s.transfers).toEqual([{ to: BROKE, yocto: GRANT }]);
    s.balances.set(BROKE, 10n ** 21n); // spent it all again
    const again = await s.post("/sponsor", { account_id: BROKE });
    expect(again.body).toMatchObject({ funded: false });
    expect(String(again.body.reason)).toMatch(/already sponsored/);
    expect(s.transfers).toHaveLength(1);
  });

  it("does not fund an account that already holds 0.02 NEAR or more", async () => {
    const s = setupUnits({}, { balances: { [BROKE]: 3n * 10n ** 22n } });
    const r = await s.post("/sponsor", { account_id: BROKE });
    expect(r.body).toMatchObject({ funded: false, balance: 0.03 });
    expect(s.transfers).toHaveLength(0);
  });

  it("refuses mainnet and malformed ids, and a named account that does not exist", async () => {
    const s = setupUnits();
    for (const id of ["alice.near", "x.mainnet", "Bob.testnet", "a..testnet", ""]) {
      const r = await s.post("/sponsor", { account_id: id });
      expect(r.status, id).toBe(400);
    }
    expect((await s.post("/sponsor", { account_id: "nobody-here.testnet" })).body.code).toBe("UNKNOWN_ACCOUNT");
    expect(s.transfers).toHaveLength(0);
  });

  it("funds an unfunded implicit account (the transfer creates it)", async () => {
    const s = setupUnits();
    const r = await s.post("/sponsor", { account_id: IMPLICIT });
    expect(r.body.funded).toBe(true);
  });

  it("caps grants per IP per day", async () => {
    const s = setupUnits({}, { balances: Object.fromEntries([1, 2, 3, 4].map((i) => [`broke-${i}.testnet`, 0n])) });
    for (const i of [1, 2, 3]) expect((await s.post("/sponsor", { account_id: `broke-${i}.testnet` }, "10.9.9.9")).body.funded).toBe(true);
    expect((await s.post("/sponsor", { account_id: "broke-4.testnet" }, "10.9.9.9")).body.code).toBe("SPONSOR_IP_LIMIT");
    s.advance(86_400_001);
    expect((await s.post("/sponsor", { account_id: "broke-4.testnet" }, "10.9.9.9")).body.funded).toBe(true);
  });

  it("stops when the sponsor runs low, and answers 503 without a sponsor key", async () => {
    const s = setupUnits({}, { balances: { [SPONSOR.accountId]: 10n ** 23n, [BROKE]: 0n } });
    expect((await s.post("/sponsor", { account_id: BROKE })).body.code).toBe("SPONSOR_EMPTY");
    const s2 = setupUnits({}, { sponsor: false, balances: { [BROKE]: 0n } });
    expect((await s2.post("/sponsor", { account_id: BROKE })).body.code).toBe("SPONSOR_NOT_CONFIGURED");
  });
});
