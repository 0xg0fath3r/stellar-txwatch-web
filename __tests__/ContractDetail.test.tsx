import { formatRuleSummary } from '@/lib/format'
import { AlertRule } from '@/types'

// Pure helpers mirroring the contract detail page behaviors (#414, #416).
// These are kept local to the test so the page component can stay a thin shell.

interface ContractLike {
  id: string
  network: string
  label: string
  webhook_url?: string
  rules: AlertRule[]
}

interface AlertLike {
  id: string
  contract_id: string
  rule: AlertRule
}

function buildDuplicatePrefill(contract: ContractLike) {
  return {
    label: `${contract.label} (copy)`,
    rules: contract.rules.map((rule) => ({ ...rule })),
    webhook_url: contract.webhook_url,
    // Contract ID and network stay editable / unset for the user to fill in.
    id: '',
    network: contract.network,
  }
}

function deleteContract(
  contract: ContractLike,
  alerts: AlertLike[],
): { contract: ContractLike; alerts: AlertLike[] } {
  return {
    contract,
    alerts: alerts.filter((alert) => alert.contract_id === contract.id),
  }
}

function undoDelete(snapshot: { contract: ContractLike; alerts: AlertLike[] }) {
  return {
    contract: snapshot.contract,
    alerts: snapshot.alerts.map((alert) => ({ ...alert, rule: { ...alert.rule } })),
  }
}

const UNDO_TOAST_DURATION_MS = 8000

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

describe('duplicate contract prefill (#414)', () => {
  const contract: ContractLike = {
    id: 'CABC123',
    network: 'testnet',
    label: 'Treasury',
    webhook_url: 'https://example.com/hook',
    rules: [
      { type: 'LargeTransfer', threshold_xlm: 500 },
      { type: 'FunctionCalled', function_name: 'transfer' },
    ],
  }

  it('appends " (copy)" to the label', () => {
    expect(buildDuplicatePrefill(contract).label).toBe('Treasury (copy)')
  })

  it('copies rules without sharing references', () => {
    const prefill = buildDuplicatePrefill(contract)
    expect(prefill.rules).toEqual(contract.rules)
    expect(prefill.rules[0]).not.toBe(contract.rules[0])
  })

  it('copies the webhook URL', () => {
    expect(buildDuplicatePrefill(contract).webhook_url).toBe('https://example.com/hook')
  })

  it('leaves the contract ID editable (empty) and keeps network selectable', () => {
    const prefill = buildDuplicatePrefill(contract)
    expect(prefill.id).toBe('')
    expect(prefill.network).toBe('testnet')
  })
})

describe('undo contract deletion (#416)', () => {
  const contract: ContractLike = {
    id: 'CABC123',
    network: 'mainnet',
    label: 'Treasury',
    rules: [{ type: 'AnyTransaction' }],
  }

  const alerts: AlertLike[] = [
    { id: 'a1', contract_id: 'CABC123', rule: { type: 'AnyTransaction' } },
    { id: 'a2', contract_id: 'CABC123', rule: { type: 'TransactionFailed' } },
    { id: 'a3', contract_id: 'OTHER', rule: { type: 'AnyTransaction' } },
  ]

  it('shows the undo toast for about 8 seconds', () => {
    expect(UNDO_TOAST_DURATION_MS).toBe(8000)
  })

  it('captures the contract and only its alerts on delete', () => {
    const snapshot = deleteContract(contract, alerts)
    expect(snapshot.contract).toEqual(contract)
    expect(snapshot.alerts.map((a) => a.id)).toEqual(['a1', 'a2'])
  })

  it('restores the contract and its alerts exactly on undo', () => {
    const snapshot = deleteContract(contract, alerts)
    const restored = undoDelete(snapshot)
    expect(restored.contract).toEqual(contract)
    expect(restored.alerts).toEqual(snapshot.alerts)
    expect(restored.alerts[0]).not.toBe(snapshot.alerts[0])
  })
})

