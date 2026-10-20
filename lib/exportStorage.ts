import { STORAGE_KEYS } from '@/lib/storageKeys';

export interface ContractExportSnapshot {
  version: 1;
  exportedAt: string;
  count: number;
  contracts: StoredContractExport[];
}

export interface StoredContractExport {
  id: string;
  address: string;
  label: string;
  network: string;
  [key: string]: unknown;
}

function readContractsFromStorage(storageKey: string): StoredContractExport[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    return JSON.parse(raw) as StoredContractExport[];
  } catch {
    console.warn(`[exportStorage] Could not read key "${storageKey}" from localStorage`);
    return [];
  }
}

export function buildContractSnapshot(
  storageKey: string = STORAGE_KEYS.CONTRACTS,
): ContractExportSnapshot {
  const contracts = readContractsFromStorage(storageKey);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    count: contracts.length,
    contracts,
  };
}

export function exportContractsAsJson(storageKey?: string): string {
  return JSON.stringify(buildContractSnapshot(storageKey), null, 2);
}

export function exportContractsAsBlob(storageKey?: string): Blob {
  return new Blob([exportContractsAsJson(storageKey)], { type: 'application/json' });
}

export function parseContractSnapshot(json: string): ContractExportSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON: cannot parse contract snapshot');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as ContractExportSnapshot).version !== 1 ||
    !Array.isArray((parsed as ContractExportSnapshot).contracts)
  ) {
    throw new Error(
      'Invalid snapshot format: expected { version: 1, contracts: [...] }',
    );
  }

  return parsed as ContractExportSnapshot;
}
