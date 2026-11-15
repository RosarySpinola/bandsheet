import { Account, type KeyPairString, type Provider, actions, teraToGas } from "near-api-js";
import { makeProvider } from "@bandsheet/core/near";
import { type SentTx, type Signer, decodeValue, failureText } from "../chain/port";

export interface UnitCall {
  method: string;
  args: object;
  tgas: number;
}

/** What the units routes need from NEAR; injectable so tests never touch the network. */
export interface UnitsChain {
  view<T = unknown>(method: string, args?: Record<string, unknown>): Promise<T>;
  /** One transaction to the units contract with one or more function calls, signed by `signer`. */
  call(signer: Signer, calls: UnitCall[]): Promise<SentTx>;
  /** A posting key on the units account submits a ciphertext (signer = receiver = the units contract). */
  submitAs(postingKey: string, ciphertext: object): Promise<SentTx>;
  transfer(signer: Signer, receiverId: string, yocto: bigint): Promise<SentTx>;
  /** Account balance in yoctoNEAR, or null when the account does not exist. */
  balance(accountId: string): Promise<bigint | null>;
}

type Res = Awaited<ReturnType<Account["signAndSendTransaction"]>>;
const outcome = (res: Res): SentTx => {
  const outcomes = [res.transaction_outcome, ...(res.receipts_outcome ?? [])];
  const failed = outcomes.map((o) => failureText(o.outcome.status)).find(Boolean) ?? failureText(res.status);
  return { hash: res.transaction.hash as string, ok: !failed, error: failed, value: decodeValue(res.status) };
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createUnitsChain(contract: string, rpcUrls?: readonly string[]): UnitsChain {
  const provider: Provider = makeProvider(rpcUrls);
  const queues = new Map<string, Promise<unknown>>();
  /** Sends from one key are serialised (access-key nonces). */
  const serial = <T>(key: string, run: () => Promise<T>): Promise<T> => {
    const next = (queues.get(key) ?? Promise.resolve()).then(run, run);
    queues.set(key, next.catch(() => undefined));
    return next;
  };
  const send = (accountId: string, privateKey: string, receiverId: string, acts: ReturnType<typeof actions.functionCall>[]) =>
    serial(`${accountId}:${privateKey.slice(-10)}`, async () => {
      const account = new Account(accountId, provider, privateKey as KeyPairString);
      return outcome(await account.signAndSendTransaction({ receiverId, actions: acts, waitUntil: "EXECUTED", throwOnFailure: false }));
    });
  return {
    async view<T>(method: string, args: Record<string, unknown> = {}) {
      return (await provider.callFunction({ contractId: contract, method, args })) as T;
    },
    call(signer, calls) {
      return send(signer.accountId, signer.privateKey, contract, calls.map((c) => actions.functionCall(c.method, c.args, teraToGas(c.tgas), 0n)));
    },
    async submitAs(postingKey, ciphertext) {
      // a key added a moment ago may not be visible on every RPC yet: retry a few times on a missing access key
      for (let i = 0; ; i++) {
        try {
          return await send(contract, postingKey, contract, [actions.functionCall("submit", { ciphertext }, teraToGas(30), 0n)]);
        } catch (e) {
          if (i >= 4 || !/access key|AccessKeyDoesNotExist|does not exist/i.test(String(e))) throw e;
          await sleep(1500 * (i + 1));
        }
      }
    },
    transfer(signer, receiverId, yocto) {
      return send(signer.accountId, signer.privateKey, receiverId, [actions.transfer(yocto) as ReturnType<typeof actions.functionCall>]);
    },
    async balance(accountId) {
      try {
        return (await provider.viewAccount({ accountId })).amount;
      } catch (e) {
        if (/UNKNOWN_ACCOUNT|does not exist/i.test(String(e))) return null;
        throw e;
      }
    },
  };
}
