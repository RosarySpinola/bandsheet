// Shared constants for the units scripts (contracts/units). TESTNET ONLY.
import { join } from "node:path";
import { ROOT } from "./lib";

export const SFX = "2d3f96";
export const UNITS = `bandsheet-units-${SFX}.testnet`;
export const REGISTRAR = `bsu-registrar-${SFX}.testnet`;
export const SPONSOR = `bsu-sponsor-${SFX}.testnet`;
export const WALLET = `bsu-wallet-${SFX}.testnet`;
export const WALLET2 = `bsu-wallet2-${SFX}.testnet`;
export const STATE = join(ROOT, "scripts/units-deployed.json");

export const PROJECT = "bandsheet-enclave.testnet/bandsheet-enclave";
export const ENGINE_SHA = "69d5616cacc61ce82d3b412ffaf76399f8bbfb6bbd853f604283316ce4643b26";
export const SECRETS_REF = { profile: "default", account_id: "bandsheet-enclave.testnet" };
/** The OutLayer source with the build pinned (version_key = the engine sha256), or unpinned as on the demo. */
export const source = (pin: boolean) => ({ Project: { project_id: PROJECT, version_key: pin ? ENGINE_SHA : null } });
