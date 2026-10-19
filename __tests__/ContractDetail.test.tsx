import { render, screen } from '@testing-library/react'
import { formatRuleSummary } from '@/lib/format'
import { AlertRule } from '@/types'
import ContractDetail from '@/app/contracts/[id]/page'

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

  it('formats token-denominated LargeTransfer rule with asset and threshold', () => {
    const rule: AlertRule = {
      type: 'LargeTransfer',
      asset: 'CUSDC',
      threshold: 500,
    }
    expect(formatRuleSummary(rule)).toBe('>= 500 CUSDC')
  })
})

const DAYS = 24 * 60 * 60 * 1000
const LEDGERS_PER_DAY = 17280

function mockContract(liveUntilLedgerSeq: number) {
  return {
    id: 'CABC',
    liveUntilLedgerSeq,
    latestLedger: 1000,
  }
}

describe('ContractDetail TTL display', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('shows liveUntilLedgerSeq and estimated expiry', () => {
    const liveUntilLedgerSeq = 1000 + LEDGERS_PER_DAY * 60
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockContract(liveUntilLedgerSeq),
    } as Response)

    render(<ContractDetail params={{ id: 'CABC' }} />)

    expect(screen.getByText(String(liveUntilLedgerSeq))).toBeInTheDocument()
    expect(screen.getByText(/estimated/i)).toBeInTheDocument()
  })

  it('shows amber warning under 30 days', async () => {
    const liveUntilLedgerSeq = 1000 + LEDGERS_PER_DAY * 20
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockContract(liveUntilLedgerSeq),
    } as Response)

    render(<ContractDetail params={{ id: 'CABC' }} />)

    const warning = await screen.findByText(/expir/i)
    expect(warning).toHaveClass('amber')
  })

  it('shows red warning under 7 days', async () => {
    const liveUntilLedgerSeq = 1000 + LEDGERS_PER_DAY * 3
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockContract(liveUntilLedgerSeq),
    } as Response)

    render(<ContractDetail params={{ id: 'CABC' }} />)

    const warning = await screen.findByText(/expir/i)
    expect(warning).toHaveClass('red')
  })

  it('shows no warning when far from expiry', async () => {
    const liveUntilLedgerSeq = 1000 + LEDGERS_PER_DAY * 365
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockContract(liveUntilLedgerSeq),
    } as Response)

    render(<ContractDetail params={{ id: 'CABC' }} />)

    expect(screen.queryByText(/expir/i)).not.toBeInTheDocument()
  })
})

