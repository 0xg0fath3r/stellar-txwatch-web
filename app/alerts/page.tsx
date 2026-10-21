'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  getContracts,
  getAlerts,
  onContractsChange,
  onAlertsChange,
} from '@/lib/storage'
import { WatchedContract, AlertPayload, AlertRuleType, Network } from '@/types'
import { truncateId, explorerContractUrl } from '@/lib/stellar'
import { formatDateTime } from '@/lib/format'
import EmptyState from '@/components/EmptyState'

interface AlertRow extends AlertPayload {
  contractLabel: string
}

export default function AlertsPage() {
  const [contracts, setContracts] = useState<WatchedContract[]>([])
  const [allAlerts, setAllAlerts] = useState<AlertRow[]>([])
  const [mounted, setMounted] = useState(false)
  const [filterContract, setFilterContract] = useState<string | null>(null)
  const [filterNetwork, setFilterNetwork] = useState<Network | null>(null)
  const [filterRule, setFilterRule] = useState<AlertRuleType | null>(null)

  useEffect(() => {
    const contracts = getContracts()
    setContracts(contracts)

    // Build alert rows with contract labels
    const contractMap = new Map(
      contracts.map((c) => [c.contract_id, c.label])
    )
    const alerts = getAllAlertsWithLabels(contracts)
    setAllAlerts(alerts)
    setMounted(true)

    // Subscribe to storage changes
    const unsubscribeContracts = onContractsChange(() => {
      const updated = getContracts()
      setContracts(updated)
      const contractMap = new Map(
        updated.map((c) => [c.contract_id, c.label])
      )
      setAllAlerts(getAllAlertsWithLabels(updated))
    })

    const unsubscribeAlerts = onAlertsChange(() => {
      setAllAlerts(getAllAlertsWithLabels(contracts))
    })

    return () => {
      unsubscribeContracts()
      unsubscribeAlerts()
    }
  }, [])

  const getAllAlertsWithLabels = useCallback(
    (contractsList: WatchedContract[]): AlertRow[] => {
      const contractMap = new Map(
        contractsList.map((c) => [c.contract_id, c.label])
      )
      const allAlerts: AlertPayload[] = contractsList.flatMap((c) =>
        getAlerts(c.contract_id)
      )
      return allAlerts
        .map((a) => ({
          ...a,
          contractLabel: contractMap.get(a.contract_id) ?? 'Unknown',
        }))
        .sort((a, b) => b.timestamp - a.timestamp)
    },
    []
  )

  const networks = [...new Set(contracts.map((c) => c.network))] as Network[]
  const ruleTypes: AlertRuleType[] = [
    'LargeTransfer',
    'AdminFunctionCalled',
    'AnyTransaction',
    'FunctionCalled',
    'TransactionFailed',
  ]

  const filteredAlerts = allAlerts.filter((a) => {
    if (filterContract && a.contract_id !== filterContract) return false
    if (filterNetwork && a.network !== filterNetwork) return false
    if (filterRule && a.rule_triggered !== filterRule) return false
    return true
  })

  if (!mounted) return null

  if (contracts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EmptyState
          title="No contracts registered"
          description="Add your first Soroban contract to see alerts in the global feed."
          action={
            <Link
              href="/contracts/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
            >
              Add Contract
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Global Alert Feed</h1>
          <p className="text-sm text-zinc-500 mt-1">
            All recent alerts across your monitored contracts
          </p>
        </div>
        <Link
          href="/contracts"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Contracts
        </Link>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterContract ?? ''}
          onChange={(e) =>
            setFilterContract(e.target.value || null)
          }
          className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Contracts</option>
          {contracts.map((c) => (
            <option key={c.id} value={c.contract_id}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={filterNetwork ?? ''}
          onChange={(e) =>
            setFilterNetwork((e.target.value as Network) || null)
          }
          className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Networks</option>
          {networks.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select
          value={filterRule ?? ''}
          onChange={(e) => setFilterRule((e.target.value as AlertRuleType) || null)}
          className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Rule Types</option>
          {ruleTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Results Count */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-zinc-500">
          {filteredAlerts.length} of {allAlerts.length} alerts
        </span>
      </div>

      {filteredAlerts.length === 0 ? (
        <EmptyState
          title="No matching alerts"
          description="Try adjusting your filters to see alerts."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <th className="pb-3 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Time</th>
                <th className="pb-3 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Contract</th>
                <th className="pb-3 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Rule</th>
                <th className="pb-3 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Tx Hash</th>
                <th className="pb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredAlerts.map((alert, i) => (
                <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3 pr-4 text-zinc-400 whitespace-nowrap">
                    {formatDateTime(alert.timestamp)}
                  </td>
                  <td className="py-3 pr-4">
                    <Link
                      href={explorerContractUrl(alert.network as Network, alert.contract_id)}
                      className="text-sm font-mono text-indigo-400 hover:text-indigo-300 transition-colors truncate max-w-[120px] block"
                    >
                      {alert.contractLabel}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono ${
                        alert.rule_triggered === 'TransactionFailed'
                          ? 'bg-red-900/30 text-red-400 border border-red-900/50'
                          : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      }`}
                    >
                      {alert.rule_triggered}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${alert.transaction_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      {truncateId(alert.transaction_hash)}
                    </a>
                  </td>
                  <td className="py-3 text-zinc-400">
                    {alert.amount !== undefined ? `${alert.amount} XLM` : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
