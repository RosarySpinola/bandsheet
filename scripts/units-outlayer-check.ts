// OutLayer check for the units contract: is the project's protected secret (PROTECTED_ENCLAVE_SEED, hence the X25519
// enclave key) bound to the CALLER, or to the project build? Calls request_execution {"op":"pubkey"} from an account
// that is not the project owner, with the same project, secrets_ref and (optionally) the pinned build, and compares
// the enclave public key with the one the demo chapel's policy pins. TESTNET ONLY.
// Usage: scripts/run.sh units-outlayer-check.ts <caller.testnet> [--pin]
import { actions, teraToGas } from "near-api-js";
import { account, near, say, sendActions, step, view } from "./lib";
import { SECRETS_REF, source } from "./units-lib";

const caller = process.argv[2];
const pin = process.argv.includes("--pin");
if (!caller?.endsWith(".testnet")) throw new Error("usage: units-outlayer-check.ts <caller.testnet> [--pin]");
const demo = await view<{ policy: { enclave_pubkey: string } }>("bandsheet-3f36b7.testnet", "get_policy");
const args = {
  source: source(pin),
  resource_limits: { max_instructions: 2_000_000_000, max_memory_mb: 128, max_execution_seconds: 60 },
  input_data: JSON.stringify({ op: "pubkey" }),
  secrets_ref: SECRETS_REF,
  response_format: "Json",
  payer_account_id: null,
  params: null,
};
const s = await sendActions(account(caller), "outlayer.testnet", [actions.functionCall("request_execution", args, teraToGas(200), near(0.05))]);
step(`request_execution {"op":"pubkey"} from ${caller} (version_key ${pin ? "pinned to the engine sha256" : "null"})`, s);
const out = s.value as { pubkey_b64?: string; key_source?: string; engine?: string } | undefined;
say(`enclave key ${out?.pubkey_b64 ?? "none"} (${out?.key_source ?? "?"}, ${out?.engine ?? "?"})`);
say(`demo policy  ${demo.policy.enclave_pubkey}`);
say(out?.pubkey_b64 === demo.policy.enclave_pubkey ? "SAME KEY: the secret is bound to the project build, not the caller" : "DIFFERENT KEY: stop");
