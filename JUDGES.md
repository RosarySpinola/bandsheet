# Judges guide

Bandsheet publishes pay bands for a union and refuses any table that would let someone work out one
colleague's salary by subtraction. Everything is NEAR **testnet** and **synthetic** (a fictional newsroom).

## 0. One command, no keys (about 6 seconds)

```bash
pnpm install && pnpm verify          # add --json for machine output, --offline to skip the network
```

It is read-only and prints PASS or FAIL lines (exit code 1 on any FAIL). It checks that the deployed
contract's code hash equals `scripts/deployed.json` and the local build, that the on-chain policy has k = 3
and the engine hash and enclave key documented in `enclave/README.md`, that every on-chain release is bound to
an OutLayer attestation of that exact engine build (engine, input and output hashes), that the differencing
attack (`10 x 63,160 - 9 x 62,400 = 70,000`) works on a typical tool and was refused on chain, the offline
evaluation (95/100 vs 0/100), and that the live API reports the same contract.
`pnpm verify --full` also re-runs `make -C enclave evaluate` (needs Rust).

## 1. The 90-second path (live: https://bandsheet.pages.dev)

| Step | Open | Do | You should see |
|---|---|---|---|
| 1 | `/unit/attack` | Pick Release #1 and #2, cell Senior | The typical tool shows **EUR 70,000** (a real salary). Bandsheet shows a real on-chain refusal with the witness `Release #2 Senior - Release #1 Senior isolates 1 member`. |
| 2 | `/unit/releases` | Read both rows | Release #1 released 5 bands; Release #2 `partially_released`, Senior withheld, the rest published. Each row links to its transaction and OutLayer attestation. |
| 3 | `/unit/verify` | Read the panel | Policy k = 3, engine build hash, enclave public key, and a command to check each. |
| 4 | `/unit/submit` | Use the demo member and a sample payslip | A Verified panel lists each NEAR AI Cloud attestation check, then the sealed entry is sent gas-free; a tx link appears. |

## 2. The 5-minute local path

```bash
pnpm install
pnpm verify                                   # live chain checks (section 0)
pnpm test                                     # core + server tests (vitest)
pnpm --filter web build                       # web typecheck + build
make -C enclave test                          # Rust: hero case, 100 adversarial cases, TS<->Rust crypto vectors
make -C enclave evaluate                      # regenerates enclave/evaluation/results.json (95/100 vs 0/100)
cd contracts/bandsheet && RUSTFLAGS="--cfg near" cargo +1.86.0 test --locked -p bandsheet   # contract unit tests
```

Optional app: `cp .env.example .env.local` (needs your own `NEARAI_API_KEY`), `pnpm --filter server dev`,
`pnpm --filter web dev`. Reading a payslip needs that key; everything above does not.
Check a release by hand: `near view bandsheet-3f36b7.testnet get_releases '{"from":0,"limit":10}' --networkId testnet`.

## 3. Track fit: Privacy & Private AI

| Sponsor tech | Where it is used | Code | Live |
|---|---|---|---|
| **NEAR AI Cloud** (TEE models) | Reads a member's payslip with a NEAR-hosted vision model. Before the call the server verifies a fresh-nonce attestation (TDX quote, signer and nonce binding, RTMR3 replay, GPU evidence nonce) and afterwards the response signature; nothing is stored. A USD 2.50 spend cap is enforced in code. | `server/src/nearai/`, `server/src/spend.ts` | `/unit/submit`, `/api/health` |
| **OutLayer** (Intel TDX) | The sealed engine: holds the X25519 key (`PROTECTED_ENCLAVE_SEED`, locked to one build), decrypts entries, runs the release audit, returns bands. An attestation record is linked per release. | `enclave/module/`, `enclave/audit/`, `contracts/bandsheet/src/outlayer.rs` | [attestation, release #2](https://testnet-api.outlayer.ai/attestations/by-tx/ErEry8mFcVR3DrwyjdHcWZHVHBPXs6xnJBQPpxhdP6dZ) |
| **Sputnik DAO** | A release can only be requested by a passed proposal (2 of 3 council). | `contracts/bandsheet/src/release.rs`, `scripts/` | [DAO](https://testnet.nearblocks.io/address/harbour-chapel.sputnik-v2.testnet) |
| **NEAR access keys** | Each member holds a function-call key limited to `submit` (gas-free); outsiders are refused; a resubmission replaces the entry. | `contracts/bandsheet/src/members.rs` | [refused outsider](https://testnet.nearblocks.io/txns/7eo7pKcCMJLtCy9fX3NT6gGkZAmkRwfK6mYut4ZGHPfb) |
| **NEAR Protocol** | The ledger: every release and refusal with witness, input/output hashes and the OutLayer request. | `contracts/bandsheet/src/` | [contract](https://testnet.nearblocks.io/address/bandsheet-3f36b7.testnet) |

Privacy mechanism: the audit treats every published cell as a sum query over members and solves the attacker's
equations first (exact rank over two primes). Its decision depends on membership only, never on pay, so a refusal
leaks nothing about values. Measured: 100 attack cases; the typical tool leaks in 95 (187 salaries recovered exactly),
Bandsheet in 0. Details: `enclave/README.md`, `THREAT_MODEL.md`.

## 4. Honest limits

- Testnet, synthetic data only. The committee is a trusted registrar of member keys.
- The audit is exact for k <= 3 (the default); for larger k it still catches any single member being solved.
- Means are integer-rounded EUR and treated as exact (conservative). The audit does not defend against
  statistical inference from many overlapping releases.
- OutLayer's TDX quote is captured and linked, and its attestation record is checked by `pnpm verify`, but the quote is
  not verified against Intel collateral and the contract does not verify it on chain.
- NVIDIA GPU attestation tokens are decoded and checked for the nonce; their signatures are not yet verified
  against NVIDIA's JWKS.
- DKIM-verified payslips (so a forged payslip cannot poison the bands) are in progress at submission time; see
  `THREAT_MODEL.md`. Until that lands, entries are member-asserted.
- `pnpm verify` live checks depend on public testnet RPCs and the OutLayer API, which rate-limit; it retries with
  backoff and fails loudly instead of skipping.
