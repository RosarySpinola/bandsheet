// Pushes the Pages secrets from local gitignored files. Values go to wrangler's stdin only; never printed.
// Usage: node deploy/put-secrets.mjs   (CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID must be in the environment)
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const project = process.env.PAGES_PROJECT || "bandsheet";
const json = (p) => JSON.parse(readFileSync(resolve(root, p), "utf8"));

const deployed = json("scripts/deployed.json");
const council = Object.fromEntries(deployed.council.map((id) => [id, json(`keys/${id}.json`).private_key]));
const envLocal = readFileSync(resolve(root, ".env.local"), "utf8");
const key = /^NEARAI_API_KEY=(.*)$/m.exec(envLocal)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!key) throw new Error("NEARAI_API_KEY missing from .env.local");

const secrets = {
  NEARAI_API_KEY: key,
  COUNCIL_KEYS_JSON: JSON.stringify(council),
  DEMO_INVITE_JSON: JSON.stringify(json("keys/invites/demo-member.json")),
  // Registrar key: a function-call key on the committee account limited to add_members / revoke_member.
  OWNER_KEY_JSON: (({ account_id, private_key }) => JSON.stringify({ account_id, private_key }))(json("keys/registrar.json")),
  // Units: the registrar key is a function-call key limited to unit_add_member / unit_remove_member / unit_add_issuer;
  // the sponsor is a low-value account that gives new wallets 0.05 testnet NEAR for gas.
  UNITS_REGISTRAR_KEY_JSON: (({ account_id, private_key }) => JSON.stringify({ account_id, private_key }))(json("keys/units-registrar.json")),
  SPONSOR_KEY_JSON: (({ account_id, private_key }) => JSON.stringify({ account_id, private_key }))(
    json(`keys/${process.env.UNITS_SPONSOR || "bsu-sponsor-2d3f96.testnet"}.json`),
  ),
};
for (const [name, value] of Object.entries(secrets)) {
  const r = spawnSync("wrangler", ["pages", "secret", "put", name, "--project-name", project], { input: value, encoding: "utf8" });
  process.stdout.write(`${name}: ${r.status === 0 ? "set" : "FAILED (exit " + r.status + ")"}\n`);
  if (r.status !== 0) process.exitCode = 1;
}
