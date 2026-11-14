# Threat model

Scope: Bandsheet on NEAR testnet with synthetic data. Goal: publish pay bands by grade while no one, including a
colluding group of members, can compute an individual's pay from what is published.

## Assets

1. Each member's pay, grade and attributes (the plaintext entry).
2. The enclave's X25519 private key (`PROTECTED_ENCLAVE_SEED`, generated inside the TEE, locked to one build hash).
3. The release history (membership vectors of every released cell), stored encrypted to the enclave key.
4. Integrity of the ledger: which releases ran, with which engine build, on which inputs.
5. Eligibility: only the chapel's members count.

## Actors

| Actor | Can | Cannot |
|---|---|---|
| Member | Submit and replace their own entry (function-call key, `submit` only); read all published releases | Submit for someone else, read others' entries |
| Committee (DAO council, 2 of 3) | Request a release by a passed proposal; the owner account (registrar) adds and revokes member keys | Read entries or the history; force the engine to publish a refused cell |
| Server operator | Serve the app, relay payslip reads to NEAR AI Cloud | Read sealed entries (encrypted in the browser to the enclave key); persist payslips (nothing is stored) |
| OutLayer operator | Run the worker, see ciphertext and the TDX quote | Read the enclave seed or plaintext (TDX memory encryption; secret locked to one build hash) |
| Outsider | Read the chain, call views, try `submit` | Submit (refused, tx on record), request a release |
| Colluding members | Pool their own pay and every published table | See anyone else's pay beyond what the tables imply (see differencing) |

## Attacks and mitigations

| Attack | Mitigation | Evidence |
|---|---|---|
| **Differencing**: subtract an earlier table from a later one after a join or leave (`10 x 63,160 - 9 x 62,400 = 70,000`) | Every released cell is a sum query over member unknowns; the audit refuses any cell that makes a row combination with fewer than k nonzero entries solvable, against the whole encrypted history | `pnpm verify` check D; 0/100 leaking cases vs 95/100 (`enclave/evaluation/results.json`) |
| **Small cells**: a group of 1 or 2 published | Primary suppression n < k (k = 3); complements next to a small cell are suppressed too | `enclave/audit/tests/` |
| **Fake entries**: an outside or unregistered key submits | The contract accepts `submit` only from registered member keys; outsiders are refused | [refused tx](https://testnet.nearblocks.io/txns/7eo7pKcCMJLtCy9fX3NT6gGkZAmkRwfK6mYut4ZGHPfb) |
| **Replay / duplicate**: the same member counted twice | One entry per slot (hash of the member key); a resubmission replaces it and the count is unchanged; the latest `submitted_at` wins in the enclave | [resubmit tx](https://testnet.nearblocks.io/txns/2MMxbfTBbcoMENVHHMxeGaYH6SjLXuVWXTm4Xb5sGWEm) |
| **Forged payslip**: a member invents or edits their pay to skew the bands | **Implemented.** The employer's payroll emails each payslip DKIM-signed; the DAO records the employer's key on chain (`add_issuer`, proposal #2) and turns on `set_require_dkim` (#3, #4); the DAO adopts the DKIM engine with `set_engine` (#5). With `require_dkim` on, the enclave counts an entry only if: it has an email (else `no_email`); a signature from a trusted domain and selector whose `d=` equals the From domain exists (else `untrusted_issuer`); that signature verifies, RSA-SHA256 with `h=` including `from`, no `l=` (else `dkim_bad_signature`); and the signed body's grade and monthly gross x 12 (within EUR 1) match the entry (else `body_mismatch`). It then keeps one entry per member slot (latest `submitted_at` wins), and one per nullifier `sha256(domain\|employee_id\|period)` (latest wins, ties by larger slot); the rest are `duplicate_payslip`. Rejections are reported as reason and count, never identity | Release #3 on chain: 37 of 38 verified, `dkim_bad_signature: 1` (HC-2977, EUR 4,908.33 edited to 6,908.33), forged submit [6XbEAZSF...](https://testnet.nearblocks.io/txns/6XbEAZSFQ9AfXT2CefXcJV4Err8xnxVFwSfa2b2a4UkH), attestation [CqPS4C69...](https://testnet-api.outlayer.ai/attestations/by-tx/CqPS4C69oPj6BgaTxfW5ZAgJ9Zs8zuStD8DABJASCSH5); `pnpm verify` check C; `enclave/module/tests/dkim_release.rs`; independent dkimpy cross-check `enclave/scripts/dkim-crosscheck.py` |
| **Key theft**: a member key is stolen | The key can only call `submit` (no funds, no reads); the registrar can revoke it; the member's next submission replaces the entry | `contracts/bandsheet/src/members.rs` |
| **Server reads payslips**: the operator tries to capture pay | The payslip goes to a NEAR-hosted TEE model only after the server verifies its attestation; the response signature is checked; nothing is persisted; the entry that is stored is encrypted in the browser to the enclave key | `server/src/nearai/`, `server/test/verify.test.ts` |
| **Enclave compromise or swap**: a modified engine publishes more | The enclave secret opens only for the exact build hash; the contract policy pins that hash and each release's attestation names it | `pnpm verify` checks B and C |
| **Spend abuse** of the AI backend | A hard USD 2.50 cap refuses calls past it | `server/src/spend.ts`, `server/test/spend.test.ts` |

## Residual risks (not mitigated)

- A compromised TDX platform or a CPU side channel would expose entries. The TDX quote is captured and linked but not
  verified against Intel collateral here, and the contract does not verify it on chain.
- DKIM proves the email came from the key holder, not that payroll was right; a compromised or dishonest employer key
  signs any pay. The demo employer, `harbourcourier.example`, is fictional with a key we generated. Keys are taken from
  the DAO policy, not DNS; the `x=` expiry is not enforced; `l=` signatures are rejected; only the first verifying
  signature is used. With `require_dkim` off (the default in the engine) entries are member-asserted. The audit
  protects individuals from inference; it does not prove the inputs are true.
- The enclave does not bind a payslip to the submitting key. If a member submitted a colleague's genuine signed
  payslip, the nullifier would still keep it to one entry per employee and period, but not to the right submitter.
- The committee is a trusted registrar: a malicious majority could register fake members (sybils) to shrink cells, then
  difference against them. Mitigation is DAO transparency, not cryptography.
- The audit is exact for k <= 3; for larger k small groups are not fully covered. Means are integer-rounded and treated as
  exact. Statistical inference from many overlapping releases is out of scope.
- A refusal reveals that a membership change happened and in which cell (by design: the witness names cells and counts,
  never members or values).
- The release history is ciphertext in the contract. Losing the enclave key (for example a rebuild without carrying the
  secret's access rule to the new hash) makes earlier releases unauditable; a fresh start with an empty history would
  forget them, so a rebuild must go through the DAO-visible policy update.
