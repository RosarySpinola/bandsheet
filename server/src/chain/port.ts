import { Account, type KeyPairString, type Provider, actions, teraToGas } from "near-api-js";
import { makeProvider } from "@bandsheet/core/near";

export interface Signer {
  accountId: string;
  privateKey: string;
}

export interface SentTx {
  hash: string;
  ok: boolean;
  /** Contract-side panic message when ok is false (short, intentional text). */
  error: string;
  value: unknown;
}

export interface SendOptions {
  tgas: number;
  depositYocto?: bigint;
}

/** Everything the server needs from NEAR, so tests can supply a mocked chain. */
export interface ChainPort {
  view<T = unknown>(contractId: string, method: string, args?: Record<string, unknown>): Promise<T>;
  send(signer: Signer, receiverId: string, method: string, args: object, opts: SendOptions): Promise<SentTx>;
  balanceNear(accountId: string): Promise<number>;
}

export function decodeValue(status: unknown): unknown {
  const v = (status as { SuccessValue?: string } | undefined)?.SuccessValue;
  if (v === undefined) return undefined;
  const text = Buffer.from(v, "base64").toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function failureText(status: unknown): string {
  const f = (status as { Failure?: unknown } | undefined)?.Failure;
  if (!f) return "";
  const j = JSON.stringify(f);
  const m = /Smart contract panicked: ([^"\\]*)/.exec(j) ?? /"ExecutionError":"([^"]*)"/.exec(j);
  return (m ? m[1]! : "transaction failed").slice(0, 240);
}

/** Real implementation over near-api-js with RPC failover/backoff. Sends from one key are serialised. */
export function createChainPort(rpcUrls?: readonly string[], waitUntil: "EXECUTED" | "FINAL" = "EXECUTED"): ChainPort {
  const provider: Provider = makeProvider(rpcUrls);
  const accounts = new Map<string, Account>();
  const queues = new Map<string, Promise<unknown>>();
  const balances = new Map<string, { at: number; v: number }>();

  const accountFor = (s: Signer): Account => {
    const k = `${s.accountId}:${s.privateKey.slice(-12)}`;
    let a = accounts.get(k);
    if (!a) accounts.set(k, (a = new Account(s.accountId, provider, s.privateKey as KeyPairString)));
    return a;
  };

  return {
    async view<T>(contractId: string, method: string, args: Record<string, unknown> = {}) {
      return (await provider.callFunction({ contractId, method, args })) as T;
    },
    send(signer, receiverId, method, args, opts) {
      const account = accountFor(signer);
      const run = async (): Promise<SentTx> => {
        const res = await account.signAndSendTransaction({
          receiverId,
          actions: [actions.functionCall(method, args, teraToGas(opts.tgas), opts.depositYocto ?? 0n)],
          waitUntil,
          throwOnFailure: false,
        });
        const outcomes = [res.transaction_outcome, ...(res.receipts_outcome ?? [])];
        const failed = outcomes.map((o) => failureText(o.outcome.status)).find(Boolean) ?? failureText(res.status);
        return { hash: res.transaction.hash as string, ok: !failed, error: failed, value: decodeValue(res.status) };
      };
      const q = queues.get(signer.accountId) ?? Promise.resolve();
      const next = q.then(run, run);
      queues.set(signer.accountId, next.catch(() => undefined));
      return next;
    },
    async balanceNear(accountId) {
      const hit = balances.get(accountId);
      if (hit && Date.now() - hit.at < 20_000) return hit.v;
      const st = await provider.viewAccount({ accountId });
      const v = Number(st.amount / 10n ** 21n) / 1000;
      balances.set(accountId, { at: Date.now(), v });
      return v;
    },
  };
}
