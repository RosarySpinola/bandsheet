/** Entry-encryption constants. Keep in sync with enclave (see CRYPTO.md). */
export const CRYPTO_INFO = "bandsheet-entry-v1";
/** HKDF salt: empty (RFC 5869 treats an absent salt as HashLen zero bytes). */
export const CRYPTO_SALT = new Uint8Array(0);
export const KEY_LEN = 32;
export const NONCE_LEN = 12;
export const X25519_KEY_LEN = 32;

export const GRADES = ["Junior", "Reporter", "Senior", "Editor", "Chief"] as const;
export const GENDERS = ["F", "M", "X"] as const;
export const SITES = ["City", "Port"] as const;
export const GROUP_FIELDS = ["grade", "gender", "site"] as const;

/** Policy minimum cell size used by the naive tool and the default enclave policy. */
export const DEFAULT_K = 3;
