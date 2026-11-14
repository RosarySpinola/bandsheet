import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { Signer } from "../chain/port";
import { REPO_ROOT } from "../env";

const KeyFile = z.object({ account_id: z.string().min(2), private_key: z.string().startsWith("ed25519:") });
const Deployed = z.object({ owner: z.string() });

/**
 * The committee (owner) signer that registers member keys and relays NEAR Auth `sign` calls.
 * Production hosts set OWNER_KEY_JSON ({account_id, private_key}); a dev machine falls back to
 * keys/owner/<owner>.json (gitignored). Testnet only: the RPCs used are testnet-only.
 */
export function loadOwnerSigner(env: NodeJS.ProcessEnv = process.env): Signer | undefined {
  if (env.OWNER_KEY_JSON) {
    const k = KeyFile.parse(JSON.parse(env.OWNER_KEY_JSON));
    return { accountId: k.account_id, privateKey: k.private_key };
  }
  const deployed = resolve(REPO_ROOT, "scripts/deployed.json");
  if (!existsSync(deployed)) return undefined;
  const owner = Deployed.safeParse(JSON.parse(readFileSync(deployed, "utf8"))).data?.owner;
  const p = owner ? resolve(REPO_ROOT, "keys/owner", `${owner}.json`) : undefined;
  if (!p || !existsSync(p)) return undefined;
  const k = KeyFile.parse(JSON.parse(readFileSync(p, "utf8")));
  return { accountId: k.account_id, privateKey: k.private_key };
}
