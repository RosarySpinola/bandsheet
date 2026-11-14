import { slotIdFromNearPublicKey } from "@bandsheet/core";
import { assertFunded } from "../chain/dao";
import type { ChainConfig } from "../chain/config";
import type { ChainPort, SentTx, Signer } from "../chain/port";
import { AppError } from "../errors";

const MEMBER_TGAS = 60;

const refused = (tx: SentTx): AppError =>
  new AppError(422, tx.error ? `the chain refused: ${tx.error}` : "the chain refused the transaction", "CHAIN_REJECTED");

/** Slot for an ed25519 member key, or a 400 for anything else. */
export function memberSlot(publicKey: string): string {
  try {
    return slotIdFromNearPublicKey(publicKey);
  } catch {
    throw new AppError(400, "the member key must be an ed25519 public key", "BAD_MEMBER_KEY");
  }
}

/**
 * Committee path, as in scripts/members.ts: the owner calls add_members([key]) on the unit, which adds a
 * function-call key limited to `submit`. Guards: the owner holds gas, the key is ed25519 and not already a member.
 */
export async function addMemberKey(chain: ChainPort, cfg: ChainConfig, owner: Signer, publicKey: string): Promise<SentTx> {
  const slot = memberSlot(publicKey);
  await assertFunded(chain, owner.accountId);
  const already = await chain.view<boolean>(cfg.unit, "is_member", { slot }).catch(() => {
    throw new AppError(502, "could not read the member list from NEAR testnet", "CHAIN_READ");
  });
  if (already) throw new AppError(409, "that member key is already registered", "ALREADY_MEMBER");
  const tx = await chain.send(owner, cfg.unit, "add_members", { public_keys: [publicKey] }, { tgas: MEMBER_TGAS });
  if (!tx.ok) throw refused(tx);
  return tx;
}

/** Revoke a member key (the contract drops that slot's entry too). A key that is already gone is not an error. */
export async function revokeMemberKey(chain: ChainPort, cfg: ChainConfig, owner: Signer, publicKey: string): Promise<SentTx | null> {
  const still = await chain.view<boolean>(cfg.unit, "is_member", { slot: memberSlot(publicKey) }).catch(() => true);
  if (!still) return null;
  const tx = await chain.send(owner, cfg.unit, "revoke_member", { public_key: publicKey }, { tgas: MEMBER_TGAS });
  if (!tx.ok && !/not a member/i.test(tx.error)) throw refused(tx);
  return tx.ok ? tx : null;
}
