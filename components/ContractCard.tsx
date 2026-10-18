import Link from 'next/link'
import { useEffect, useState } from 'react'
import { WatchedContract } from '@/types'
import NetworkBadge from './NetworkBadge'
import { truncateId } from '@/lib/stellar'
import { formatDate } from '@/lib/format'

interface ContractCardProps {
  contract: WatchedContract
  lastAlertTime?: number
  highlight?: boolean
}

export default function ContractCard({ contract, lastAlertTime, highlight }: ContractCardProps) {
  const hasWebhook = Boolean(contract.webhook_url)
  const hasFallbackWebhook = Boolean(contract.fallback_webhook_url)
  const [active, setActive] = useState(highlight)

  useEffect(() => {
    if (!highlight) return
    setActive(true)
    const id = setTimeout(() => setActive(false), 2500)
    return () => clearTimeout(id)
  }, [highlight])

  return (
    <Link
      href={`/contracts/${contract.id}`}
      className={`block bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 hover:bg-zinc-800/60 transition-all group ${
        active ? 'ring-2 ring-indigo-500/40 animate-pulse' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-zinc-100 truncate group-hover:text-white">
            {contract.label}
          </h3>
          <p className="text-xs font-mono text-zinc-500 mt-0.5">
            {truncateId(contract.contract_id)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <NetworkBadge network={contract.network} />
          {hasFallbackWebhook && (
            <span
              className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400 border border-indigo-500/20"
              title={`Fallback webhook: ${contract.fallback_webhook_url}`}
            >
              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Fallback
            </span>
          )}
        </div>
      </div>

      {/* Webhook status indicator */}
      {!hasWebhook && (
        <div className="mb-3 flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/20">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>No webhook configured</span>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          <span className="text-zinc-300 font-medium">{contract.rules.length}</span>{' '}
          {contract.rules.length === 1 ? 'rule' : 'rules'} active
        </span>
        {lastAlertTime ? (
          <span>Last alert {formatDate(lastAlertTime)}</span>
        ) : (
          <span>No alerts yet</span>
        )}
      </div>
    </Link>
  )
}
