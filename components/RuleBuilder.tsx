'use client'

import { useState } from 'react'
import { AlertRule, AlertRuleType, Network } from '@/types'
import { formatRuleSummary } from '@/lib/format'
import { HORIZON_URLS } from '@/lib/stellar'
import AlertRuleBadge from './AlertRuleBadge'

const RULE_TYPES: AlertRuleType[] = [
  'AnyTransaction',
  'LargeTransfer',
  'FunctionCalled',
  'AdminFunctionCalled',
  'TransactionFailed',
]

const RULE_EXAMPLES: Record<AlertRuleType, string> = {
  'AnyTransaction': 'Alert on every transaction',
  'LargeTransfer': 'Alert when transfer amount exceeds threshold',
  'FunctionCalled': 'Alert when a specific function is called',
  'AdminFunctionCalled': 'Alert when admin functions are called',
  'TransactionFailed': 'Alert on failed transactions',
}

// ---------- Horizon transaction shape (minimal) ----------
interface HorizonOperation {
  type: string
  amount?: string
  to?: string
  from?: string
  funder?: string
  into?: string
  function_name?: string
}

interface HorizonTransaction {
  hash: string
  successful: boolean
  created_at: string
  source_account: string
  _links?: {
    operations?: { href: string }
  }
}

// ---------- Rule evaluation logic ----------
/**
 * Evaluates a single draft rule against a Horizon transaction + its operations.
 * Returns true if the rule would have fired.
 */
function evaluateRule(rule: AlertRule, tx: HorizonTransaction, ops: HorizonOperation[]): boolean {
  switch (rule.type) {
    case 'AnyTransaction':
      return true
    case 'TransactionFailed':
      return !tx.successful
    case 'LargeTransfer': {
      const threshold = rule.threshold_xlm ?? 0
      return ops.some((op) => {
        if (op.type !== 'payment') return false
        const amount = parseFloat(op.amount ?? '0')
        return amount >= threshold
      })
    }
    case 'FunctionCalled': {
      const target = rule.function_name?.toLowerCase()
      if (!target) return false
      return ops.some((op) => op.function_name?.toLowerCase() === target)
    }
    case 'AdminFunctionCalled': {
      const names = (rule.function_names ?? []).map((n) => n.toLowerCase())
      if (names.length === 0) return false
      return ops.some((op) => {
        const fn = op.function_name?.toLowerCase()
        return fn ? names.includes(fn) : false
      })
    }
    default:
      return false
  }
}

interface DryRunResult {
  total: number
  matched: number
  matchedHashes: string[]
}

interface RuleBuilderProps {
  rules: AlertRule[]
  onChange: (rules: AlertRule[]) => void
  /** Optional callback fired whenever a rule is added, updated, or removed.
   *  Intended as an analytics hook point — no behavior depends on it. */
  onRulesChanged?: (rules: AlertRule[], action: 'add' | 'update' | 'remove') => void
  /** Contract ID and network to use for the Test Rule dry-run feature. */
  contractId?: string
  network?: Network
}

const emptyRule = (): AlertRule => ({ type: 'AnyTransaction' })

