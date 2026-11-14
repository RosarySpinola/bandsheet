// DEV PROXY for the mock OutLayer only: run the real enclave binary (enclave/target/release/bandsheet-enclave,
// the same code OutLayer runs, here outside a TEE with the MOCK key in keys/enclave-mock.json) on the exact
// entries and history currently on chain, and queue its real output in the mock. The real demo uses
// outlayer.testnet and never touches this file.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { callTx, account, KEYS, loadState, say, view } from "./lib";
import type { Query } from "./dao";

const BIN = `${KEYS}/../enclave/target/release/bandsheet-enclave`;

export async function queueRealOutput(query: Query): Promise<void> {
  const st = loadState();
  if (!st.mockOutlayer) return;
  const pol = await view<{ policy: { k: number }; releases: number; outlayer: { account: string } }>(st.unit, "get_policy");
  if (pol.outlayer.account !== st.mockOutlayer) return; // real OutLayer is configured: nothing to proxy
  const entries: unknown[] = [];
  for (let from = 0; ; from += 50) {
    const page = await view<string[]>(st.unit, "get_entries", { from, limit: 50 });
    entries.push(...page.map((e) => JSON.parse(e)));
    if (page.length < 50) break;
  }
  const history = await view<string | null>(st.unit, "get_history");
  const input = { policy: { k: pol.policy.k }, query: { stat: "mean", ...query, id: pol.releases + 1 }, entries, history: history ? JSON.parse(history) : null };
  const key = JSON.parse(readFileSync(`${KEYS}/enclave-mock.json`, "utf8")) as { secret_key: string };
  const r = spawnSync(BIN, { input: JSON.stringify(input), env: { ENCLAVE_X25519_SK: Buffer.from(key.secret_key, "base64").toString("hex") }, encoding: "utf8", maxBuffer: 1 << 24 });
  if (r.status !== 0 && !r.stdout) throw new Error(`local enclave failed: ${r.stderr.slice(0, 200)}`);
  const out = JSON.parse(r.stdout);
  if (out.error) throw new Error(`local enclave refused the input: ${out.error} ${out.code ?? ""}`);
  const sent = await callTx(account(st.mockOutlayer), st.mockOutlayer, "push_response", { response: JSON.stringify(out) }, 30);
  say(`queued the real enclave output (status ${out.status}) in the mock OutLayer: ${sent.link}`);
}
