import type { AuthDeps } from "./routes/auth";
import type { ChainConfig } from "./chain/config";
import type { ChainPort } from "./chain/port";
import type { Config } from "./env";
import type { ChatRequest, VerifiedChat } from "./nearai/client";
import type { SpendGuard } from "./spend";
import type { UnitsDeps } from "./units/deps";

export type ChatFn = (req: ChatRequest) => Promise<VerifiedChat>;
export type ViewFn = (contractId: string, method: string, args: Record<string, unknown>) => Promise<unknown>;

/** Everything the routes need, injectable so tests never touch the network. */
export interface Deps {
  config: Config;
  chat: ChatFn;
  view: ViewFn;
  guard: SpendGuard;
  chain: ChainPort;
  chainCfg: ChainConfig;
  /** Sign-in (NEAR Auth / NEAR Connect); undefined when the host has no auth store. */
  auth?: AuthDeps;
  /** Start-your-own-unit (contracts/units); undefined when the host has no auth store. */
  units?: UnitsDeps;
}
