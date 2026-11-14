import type { Config } from "./env";
import type { ChatRequest, VerifiedChat } from "./nearai/client";
import type { SpendGuard } from "./spend";

export type ChatFn = (req: ChatRequest) => Promise<VerifiedChat>;
export type ViewFn = (contractId: string, method: string, args: Record<string, unknown>) => Promise<unknown>;

/** Everything the routes need, injectable so tests never touch the network. */
export interface Deps {
  config: Config;
  chat: ChatFn;
  view: ViewFn;
  guard: SpendGuard;
}
