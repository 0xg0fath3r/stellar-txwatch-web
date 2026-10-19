import { formatRuleSummary } from '@/lib/format'
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

describe('formatRelativeTime (#220)', () => {
  it('formats recent timestamps as just now', async () => {
    const { formatRelativeTime } = await import('@/lib/format')
    const now = 1700000000000
    expect(formatRelativeTime(now - 10000, now)).toBe('just now')
    expect(formatRelativeTime(now - 59000, now)).toBe('just now')
  })

  it('formats minutes, hours, and days ago', async () => {
    const { formatRelativeTime } = await import('@/lib/format')
    const now = 1700000000000
    expect(formatRelativeTime(now - 60000 * 5, now)).toBe('5 minutes ago')
    expect(formatRelativeTime(now - 60000 * 60, now)).toBe('1 hour ago')
    expect(formatRelativeTime(now - 60000 * 60 * 3, now)).toBe('3 hours ago')
    expect(formatRelativeTime(now - 86400000 * 3, now)).toBe('3 days ago')
    expect(formatRelativeTime(now - 86400000 * 35, now)).toBe('1 month ago')
    expect(formatRelativeTime(now - 86400000 * 400, now)).toBe('1 year ago')
  })
})

describe('Soroban RPC URL configuration and fallback', () => {
  it('defaults to keyless public endpoint for mainnet', async () => {
    const { SOROBAN_RPC_URLS, getSorobanRpcUrl } = await import('@/lib/stellar')
    expect(SOROBAN_RPC_URLS.mainnet).toBe('https://mainnet.sorobanrpc.com')
    expect(getSorobanRpcUrl('mainnet')).toBe('https://mainnet.sorobanrpc.com')
  })
})


