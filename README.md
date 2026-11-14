# Bandsheet

**A sealed pay-band box for unions. It publishes what each grade is paid, and refuses any table
that would let someone work out one colleague's salary by subtraction.**

Built at NEAR HACKATHON (November 2026) for the **Privacy & Private AI** track.
Everything runs on **NEAR testnet** with a **synthetic** union chapel (a fictional newsroom, the Harbour Courier).
No real payslips or salaries are used anywhere.

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
| Authenticity | **DKIM** inside **OutLayer** | The entry carries the employer's DKIM-signed payroll email. The enclave verifies it against an employer key the DAO voted to trust, checks grade and pay against the signed body, and counts one payslip once. Edited, unsigned or duplicate payslips are rejected and reported by reason and count only. |
| Deciding | **OutLayer** | The release engine treats every published cell as a sum query over members. It solves the attacker's equations first (exact rank over two primes), withholds any cell that would isolate a member, and suppresses complements too. |
| Asking | **Sputnik DAO** | A release can only be requested by a passed DAO proposal (2 of 3 council seats). The same DAO trusts DKIM issuers, turns `require_dkim` on and adopts a new engine build. |
| Membership | **NEAR access keys** | Each member holds a function-call key that can only call `submit`, so submitting is gas-free. A resubmission replaces the earlier entry, so the count doesn't change. Outside accounts are refused. |
| Record | **NEAR Protocol** | Every release and every refusal is written to the contract with its witness, input/output hashes, rejection counts and OutLayer request. |

Beyond NEAR:

| Standard or source | Used for |
|---|---|
| DKIM, RFC 6376 | Payslip authenticity. Rust verifier in `enclave/dkim/`; fixtures signed by an independent Node signer and cross-checked with dkimpy (`enclave/scripts/dkim-crosscheck.py`). |
| Eurostat SES (`earn_ses_monthly`) | `/api/context`: median monthly earnings for ISCO-08 Professionals (OC2), latest year 2018 (Malta €2,189), as a dated outside reference for a band. |
| MCP | `mcp/`: six read-only tools so an AI assistant can read bands, explain a refusal and verify a release. |
| EU Directive 2023/970, Art. 7 | `/unit/stand` drafts the member's pay-information letter (Malta: Legal Notice 173 of 2026, reply within 8 days). |

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

Live preview: <https://bandsheet.pages.dev> (Cloudflare Pages with Pages Functions; D1 holds the NEAR AI spend ledger, USD 2.50 hard cap).
Step one, no keys needed:

```bash
pnpm install && pnpm verify      # 19 read-only checks: testnet, OutLayer attestations, the live site
```

Live testnet accounts (see `scripts/deployed.json`):

