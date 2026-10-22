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
  notes?: string;
  [key: string]: unknown;
}

const MAX_NOTES_LENGTH = 1000;

function normalizeNotes(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_NOTES_LENGTH);
}

function normalizeContract(contract: StoredContractExport): StoredContractExport {
  const normalized: StoredContractExport = { ...contract };
  const notes = normalizeNotes(contract.notes);
  if (notes === undefined) {
    delete normalized.notes;
  } else {
    normalized.notes = notes;
  }
  return normalized;
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
  storageKey = 'txwatch:contracts',
): ContractExportSnapshot {
  const contracts = readContractsFromStorage(storageKey).map(normalizeContract);
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

  const snapshot = parsed as ContractExportSnapshot;
  return {
    ...snapshot,
    contracts: snapshot.contracts.map(normalizeContract),
  };
}
