/**
 * Single source of truth for every browser storage key used by the app.
 *
 * Never write a storage key as a string literal anywhere else — import it from
 * here instead. `__tests__/storageKeys.test.ts` fails if a literal slips in.
 */
export const STORAGE_KEYS = {
  /** localStorage — registered contracts */
  CONTRACTS: 'txwatch_contracts',
  /** localStorage — alert history for all contracts */
  ALERTS: 'txwatch_alerts',
  /** localStorage — schema version used by migrateStorage */
  STORAGE_VERSION: 'txwatch_storage_version',
  /** localStorage — connected Freighter public key */
  FREIGHTER_PUBLIC_KEY: 'freighter_public_key',
  /** sessionStorage — id of the contract just created, highlighted once on the list page */
  LAST_CREATED_CONTRACT: 'txwatch_last_created_contract',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]
