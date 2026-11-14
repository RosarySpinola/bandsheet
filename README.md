# Bandsheet

**A sealed pay-band box for unions. It publishes what each grade is paid, and refuses any table
that would let someone work out one colleague's salary by subtraction.**

Built at NEAR HACKATHON (November 2026) for the **Privacy & Private AI** track.
Everything runs on **NEAR testnet** with a **synthetic** union chapel (36 members of a fictional
newsroom, the Harbour Courier). No real payslips or salaries are used anywhere.

## The problem

A union chapel asks for average pay by grade. An honest tool publishes it with a "fewer than 3
people, hide it" rule. A month later one person joins and the chapel asks again. Both tables pass
the n ≥ 3 rule, and:

```
10 × €63,160  −  9 × €62,400  =  €70,000   ← the new Senior's exact salary
```

Small-cell thresholds don't remember earlier releases. Under the EU Pay Transparency Directive
(2023/970, Article 7), workers now have a right to this kind of pay information, so these tables
are about to be requested everywhere.

## What Bandsheet does

| Layer | Sponsor tech | What it actually does |
|---|---|---|
| Reading | **NEAR AI Cloud** | A member's payslip is read by a NEAR-hosted vision model inside a TEE. Before sending, the server verifies a fresh-nonce attestation (Intel TDX quote via DCAP, signer and nonce binding, RTMR3 event-log replay; NVIDIA GPU evidence is decoded and checked for the nonce). Afterwards it verifies the signed response. Nothing is stored. |
| Sealing | **OutLayer** (Intel TDX) | The member's browser encrypts the confirmed entry (X25519 + HKDF-SHA256 + ChaCha20-Poly1305) to a key that was generated inside the enclave and is locked to one engine build. |
| Deciding | **OutLayer** | The release engine treats every published cell as a sum query over members. It solves the attacker's equations first (exact rank over two primes), withholds any cell that would isolate a member, and suppresses complements too. |
| Asking | **Sputnik DAO** | A release can only be requested by a passed DAO proposal (2 of 3 council seats). |
| Membership | **NEAR access keys** | Each member holds a function-call key that can only call `submit`, so submitting is gas-free. A resubmission replaces the earlier entry, so the count doesn't change. Outside accounts are refused. |
| Record | **NEAR Protocol** | Every release and every refusal is written to the contract with its witness, input/output hashes and OutLayer request. |

## Measured result

`enclave/evaluation/results.json`, run from 100 generated join, leave and overlap attack cases
(deterministic seeds 0–99, k = 3). An independent exact attacker (rational Gaussian elimination,
sharing no code with the auditor) tries to recover salaries:

| | Cases leaking | Exact salaries recovered | Cells published |
|---|---|---|---|
| Typical n ≥ 3 tool | **95 / 100** | 187 members | 1,265 |
| Bandsheet | **0 / 100** | 0 | 931 |

Reproduce: `cd enclave && make evaluate`.

## Try it (judges)

Live testnet accounts (see `scripts/deployed.json`):

- Union contract: [`bandsheet-3f36b7.testnet`](https://testnet.nearblocks.io/address/bandsheet-3f36b7.testnet)
- DAO: [`harbour-chapel.sputnik-v2.testnet`](https://testnet.nearblocks.io/address/harbour-chapel.sputnik-v2.testnet)
- OutLayer project: `bandsheet-enclave.testnet/bandsheet-enclave`, engine WASM sha256 `a1dd40549adacc6183e140cc34ae7ed5c6af63eb646ab7978e4d50a371073f57`

The hero run already on chain (`scripts/demo-log.json`):

1. **Release #1** by DAO vote. Senior: 9 members, mean €62,400.
   [proposal](https://testnet.nearblocks.io/txns/Ai56ChQHWRpygEsZwS3MuzjNFfrJMdR8v7umykpvbq3D) ·
   [OutLayer run](https://testnet.nearblocks.io/txns/82YcfbFjeCp3WD7oVSuztUv8DDey6dLGLahF38DqwFsV)
2. A tenth Senior joins.
3. **Release #2** by DAO vote. **Senior withheld**: `Release #2 Senior - Release #1 Senior isolates 1 member`.
   The other bands are published.
   [proposal](https://testnet.nearblocks.io/txns/A9ZjCsFv25cWfSENJkAetCTKDUpj9BLRTvCu4aPJ2qQH) ·
   [OutLayer run](https://testnet.nearblocks.io/txns/BVySfrKeJzF2jQegQptQXeMogS4XffYZMsLp1GgRBr88)
4. A fake entry from an outside account is refused:
   [tx](https://testnet.nearblocks.io/txns/7eo7pKcCMJLtCy9fX3NT6gGkZAmkRwfK6mYut4ZGHPfb).
   A resubmission replaces the earlier entry, and the count is unchanged:
   [tx](https://testnet.nearblocks.io/txns/2MMxbfTBbcoMENVHHMxeGaYH6SjLXuVWXTm4Xb5sGWEm).

Check a release yourself:

```bash
near view bandsheet-3f36b7.testnet get_releases '{"from":0,"limit":10}' --networkId testnet
curl https://testnet-api.outlayer.ai/attestations/by-tx/BVySfrKeJzF2jQegQptQXeMogS4XffYZMsLp1GgRBr88
```

## Run it locally

Requirements: Node 22+, pnpm, Rust (wasm32-wasip2 target) for the enclave, cargo-near for the contract.

```bash
pnpm install
cp .env.example .env.local        # NEARAI_API_KEY, BANDSHEET_CONTRACT, PORT=8788
pnpm --filter server dev          # API on :8788
pnpm --filter web dev             # app on :4173 (proxies /api to :8788)
pnpm test                         # core + server tests (vitest)
cd enclave && make test           # audit, hero case, cross-language crypto vectors
cd contracts/bandsheet && ./build.sh && cargo test
```

Do this, see that:

- Open `/unit/attack`. Pick Release #1 and #2, cell Senior. The typical tool shows **€70,000**;
  Bandsheet shows the real on-chain refusal and its witness.
- Open `/unit/submit`. Use the demo member and a sample payslip. The Verified panel lists each
  attestation check, then the sealed entry is sent gas-free (tx link).
- Open `/unit/releases`. Every release and refusal, with tx and OutLayer attestation links.
- Open `/unit/verify`. The policy, the engine build hash and the enclave key, with commands to check each.

## Repository

| Path | What |
|---|---|
| `enclave/` | Rust: `audit/` (pure release audit), `module/` (OutLayer WASM), evaluation, proofs |
| `contracts/bandsheet/` | NEAR contract: members, submit, DAO-gated release, OutLayer call, ledger |
| `packages/core/` | Shared TS: schemas, entry crypto, seed data, naive baseline, NEAR helpers |
| `server/` | Hono API: NEAR AI Cloud client with attestation and signature verification, USD 2.50 spend cap, DAO and demo routes |
| `web/` | React app: landing page and the demo unit |
| `scripts/` | Testnet setup, member keys, DAO proposals, the seeded demo |

## Honest limits

- Testnet only, with synthetic data. The committee is a trusted registrar of member keys.
- The audit is exact for k ≤ 3 (the default). For larger k it still catches any single member
  being solved, but not every small group.
- Means are integer-rounded EUR and treated as exact.
- NVIDIA GPU attestation tokens are decoded and checked, but their signatures are not yet verified against NVIDIA's JWKS.
- OutLayer's TDX quote is captured and linked; the contract stores the input/output hashes rather
  than verifying the quote on chain.
- All code in this repository was written during the hackathon window (from 1 Nov 2026).

## License

MIT