export default function RuleBuilder({
  rules,
  onChange,
  onRulesChanged,
  contractId,
  network = 'testnet',
}: RuleBuilderProps) {
  const [draft, setDraft] = useState<AlertRule>(emptyRule())
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  // Dry-run state
  const [dryRunStatus, setDryRunStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null)
  const [dryRunError, setDryRunError] = useState<string | null>(null)

  function updateDraft(patch: Partial<AlertRule>) {
    setDraft((prev) => ({ ...prev, ...patch }))
    setError(null)
    setWarning(null)
    // Reset dry-run results when rule changes
    setDryRunResult(null)
    setDryRunStatus('idle')
  }

  function handleTypeChange(type: AlertRuleType) {
    setDraft({ type })
    setError(null)
    setWarning(null)
    setDryRunResult(null)
    setDryRunStatus('idle')
  }

  function isDuplicateLabel(newRule: AlertRule): boolean {
    return rules.some((rule) => {
      if (newRule.type !== rule.type) return false
      if (newRule.type === 'LargeTransfer') return newRule.threshold_xlm === rule.threshold_xlm
      if (newRule.type === 'FunctionCalled') return newRule.function_name === rule.function_name
      if (newRule.type === 'AdminFunctionCalled') {
        const newNames = (newRule.function_names ?? []).sort().join(',')
        const existingNames = (rule.function_names ?? []).sort().join(',')
        return newNames === existingNames
      }
      return true // AnyTransaction and TransactionFailed
    })
  }

  function isValidFunctionName(name: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)
  }

  /** Validate the current draft; returns false + sets error if invalid. */
  function validateDraft(): boolean {
    if (draft.type === 'LargeTransfer') {
      if (draft.threshold_xlm === undefined || draft.threshold_xlm === null || isNaN(draft.threshold_xlm)) {
        setError('Enter a valid XLM threshold')
        return false
      }
      if (draft.threshold_xlm <= 0) {
        setError('Threshold must be greater than 0')
        return false
      }
    }
    if (draft.type === 'FunctionCalled') {
      if (!draft.function_name?.trim()) {
        setError('Enter a function name')
        return false
      }
      if (!isValidFunctionName(draft.function_name.trim())) {
        setError('Function name must start with a letter or underscore, contain only alphanumeric characters and underscores')
        return false
      }
    }
    if (draft.type === 'AdminFunctionCalled') {
      if (!draft.function_names?.length) {
        setError('Enter at least one function name')
        return false
      }
    }
    return true
  }

  function addRule() {
    if (!validateDraft()) return
    if (draft.type === 'AdminFunctionCalled') {
      draft.function_names = [...(draft.function_names ?? [])].sort()
    }
    const newRule = { ...draft }
    if (editingIndex !== null) {
      const updated = [...rules]
      updated[editingIndex] = newRule
      onChange(updated)
      onRulesChanged?.(updated, 'update')
      setEditingIndex(null)
    } else {
      if (isDuplicateLabel(newRule)) {
        setWarning('This rule already exists')
        return
      }
      const updated = [...rules, newRule]
      onChange(updated)
      onRulesChanged?.(updated, 'add')
    }
    setDraft(emptyRule())
    setError(null)
    setWarning(null)
    setDryRunResult(null)
    setDryRunStatus('idle')
  }

  function startEdit(index: number) {
    setDraft(rules[index])
    setEditingIndex(index)
    setError(null)
    setDryRunResult(null)
    setDryRunStatus('idle')
  }

  function cancelEdit() {
    setDraft(emptyRule())
    setEditingIndex(null)
    setError(null)
    setDryRunResult(null)
    setDryRunStatus('idle')
  }

  function removeRule(index: number) {
    const updated = rules.filter((_, i) => i !== index)
    onChange(updated)
    onRulesChanged?.(updated, 'remove')
  }

  /** Fetch the last 20 transactions for the contract from Horizon. */
  async function fetchRecentTransactions(): Promise<HorizonTransaction[]> {
    if (!contractId) return []
    const horizonBase = HORIZON_URLS[network]
    const url = `${horizonBase}/accounts/${contractId}/transactions?order=desc&limit=20`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Horizon returned ${res.status}`)
    const data = await res.json()
    return (data?.records ?? []) as HorizonTransaction[]
  }

  /** Fetch operations for a single transaction. */
  async function fetchOperations(tx: HorizonTransaction): Promise<HorizonOperation[]> {
    if (!contractId) return []
    const horizonBase = HORIZON_URLS[network]
    const opsUrl = tx._links?.operations?.href ?? `${horizonBase}/transactions/${tx.hash}/operations`
    // Strip the templated part from Horizon HAL links
    const cleanUrl = opsUrl.replace(/\{[^}]+\}/, '')
    const res = await fetch(cleanUrl)
    if (!res.ok) return []
    const data = await res.json()
    return (data?.records ?? []) as HorizonOperation[]
  }

  async function handleTestRule() {
    if (!validateDraft()) return
    if (!contractId) {
      setError('Enter a contract ID first to test the rule against recent transactions')
      return
    }

    setDryRunStatus('running')
    setDryRunResult(null)
    setDryRunError(null)

    try {
      const txs = await fetchRecentTransactions()
      const matchedHashes: string[] = []

      for (const tx of txs) {
        const ops = await fetchOperations(tx)
        if (evaluateRule(draft, tx, ops)) {
          matchedHashes.push(tx.hash)
        }
      }

      setDryRunResult({ total: txs.length, matched: matchedHashes.length, matchedHashes })
      setDryRunStatus('done')
    } catch (err) {
      setDryRunError(err instanceof Error ? err.message : 'Failed to fetch transactions')
      setDryRunStatus('error')
    }
  }

  // Show Test Rule button only when the draft has the minimum configuration
  function isDraftTestable(): boolean {
    if (draft.type === 'LargeTransfer') return (draft.threshold_xlm ?? 0) > 0
    if (draft.type === 'FunctionCalled') return !!draft.function_name?.trim()
    if (draft.type === 'AdminFunctionCalled') return (draft.function_names?.length ?? 0) > 0
    return true // AnyTransaction, TransactionFailed
  }

  return (
    <div className="space-y-4">
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Rule Type</label>
          <select
            value={draft.type}
            onChange={(e) => handleTypeChange(e.target.value as AlertRuleType)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
          >
            {RULE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <p className="text-xs text-zinc-500 mt-1">{RULE_EXAMPLES[draft.type]}</p>
        </div>

        {draft.type === 'LargeTransfer' && (
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Threshold (XLM)</label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="e.g. 10000"
              value={draft.threshold_xlm ?? ''}
              onChange={(e) => updateDraft({ threshold_xlm: parseFloat(e.target.value) || undefined })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {draft.type === 'FunctionCalled' && (
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Function Name</label>
            <input
              type="text"
              placeholder="e.g. transfer"
              value={draft.function_name ?? ''}
              onChange={(e) => updateDraft({ function_name: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {draft.type === 'AdminFunctionCalled' && (
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Function Names <span className="text-zinc-600">(comma separated)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. set_admin, upgrade, migrate"
              value={draft.function_names?.join(', ') ?? ''}
              onChange={(e) =>
                updateDraft({
                  function_names: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}
        {warning && <p className="text-xs text-amber-400">{warning}</p>}

        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={addRule}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {editingIndex !== null ? 'Update Rule' : 'Add Rule'}
          </button>

          {isDraftTestable() && (
            <button
              type="button"
              onClick={handleTestRule}
              disabled={dryRunStatus === 'running'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-sm font-medium text-zinc-200 transition-colors"
              title={!contractId ? 'Enter a contract ID to enable dry-run testing' : 'Evaluate this rule against the last 20 transactions'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {dryRunStatus === 'running' ? 'Testing…' : 'Test Rule'}
            </button>
          )}

          {editingIndex !== null && (
            <button
              type="button"
              onClick={cancelEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-sm font-medium text-white transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Dry-run results */}
        {dryRunStatus === 'done' && dryRunResult && (
          <div className="mt-3 rounded-lg bg-zinc-900 border border-zinc-700 p-3 space-y-2">
            <p className="text-xs font-semibold text-zinc-300">
              Dry-run results:{' '}
              <span className={dryRunResult.matched > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                {dryRunResult.matched} of {dryRunResult.total} recent transactions
              </span>{' '}
              would have matched
            </p>
            {dryRunResult.matchedHashes.length > 0 && (
              <ul className="space-y-1 max-h-36 overflow-y-auto">
                {dryRunResult.matchedHashes.map((hash) => (
                  <li key={hash} className="text-xs font-mono text-zinc-400 truncate">
                    {hash.slice(0, 16)}…{hash.slice(-8)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {dryRunStatus === 'error' && dryRunError && (
          <p className="text-xs text-red-400 mt-2">Dry-run failed: {dryRunError}</p>
        )}
      </div>

      {rules.length > 0 && (
        <ul className="space-y-2">
          {rules.map((rule, i) => (
            <li key={i} className={`flex items-center justify-between rounded-lg px-3 py-2 border ${editingIndex === i ? 'bg-indigo-900/30 border-indigo-600' : 'bg-zinc-900 border-zinc-800'}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <AlertRuleBadge type={rule.type} />
                {formatRuleSummary(rule) && (
                  <span className="text-xs font-mono text-zinc-400">{formatRuleSummary(rule)}</span>
                )}
              </div>
              <div className="flex gap-1 ml-2">
                <button
                  type="button"
                  onClick={() => startEdit(i)}
                  className="text-zinc-600 hover:text-indigo-400 transition-colors"
                  aria-label="Edit rule"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => removeRule(i)}
                  className="text-zinc-600 hover:text-red-400 transition-colors"
                  aria-label="Remove rule"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
