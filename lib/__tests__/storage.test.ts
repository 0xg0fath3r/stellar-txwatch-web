import {
  saveContract,
  deleteContract,
  getContracts,
  saveAlert,
  getAlerts,
  deleteAlert,
  addAlert,
  getLastAlertTimes,
} from '../storage';
import {
  onStorageError,
  clearStorageErrorHandlers,
  StorageErrorContext,
} from '../storageLogger';
import { WatchedContract, AlertPayload, Network } from '@/types';

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

function makeContract(id: string, label: string, network: Network): WatchedContract {
  return {
    id,
    label,
    contract_id: `C-${id}`,
    network,
    rules: [],
    webhook_url: '',
    created_at: 0,
    updated_at: 0,
  };
}

function makeAlert(id: string, contractId: string): AlertPayload {
  return {
    id,
    label: `Alert ${id}`,
    contract_id: contractId,
    network: 'mainnet',
    rule_triggered: 'AnyTransaction',
    transaction_hash: `hash-${id}`,
    timestamp: Date.now(),
    horizon_link: `https://horizon.stellar.org/transactions/hash-${id}`,
  };
}

const contract1 = makeContract('c1', 'Contract Alpha', 'mainnet');
const contract2 = makeContract('c2', 'Contract Beta', 'testnet');

const alert1 = makeAlert('a1', 'c1');
const alert2 = makeAlert('a2', 'c1');
const alert3 = makeAlert('a3', 'c1');

beforeEach(() => {
  localStorageMock.clear();
  clearStorageErrorHandlers();
});

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

describe('schema validation of stored entries', () => {
  it('drops contracts that do not match the schema and keeps valid ones', () => {
    localStorage.setItem('txwatch_contracts', JSON.stringify([
      contract1,
      { id: 'broken', label: 'Missing fields' },
      { ...contract2, network: 'devnet' },
      null,
    ]));
    const contracts = getContracts();
    expect(contracts).toHaveLength(1);
    expect(contracts[0].id).toBe('c1');
  });

  it('drops alerts that do not match the schema', () => {
    localStorage.setItem('txwatch_alerts', JSON.stringify([
      alert1,
      { ...alert2, timestamp: 'yesterday' },
      { id: 'a3', contractId: 'c1', type: 'transfer' },
    ]));
    expect(getAlerts('c1').map(a => a.id)).toEqual(['a1']);
  });

  it('drops contracts with malformed alert rules', () => {
    localStorage.setItem('txwatch_contracts', JSON.stringify([
      { ...contract1, rules: [{ type: 'NotARule' }] },
    ]));
    expect(getContracts()).toEqual([]);
  });

  it('reports each invalid entry through storageLogger', () => {
    const received: StorageErrorContext[] = [];
    onStorageError(ctx => received.push(ctx));
    localStorage.setItem('txwatch_contracts', JSON.stringify([
      contract1,
      { id: 'broken' },
      42,
    ]));
    getContracts();
    expect(received).toHaveLength(2);
    expect(received.every(ctx => ctx.key === 'txwatch_contracts')).toBe(true);
  });

  it('returns an empty list and reports when the stored value is not an array', () => {
    const received: StorageErrorContext[] = [];
    onStorageError(ctx => received.push(ctx));
    localStorage.setItem('txwatch_alerts', JSON.stringify({ not: 'an array' }));
    expect(getAlerts('c1')).toEqual([]);
    expect(received).toHaveLength(1);
    expect(received[0].key).toBe('txwatch_alerts');
  });
});

describe('parse error reporting', () => {
  it('returns an empty list for malformed JSON', () => {
    localStorage.setItem('txwatch_contracts', '{not valid json');
    expect(getContracts()).toEqual([]);
  });

  it('triggers registered storage error handlers on malformed JSON', () => {
    const received: StorageErrorContext[] = [];
    onStorageError(ctx => received.push(ctx));
    localStorage.setItem('txwatch_alerts', '[{broken');
    expect(getAlerts('c1')).toEqual([]);
    expect(received).toHaveLength(1);
    expect(received[0].key).toBe('txwatch_alerts');
    expect(received[0].rawValue).toBe('[{broken');
    expect(received[0].error).toBeInstanceOf(SyntaxError);
  });
});

describe('getLastAlertTimes', () => {
  it('returns an empty record when there are no alerts', () => {
    expect(getLastAlertTimes()).toEqual({});
  });

  it('returns the most recent timestamp per contract in one pass', () => {
    addAlert({ ...makeAlert('a1', 'c1'), timestamp: 100 });
    addAlert({ ...makeAlert('a2', 'c1'), timestamp: 300 });
    addAlert({ ...makeAlert('a3', 'c1'), timestamp: 200 });
    addAlert({ ...makeAlert('b1', 'c2'), timestamp: 50 });
    expect(getLastAlertTimes()).toEqual({ c1: 300, c2: 50 });
  });

  it('returns the memoised result while alerts are unchanged', () => {
    addAlert({ ...makeAlert('a1', 'c1'), timestamp: 100 });
    const parseSpy = vi.spyOn(JSON, 'parse');
    const first = getLastAlertTimes();
    const parsesAfterFirst = parseSpy.mock.calls.length;
    const second = getLastAlertTimes();
    expect(second).toBe(first);
    expect(parseSpy.mock.calls.length).toBe(parsesAfterFirst);
    parseSpy.mockRestore();
  });

  it('recomputes when alerts change', () => {
    addAlert({ ...makeAlert('a1', 'c1'), timestamp: 100 });
    const before = getLastAlertTimes();
    addAlert({ ...makeAlert('a2', 'c1'), timestamp: 500 });
    const after = getLastAlertTimes();
    expect(after).not.toBe(before);
    expect(after).toEqual({ c1: 500 });
  });
});
