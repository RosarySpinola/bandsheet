# Bandsheet deployment (Cloudflare Pages)

**URL:** https://bandsheet.pages.dev (Pages project `bandsheet`, production branch `main`; no custom domain).
Static SPA from `web/dist`; the Hono API runs as a Pages Function on the same origin (`web/functions/api/[[path]].ts`
-> `server/src/worker.ts`), so the browser calls `/api/*` with no CORS or proxy.

## Redeploy

```
~/.claude/vault/inject.sh get CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID --dir <repo>/deploy   # once; .env.local is gitignored
deploy/deploy.sh                       # build web, deploy to Pages
deploy/deploy.sh --secrets --migrate   # also re-push secrets / apply D1 migrations
```

`deploy.sh` runs `pnpm --filter web build` then `wrangler pages deploy dist` from `web/` (Pages needs
`wrangler.toml` and `functions/` in the project root, so the config lives at `web/wrangler.toml`).

## Bindings (`web/wrangler.toml`)

| Name | Kind | Value |
|---|---|---|
| `DB` | D1 | database `bandsheet-spend` (id `4f812a9f-1645-421e-b281-e65fff1d8640`) |
| `BANDSHEET_CONTRACT` | var | `bandsheet-3f36b7.testnet` |
| `BANDSHEET_DAO` | var | `harbour-chapel.sputnik-v2.testnet` |
| `BANDSHEET_COUNCIL` | var | `bs-c1-3f36b7.testnet,bs-c2-3f36b7.testnet,bs-c3-3f36b7.testnet` |
| compat | flags | `nodejs_compat`, date `2026-10-01` |

Secrets (names only; set with `wrangler pages secret put`, via `deploy/put-secrets.mjs`):
`NEARAI_API_KEY`, `COUNCIL_KEYS_JSON` (`{account_id: ed25519 key}` for the 3 council seats), `DEMO_INVITE_JSON`
(`keys/invites/demo-member.json`). Optional: `NEAR_RPC_URLS`, `CORS_ORIGIN`.

## Spend ledger (D1)

`deploy/migrations/0001_spend_ledger.sql`:

```sql
CREATE TABLE spend_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, model TEXT NOT NULL, kind TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0, completion_tokens INTEGER NOT NULL DEFAULT 0, cost_usd REAL NOT NULL DEFAULT 0);
```

`server/src/spend-d1.ts` is the D1 store behind `SpendGuard` (`LedgerStore` in `spend.ts`); the Node file ledger is
still used locally and in tests. The guard reads SUM(cost_usd) before every call and refuses at USD 2.50; an
unreadable ledger fails closed. The 13 rows from the local `server/.spend.json` were seeded with `kind = "seed:<kind>"`
so the cap is shared. State after the one live call: 20 rows, USD 0.00214 of 2.50. Note: each isolate holds its own
in-flight total, so two simultaneous requests on different isolates could each pass the check (bounded by one
request's projection, about USD 0.01).

## Measured on the deployed preview (one live extract, `payslip-senior-monthly.png`)

| What | Result |
|---|---|
| POST /api/extract | 200, 6.0 s wall (client), all 16 attestation/signature checks pass, 70000 EUR / Senior |
| Worker CPU (wrangler tail, includes cold isolate init) | 783 ms |
| Worker wall (tail) | 5.6 s |
| DCAP verification, 2 TDX quotes (gateway + model), wall incl. collateral fetch | 337 ms (`Server-Timing: dcap` header) |
| GET /api/health (cold / warm) | 43 ms / 2 ms CPU |

DCAP is far inside limits, so no per-signer quote cache was added. The account is on a paid Workers plan (30 s CPU
default); on the free plan's 10 ms CPU cap an extract would not fit. The extract response carries `Server-Timing`
so timing can be re-read in the browser. To tail: `wrangler pages deployment tail <deployment-id> --project-name bandsheet --format json`
(the tail takes up to a minute to attach; its events include `cpuTime`).

## Notes

- `NearAiClient` stored bare `fetch` and called it as `this.f()`, which throws "Illegal invocation" on Workers; it now wraps it.
- `app.ts` logs unexpected errors with `console.error` (type and message only) so `wrangler tail` shows them; responses stay `{error, code}`.
- Propose, vote and demo submit write to testnet and were not exercised on the deployed URL.
