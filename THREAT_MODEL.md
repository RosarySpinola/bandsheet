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
| Member | Submit and replace their own entry (function-call key, `submit` only); read all published releases; join with their own NEAR account and vouch for their entry | Submit for someone else, read others' entries |
| Member's wallet | Get one posting key registered (re-joining revokes the old one); sign each entry before it is posted | Hold two active posting keys; have an entry posted without its signature; appear on chain next to its entry |
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
| **Sign-in replay or forgery**: reuse a signed join, sign for another app, claim someone else's account | Single-use 32-byte nonces from the server, consumed atomically before verification and expiring after 10 minutes; the server re-encodes the payload with its own recipient and nonce (NEP-413 Borsh, or the NEAR Auth statement transaction) and verifies ed25519; the key must be a FullAccess key of the account (`view_access_key`), except a not-yet-existing implicit account whose id is that key; the NEAR Auth relay only forwards the exact statement bytes it issued, once per nonce; 5 joins a minute per IP | `server/test/auth.test.ts` (valid passes; wrong recipient, replayed nonce, expired nonce, key not on account, function-call key, tampered message fail), `server/scripts/auth-live.ts` (9/9 on the preview) |
| **Entry posted without the member's consent**: a stolen posting key posts in the member's name | A wallet member's entry is posted by the server only after the wallet's signature over that exact ciphertext verifies and the posting key matches the wallet's slot; a refusal posts nothing. (The posting key alone can still call `submit` directly on chain, as before; such an entry has no wallet binding) | `server/test/auth-entry.test.ts` (no signature, a signature over another entry, another slot's key, a non-submit transaction: nothing broadcast) |
| **Ethereum wallet forgery**: claim a 0x account without its key | EIP-191 text rebuilt by the server with its own recipient and nonce; viem `verifyMessage` must recover that exact lower-case 0x address | `server/test/auth-evm.test.ts` (wrong address, replay, wrong recipient, expired nonce, tampered message fail) |
| **Deanonymisation through sign-in**: link an account to its entry | The account to slot link is only in the server's D1 database; nothing that names the account is sent on chain (`add_members` carries only the member key); the API has no lookup by account | `server/test/auth.test.ts` asserts no on-chain call carries the account id |
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
- The sign-in database is a new secret: whoever reads `AUTH_DB` (the server operator, Cloudflare) learns which account holds
  which slot, and with the entry bindings which ciphertext. The ciphertext stays sealed to the enclave, but this weakens
  anonymity against the operator compared with invite-only membership. Members who want that should join by invite.
- Sign-in opens membership to any NEAR account: it proves control of an account, not employment or personhood, so one
  person with several accounts can register several member keys (sybils). A real chapel needs the server to check a
  roster or allow-list before `add_members`; that check is not implemented. Invite-only membership is unchanged.
- The hosted server holds a registrar key (function-call key on the committee account, `add_members` and `revoke_member`
  only). A server compromise can add or revoke members, not change the DAO, policy or engine.
- The committee is a trusted registrar: a malicious majority could register fake members (sybils) to shrink cells, then
  difference against them. Mitigation is DAO transparency, not cryptography.
- The audit is exact for k <= 3; for larger k small groups are not fully covered. Means are integer-rounded and treated as
  exact. Statistical inference from many overlapping releases is out of scope.
- A refusal reveals that a membership change happened and in which cell (by design: the witness names cells and counts,
  never members or values).
- The release history is ciphertext in the contract. Losing the enclave key (for example a rebuild without carrying the
  secret's access rule to the new hash) makes earlier releases unauditable; a fresh start with an empty history would
  forget them, so a rebuild must go through the DAO-visible policy update.

## Your own unit (units contract)

Anyone with a NEAR wallet can start a unit on `contracts/units` (one contract, many units). The demo chapel above is
unchanged; this section covers what the units contract adds. Interface: `contracts/units/INTERFACE.md`.

| Actor | Can | Cannot |
|---|---|---|
| Unit council (1 to 5 wallet seats) | Propose and vote releases in-contract (more than half of the seats at proposal time passes); approve new seats (more than half of the current council); list employer DKIM domains; ask for up to 8 synthetic colleagues; rotate the invite | Pack the council alone (a seat needs more than half), read entries, vote twice or after a proposal closed, touch another unit |
| Unit member | Join with a wallet signature and the invite link secret; submit and replace one sealed entry per posting key | Submit to another unit (the slot routes the entry), hold two posting keys in one unit (re-joining revokes the old one) |
| Registrar (server's function-call key on `bsu-registrar-*`) | Call `unit_add_member`, `unit_remove_member`, `unit_add_issuer` only | Vote, propose, change the engine; add a non-synthetic member without the unit's invite code (the contract checks it). It can add synthetic members (flagged on chain, 8 per unit): the council-signature check for those is the server's, not the contract's |
| Gas sponsor (server's key on a low-value account) | Send 0.05 testnet NEAR once per account, 3 accounts per IP per day | Fund mainnet ids; fund an account twice |

| Attack | Mitigation | Evidence |
|---|---|---|
| A unit's release mixes in another unit's entries or history | Entries, history, proposals and releases are keyed by unit; a slot belongs to exactly one unit; each run sends only its unit's ciphertexts and its own history | `contracts/units/src/tests_vote.rs`, sandbox `it/tests/units.rs` |
| A wallet or outsider adds an entry | `submit` accepts only this account's own posting keys (predecessor = the contract, signer key = a registered slot) | sandbox test: outside wallet refused |
| Replaying an invite code read from chain | The link carries a secret S; the chain sees only sha256(S) as the code; the server checks S itself | `server/test/units-join.test.ts` |
| Synthetic entries passing as real | Synthetic keys are flagged on chain at join, single-use, capped at 8 by the contract, added only after a council member's signed request (checked by the server); every release records entries, synthetic, DKIM-verified and self-attested counts; the API, MCP and verify output say SYNTHETIC | `server/test/units-admin.test.ts`, `mcp/test/mcp.test.ts` |
| Bills: storage and engine runs paid by the contract | 3 units per account, 400 in total; 40 members and 120 member keys per unit; 10 proposals and 5 runs per unit per day; 60 runs per day overall; a 0.5 NEAR floor below which writes are refused; queries at most 512 bytes; stored engine answers at most 96 KB | `contracts/units/src/tests*.rs` |

Residual risks, units:
- **Synthetic colleagues weaken a band.** A band of one real entry and four synthetic ones protects the real pay only as
  long as nobody knows the synthetic values. The server draws them at random and never stores or logs them, but a server
  that was modified could; synthetic data is for trying the product, not for real pay.
- **Self-attested entries** (PDF, image, hand-entered, generated payslip) are the member's word. DKIM-verified counts come
  from a second, cell-less engine run with `require_dkim`; the release itself counts every entry.
- **Issuer keys supplied by a council member** (the test seam for a domain with no DNS record) are only as good as that
  member; they are recorded as `supplied`, not `dns`, and shown that way.
- **Squatting.** Anyone with testnet NEAR can create accounts and take units up to the caps; nothing is payable. The caps
  bound the bill, they do not stop a determined squatter.
- **The units account keeps a full-access key** during the hackathon (for fixes). Whoever holds it could redeploy the
  contract; `pnpm verify --units` checks that the deployed code hash equals the committed build.
- A member can submit a colleague's genuine DKIM payslip; the engine's nullifier keeps it to one entry per payslip, as in
  the demo.
