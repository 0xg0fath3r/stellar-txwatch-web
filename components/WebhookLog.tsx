'use client'

import { AlertPayload, AlertRuleType, DeliveryStatus } from '@/types'
import { explorerTxUrl } from '@/lib/stellar'
import { Network } from '@/types'
import EmptyState from './EmptyState'
import { truncateId } from '@/lib/stellar'
import { formatDateTime } from '@/lib/format'
import { useState } from 'react'
import AlertRuleBadge from './AlertRuleBadge'

interface WebhookLogProps {
  alerts: AlertPayload[]
  network: Network
}

const ruleTypes: AlertRuleType[] = [
  'LargeTransfer',
  'AdminFunctionCalled',
  'AnyTransaction',
  'FunctionCalled',
  'TransactionFailed',
]

function exportCSV(alerts: AlertPayload[]) {
  const rows = [
    ['Time', 'Rule', 'Tx Hash', 'Function', 'Amount', 'Delivery Status', 'Retry Count', 'Last Attempt'],
    ...alerts.map((a) => [
      new Date(a.timestamp).toLocaleString(),
      a.rule_triggered,
      a.transaction_hash,
      a.function_name ?? 'N/A',
      a.amount !== undefined ? `${a.amount} XLM` : 'N/A',
      a.delivery_status ?? 'unknown',
      a.delivery_retry_count !== undefined ? String(a.delivery_retry_count) : 'N/A',
      a.delivery_last_attempt ? new Date(a.delivery_last_attempt).toLocaleString() : 'N/A',
    ]),
  ]
  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'alerts.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function DeliveryStatusBadge({
  status,
  retryCount,
  lastAttempt,
}: {
  status?: DeliveryStatus
  retryCount?: number
  lastAttempt?: number
}) {
  if (!status) {
    return <span className="text-xs text-zinc-600">—</span>
  }
  const styles: Record<DeliveryStatus, string> = {
    delivered: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    retrying: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    failed: 'bg-red-500/15 text-red-400 border-red-500/20',
  }
  const label: Record<DeliveryStatus, string> = {
    delivered: 'Delivered',
    retrying: 'Retrying',
    failed: 'Failed',
  }
  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${styles[status]}`}>
        {label[status]}
      </span>
      {status === 'retrying' && (retryCount !== undefined || lastAttempt !== undefined) && (
        <span className="text-xs text-zinc-500 whitespace-nowrap">
          {retryCount !== undefined && (
            <>{retryCount} {retryCount === 1 ? 'retry' : 'retries'}</>
          )}
          {retryCount !== undefined && lastAttempt !== undefined && ' · '}
          {lastAttempt !== undefined && <>last {formatDateTime(lastAttempt)}</>}
        </span>
      )}
    </div>
  )
}

export default function WebhookLog({ alerts, network }: WebhookLogProps) {
  const [selectedFilter, setSelectedFilter] = useState<AlertRuleType | null>(null)

  const filteredAlerts = selectedFilter
    ? alerts.filter((a) => a.rule_triggered === selectedFilter)
    : alerts

  if (alerts.length === 0) {
    return (
      <EmptyState
        title="No alerts yet"
        description="Alerts will appear here once your contract triggers a matching rule."
      />
    )
  }

  const persistentFailures = alerts.filter((a) => a.delivery_status === 'failed').length

  return (
    <div className="space-y-4">
      {persistentFailures > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            {persistentFailures} webhook {persistentFailures === 1 ? 'delivery has' : 'deliveries have'} persistently failed.
            Check your endpoint and alert rules.
          </span>
        </div>
      )}

      {/* Filter Controls */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedFilter(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedFilter === null
              ? 'bg-indigo-600 text-white'
              : 'border border-zinc-700 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          All Rules
        </button>
        {ruleTypes.map((type) => (
          <button
            key={type}
            onClick={() => setSelectedFilter(type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedFilter === type
                ? 'bg-indigo-600 text-white'
                : 'border border-zinc-700 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Export and Results */}
      <div className="overflow-x-auto">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-zinc-500">
            {filteredAlerts.length} of {alerts.length} alerts
          </span>
          <button
            onClick={() => exportCSV(filteredAlerts)}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Export CSV
          </button>
        </div>
        {filteredAlerts.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4">No alerts match the selected filter.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <th className="pb-3 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Time</th>
                <th className="pb-3 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Rule</th>
                <th className="pb-3 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Tx Hash</th>
                <th className="pb-3 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Function</th>
                <th className="pb-3 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Amount</th>
                <th className="pb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Delivery Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredAlerts.map((alert, i) => (
                <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3 pr-4 text-zinc-400 whitespace-nowrap">
                    {formatDateTime(alert.timestamp)}
                  </td>
                  <td className="py-3 pr-4">
                    <AlertRuleBadge type={alert.rule_triggered as AlertRuleType} />
                  </td>
                  <td className="py-3 pr-4">
                    <a
                      href={explorerTxUrl(network, alert.transaction_hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      {truncateId(alert.transaction_hash)}
                    </a>
                  </td>
                  <td className="py-3 pr-4 font-mono text-zinc-400">
                    {alert.function_name ?? 'N/A'}
                  </td>
                  <td className="py-3 pr-4 text-zinc-400">
                    {alert.amount !== undefined ? `${alert.amount} XLM` : 'N/A'}
                  </td>
                  <td className="py-3">
                    <DeliveryStatusBadge
                      status={alert.delivery_status}
                      retryCount={alert.delivery_retry_count}
                      lastAttempt={alert.delivery_last_attempt}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