- Union contract: [`bandsheet-3f36b7.testnet`](https://testnet.nearblocks.io/address/bandsheet-3f36b7.testnet). Contract code hash `5414e7db7fd9d05c913e6224277a0a0f3a482ac863e6f6180fecd5adb2707f4f`.
- DAO: [`harbour-chapel.sputnik-v2.testnet`](https://testnet.nearblocks.io/address/harbour-chapel.sputnik-v2.testnet)
- OutLayer project: `bandsheet-enclave.testnet/bandsheet-enclave`. Engine WASM sha256 (a different thing from the contract hash):
  current `69d5616cacc61ce82d3b412ffaf76399f8bbfb6bbd853f604283316ce4643b26` (0.2.0+dkim, release #3);
  previous `a1dd40549adacc6183e140cc34ae7ed5c6af63eb646ab7978e4d50a371073f57` (releases #1 and #2).
  The enclave key is the same for both: hex `2a7d1b5606126e98b903777f95d1a0795a1442bff3c5371cc9bb988c2d891346`.

The run already on chain (`scripts/demo-log.json`):

1. **Release #1** by DAO vote. Five bands; Senior: 9 members, mean €62,400.
   [proposal](https://testnet.nearblocks.io/txns/Ai56ChQHWRpygEsZwS3MuzjNFfrJMdR8v7umykpvbq3D) ·
   [OutLayer run](https://testnet.nearblocks.io/txns/82YcfbFjeCp3WD7oVSuztUv8DDey6dLGLahF38DqwFsV)
2. A tenth Senior joins.
3. **Release #2** by DAO vote. **Senior withheld**: `Release #2 Senior - Release #1 Senior isolates 1 member`.
   The other four bands are published.
   [proposal](https://testnet.nearblocks.io/txns/A9ZjCsFv25cWfSENJkAetCTKDUpj9BLRTvCu4aPJ2qQH) ·
   [OutLayer run](https://testnet.nearblocks.io/txns/BVySfrKeJzF2jQegQptQXeMogS4XffYZMsLp1GgRBr88)
4. A fake entry from an outside account is refused:
   [tx](https://testnet.nearblocks.io/txns/7eo7pKcCMJLtCy9fX3NT6gGkZAmkRwfK6mYut4ZGHPfb).
   A resubmission replaces the earlier entry, and the count is unchanged:
   [tx](https://testnet.nearblocks.io/txns/2MMxbfTBbcoMENVHHMxeGaYH6SjLXuVWXTm4Xb5sGWEm).
5. **DKIM goes on, by DAO vote.** Proposal #2 trusts the employer's DKIM key (`harbourcourier.example`, selector
   `payroll2026`; [tx](https://testnet.nearblocks.io/txns/4G8BgLruHneA2oYCAqw1BEcojFkkLS2ibvF85gdpHrpU)).
   Proposals #3 and #4 turn on `require_dkim` ([tx](https://testnet.nearblocks.io/txns/6NXPSmu9hwySkoLD6T7QR87uyA9YifDGaginXEUBA4vx)).
   Proposal #5 adopts the new engine ([tx](https://testnet.nearblocks.io/txns/GzBmmztWUZmpBoQqBitHWNeWPZLXNhmNgdQpgjGRDmEf)).
   The 37 members then resubmit with their signed payslip email (37 txs, `dkim_resubmit` in the demo log).
6. **A forged payslip is submitted.** The contract cannot read the ciphertext, so it
   [accepts the transaction](https://testnet.nearblocks.io/txns/6XbEAZSFQ9AfXT2CefXcJV4Err8xnxVFwSfa2b2a4UkH);
   the enclave refuses to count it.
7. **Release #3** by DAO vote (proposal #6): `partially_released`, **37 of 38 entries verified**, rejected
   `dkim_bad_signature: 1`. That is Ingrid Halvorsen's payslip HC-2977, with €4,908.33 edited to €6,908.33 after signing.
   Junior 8 members €30,713; Reporter 11 €43,000; Editor 5 €81,780; Chief 3 €109,333. Senior is withheld again
   (`Release #3 Senior - Release #1 Senior isolates 1 member`).
   [proposal](https://testnet.nearblocks.io/txns/5B9mURqeoFM9BkkMcrN2t27qaS8u9V4s3fmLzs7KEGCv) ·
   [OutLayer run](https://testnet.nearblocks.io/txns/CqPS4C69oPj6BgaTxfW5ZAgJ9Zs8zuStD8DABJASCSH5)

Check a release yourself (release #3 shown):

```bash
near view bandsheet-3f36b7.testnet get_releases '{"from":0,"limit":10}' --networkId testnet
curl https://testnet-api.outlayer.ai/attestations/by-tx/CqPS4C69oPj6BgaTxfW5ZAgJ9Zs8zuStD8DABJASCSH5
```

The attestation names the engine, input and output hashes that the contract recorded; `pnpm verify` compares them.

## Run it locally

Requirements: Node 22+, pnpm, Rust (wasm32-wasip2 target) for the enclave, cargo-near for the contract.

```bash
pnpm install
cp .env.example .env.local        # NEARAI_API_KEY, BANDSHEET_CONTRACT, PORT=8788
pnpm --filter server dev          # API on :8788
pnpm --filter web dev             # app on :4173 (proxies /api to :8788)
pnpm test                         # core + server tests (vitest)
cd enclave && make test           # audit, hero case, DKIM release, cross-language crypto vectors
cd contracts/bandsheet && ./build.sh && cargo test
```

Do this, see that (routes: `/`, `/pricing`, `/unit`, `/unit/join`, `/unit/submit`, `/unit/releases`, `/unit/attack`,
`/unit/vote`, `/unit/stand`, `/unit/verify`, `/unit/how`, `/unit/help`):

- Open `/unit/attack`. Pick Release #1 and #2, cell Senior. The typical tool shows **€70,000**;
  Bandsheet shows the real on-chain refusal and its witness. Then **Try to cheat**: the forged payslip
  (HC-2977) and the outsider key, each refused with the recorded reason.
- Open `/unit/releases`. Every release and refusal with tx and OutLayer attestation links. Release #3 shows
  37 verified, 1 rejected (`dkim_bad_signature`), Senior withheld.
- Open `/unit/submit`. Use the demo member and a sample payslip (a PDF, image, or the signed `.eml`). The Verified panel lists each
  attestation check, then the sealed entry is sent gas-free (tx link).
- Open `/unit/stand` to compare a pay figure with the published band and draft the Article 7 letter.
- Open `/unit/verify`. The policy, the engine build hash and the enclave key, with commands to check each.
- Add the MCP server to Claude Desktop or Claude Code (`mcp/README.md`) and ask "Verify release 3".

## Repository

| Path | What |
|---|---|
| `enclave/` | Rust: `audit/` (pure release audit), `dkim/` (DKIM verifier, payslip parser), `module/` (OutLayer WASM), evaluation, proofs |
| `contracts/bandsheet/` | NEAR contract: members, submit, DAO-gated release and engine, DAO-trusted DKIM issuers and `require_dkim`, input-sized OutLayer deposit, ledger |
| `packages/core/` | Shared TS: schemas, entry crypto, seed data, naive baseline, NEAR helpers |
| `server/` | Hono API: NEAR AI Cloud client with attestation and signature verification, `.eml` extraction, `/api/context` (Eurostat), Article 7 letter, USD 2.50 spend cap, DAO and demo routes |
| `web/` | React app: landing page and the demo unit |
| `mcp/` | MCP server, six tools: `get_bands`, `list_releases`, `explain_refusal`, `verify_release`, `try_subtraction`, `pay_context` |
| `tools/verify/` | `pnpm verify`: 19 read-only checks of chain, attestations and the live site |
| `fixtures/dkim/` | Fictional employer `harbourcourier.example`, signed payslip emails and negatives; keys generated by us |
| `scripts/` | Testnet setup, member keys, DAO proposals, the seeded demo (`demo-log.json` lists every tx) |
| `deploy/` | Cloudflare Pages deploy (`DEPLOY.md`) |
| [`JUDGES.md`](JUDGES.md) | The 90-second path, the 5-minute path, track fit |
| [`THREAT_MODEL.md`](THREAT_MODEL.md) | Assets, actors, attacks, residual risks |

## Honest limits

- Testnet only, with synthetic data.
- DKIM uses our own fictional employer and keys we generated; no real employer is involved. Keys come from the DAO
  policy, not DNS. The DKIM `x=` expiry is not enforced and `l=` signatures are rejected. DKIM proves the email came
  from the key holder, not that payroll was right.
- The committee is still the trusted registrar of member keys; a malicious majority could register fake members.
- The audit is exact for k ≤ 3 (the default). For larger k it still catches any single member
  being solved, but not every small group.
- Means are integer-rounded EUR and treated as exact. Statistical inference from many overlapping releases is out of scope.
- NVIDIA GPU attestation tokens are decoded and checked for the nonce; their signatures are not verified against NVIDIA's JWKS.
- OutLayer's TDX quote is captured and its attestation record is checked by `pnpm verify`, but the quote is not verified
  against Intel collateral, and the contract stores hashes rather than verifying the quote on chain.
- All code in this repository was written during the hackathon window (from 1 Nov 2026).

## License

MIT
