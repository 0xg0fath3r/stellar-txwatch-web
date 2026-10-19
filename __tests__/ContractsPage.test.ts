/**
 * Tests for pagination logic used in the contracts page (issue #80)
 * and responsive filter bar behaviour (issue #81).
 */

const PAGE_SIZE = 12

function paginate<T>(items: T[], page: number): T[] {
  return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
}

function totalPages(count: number): number {
  return Math.max(1, Math.ceil(count / PAGE_SIZE))
}

describe('contracts page — pagination (issue #80)', () => {
  it('returns first PAGE_SIZE items on page 1', () => {
    const items = Array.from({ length: 30 }, (_, i) => i)
    expect(paginate(items, 1)).toHaveLength(PAGE_SIZE)
    expect(paginate(items, 1)[0]).toBe(0)
  })

  it('returns correct slice on page 2', () => {
    const items = Array.from({ length: 30 }, (_, i) => i)
    const result = paginate(items, 2)
    expect(result).toHaveLength(PAGE_SIZE)
    expect(result[0]).toBe(PAGE_SIZE)
  })

  it('returns remaining items on last page', () => {
    const items = Array.from({ length: 25 }, (_, i) => i)
    const result = paginate(items, 3)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(24)
  })

  it('totalPages is 1 for empty list', () => {
    expect(totalPages(0)).toBe(1)
  })

  it('totalPages is 1 when items fit on one page', () => {
    expect(totalPages(PAGE_SIZE)).toBe(1)
  })

  it('totalPages rounds up correctly', () => {
    expect(totalPages(PAGE_SIZE + 1)).toBe(2)
    expect(totalPages(PAGE_SIZE * 3)).toBe(3)
    expect(totalPages(PAGE_SIZE * 3 + 1)).toBe(4)
  })

  it('page 1 of a single-item list returns that item', () => {
    expect(paginate(['only'], 1)).toEqual(['only'])
  })
})

describe('contracts page — network filter (issue #81)', () => {
  type Item = { network: string }
  const items: Item[] = [
    { network: 'mainnet' },
    { network: 'mainnet' },
    { network: 'testnet' },
    { network: 'futurenet' },
  ]

  function applyFilter(list: Item[], filter: string): Item[] {
    if (filter === 'all') return list
    return list.filter((c) => c.network === filter)
  }

  it('all filter returns every item', () => {
    expect(applyFilter(items, 'all')).toHaveLength(4)
  })

  it('mainnet filter returns only mainnet items', () => {
    const result = applyFilter(items, 'mainnet')
    expect(result).toHaveLength(2)
    expect(result.every((c) => c.network === 'mainnet')).toBe(true)
  })

  it('testnet filter returns only testnet items', () => {
    const result = applyFilter(items, 'testnet')
    expect(result).toHaveLength(1)
    expect(result[0].network).toBe('testnet')
  })

  it('futurenet filter returns only futurenet items', () => {
    const result = applyFilter(items, 'futurenet')
    expect(result).toHaveLength(1)
    expect(result[0].network).toBe('futurenet')
  })

  it('filter with no matches returns empty array', () => {
    expect(applyFilter([], 'mainnet')).toHaveLength(0)
  })
})

describe('contracts page — search', () => {
  type ContractItem = { label: string; contract_id: string }
  const items: ContractItem[] = [
    { label: 'Escrow Manager', contract_id: 'ABC123' },
    { label: 'Payment Router', contract_id: 'DEF456' },
    { label: 'token service', contract_id: 'ghi789' },
  ]

  function applySearch(list: ContractItem[], query: string): ContractItem[] {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return list
    return list.filter((item) => {
      return (
        item.label.toLowerCase().includes(normalized) ||
        item.contract_id.toLowerCase().includes(normalized)
      )
    })
  }

  it('returns all contracts when search is empty', () => {
    expect(applySearch(items, '')).toHaveLength(3)
  })

  it('searches by label case-insensitively', () => {
    expect(applySearch(items, 'ESCROW')).toEqual([{ label: 'Escrow Manager', contract_id: 'ABC123' }])
  })

  it('searches by contract id substring', () => {
    expect(applySearch(items, '456')).toEqual([{ label: 'Payment Router', contract_id: 'DEF456' }])
  })

  it('returns no matches when search does not match any contract', () => {
    expect(applySearch(items, 'missing')).toHaveLength(0)
  })
})

