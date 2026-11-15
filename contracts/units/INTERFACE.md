# Units: interface for the web (backend owner, 15 Nov 2026)

Network: NEAR testnet only. Names follow UNITS-BRIEF.md; the additions and the two clarifications are marked **(+)** and **(!)**.

## Accounts

| | |
|---|---|
| Units contract | `bandsheet-units-2d3f96.testnet` (deploy pending; this file is updated with the code hash when it lands) |
| Registrar (contract `owner`) | `bsu-registrar-2d3f96.testnet` (the server holds a function-call key on it: `unit_add_member`, `unit_remove_member`, `unit_add_issuer` only) |
| Gas sponsor | `bsu-sponsor-2d3f96.testnet` (about 2 NEAR) |
| Engine | OutLayer project `bandsheet-enclave.testnet/bandsheet-enclave`, wasm sha256 `69d5616c…3b26`, same enclave key as the demo |

Server code default: `UNITS_CONTRACT` (env overrides). Read the live values from `get_policy` / `GET /api/units/policy`.

## Invite codes (!)

The link carries a random secret `S` (`/join/:unitId?code=S`). `invite_code = hex(sha256(S))`, `invite_code_hash = hex(sha256(invite_code))`.
The contract checks `sha256(invite_code) == invite_code_hash` exactly as the brief says, but only the server ever sees `S`, so a code read
from an earlier join transaction cannot be replayed through the server. Use the helpers in `@bandsheet/core`:
`newUnitInvite() -> {secret, code, hash}`, `inviteCodeOf(secret)`, `inviteHashOf(secret)`. Pass `hash` to `create_unit`, put `secret` in the link,
and send `secret` as `invite_code` to the join route.

## Contract: wallet transactions (signed by the user's wallet)

| Method | Args | Gas | Notes |
|---|---|---|---|
| `create_unit` | `{name, invite_code_hash, dkim_domains: string[]}` | 30 Tgas | returns unit id (u32, from 1). Caller = seat 1. Caps: 3 per account, 400 total, 4 domains |
| `unit_add_council` | `{unit_id, account_id}` | 30 Tgas | council only, 5 seats max. **(!)** returns `"added"` or `"pending"`: on a 1-seat council the seat is added at once; otherwise each call is one approval and the seat is added when more than half of the current council has called it for that account (review finding: one member must not pack the council). Pending ones are in `get_unit().pending_seats` |
| `unit_add_dkim_domain` | `{unit_id, domain}` | 30 Tgas | council only |
| `unit_propose_release` | `{unit_id, query}` | **300 Tgas** | council only; `query` is a JSON string `{"group_by":["grade"]}` (fields grade, gender, site; optional `filter`). Returns proposal id (per unit, from 1). The proposer's approval counts, so **on a 1-seat council the proposal passes and the engine runs in this same call** |
| `unit_vote` | `{unit_id, proposal_id, approve: bool}` | **300 Tgas** | only seats that existed when the proposal was made; once each; returns `"open" \| "running" \| "rejected"` |
| `unit_clear_stale` **(+)** | `{unit_id}` | 30 Tgas | council; unfreezes a run that never answered after 10 minutes |
| `unit_withdraw_proposal` **(+)** | `{unit_id, proposal_id}` | 30 Tgas | the proposer only, while open |
| `unit_rotate_invite` **(+)** | `{unit_id, invite_code_hash}` | 30 Tgas | council; a new invite link (old link stops working, members stay) |

Threshold: approvals × 2 > seats at proposal time (1 of 1, 2 of 2, 2 of 3, 3 of 4, 3 of 5). A proposal is `rejected` as soon as it can no longer pass.
Proposal status: `open → running → executed`, or `rejected`, `withdrawn`, `expired` (open proposals expire after 7 days). Caps: 5 open
proposals, 10 proposals and 5 engine runs per unit per rolling 24 h, 60 engine runs per 24 h across the contract, 40 members and 120 member keys
ever per unit. `query` at most 512 bytes, keys `group_by`, `filter`, `stat` only. If a vote attaches too little gas for the DKIM count run, the
release still runs and `count_note` says DKIM was not counted.

## Contract: views

