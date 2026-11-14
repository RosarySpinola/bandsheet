# Judges guide

Bandsheet publishes pay bands for a union and refuses any table that would let someone work out one
colleague's salary by subtraction. Everything is NEAR **testnet** and **synthetic** (a fictional newsroom).
Payslips are DKIM-verified inside the OutLayer enclave, so an edited payslip cannot skew the bands.

## 0. One command, no keys (about 6 seconds)

```bash
pnpm install && pnpm verify          # add --json for machine output, --offline to skip the network
```

It is read-only and prints PASS or FAIL lines (exit code 1 on any FAIL). 19 checks: the deployed contract's code hash
equals `scripts/deployed.json` and the local build; the on-chain policy has k = 3 and the engine hash
(`69d5616c...3b26`) and enclave key documented in `enclave/README.md`; all 3 on-chain releases are bound to an OutLayer
attestation of the engine build that ran them (engine, input and output hashes; releases #1 and #2 ran under the previous
engine `a1dd4054...3f57`); release #3 required employer DKIM, with 37 entries verified and `dkim_bad_signature: 1`
rejected; the differencing attack (`10 x 63,160 - 9 x 62,400 = 70,000`) works on a typical tool and was refused on chain;
the offline evaluation (95/100 vs 0/100); and the live API reports the same contract.
`pnpm verify --full` also re-runs `make -C enclave evaluate` (needs Rust).

## 1. The 90-second path (live: https://bandsheet.pages.dev)

| Step | Open | Do | You should see |
|---|---|---|---|
| 1 | `/unit/attack` | Pick Release #1 and #2, cell Senior | The typical tool shows **EUR 70,000** (a real salary). Bandsheet shows a real on-chain refusal with the witness `Release #2 Senior - Release #1 Senior isolates 1 member`. |
| 2 | `/unit/attack` | Scroll to **Try to cheat** | A real signed payslip with one digit changed after signing (HC-2977, EUR 4,908.33 to 6,908.33) was submitted and accepted by the contract, but the enclave rejected it: `dkim_bad_signature`. An outsider's key is refused by the contract with its panic message. |
| 3 | `/unit/releases` | Read the three rows | #1 released 5 bands; #2 `partially_released`, Senior withheld; #3 (DKIM required) `partially_released`, **37 of 38 entries verified**, 1 rejected (`dkim_bad_signature`), Senior withheld, Junior 8 / Reporter 11 / Editor 5 / Chief 3 published. Each row links to its transaction and OutLayer attestation. |
| 4 | `/unit/verify` | Read the panel | Policy k = 3, engine build hash, enclave public key, trusted DKIM issuer, and a command to check each. |
| 5 | `/unit/submit` | Use the demo member and a sample payslip (PDF, image or signed `.eml`) | A Verified panel lists each NEAR AI Cloud attestation check (and the DKIM result for an `.eml`), then the sealed entry is sent gas-free; a tx link appears. |

Optional: `/unit/stand` (compare your pay with the band, draft the Article 7 letter) and `mcp/README.md` (ask an AI
assistant to "verify release 3").

## 2. The 5-minute local path

```bash
pnpm install
pnpm verify                                   # live chain checks (section 0)
pnpm test                                     # core + server tests (vitest)
pnpm --filter web build                       # web typecheck + build
make -C enclave test                          # Rust: hero case, 100 adversarial cases, DKIM release, TS<->Rust crypto vectors
make -C enclave crosscheck                    # verifies every DKIM fixture with dkimpy, an independent implementation
make -C enclave evaluate                      # regenerates enclave/evaluation/results.json (95/100 vs 0/100)
cd contracts/bandsheet && RUSTFLAGS="--cfg near" cargo +1.86.0 test --locked -p bandsheet   # contract unit tests
```

Optional app: `cp .env.example .env.local` (needs your own `NEARAI_API_KEY`), `pnpm --filter server dev`,
`pnpm --filter web dev`. Reading a payslip needs that key; everything above does not.
Check a release by hand: `near view bandsheet-3f36b7.testnet get_releases '{"from":0,"limit":10}' --networkId testnet`, and
`curl https://testnet-api.outlayer.ai/attestations/by-tx/CqPS4C69oPj6BgaTxfW5ZAgJ9Zs8zuStD8DABJASCSH5` for release #3's attestation.

## 3. Track fit: Privacy & Private AI