describe('contracts page — undo delete (issue #416)', () => {
  type Alert = { id: string; threshold: number; channel: string }
  type Contract = { id: string; label: string; alerts: Alert[] }

  const UNDO_WINDOW_MS = 8000

  function makeContracts(): Contract[] {
    return [
      {
        id: 'c1',
        label: 'Escrow Manager',
        alerts: [
          { id: 'a1', threshold: 100, channel: 'email' },
          { id: 'a2', threshold: 500, channel: 'slack' },
        ],
      },
      {
        id: 'c2',
        label: 'Payment Router',
        alerts: [{ id: 'a3', threshold: 250, channel: 'webhook' }],
      },
      {
        id: 'c3',
        label: 'Token Service',
        alerts: [],
      },
    ]
  }

  type Toast = { message: string; actionLabel: string; durationMs: number }

  type DeleteResult = {
    contracts: Contract[]
    toast: Toast | null
    restore: () => Contract[]
  }

  function deleteContracts(list: Contract[], ids: string[]): DeleteResult {
    const removed = list.filter((c) => ids.includes(c.id))
    const remaining = list.filter((c) => !ids.includes(c.id))
    return {
      contracts: remaining,
      toast:
        removed.length > 0
          ? {
              message: removed.length === 1 ? 'Contract deleted' : `${removed.length} contracts deleted`,
              actionLabel: 'Undo',
              durationMs: UNDO_WINDOW_MS,
            }
          : null,
      restore: () => {
        const restored = [...remaining]
        for (const contract of removed) {
          const index = list.findIndex((c) => c.id === contract.id)
          restored.splice(index, 0, contract)
        }
        return restored
      },
    }
  }

  it('single delete shows an Undo toast for about 8 seconds', () => {
    const result = deleteContracts(makeContracts(), ['c2'])
    expect(result.contracts.map((c) => c.id)).toEqual(['c1', 'c3'])
    expect(result.toast).not.toBeNull()
    expect(result.toast!.actionLabel).toBe('Undo')
    expect(result.toast!.durationMs).toBe(8000)
  })

  it('undo after single delete restores the contract and its alerts exactly', () => {
    const original = makeContracts()
    const result = deleteContracts(original, ['c2'])
    const restored = result.restore()
    expect(restored).toEqual(original)
    const c2 = restored.find((c) => c.id === 'c2')!
    expect(c2.alerts).toEqual([{ id: 'a3', threshold: 250, channel: 'webhook' }])
  })

  it('bulk delete shows an Undo toast', () => {
    const result = deleteContracts(makeContracts(), ['c1', 'c3'])
    expect(result.contracts.map((c) => c.id)).toEqual(['c2'])
    expect(result.toast).not.toBeNull()
    expect(result.toast!.actionLabel).toBe('Undo')
    expect(result.toast!.durationMs).toBe(8000)
  })

  it('undo after bulk delete restores all contracts and alerts exactly', () => {
    const original = makeContracts()
    const result = deleteContracts(original, ['c1', 'c3'])
    const restored = result.restore()
    expect(restored).toEqual(original)
    expect(restored.find((c) => c.id === 'c1')!.alerts).toEqual(original[0].alerts)
    expect(restored.find((c) => c.id === 'c3')!.alerts).toEqual([])
  })

  it('no toast is shown when nothing was deleted', () => {
    const result = deleteContracts(makeContracts(), [])
    expect(result.toast).toBeNull()
  })
})
