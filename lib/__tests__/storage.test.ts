import {
  saveContract,
  deleteContract,
  getContracts,
  saveAlert,
  getAlerts,
  deleteAlert,
  getSettings,
  saveSettings,
  normalizeAlert,
} from '../storage';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem:   (key: string) => store[key] ?? null,
    setItem:   (key: string, value: string) => { store[key] = value; },
    removeItem:(key: string) => { delete store[key]; },
    clear:     () => { store = {}; },
  };
})();

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

describe('settings persistence', () => {
  it('defaults the explorer to Stellar Expert when nothing is saved', () => {
    expect(getSettings().explorer).toBe('stellar-expert');
  });

  it('saves and reloads a chosen explorer', () => {
    saveSettings({ explorer: 'stellar-chain' });
    expect(getSettings().explorer).toBe('stellar-chain');
  });

  it('falls back to Stellar Expert for an unknown explorer id', () => {
    saveSettings({ explorer: 'not-a-real-explorer' });
    expect(getSettings().explorer).toBe('stellar-expert');
  });
});

describe('LargeTransfer threshold_xlm migration', () => {
  it('normalizes a legacy threshold_xlm rule to the token threshold shape', () => {
    const legacy = {
      id: 'a4',
      contractId: 'c1',
      type: 'large_transfer',
      threshold_xlm: 250,
    };
    const normalized = normalizeAlert(legacy);
    expect(normalized.threshold).toBe(250);
    expect(normalized.asset).toBeUndefined();
    expect(normalized.threshold_xlm).toBeUndefined();
  });

  it('leaves token-denominated rules untouched', () => {
    const tokenRule = {
      id: 'a5',
      contractId: 'c1',
      type: 'large_transfer',
      asset: 'CUSDC...SAC',
      threshold: 1000,
    };
    const normalized = normalizeAlert(tokenRule);
    expect(normalized.asset).toBe('CUSDC...SAC');
    expect(normalized.threshold).toBe(1000);
  });

  it('migrates legacy rules when loading alerts from storage', () => {
    localStorageMock.setItem(
      'txwatch_alerts',
      JSON.stringify([
        { id: 'a6', contractId: 'c1', type: 'large_transfer', threshold_xlm: 42 },
      ]),
    );
    const alerts = getAlerts('c1');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].threshold).toBe(42);
    expect(alerts[0].threshold_xlm).toBeUndefined();
  });
});
