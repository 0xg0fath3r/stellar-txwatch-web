'use client'

import { AlertPayload, AlertRuleType } from '@/types'
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
    ['Time', 'Rule', 'Rule Name', 'Tx Hash', 'Function', 'Amount'],
    ...alerts.map((a) => [
      new Date(a.timestamp).toLocaleString(),
      a.rule_triggered,
      a.rule_name ?? '',
      a.transaction_hash,
      a.function_name ?? 'N/A',
      a.amount !== undefined ? `${a.amount} XLM` : 'N/A',
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

  return (
    <div className="space-y-4">
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
          /*
           * We use a div-based grid layout instead of a native <table> so that
           * react-virtual can absolutely position rows inside a single tall
           * container without breaking table semantics.  The visual appearance
           * is identical to the previous <table> implementation.
           */
          <div role="table" aria-label="Alert history" className="w-full text-sm min-w-[640px]">
            {/* Header */}
            <div
              role="row"
              className="grid border-b border-zinc-800 pb-3 mb-0"
              style={{ gridTemplateColumns: '160px 180px 1fr 140px 120px' }}
            >
              {['Time', 'Rule', 'Tx Hash', 'Function', 'Amount'].map((h) => (
                <div
                  key={h}
                  role="columnheader"
                  className="pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider"
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Virtualised scrollable body */}
            <div
              ref={parentRef}
              role="rowgroup"
              style={{ height: VIEWPORT_HEIGHT, overflowY: 'auto' }}
            >
              {/* Total height spacer — tells the browser the true scroll height */}
              <div
                style={{
                  height: virtualizer.getTotalSize(),
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const alert = filteredAlerts[virtualRow.index]
                  return (
                    <div
                      key={virtualRow.key}
                      role="row"
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      className="grid hover:bg-zinc-800/30 transition-colors border-b border-zinc-800/50"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                        minHeight: ROW_HEIGHT,
                        alignItems: 'center',
                        gridTemplateColumns: '160px 180px 1fr 140px 120px',
                      }}
                    >
                      <div role="cell" className="pr-4 text-zinc-400 whitespace-nowrap text-xs">
                        {formatDateTime(alert.timestamp)}
                      </div>
                      <div role="cell" className="pr-4 flex flex-col gap-0.5 justify-center">
                        <AlertRuleBadge type={alert.rule_triggered as AlertRuleType} />
                        {alert.rule_name && (
                          <span className="text-xs text-zinc-400 truncate" title={alert.rule_name}>
                            {alert.rule_name}
                          </span>
                        )}
                      </div>
                      <div role="cell" className="pr-4">
                        <a
                          href={explorerTxUrl(network, alert.transaction_hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          {truncateId(alert.transaction_hash)}
                        </a>
                      </div>
                      <div role="cell" className="pr-4 font-mono text-zinc-400 text-xs truncate">
                        {alert.function_name ?? 'N/A'}
                      </div>
                      <div role="cell" className="text-zinc-400 text-xs">
                        {alert.amount !== undefined ? `${alert.amount} XLM` : 'N/A'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
