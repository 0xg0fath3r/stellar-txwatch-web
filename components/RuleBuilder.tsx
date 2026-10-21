'use client'

import { useEffect, useState } from 'react'
import { AlertRule, AlertRuleType, RuleTemplate } from '@/types'
import { formatRuleSummary } from '@/lib/format'
import AlertRuleBadge from './AlertRuleBadge'
import {
  getRuleTemplates,
  saveRuleTemplate,
  deleteRuleTemplate,
  onRuleTemplatesChange,
} from '@/lib/storage'

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

interface RuleBuilderProps {
  rules: AlertRule[]
  onChange: (rules: AlertRule[]) => void
  /** Optional callback fired whenever a rule is added, updated, or removed.
   *  Intended as an analytics hook point — no behavior depends on it. */
  onRulesChanged?: (rules: AlertRule[], action: 'add' | 'update' | 'remove') => void
}

const emptyRule = (): AlertRule => ({ type: 'AnyTransaction' })
const newTemplateId = () => `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export default function RuleBuilder({ rules, onChange, onRulesChanged }: RuleBuilderProps) {
  const [draft, setDraft] = useState<AlertRule>(emptyRule())
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [templates, setTemplates] = useState<RuleTemplate[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [templateName, setTemplateName] = useState('')

  useEffect(() => {
    setTemplates(getRuleTemplates())
    const unsubscribe = onRuleTemplatesChange(() => {
      setTemplates(getRuleTemplates())
    })
    return () => unsubscribe()
  }, [])

  function updateDraft(patch: Partial<AlertRule>) {
    setDraft((prev) => ({ ...prev, ...patch }))
    setError(null)
    setWarning(null)
  }

  function handleTypeChange(type: AlertRuleType) {
    setDraft({ type })
    setError(null)
    setWarning(null)
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

  function addRule() {
    if (draft.type === 'LargeTransfer') {
      if (draft.threshold_xlm === undefined || draft.threshold_xlm === null || isNaN(draft.threshold_xlm)) {
        setError('Enter a valid XLM threshold')
        return
      }
      if (draft.threshold_xlm <= 0) {
        setError('Threshold must be greater than 0')
        return
      }
    }
    if (draft.type === 'FunctionCalled') {
      if (!draft.function_name?.trim()) {
        setError('Enter a function name')
        return
      }
      if (!isValidFunctionName(draft.function_name.trim())) {
        setError('Function name must start with a letter or underscore, contain only alphanumeric characters and underscores')
        return
      }
    }
    if (draft.type === 'AdminFunctionCalled') {
      if (!draft.function_names?.length) {
        setError('Enter at least one function name')
        return
      }
      draft.function_names = [...draft.function_names].sort()
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
  }

  function startEdit(index: number) {
    setDraft(rules[index])
    setEditingIndex(index)
    setError(null)
    setWarning(null)
  }

  function cancelEdit() {
    setDraft(emptyRule())
    setEditingIndex(null)
    setError(null)
    setWarning(null)
  }

  function removeRule(index: number) {
    const updated = rules.filter((_, i) => i !== index)
    onChange(updated)
    onRulesChanged?.(updated, 'remove')
  }

  // ── Template actions ──────────────────────────────────────────────

  function saveAsTemplate() {
    if (!templateName.trim()) {
      setWarning('Enter a template name')
      return
    }
    const template: RuleTemplate = {
      id: newTemplateId(),
      name: templateName.trim(),
      rules: [...rules],
      created_at: Date.now(),
    }
    saveRuleTemplate(template)
    setTemplateName('')
    setShowSaveDialog(false)
    setWarning(null)
  }

  function loadTemplate(template: RuleTemplate) {
    onChange([...template.rules])
    onRulesChanged?.([...template.rules], 'add')
    setShowLoadDialog(false)
  }

  function deleteTemplate(id: string) {
    deleteRuleTemplate(id)
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

        <div className="flex gap-2">
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

      {/* Template controls */}
      {rules.length > 0 && (
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => setShowSaveDialog(true)}
            className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            💾 Save as Template
          </button>
          <button
            onClick={() => setShowLoadDialog(true)}
            className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            disabled={templates.length === 0}
          >
            📂 Load Template
          </button>
        </div>
      )}

      {/* Save Template Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-zinc-100 mb-4">Save Rule Template</h3>
            <div className="space-y-4">
              <label className="block text-xs font-medium text-zinc-400 mb-1">Template Name</label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. DeFi safety pack"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button
                onClick={saveAsTemplate}
                className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
                disabled={!templateName.trim()}
              >
                Save
              </button>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Template Dialog */}
      {showLoadDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-zinc-100 mb-4">Load Rule Template</h3>
            <div className="space-y-3">
              {templates.length === 0 ? (
                <p className="text-xs text-zinc-500">No saved templates yet.</p>
              ) : (
                templates.map((tpl) => (
                  <div key={tpl.id} className="p-3 rounded-lg bg-zinc-800 border border-zinc-700 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">{tpl.name}</p>
                        <p className="text-xs text-zinc-500">{tpl.rules.length} rule{tpl.rules.length !== 1 ? 's' : ''}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteTemplate(tpl.id)
                        }}
                        className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                        aria-label="Delete template"
                      >
                        ×
                      </button>
                    </div>
                    <button
                      onClick={() => loadTemplate(tpl)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors text-sm"
                    >
                      Load rules
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="pt-4">
              <button
                onClick={() => setShowLoadDialog(false)}
                className="w-full px-4 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
