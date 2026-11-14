# Bandsheet enclave

The sealed engine of Bandsheet: a Rust `wasm32-wasip2` module for OutLayer (Intel TDX). It decrypts members'
payslip entries inside the TEE, audits a release request against everything released before, and returns pay
bands only where no member's pay can be solved. All data in tests and demos is synthetic.

```
audit/    bandsheet-audit: pure library, no I/O. The release audit, witnesses, history, naive baseline.
module/   bandsheet-enclave: WASI binary. Decrypt, validate, call the audit, seal the history, hash.
test-vectors/  TypeScript <-> Rust crypto vectors.   evaluation/  results of the 100-case comparison.
proof/    testnet outputs and OutLayer attestation records.   scripts/  input builder and invoker.
```

## Commands

```bash
make test        # all Rust tests (hero case, 100 adversarial cases, unit, module) + TS cross-language check
make evaluate    # reruns the 100 cases and writes evaluation/results.json (per case, for the UI)
./build.sh       # wasm -> out/bandsheet-enclave.wasm, prints sha256
```

Disk is tight on this machine: `export CARGO_TARGET_DIR=<shared dir>` to avoid another `target/`.

## The audit (audit/src)

Every member's pay, in one version of their entry, is an unknown. Every released cell is a sum query over
a set of unknowns (mean x public n). A release is processed cell by cell, largest first:

1. Primary suppression: a group with n < k is `small_cell`, never released.
2. Exposure check on every other cell: after adding its row, the row space of all released rows (this
   release plus the encrypted history) must contain no nonzero vector with fewer than k nonzero entries.
   k = 1 entry is "one member's pay is solvable" (a unit vector e_i); fewer than k also catches differences and
   complements that isolate a small group (a total minus the large cell next to a small one). Exact
   arithmetic over GF(2^61 - 1) and GF(2^64 - 59); a cell is refused if either field finds a violation.
   Exact for k <= 3 (singles and pairs of reduced rows); for larger k it still catches every single member.
3. Secondary suppression: a refused cell is `differencing` with a witness such as
   `Release #2 Senior - Release #1 Senior isolates 1 member`. Witnesses name cells and a count, never a member
   or a value. A cell that adds no information (same member set already released) passes.
4. Join, leave, raise: a member whose entry changed (pay, grade, any attribute) is a new unknown, a leaver stays
   an unknown. The history keeps every released row, so a release is audited against all earlier ones.
5. The decision depends on membership only, never on pay, so refusals reveal nothing about values.

Limits (stated, not hidden): means are integer-rounded EUR and treated as exact (conservative); the audit
protects individuals and groups under k, not statistical inference from many overlapping releases.

## Results

`make test`: hero case: 36 members, release #1 by grade releases 4 bands and holds the Chief (n=1). A Senior at
EUR 70,000 joins. Typical n>=k tool: 13 x 68,152 - 12 x 67,998 = EUR 70,000 (exact). Bandsheet: the Senior cell
is refused with the witness above; the other three bands are unchanged and still released.

100 generated adversarial cases (joins, leaves, swaps, raises, repeated and overlapping group-bys, filters,
totals next to partitions, 3 to 5 releases each; deterministic seeds; attacker is independent exact rational
elimination that shares no code with the auditor):

| | leaking cases | exact recoveries | cells published |
|---|---|---|---|
| typical n >= k | 95 of 100 (81 exact, 14 isolated pair) | 187 members | 1265 |
| Bandsheet | 0 of 100 | 0 | 931 (74%) |

Worst recovery error from rounded means: EUR 21. Full per-case data: `evaluation/results.json`.

## Enclave I/O

Input (stdin): `{"op":"release"?, "policy":{"k":3}, "query":{"id","group_by":[..],"filter":{..}?,"stat":"mean"},
"entries":[{epk,nonce,ct}...], "history": {epk,nonce,ct} | null}`. An envelope may also be a base64 string of that
JSON. `{"op":"pubkey"}` returns the enclave public key. Output (stdout, one JSON):
`release_id, status (released|partially_released|refused), cells [{key,n,mean_eur}], suppressed [{key,reason,witness}],
history {epk,nonce,ct} (pass back unchanged next time), input_hash, output_hash`, plus `entries_used`,
`entries_superseded`, `entries_rejected {code: count}`, `engine`.

