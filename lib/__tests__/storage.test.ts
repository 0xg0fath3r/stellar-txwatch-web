import { vi } from 'vitest';
import {
  saveContract,
  deleteContract,
  getContracts,
  getContract,
  saveAlert,
  addAlert,
  getAlerts,
  deleteAlert,
  deleteAlerts,
  deleteAlertsByContractId,
  migrateStorage,
  getNetworkDistribution,
} from '../storage';
import { WatchedContract, AlertPayload, Network } from '@/types';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem:   (key: string) => store[key] ?? null,
    setItem:   (key: string, value: string) => { store[key] = value; },
    removeItem:(key: string) => { delete store[key]; },
    clear:     () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key:       (i: number) => Object.keys(store)[i] ?? null,
  };
})();

const CONTRACTS_KEY = 'txwatch_contracts';
const ALERTS_KEY = 'txwatch_alerts';
const VERSION_KEY = 'txwatch_storage_version';

function makeContract(overrides: Partial<WatchedContract> = {}): WatchedContract {
  return {
    id: 'c1',
    label: 'Test Contract',
    contract_id: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7',
    network: 'testnet',
    rules: [],
    webhook_url: '',
    created_at: 1000,
    updated_at: 1000,
    ...overrides,
  };
}

function makeAlert(overrides: Partial<AlertPayload> = {}): AlertPayload {
  return {
    label: 'Alert',
    contract_id: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7',
    network: 'testnet',
    rule_triggered: 'AnyTransaction',
    transaction_hash: 'tx',
    timestamp: Date.now(),
    horizon_link: 'https://horizon-testnet.stellar.org/transactions/tx',
    ...overrides,
  };
}

function readRaw<T>(key: string): T {
  return JSON.parse(localStorageMock.getItem(key) ?? '[]');
}

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

const contract1 = { id: 'c1', address: 'GABC...001', label: 'Contract Alpha', network: 'mainnet' };
const contract2 = { id: 'c2', address: 'GDEF...002', label: 'Contract Beta',  network: 'testnet' };

const alert1 = { id: 'a1', contractId: 'c1', type: 'transfer', threshold: 100 };
const alert2 = { id: 'a2', contractId: 'c1', type: 'invocation', threshold: 0 };
const alert3 = { id: 'a3', contractId: 'c1', type: 'balance',   threshold: 500 };

beforeEach(() => localStorageMock.clear());

describe('saveContract / getContracts', () => {
  it('saves a contract and retrieves it', () => {
    saveContract(contract1);
    const contracts = getContracts();
    expect(contracts).toHaveLength(1);
    expect(contracts[0].id).toBe('c1');
  });

  it('retrieves multiple saved contracts', () => {
    saveContract(contract1);
    saveContract(contract2);
    expect(getContracts()).toHaveLength(2);
  });

  it('returns empty array when no contracts saved (empty fallback)', () => {
    expect(getContracts()).toEqual([]);
  });
});

describe('deleteContract', () => {
  it('removes the correct contract by id', () => {
    saveContract(contract1);
    saveContract(contract2);
    deleteContract('c1');
    const remaining = getContracts();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('c2');
  });

  it('is a no-op when deleting a non-existent id', () => {
    saveContract(contract1);
    deleteContract('does-not-exist');
    expect(getContracts()).toHaveLength(1);
  });

  it('results in empty array after deleting the only contract', () => {
    saveContract(contract1);
    deleteContract('c1');
    expect(getContracts()).toEqual([]);
  });
});

describe('duplicate contract handling', () => {
  it('does not create a duplicate when saving the same id twice', () => {
    saveContract(contract1);
    saveContract({ ...contract1, label: 'Updated Label' });
    const contracts = getContracts();
    expect(contracts).toHaveLength(1);
  });

  it('updates the existing entry when saving a duplicate id', () => {
    saveContract(contract1);
    saveContract({ ...contract1, label: 'Updated Label' });
    expect(getContracts()[0].label).toBe('Updated Label');
  });
});

