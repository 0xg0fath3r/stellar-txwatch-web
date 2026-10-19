import {
  formatContractMetadata,
  formatRuleSummary,
  mapContractEvents,
} from '@/lib/format'
import { AlertRule } from '@/types'

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

describe('formatContractMetadata', () => {
  const hash =
    'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'

  it('returns "Stellar Asset Contract" when isSac is true', () => {
    expect(
      formatContractMetadata({ isSac: true, wasmHash: hash, lastModifiedLedger: 42 })
    ).toBe('Stellar Asset Contract')
  })

  it('returns a truncated hash for non-SAC contracts', () => {
    const result = formatContractMetadata({
      isSac: false,
      wasmHash: hash,
      lastModifiedLedger: 42,
    })
    expect(result).not.toBe('Stellar Asset Contract')
    expect(result).toContain('abcdef01')
    expect(result.length).toBeLessThan(hash.length)
  })

  it('returns an empty string when no hash is available', () => {
    expect(
      formatContractMetadata({ isSac: false, wasmHash: null, lastModifiedLedger: null })
    ).toBe('')
  })
})

describe('mapContractEvents', () => {
  const rawEvent = {
    type: 'contract',
    ledger: 1234,
    txHash: 'deadbeef',
    topic: ['AAAADwAAAAh0cmFuc2Zlcg=='],
    value: 'AAAADwAAAAA=',
  }

  it('returns an empty array for empty input', () => {
    expect(mapContractEvents([])).toEqual([])
  })

  it('maps raw getEvents results into display rows', () => {
    const rows = mapContractEvents([rawEvent])
    expect(rows).toHaveLength(1)
    expect(rows[0].type).toBe('contract')
    expect(rows[0].ledger).toBe(1234)
    expect(rows[0].txHash).toBe('deadbeef')
    expect(Array.isArray(rows[0].topics)).toBe(true)
    expect(rows[0].topics.length).toBeGreaterThan(0)
  })
})

