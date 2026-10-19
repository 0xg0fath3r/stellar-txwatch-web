'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WatchedContract, AlertPayload, AlertRule } from '@/types'
import { getContract, deleteContract, getAlerts, saveContract } from '@/lib/storage'
import { truncateId, explorerContractUrl, explorerTxUrl, isValidUrl } from '@/lib/stellar'
import { formatDate, formatRuleSummary } from '@/lib/format'
import { useAnalytics } from '@/lib/useAnalytics'
import { fetchContractMetadata, ContractMetadata } from '@/lib/soroban'
import { fetchContractEvents, ContractEvent } from '@/lib/events'
import NetworkBadge from '@/components/NetworkBadge'
import AlertRuleBadge from '@/components/AlertRuleBadge'
import WebhookLog from '@/components/WebhookLog'
import RuleBuilder from '@/components/RuleBuilder'
import CopyButton from '@/components/CopyButton'
import MetadataSection from '@/components/MetadataSection'

export default function ContractDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { trackEvent } = useAnalytics()
  const [contract, setContract] = useState<WatchedContract | null>(null)
  const [alerts, setAlerts] = useState<AlertPayload[]>([])
  const [mounted, setMounted] = useState(false)
  const [contractNotFound, setContractNotFound] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showEditRules, setShowEditRules] = useState(false)
  const [editedRules, setEditedRules] = useState<AlertRule[]>([])
  const [rulesError, setRulesError] = useState<string | null>(null)
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)
  
  // Metadata editing state
  const [showEditMetadata, setShowEditMetadata] = useState(false)
  const [editedLabel, setEditedLabel] = useState('')
  const [editedWebhookUrl, setEditedWebhookUrl] = useState('')
  const [metadataError, setMetadataError] = useState<string | null>(null)

  // On-chain metadata state
  const [chainMetadata, setChainMetadata] = useState<ContractMetadata | null>(null)
  const [chainMetadataLoading, setChainMetadataLoading] = useState(true)
  const [chainMetadataError, setChainMetadataError] = useState(false)

  // Recent events state
  const [events, setEvents] = useState<ContractEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState(false)

  useEffect(() => {
    const c = getContract(params.id)
    if (!c) { 
      setContractNotFound(true)
      setMounted(true)
      return 
    }
    setContract(c)
    setAlerts(getAlerts(params.id))
    setMounted(true)
  }, [params.id, router])

  useEffect(() => {
    if (!contract) return
    let cancelled = false
    setChainMetadataLoading(true)
    setChainMetadataError(false)
    fetchContractMetadata(contract.network, contract.contract_id)
      .then((meta) => {
        if (cancelled) return
        setChainMetadata(meta)
        setChainMetadataLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setChainMetadataError(true)
        setChainMetadataLoading(false)
      })
    return () => { cancelled = true }
  }, [contract?.network, contract?.contract_id])

  useEffect(() => {
    if (!contract) return
    let cancelled = false
    setEventsLoading(true)
    setEventsError(false)
    fetchContractEvents(contract.network, contract.contract_id)
      .then((evts) => {
        if (cancelled) return
        setEvents(evts)
        setEventsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setEventsError(true)
        setEventsLoading(false)
      })
    return () => { cancelled = true }
  }, [contract?.network, contract?.contract_id])

  function refreshEvents() {
    if (!contract) return
    setEventsLoading(true)
    setEventsError(false)
    fetchContractEvents(contract.network, contract.contract_id)
      .then((evts) => {
        setEvents(evts)
        setEventsLoading(false)
      })
      .catch(() => {
        setEventsError(true)
        setEventsLoading(false)
      })
  }

  function handleDelete() {
    deleteContract(params.id)
    router.push('/contracts')
  }

  function openEditRules() {
    setEditedRules(contract!.rules)
    setRulesError(null)
    setShowEditRules(true)
    trackEvent('rule_edit_opened', { contractId: params.id, ruleCount: contract!.rules.length })
  }

  function saveRules() {
    if (editedRules.length === 0) { setRulesError('Add at least one rule'); return }
    const updated = { ...contract!, rules: editedRules }
    saveContract(updated)
    setContract(updated)
    setShowEditRules(false)
    trackEvent('rule_edit_saved', { contractId: params.id, ruleCount: editedRules.length })
  }

  function hasUnsavedChanges(): boolean {
    return JSON.stringify(editedRules) !== JSON.stringify(contract?.rules ?? [])
  }

  function handleCancelEdit() {
    if (hasUnsavedChanges()) {
      setShowUnsavedWarning(true)
    } else {
      setShowEditRules(false)
    }
  }

  function confirmDiscard() {
    setShowUnsavedWarning(false)
    setShowEditRules(false)
  }

  // Metadata editing functions
  function openEditMetadata() {
    setEditedLabel(contract!.label)
    setEditedWebhookUrl(contract!.webhook_url)
    setMetadataError(null)
    setShowEditMetadata(true)
    trackEvent('metadata_edit_opened', { contractId: params.id })
  }

  function saveMetadata() {
    // Validation
    const trimmedLabel = editedLabel.trim()
    const trimmedWebhookUrl = editedWebhookUrl.trim()

    if (!trimmedLabel) {
      setMetadataError('Label is required')
      return
    }

    if (trimmedLabel.length > 100) {
      setMetadataError('Label must be 100 characters or less')
      return
    }

    if (!trimmedWebhookUrl) {
      setMetadataError('Webhook URL is required')
      return
    }

    if (!isValidUrl(trimmedWebhookUrl)) {
      setMetadataError('Please enter a valid HTTP or HTTPS URL')
      return
    }

    // Save changes
    const updated = { 
      ...contract!, 
      label: trimmedLabel,
      webhook_url: trimmedWebhookUrl
    }
    saveContract(updated)
    setContract(updated)
    setShowEditMetadata(false)
    trackEvent('metadata_edit_saved', { contractId: params.id })
  }

  function hasMetadataChanges(): boolean {
    return editedLabel !== contract?.label || editedWebhookUrl !== contract?.webhook_url
  }

  function handleCancelMetadataEdit() {
    if (hasMetadataChanges()) {
      if (confirm('You have unsaved changes. Are you sure you want to discard them?')) {
        setShowEditMetadata(false)
      }
    } else {
      setShowEditMetadata(false)
    }
  }

  if (!mounted) return null

  if (contractNotFound) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-sm">
          <div className="flex justify-center">
            <svg className="w-16 h-16 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-100">Contract Not Found</h2>
          <p className="text-sm text-zinc-400">
            The contract you&apos;re looking for doesn&apos;t exist or has been deleted.
          </p>
          <button
            onClick={() => router.push('/contracts')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Contracts
          </button>
        </div>
      </div>
    )
  }

  if (!contract) return null

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-zinc-100">{contract.label}</h1>
            <NetworkBadge network={contract.network} />
          </div>
          <div className="flex items-center gap-2">
            <a
              href={explorerContractUrl(contract.network, contract.contract_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono text-indigo-400 hover:text-indigo-300 transition-colors break-all"
            >
              {truncateId(contract.contract_id, 12)}
            </a>
            <CopyButton text={contract.contract_id} />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={openEditMetadata}
            className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
          >
            Edit Details
          </button>
          <button
            onClick={openEditRules}
            className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
          >
            Edit Rules
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="px-3 py-1.5 rounded-lg border border-red-800 hover:border-red-600 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-zinc-500">Webhook URL</p>
            <CopyButton text={contract.webhook_url} />
          </div>
          <a
            href={contract.webhook_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors break-all"
          >
            {contract.webhook_url}
          </a>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">Registered</p>
          <p className="text-sm text-zinc-300">{formatDate(contract.created_at)}</p>
          <p className="text-xs text-zinc-500 mt-1">{new Date(contract.created_at).toLocaleTimeString()}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">{alerts.length === 0 ? 'Total Alerts' : 'Last Alert'}</p>
          {alerts.length === 0 ? (
            <p className="text-sm text-zinc-300">No alerts yet</p>
          ) : (
            <>
              <p className="text-sm text-zinc-300">{formatDate(alerts[0].timestamp)}</p>
              <p className="text-xs text-zinc-500 mt-1">{new Date(alerts[0].timestamp).toLocaleTimeString()}</p>
            </>
          )}
        </div>
        {!chainMetadataError && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-1">WASM Hash</p>
            {chainMetadataLoading ? (
              <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse" />
            ) : chainMetadata?.isSac ? (
              <p className="text-sm text-zinc-300">Stellar Asset Contract</p>
            ) : chainMetadata?.wasmHash ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-zinc-300 break-all">
                  {truncateId(chainMetadata.wasmHash, 8)}
                </span>
                <CopyButton text={chainMetadata.wasmHash} />
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Unavailable</p>
            )}
          </div>
        )}
        {!chainMetadataError && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-1">Last Modified Ledger</p>
            {chainMetadataLoading ? (
              <div className="h-4 w-20 bg-zinc-800 rounded animate-pulse" />
            ) : chainMetadata?.lastModifiedLedger != null ? (
              <p className="text-sm text-zinc-300 font-mono">
                {chainMetadata.lastModifiedLedger.toLocaleString()}
              </p>
            ) : (
              <p className="text-sm text-zinc-500">Unavailable</p>
            )}
          </div>
        )}
      </div>

      {/* Active Rules */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-100 mb-3">Active Rules</h2>
        {contract.rules.length === 0 ? (
          <p className="text-sm text-zinc-500">No rules configured.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {contract.rules.map((rule, i) => (
              <div key={i} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                <AlertRuleBadge type={rule.type} />
                {formatRuleSummary(rule) && (
                  <span className="text-xs font-mono text-zinc-400">{formatRuleSummary(rule)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alert History */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-100 mb-3">Alert History</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <WebhookLog alerts={alerts} network={contract.network} />
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-zinc-100">Recent activity</h2>
          <button
            onClick={refreshEvents}
            disabled={eventsLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className={`w-4 h-4 ${eventsLoading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          {eventsLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 bg-zinc-800 rounded animate-pulse" />
              ))}
            </div>
          ) : eventsError ? (
            <div className="text-center space-y-3 py-4">
              <p className="text-sm text-zinc-400">Failed to load recent events.</p>
              <button
                onClick={refreshEvents}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
              >
                Retry
              </button>
            </div>
          ) : events.length === 0 ? (
            <p className="text-sm text-zinc-500">No recent events</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {events.slice(0, 20).map((event, i) => (
                <li key={`${event.txHash}-${i}`} className="py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-medium text-zinc-200">{event.type}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-zinc-500">
                        Ledger {event.ledger.toLocaleString()}
                      </span>
                      <a
                        href={explorerTxUrl(contract.network, event.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        View tx
                      </a>
                    </div>
                  </div>
                  {event.topics.length > 0 && (
                    <p className="text-xs font-mono text-zinc-400 break-all">
                      {event.topics.map((t) => JSON.stringify(t)).join(' · ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Edit Metadata Modal */}
      {showEditMetadata && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-lg w-full space-y-4">
            <h3 className="text-lg font-semibold text-zinc-100">Edit Contract Details</h3>
            
            <div className="space-y-4">
              {/* Label field */}
              <div>
                <label htmlFor="edit-label" className="block text-sm font-medium text-zinc-300 mb-2">
                  Label
                </label>
                <input
                  id="edit-label"
                  type="text"
                  value={editedLabel}
                  onChange={(e) => setEditedLabel(e.target.value)}
                  placeholder="My Contract"
                  maxLength={100}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  {editedLabel.length}/100 characters
                </p>
              </div>

              {/* Webhook URL field */}
              <div>
                <label htmlFor="edit-webhook" className="block text-sm font-medium text-zinc-300 mb-2">
                  Webhook URL
                </label>
                <input
                  id="edit-webhook"
                  type="url"
                  value={editedWebhookUrl}
                  onChange={(e) => setEditedWebhookUrl(e.target.value)}
                  placeholder="https://example.com/webhook"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Must be a valid HTTP or HTTPS URL
                </p>
              </div>
            </div>

            {metadataError && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                <p className="text-xs text-red-400">{metadataError}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={saveMetadata}
                className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
              >
                Save Changes
              </button>
              <button
                onClick={handleCancelMetadataEdit}
                className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-semibold text-zinc-100">Delete Contract?</h3>
            <div className="space-y-2 text-sm text-zinc-400">
              <p>
                This will permanently remove <span className="text-zinc-200 font-medium">{contract.label}</span> and cannot be undone.
              </p>
              <p className="text-xs text-zinc-500">
                Deleted data:
              </p>
              <ul className="text-xs text-zinc-500 list-disc list-inside space-y-1">
                <li>Contract configuration and alert rules</li>
                <li>All {alerts.length} alert {alerts.length === 1 ? 'record' : 'records'}</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-medium text-white transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDelete(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Rules Modal */}
      {showEditRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-zinc-100">Edit Alert Rules</h3>
            <RuleBuilder
              rules={editedRules}
              onChange={setEditedRules}
              onRulesChanged={(rules, action) =>
                trackEvent(action === 'remove' ? 'rule_removed' : 'rule_added', {
                  contractId: params.id,
                  ruleCount: rules.length,
                })
              }
            />
            {rulesError && <p className="text-xs text-red-400">{rulesError}</p>}
            <div className="flex gap-3 pt-2">
              <button
                onClick={saveRules}
                className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
              >
                Save Rules
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Warning Modal */}
      {showUnsavedWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-semibold text-zinc-100">Discard Changes?</h3>
            <p className="text-sm text-zinc-400">
              You have unsaved changes to your alert rules. Are you sure you want to discard them?
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDiscard}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-medium text-white transition-colors"
              >
                Discard
              </button>
              <button
                onClick={() => setShowUnsavedWarning(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
              >
                Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
