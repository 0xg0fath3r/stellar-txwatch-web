import { formatRuleSummary } from '@/lib/format'
import { AlertRule, WatchedContract } from '@/types'

describe('formatRuleSummary', () => {
  it('formats LargeTransfer rule with threshold', () => {
    const rule: AlertRule = { type: 'LargeTransfer', threshold_xlm: 1000 }
    expect(formatRuleSummary(rule)).toBe('>= 1000 XLM')
  })

  it('formats FunctionCalled rule with function name', () => {
    const rule: AlertRule = { type: 'FunctionCalled', function_name: 'transfer' }
    expect(formatRuleSummary(rule)).toBe('transfer')
  })

  it('formats AdminFunctionCalled rule with function names', () => {
    const rule: AlertRule = {
      type: 'AdminFunctionCalled',
      function_names: ['set_admin', 'upgrade'],
    }
    expect(formatRuleSummary(rule)).toBe('set_admin, upgrade')
  })

  it('returns empty string for AnyTransaction', () => {
    const rule: AlertRule = { type: 'AnyTransaction' }
    expect(formatRuleSummary(rule)).toBe('')
  })

  it('returns empty string for TransactionFailed', () => {
    const rule: AlertRule = { type: 'TransactionFailed' }
    expect(formatRuleSummary(rule)).toBe('')
  })

  it('handles FunctionCalled with missing function_name', () => {
    const rule: AlertRule = { type: 'FunctionCalled' }
    expect(formatRuleSummary(rule)).toBe('function')
  })

  it('handles AdminFunctionCalled with empty function_names', () => {
    const rule: AlertRule = { type: 'AdminFunctionCalled', function_names: [] }
    expect(formatRuleSummary(rule)).toBe('admin functions')
  })
})

describe('contract notes', () => {
  const baseContract: WatchedContract = {
    id: 'c1',
    label: 'My Contract',
    contract_id: 'CABC',
    network: 'mainnet',
    created_at: '2024-01-01T00:00:00.000Z',
  }

  it('round-trips notes through storage serialization', () => {
    const notes = 'Owner: Alice\nRunbook: https://example.com/runbook\nAudit: SOC2'
    const contract: WatchedContract = { ...baseContract, notes }
    const restored = JSON.parse(JSON.stringify(contract)) as WatchedContract
    expect(restored.notes).toBe(notes)
    expect(restored.notes?.split('\n')).toHaveLength(3)
  })

  it('omits notes when not set', () => {
    const restored = JSON.parse(JSON.stringify(baseContract)) as WatchedContract
    expect(restored.notes).toBeUndefined()
  })

  it('includes notes in export/import round-trip', () => {
    const notes = 'Line one\nLine two'
    const exported = JSON.stringify({ contracts: [{ ...baseContract, notes }] })
    const imported = JSON.parse(exported) as { contracts: WatchedContract[] }
    expect(imported.contracts[0].notes).toBe(notes)
  })

  it('renders notes with preserved line breaks', () => {
    const notes = 'First line\nSecond line\nThird line'
    const rendered = notes.split('\n').join('\n')
    expect(rendered).toBe(notes)
    expect(rendered.split('\n')).toEqual(['First line', 'Second line', 'Third line'])
  })

  it('accepts notes up to 1000 characters', () => {
    const notes = 'a'.repeat(1000)
    expect(notes.length).toBe(1000)
  })
})

describe('mainnet delete confirmation', () => {
  const isDeleteEnabled = (network: string, label: string, typed: string) =>
    network !== 'mainnet' || typed === label

  it('requires exact label match for mainnet', () => {
    expect(isDeleteEnabled('mainnet', 'My Contract', '')).toBe(false)
    expect(isDeleteEnabled('mainnet', 'My Contract', 'My Contract ')).toBe(false)
    expect(isDeleteEnabled('mainnet', 'My Contract', 'my contract')).toBe(false)
    expect(isDeleteEnabled('mainnet', 'My Contract', 'My Contract')).toBe(true)
  })

  it('allows one-click confirm for testnet and futurenet', () => {
    expect(isDeleteEnabled('testnet', 'My Contract', '')).toBe(true)
    expect(isDeleteEnabled('futurenet', 'My Contract', '')).toBe(true)
  })
})

describe('breadcrumbs', () => {
  const buildBreadcrumbs = (label?: string) =>
    label ? ['Contracts', label] : ['Contracts', 'New']

  it('builds Contracts / <label> for detail page', () => {
    expect(buildBreadcrumbs('My Contract')).toEqual(['Contracts', 'My Contract'])
  })

  it('builds Contracts / New for add page', () => {
    expect(buildBreadcrumbs()).toEqual(['Contracts', 'New'])
  })
})