| Sponsor tech | Where it is used | Code | Live |
|---|---|---|---|
| **NEAR AI Cloud** (TEE models) | Reads a member's payslip with a NEAR-hosted vision model. Before the call the server verifies a fresh-nonce attestation (TDX quote, signer and nonce binding, RTMR3 replay, GPU evidence nonce) and afterwards the response signature; nothing is stored. A USD 2.50 spend cap is enforced in code (D1 ledger). | `server/src/nearai/`, `server/src/spend.ts` | `/unit/submit`, `/api/health` |
| **OutLayer** (Intel TDX) | The sealed engine: holds the X25519 key (`PROTECTED_ENCLAVE_SEED`, locked to one build), decrypts entries, verifies DKIM, runs the release audit, returns bands. An attestation record is linked per release. | `enclave/module/`, `enclave/audit/`, `enclave/dkim/`, `contracts/bandsheet/src/outlayer.rs` | [attestation, release #3](https://testnet-api.outlayer.ai/attestations/by-tx/CqPS4C69oPj6BgaTxfW5ZAgJ9Zs8zuStD8DABJASCSH5) |
| **Sputnik DAO** | A release can only be requested by a passed proposal (2 of 3 council). The DAO also trusts the employer's DKIM key (proposal #2), turns `require_dkim` on (#3, #4) and adopts the DKIM engine (#5). | `contracts/bandsheet/src/release.rs`, `contracts/bandsheet/src/dkim.rs`, `scripts/` | [DAO](https://testnet.nearblocks.io/address/harbour-chapel.sputnik-v2.testnet) |
| **NEAR access keys** | Each member holds a function-call key limited to `submit` (gas-free); outsiders are refused; a resubmission replaces the entry. | `contracts/bandsheet/src/members.rs` | [refused outsider](https://testnet.nearblocks.io/txns/7eo7pKcCMJLtCy9fX3NT6gGkZAmkRwfK6mYut4ZGHPfb) |
| **NEAR Connect + NEP-413** | Join with any testnet wallet: it signs `Bandsheet join: <member key>` (NEP-413, recipient the unit, single-use nonce); the server re-encodes the Borsh payload, verifies the signature and that the key is a FullAccess key, then registers the browser-made member key. Council seats vote from their own wallet (`act_proposal`). | `server/src/auth/`, `server/src/routes/auth.ts`, `web/src/lib/wallet/` | [join via NEAR CLI executor](https://testnet.nearblocks.io/txns/DoXMnkMTGVCkUYAVGWgReybiy6yA2KgD7p2SiZQVXG1K) |
| **NEAR Auth** (FastAuth) | Join with email, a passkey or Google, no wallet: the account signs a never-executable statement transaction through Auth0 and the MPC network (`fast-auth.testnet` `sign`, relayed by the server). Account to slot stays off chain (D1). | `web/src/lib/wallet/near-auth.ts`, `server/src/auth/near-auth.ts` | [MPC sign](https://testnet.nearblocks.io/txns/DXN837PH64yG66Q9JhXDLHG4ezMVJnepiVLUCqNicFS3) · [member added](https://testnet.nearblocks.io/txns/HspVCBQtxJx6N9oSFjY8LvoTPvGEieZF5pqaSTyMUVYy) |
| **NEAR Protocol** | The ledger: every release and refusal with witness, input/output hashes, rejection counts and the OutLayer request; the OutLayer deposit is sized to the input. | `contracts/bandsheet/src/` | [contract](https://testnet.nearblocks.io/address/bandsheet-3f36b7.testnet) |
| Beyond NEAR | DKIM (RFC 6376), Eurostat SES wage context, an MCP server, EU Directive 2023/970 Art. 7 letter | `enclave/dkim/`, `server/src/context.ts`, `mcp/`, `server/src/letter.ts` | `/unit/stand`, `/api/context` |

Privacy mechanism: the audit treats every published cell as a sum query over members and solves the attacker's
equations first (exact rank over two primes). Its decision depends on membership only, never on pay, so a refusal
leaks nothing about values. Measured: 100 attack cases; the typical tool leaks in 95 (187 salaries recovered exactly),
Bandsheet in 0. Authenticity: with `require_dkim`, only entries whose payroll email verifies against a DAO-trusted key
count; release #3 rejected one edited payslip and reported only the reason and count, never who. Details:
`enclave/README.md`, `THREAT_MODEL.md`.

## 4. Honest limits

- Testnet, synthetic data only. The committee is a trusted registrar of member keys.
- Sign-in: NEAR Auth (FastAuth) cannot run on the deployed site. Its shared testnet Auth0 client answers
  `403 unauthorized_client: Callback URL mismatch` for any origin but `http://localhost:3000`, so on bandsheet.pages.dev the
  button is disabled with a one-line reason. It was tested end to end from `localhost:3000` with a passkey (MPC sign, member
  added, submit, entry bound). Unblocking needs the NEAR Auth team to allowlist the site's origin. NEAR Connect wallets work
  on the deployed site. The demo member (`/unit/join`, "Try as a demo member (no sign-in)") needs no account and is unchanged.
  A real third-party wallet sign-in (Meteor, Intear, Nightly, Ledger) and a wallet vote were not tested.
- The DKIM employer, `harbourcourier.example`, is fictional and its key was generated by us. Keys come from the DAO
  policy (no DNS). The DKIM `x=` expiry is not enforced; signatures with `l=` are rejected.
- The audit is exact for k <= 3 (the default); for larger k it still catches any single member being solved.
- Means are integer-rounded EUR and treated as exact (conservative). The audit does not defend against
  statistical inference from many overlapping releases.
- OutLayer's TDX quote is captured and linked, and its attestation record is checked by `pnpm verify`, but the quote is
  not verified against Intel collateral and the contract does not verify it on chain.
- NVIDIA GPU attestation tokens are decoded and checked for the nonce; their signatures are not verified
  against NVIDIA's JWKS.
- `pnpm verify` live checks depend on public testnet RPCs and the OutLayer API, which rate-limit; it retries with
  backoff and fails loudly instead of skipping.