- `get_unit({unit_id})` → `{id, name, creator, created_at, council[], invite_code_hash, threshold, pending_seats[{account_id, approvals[]}], joins, dkim_domains[], issuers[{domain, selector, source: "dns"|"supplied", key_sha256}], members, synthetic_members, synthetic_added, entries, proposals, open_proposals, releases, in_flight, runs_last_24h}` or null
- `get_units_of({account_id})` → `[{id, name, creator, council, members, entries, releases}]` (units where the account holds a seat)
- `get_unit_proposals({unit_id, from?, limit?})` → `[{id, unit_id, query (JSON text), proposer, created_at, council[], approvals[], rejections[], status, release_id}]`
- `get_unit_releases({unit_id, from?, limit?})`, `get_unit_release({unit_id, release_id})` **(+)** → release view: the demo contract's `ReleaseView` fields
  (`id, query, requested_by, status, cells, suppressed, input_hash, output_hash, input_sha256, output_sha256, proof, note, block_timestamp, wasm_sha256, issuers, entries_verified`)
  plus `unit_id, proposal_id, entries_used, rejections, dkim_rejections, count_note` and
  **`counts: {entries, synthetic, dkim_verified, self_attested, rejected}`** (show all three kinds on every release; `dkim_verified`/`self_attested` are null if the DKIM count run failed)
- `unit_of_slot({slot})` → `{unit_id, synthetic, has_entry}` or null; `slot_of({public_key})` → slot hex
- `get_unit_entries({unit_id, from?, limit?})` **(+)** → ciphertexts
- `get_units_stats()` → `{units, max_units, members, entries, releases}`
- `get_policy()` → `{contract, registrar, k, enclave_pubkey, wasm_sha256, policy_hash, outlayer, caps{...}, frozen}`

How DKIM counting works with the unchanged engine: the release runs with `require_dkim=false` (every entry counts). When the unit has an issuer key
and real entries, a second request goes out in the same vote: `require_dkim=true`, the unit's keys, no history, a filter that matches nobody, so it
publishes no cells and only returns `entries_verified`. That number is `counts.dkim_verified`.

## Entries

Plaintext (sealed with `encryptBytes(parseEnclavePublicKey(policy.enclave_pubkey), utf8(JSON))`, or `encryptEntry` for entries without email):
`{slot, gross_annual_eur, grade: Junior|Reporter|Senior|Editor|Chief, gender: F|M|X, site: City|Port, submitted_at, eml_b64?}`. The engine only knows these
five grades and two sites. `eml_b64` (raw .eml, base64) makes it countable as DKIM-verified. The posting key signs
`submit({ciphertext})` on the units contract (signer = receiver = units contract): `signSubmitTx({accountId: UNITS, contractId: UNITS, privateKey, ...}, ct)`.

## Server (Pages Functions; errors are `{error, code}`)

Signed claims use the demo's shape: `{scheme: "nep413" | "eip191", account_id, public_key (the WALLET's ed25519 key; omit for eip191), signature, nonce}`.
NEP-413 recipient = the units contract; nonce from `POST /api/units/nonce`. EIP-191 text = `<statement>\nRecipient: <units contract>\nNonce: <nonce>`.
(NEAR Auth / FastAuth `near-tx` is not supported on units.)

| Route | Body | Reply |
|---|---|---|
| `POST /api/units/nonce` **(+)** | `{purpose: "unit_join" \| "unit_synthetic" \| "unit_entry" \| "unit_issuer"}` | `{nonce, purpose, recipient, expires_at}` |
| `POST /api/sponsor` | `{account_id}` | `{funded, tx?: {hash, url}, balance}`; 0.05 NEAR once per account when balance < 0.02; refuses `.near` / mainnet ids |
| `POST /api/units/:id/join` | claim + `{member_public_key, invite_code: S}` **(!)** statement `Bandsheet join unit <id>: <member_public_key>` | `{unit_id, account_id, member_public_key, slot, tx, replaced}` |
| `POST /api/units/:id/entry` **(+)** | claim + `{signed_tx}` statement `Bandsheet unit <id> entry: <sha256 hex of the ciphertext JSON>` | `{unit_id, slot, ct_sha256, tx, entry_count}`; binds the entry to the account in D1 and broadcasts |
| `POST /api/units/:id/synthetic` | claim + `{n (1..8), grade?}` statement `Bandsheet synthetic <id>: <n>`; signer must hold a council seat | `{unit_id, added, synthetic_total, txs[{hash,url}]}` |
| `POST /api/units/:id/issuer` | `{eml}` (raw .eml text): reads d= and s=, domain must be listed, key over DoH | `{unit_id, domain, selector, source: "dns", key_sha256, tx}` |
| `POST /api/units/:id/issuer` (test seam) | `{eml, supplied_key (PEM or base64 SPKI)}` + claim, statement `Bandsheet issuer <id>: <domain> <selector>`; council only | same, `source: "supplied"` (show as "supplied, not DNS") |
| `GET /api/units/:id` | | `{contract, unit, policy, proposals, releases, latest_bands, counts, explorer}` |
| `GET /api/units?account_id=` **(+)** | | `{units: [...]}` |
| `GET /api/units/policy` **(+)** | | `get_policy` |
| `POST /api/stand` | demo body + optional `unit_id` | as today; bands read from that unit |
