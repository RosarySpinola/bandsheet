import { isMock } from "./config"
import { chainClient } from "./chain-client"
import { chainWallet } from "./chain-wallet"
import { mockClient, mockWallet } from "./mock-client"
import type { UnitsClient, UnitsWallet } from "./types"

/** The one switch between the live units contract and mock mode (see config.ts). Pages import from here only. */
export const units: UnitsClient = isMock() ? mockClient : chainClient
export const unitsWallet: UnitsWallet = isMock() ? mockWallet : chainWallet

export * from "./types"
export * from "./schemas"
export { isMock, LIMITS, GAS, SPONSOR_AMOUNT_NEAR, SPONSOR_THRESHOLD_NEAR } from "./config"
