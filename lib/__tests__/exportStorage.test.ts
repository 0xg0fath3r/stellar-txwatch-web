import {
  buildContractSnapshot,
  exportContractsAsJson,
  parseContractSnapshot,
} from '../exportStorage';
import { STORAGE_KEYS } from '../storageKeys';

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

const KEY = STORAGE_KEYS.CONTRACTS;
const sample = [
  { id: 'c1', address: 'GABC', label: 'Alpha', network: 'mainnet' },
  { id: 'c2', address: 'GDEF', label: 'Beta',  network: 'testnet' },
];

beforeEach(() => localStorageMock.clear());

describe('buildContractSnapshot', () => {
  it('returns version 1 snapshot', () => {
    localStorage.setItem(KEY, JSON.stringify(sample));
    expect(buildContractSnapshot(KEY).version).toBe(1);
  });

  it('includes all contracts', () => {
    localStorage.setItem(KEY, JSON.stringify(sample));
    const snap = buildContractSnapshot(KEY);
    expect(snap.count).toBe(2);
    expect(snap.contracts).toHaveLength(2);
  });

  it('returns count 0 and empty array when no contracts stored', () => {
    const snap = buildContractSnapshot(KEY);
    expect(snap.count).toBe(0);
    expect(snap.contracts).toEqual([]);
  });

  it('includes an ISO exportedAt timestamp', () => {
    const snap = buildContractSnapshot(KEY);
    expect(() => new Date(snap.exportedAt)).not.toThrow();
    expect(snap.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('exportContractsAsJson', () => {
  it('returns valid JSON string', () => {
    localStorage.setItem(KEY, JSON.stringify(sample));
    const json = exportContractsAsJson(KEY);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('produced JSON round-trips back to snapshot shape', () => {
    localStorage.setItem(KEY, JSON.stringify(sample));
    const json = exportContractsAsJson(KEY);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.contracts).toHaveLength(2);
  });
});

describe('parseContractSnapshot', () => {
  it('parses valid snapshot JSON', () => {
    localStorage.setItem(KEY, JSON.stringify(sample));
    const json = exportContractsAsJson(KEY);
    const snap = parseContractSnapshot(json);
    expect(snap.version).toBe(1);
    expect(snap.contracts).toHaveLength(2);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseContractSnapshot('not json')).toThrow('Invalid JSON');
  });

  it('throws on wrong version', () => {
    const bad = JSON.stringify({ version: 99, contracts: [] });
    expect(() => parseContractSnapshot(bad)).toThrow('Invalid snapshot format');
  });

  it('throws when contracts field is missing', () => {
    const bad = JSON.stringify({ version: 1 });
    expect(() => parseContractSnapshot(bad)).toThrow('Invalid snapshot format');
  });
});