- `input_hash` = sha256 of the raw input bytes (equals sha256 of `input_data`; OutLayer's attestation carries the same value).
- `output_hash` = sha256 of the compact, key-sorted JSON of this object without `output_hash`. (OutLayer's attestation
  `output_hash` is a different, standard value: sha256 of the stdout bytes.)
- Entries that fail to decrypt or validate are skipped and counted, never fatal. One entry per slot: the latest
  `submitted_at` wins. An error is `{"error","code"}` (E_INPUT, E_KEY, E_HISTORY, E_QUERY) with no `status` field.
- Crypto: see CRYPTO.md. The enclave X25519 key is `PROTECTED_ENCLAVE_SEED`, generated inside the TEE; nobody sees it.

## Deployed (TESTNET)

| | |
|---|---|
| Project | `bandsheet-enclave.testnet/bandsheet-enclave` (owner account `bandsheet-enclave.testnet`) |
| WASM sha256 | `a1dd40549adacc6183e140cc34ae7ed5c6af63eb646ab7978e4d50a371073f57` (374,198 bytes) |
| FastFS | `https://test.fastfs.io/bandsheet-enclave.testnet/outlayer.testnet/a1dd40549adacc6183e140cc34ae7ed5c6af63eb646ab7978e4d50a371073f57.wasm`, upload tx `A1yGjLVej4e8K8BgSHSDwHwcYrzqeykFFG3Mo6rp3vvv` |
| Enclave public key | hex `2a7d1b5606126e98b903777f95d1a0795a1442bff3c5371cc9bb988c2d891346`, base64 `Kn0bVgYSbpi5A3d/ldGgeVoUQr/zxTccybuYjC2JE0Y=` |
| Secret | profile `default`, `PROTECTED_ENCLAVE_SEED` (TEE-generated), locked to this exact build hash |
| Executions | pubkey `CfDKSJ96M7KSTGkiht89BCLWPJWSWzjqyE89PSkCJpoM`; release #1 `82YcfbFjeCp3WD7oVSuztUv8DDey6dLGLahF38DqwFsV`; release #2 `BVySfrKeJzF2jQegQptQXeMogS4XffYZMsLp1GgRBr88` |

Explorer: `https://testnet.nearblocks.io/txns/<hash>`. Attestation record (TDX quote, worker measurement, wasm hash,
input and output hash, request id): `https://testnet-api.outlayer.ai/attestations/by-tx/<hash>`; saved copies in `proof/`.
Quote verification collateral: `GET /public/collateral` (needs an `fmspc` query parameter).

Rebuilding changes the hash: a new build needs `./ol.sh upload`, `./ol.sh deploy bandsheet-enclave <url>`, and
`./ol.sh secrets access --project bandsheet-enclave.testnet/bandsheet-enclave --build <new sha256>`.

```bash
./ol.sh login bandsheet-enclave.testnet        # key from ~/.near-credentials or keys/, isolated HOME, never printed
./ol.sh upload out/bandsheet-enclave.wasm
./ol.sh deploy bandsheet-enclave <FastFS URL>
./ol.sh secrets set --generate PROTECTED_ENCLAVE_SEED:hex32 --project bandsheet-enclave.testnet/bandsheet-enclave --access allow-all --build <sha256>
node scripts/make-input.mjs --pubkey <hex> --release 1 > in1.json        # synthetic hero input, encrypted to the enclave key
node scripts/invoke.mjs --rpc https://archival-rpc.testnet.near.org --input in1.json --out out1.json
node scripts/make-input.mjs --pubkey <hex> --release 2 --history <history envelope from out1.json> > in2.json
```

(`./ol.sh run ...` works too but its RPC wait timed out behind the shared public RPC rate limit; `invoke.mjs` uses near-api-js.)

## What the Bandsheet contract must call

`outlayer.testnet` `request_execution` (payable), signed by any account, with:

```json
{"source":{"Project":{"project_id":"bandsheet-enclave.testnet/bandsheet-enclave","version_key":null}},
 "resource_limits":{"max_instructions":2000000000,"max_memory_mb":128,"max_execution_seconds":60},
 "input_data":"<enclave input JSON as a string>",
 "secrets_ref":{"profile":"default","account_id":"bandsheet-enclave.testnet"},
 "response_format":"Json","payer_account_id":null,"params":null}
```

Attach 0.05 NEAR (the run is charged about 0.002 NEAR; the rest is refunded to the caller or `payer_account_id`);
attach at least 100 TGas, 200 recommended (the settlement callback takes 50 TGas). `input_data` over 10,000 bytes is
stored by OutLayer and handled for you (a 36-member input is about 12 KB). The callback receives the guest's JSON
output as a JSON value; `null` means the run failed. Pin the version by passing `version_key` = the wasm sha256.
The secret's access rule is "this exact build only", so any account may call it; `Predecessor`-based gating belongs
in the Bandsheet contract (DAO-approved release).
The contract should store `output.history` only from a result that has `status`, and pass it back as `input.history`.
A run takes about 50 ms of compute locally; end-to-end latency on testnet was not timed precisely (each call returned within about a minute or two).

## Unverified

TDX quote signature was not verified against Intel collateral here (the record is captured, not checked).
Instruction and time limits were set generously and not tuned. Behaviour above 500 entries is refused by design.
