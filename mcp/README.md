# bandsheet-mcp

An MCP server that lets an AI assistant read and check **Bandsheet**, the union pay-band box: released pay bands,
the cells that were withheld and why, on-chain release records, and public Eurostat wage context.
Read-only: it never writes to the chain.

It reads either the **example chapel** (the default) or **your own unit** on the units contract
(`bandsheet-units-2d3f96.testnet`), chosen per call with `unit_id`.

What is synthetic: all of the example chapel's data (a fictional newsroom, the Harbour Courier), and, in your own unit,
any synthetic colleagues the council added. Those entries are flagged synthetic on chain, and `get_bands`, `list_releases` and
`verify_release` label any release that includes them (`SYNTHETIC: n of m entries … are synthetic colleagues (sample data)`). Your unit's
other entries are its members' own payslips, counted as DKIM-verified or self-attested.

It talks to the deployed API, `https://bandsheet.pages.dev/api`. Set `BANDSHEET_API` to point it elsewhere
(for example `http://localhost:8788/api` while developing).

## Tools

| Tool | Input | What you get |
|---|---|---|
| `get_bands` | optional `unit_id` | Latest released bands per cell (mean gross annual EUR, n), plus the cells withheld in the newest release with their witnesses. |
| `list_releases` | optional `unit_id` | Every release logged on NEAR testnet: status, released and withheld counts, time. |
| `explain_refusal` | `release_id`, `cell`, optional `unit_id` | The witness equation for a withheld cell and a plain-words reason. `cell` can be `Senior` or `grade=Senior`. |
| `verify_release` | `release_id`, optional `unit_id` | PASS/FAIL/SKIP list: enclave input hash vs the contract's, output hash logged, no cell with n below the policy minimum, witnesses present, requested by the DAO and a matching approved DAO vote (for a unit: its council and in-contract vote), and OutLayer attestation hashes when the record carries them (otherwise SKIP, never a silent pass). |
| `try_subtraction` | `release_a`, `release_b`, `cell`, optional `unit_id` | What a typical n>=3 tool would expose by subtracting the two releases (computed on the synthetic seed chapel, checked against the chain's release A) versus what Bandsheet published. |
| `pay_context` | `country` (MT, GR, DE, FR, IE), optional `isco` | Eurostat Structure of Earnings Survey median gross monthly earnings for ISCO-08 Professionals (OC2), with year, source and snapshot hash. The latest survey year is 2018 for this series, and the output says so. |

Every tool except `pay_context` also takes an optional **`unit_id`** (a whole number, 1 or more): the unit to read on the
units contract, the number in its link (`https://bandsheet.pages.dev/u/2`). Leave it out to read the example chapel.
For a unit, `verify_release` checks that a council seat asked for the release and that the unit's in-contract vote passed
(more than half of the council), instead of the chapel's Sputnik DAO vote, and lists the entry kinds. `try_subtraction`
can reproduce the typical tool only on the example chapel's seed data.

```json
{ "name": "verify_release", "arguments": { "release_id": 1, "unit_id": 2 } }
```

Try: "Why did Bandsheet withhold the Senior cell in release 2?", "Verify release 2", "Run the subtraction attack on
Senior between releases 1 and 2", "What do professionals earn in Malta?", "List the releases of unit 2".

## Claude Code

```bash
# from a checkout of this repo (build first):
pnpm --filter bandsheet-mcp build
claude mcp add bandsheet -- node /absolute/path/to/near-bandsheet/mcp/dist/index.js
```

To use a local API: `claude mcp add bandsheet -e BANDSHEET_API=http://localhost:8788/api -- node .../mcp/dist/index.js`.

## Claude Desktop

Add to `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`):

```json
{
  "mcpServers": {
    "bandsheet": {
      "command": "node",
      "args": ["/absolute/path/to/near-bandsheet/mcp/dist/index.js"],
      "env": { "BANDSHEET_API": "https://bandsheet.pages.dev/api" }
    }
  }
}
```

With the package published (or installed from a path) you can use `npx` instead:

```json
{ "mcpServers": { "bandsheet": { "command": "npx", "args": ["-y", "bandsheet-mcp"] } } }
```

`npx /absolute/path/to/near-bandsheet/mcp` also works once `pnpm --filter bandsheet-mcp build` has produced `dist/`
(the package's `prepack` step builds it for `npm pack` and `npm publish`).

## Develop and test

```bash
pnpm --filter bandsheet-mcp test        # unit tests on recorded API responses + a stdio client calling all six tools
pnpm --filter bandsheet-mcp typecheck
pnpm --filter bandsheet-mcp build && pnpm --filter bandsheet-mcp smoke   # all tools over stdio against the real API
```

## Honest limits

- `verify_release` can only compare what the record carries. The current testnet records have an empty `proof`,
  so the OutLayer attestation check reports SKIP.
- `try_subtraction` reproduces the "typical tool" on the synthetic seed data only, and only when that data
  reproduces the chain's release A exactly; otherwise it says it cannot.
- Eurostat figures are survey medians for a past year, not a live market rate.