describe('saveAlert / getAlerts — insertion order', () => {
  it('returns alerts in insertion order', () => {
    saveAlert(alert1);
    saveAlert(alert2);
    saveAlert(alert3);
    const alerts = getAlerts('c1');
    expect(alerts.map(a => a.id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('returns empty array when no alerts exist for a contract (empty fallback)', () => {
    expect(getAlerts('no-such-contract')).toEqual([]);
  });
});

describe('deleteAlert', () => {
  it('removes only the specified alert', () => {
    saveAlert(alert1);
    saveAlert(alert2);
    deleteAlert('a1');
    const alerts = getAlerts('c1');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe('a2');
  });
});

describe('getContract', () => {
  it('returns the contract matching the id', () => {
    saveContract(makeContract({ id: 'c1', label: 'Alpha' }));
    saveContract(makeContract({ id: 'c2', label: 'Beta' }));
    expect(getContract('c2')?.label).toBe('Beta');
  });

  it('returns undefined for an unknown id', () => {
    saveContract(makeContract({ id: 'c1' }));
    expect(getContract('nope')).toBeUndefined();
  });

  it('returns undefined when storage is empty', () => {
    expect(getContract('c1')).toBeUndefined();
  });
});

describe('saveContract — timestamps', () => {
  it('sets updated_at to the current time on save', () => {
    const before = Date.now();
    saveContract(makeContract({ id: 'c1', updated_at: 0 }));
    const saved = getContract('c1')!;
    expect(saved.updated_at).toBeGreaterThanOrEqual(before);
    expect(saved.updated_at).not.toBe(0);
  });

  it('refreshes updated_at when an existing contract is re-saved', () => {
    saveContract(makeContract({ id: 'c1', updated_at: 1 }));
    const first = getContract('c1')!.updated_at;
    saveContract(makeContract({ id: 'c1', updated_at: first }));
    expect(getContract('c1')!.updated_at).toBeGreaterThanOrEqual(first);
  });
});

describe('deleteContract — cascade to alerts', () => {
  it('deletes alerts associated with the removed contract', () => {
    const contract = makeContract({ id: 'c1', contract_id: 'CONTRACT_1' });
    saveContract(contract);
    addAlert(makeAlert({ contract_id: 'CONTRACT_1' }));
    addAlert(makeAlert({ contract_id: 'CONTRACT_1' }));
    addAlert(makeAlert({ contract_id: 'CONTRACT_2' }));

    deleteContract('c1');

    expect(getContracts()).toHaveLength(0);
    expect(getAlerts('CONTRACT_1')).toHaveLength(0);
    expect(getAlerts('CONTRACT_2')).toHaveLength(1);
  });

  it('does not remove alerts for other contracts', () => {
    saveContract(makeContract({ id: 'c1', contract_id: 'CONTRACT_1' }));
    addAlert(makeAlert({ contract_id: 'CONTRACT_2' }));
    deleteContract('c1');
    expect(getAlerts('CONTRACT_2')).toHaveLength(1);
  });
});

describe('addAlert — per-contract cap', () => {
  it('keeps at most 500 alerts per contract', () => {
    for (let i = 0; i < 505; i++) {
      addAlert(makeAlert({ contract_id: 'CAP', transaction_hash: `tx-${i}` }));
    }
    const alerts = getAlerts('CAP');
    expect(alerts).toHaveLength(500);
    expect(alerts[0].transaction_hash).toBe('tx-0');
    expect(alerts[499].transaction_hash).toBe('tx-499');
  });

  it('applies the cap independently per contract', () => {
    for (let i = 0; i < 500; i++) {
      addAlert(makeAlert({ contract_id: 'A', transaction_hash: `a-${i}` }));
    }
    addAlert(makeAlert({ contract_id: 'B', transaction_hash: 'b-0' }));
    expect(getAlerts('A')).toHaveLength(500);
    expect(getAlerts('B')).toHaveLength(1);
  });
});

describe('deleteAlerts / deleteAlertsByContractId', () => {
  it('deleteAlerts removes only alerts for the given contract', () => {
    addAlert(makeAlert({ contract_id: 'A', transaction_hash: 'a1' }));
    addAlert(makeAlert({ contract_id: 'B', transaction_hash: 'b1' }));
    deleteAlerts('A');
    expect(getAlerts('A')).toHaveLength(0);
    expect(getAlerts('B')).toHaveLength(1);
  });

  it('deleteAlertsByContractId removes only alerts for the given contract', () => {
    addAlert(makeAlert({ contract_id: 'A', transaction_hash: 'a1' }));
    addAlert(makeAlert({ contract_id: 'B', transaction_hash: 'b1' }));
    deleteAlertsByContractId('A');
    expect(getAlerts('A')).toHaveLength(0);
    expect(getAlerts('B')).toHaveLength(1);
  });

  it('is a no-op when no alerts match', () => {
    addAlert(makeAlert({ contract_id: 'A', transaction_hash: 'a1' }));
    deleteAlerts('does-not-exist');
    deleteAlertsByContractId('does-not-exist');
    expect(getAlerts('A')).toHaveLength(1);
  });
});

describe('migrateStorage', () => {
  it('runs migrations from the stored version up to the current version', () => {
    localStorageMock.setItem(VERSION_KEY, '0');
    const calls: number[] = [];
    migrateStorage({ 1: () => calls.push(1) });
    expect(calls).toEqual([1]);
    expect(localStorageMock.getItem(VERSION_KEY)).toBe('1');
  });

  it('runs pending migrations in ascending version order', () => {
    localStorageMock.setItem(VERSION_KEY, '-1');
    const order: number[] = [];
    migrateStorage({
      0: () => order.push(0),
      1: () => order.push(1),
    });
    expect(order).toEqual([0, 1]);
    expect(localStorageMock.getItem(VERSION_KEY)).toBe('1');
  });

  it('does not run migrations when already at the current version', () => {
    localStorageMock.setItem(VERSION_KEY, '1');
    const migration = vi.fn();
    migrateStorage({ 1: migration });
    expect(migration).not.toHaveBeenCalled();
  });

  it('still records the current version when no migration is provided', () => {
    localStorageMock.setItem(VERSION_KEY, '0');
    migrateStorage({});
    expect(localStorageMock.getItem(VERSION_KEY)).toBe('1');
  });
});

describe('getNetworkDistribution', () => {
  it('counts saved contracts per network', () => {
    saveContract(makeContract({ id: 'c1', network: 'mainnet' }));
    saveContract(makeContract({ id: 'c2', network: 'testnet' }));
    saveContract(makeContract({ id: 'c3', network: 'testnet' }));
    expect(getNetworkDistribution()).toEqual({ mainnet: 1, testnet: 2 });
  });

  it('omits networks with no contracts', () => {
    saveContract(makeContract({ id: 'c1', network: 'futurenet' as Network }));
    expect(getNetworkDistribution()).toEqual({ futurenet: 1 });
  });

  it('returns an empty object when there are no contracts', () => {
    expect(getNetworkDistribution()).toEqual({});
  });
});

describe('pruneOldAlerts (via saveContract)', () => {
  it('removes alerts older than the 90-day retention window', () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const old = makeAlert({ transaction_hash: 'old', timestamp: now - 91 * day });
    const recent = makeAlert({ transaction_hash: 'recent', timestamp: now - day });
    localStorageMock.setItem(ALERTS_KEY, JSON.stringify([old, recent]));

    saveContract(makeContract({ id: 'c1' }));

    const alerts = readRaw<AlertPayload>(ALERTS_KEY);
    expect(alerts.map((a) => a.transaction_hash)).toEqual(['recent']);
  });

  it('keeps alerts newer than the retention window', () => {
    const now = Date.now();
    localStorageMock.setItem(
      ALERTS_KEY,
      JSON.stringify([
        makeAlert({ transaction_hash: 'a', timestamp: now - 10 * 24 * 60 * 60 * 1000 }),
        makeAlert({ transaction_hash: 'b', timestamp: now }),
      ])
    );

    saveContract(makeContract({ id: 'c1' }));

    expect(readRaw<AlertPayload>(ALERTS_KEY)).toHaveLength(2);
  });
});

describe('getStorage corruption handling', () => {
  it('falls back to an empty list when stored JSON is invalid', () => {
    localStorageMock.setItem(CONTRACTS_KEY, 'not-json');
    expect(getContracts()).toEqual([]);
  });
});
