import type { WatchedContract } from '@/types'

/** The snapshot file format version. Increment when the schema changes. */
const SNAPSHOT_VERSION = 1 as const

/**
 * The localStorage key used by storage.ts.
 * Must stay in sync with CONTRACTS_KEY in lib/storage.ts.
 */
const CONTRACTS_STORAGE_KEY = 'txwatch_contracts'

export interface ContractExportSnapshot {
  version: typeof SNAPSHOT_VERSION
  exportedAt: string
  count: number
  contracts: WatchedContract[]
}

function readContractsFromStorage(storageKey: string): WatchedContract[] {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    return JSON.parse(raw) as WatchedContract[]
  } catch {
    console.warn(`[exportStorage] Could not read key "${storageKey}" from localStorage`)
    return []
  }
}

export function buildContractSnapshot(
  storageKey = CONTRACTS_STORAGE_KEY,
): ContractExportSnapshot {
  const contracts = readContractsFromStorage(storageKey)
  return {
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    count: contracts.length,
    contracts,
  }
}

export function exportContractsAsJson(storageKey?: string): string {
  return JSON.stringify(buildContractSnapshot(storageKey), null, 2)
}

export function exportContractsAsBlob(storageKey?: string): Blob {
  return new Blob([exportContractsAsJson(storageKey)], { type: 'application/json' })
}

/**
 * Validates and parses a JSON string that was previously exported via
 * `exportContractsAsJson`. Throws a descriptive error on invalid input.
 */
export function parseContractSnapshot(json: string): ContractExportSnapshot {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Invalid JSON: cannot parse contract snapshot')
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as ContractExportSnapshot).version !== SNAPSHOT_VERSION ||
    !Array.isArray((parsed as ContractExportSnapshot).contracts)
  ) {
    throw new Error(
      'Invalid snapshot format: expected { version: 1, contracts: [...] }',
    )
  }

  return parsed as ContractExportSnapshot
}

/**
 * Validates that each contract in a snapshot has the minimum required fields.
 * Returns an array of error strings (empty = valid).
 */
export function validateSnapshotContracts(snapshot: ContractExportSnapshot): string[] {
  const errors: string[] = []
  const requiredKeys: (keyof WatchedContract)[] = [
    'id',
    'label',
    'contract_id',
    'network',
    'rules',
    'webhook_url',
  ]

  snapshot.contracts.forEach((contract, index) => {
    for (const key of requiredKeys) {
      if (!(key in contract) || contract[key] === undefined || contract[key] === null) {
        errors.push(`Contract at index ${index} is missing required field: "${key}"`)
      }
    }
    // Validate network value
    const validNetworks = ['mainnet', 'testnet', 'futurenet']
    if (contract.network && !validNetworks.includes(contract.network)) {
      errors.push(`Contract at index ${index} has unknown network: "${contract.network}"`)
    }
  })

  return errors
}

/**
 * Restore a snapshot by writing all contracts back to localStorage.
 * Overwrites any existing contracts data.
 */
export function restoreContractSnapshot(
  snapshot: ContractExportSnapshot,
  storageKey = CONTRACTS_STORAGE_KEY,
): void {
  localStorage.setItem(storageKey, JSON.stringify(snapshot.contracts))
}
