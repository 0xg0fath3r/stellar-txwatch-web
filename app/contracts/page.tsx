'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { WatchedContract, Network } from '@/types'
import { getContracts, getAlerts, deleteContract } from '@/lib/storage'
import { STORAGE_KEYS } from '@/lib/storageKeys'
import { useContractListState } from '@/hooks/useContractListState'
import ContractCard from '@/components/ContractCard'
import ContractListToolbar from '@/components/ContractListToolbar'
import BulkActionBar from '@/components/BulkActionBar'
import EmptyState from '@/components/EmptyState'

const NETWORK_LABELS: Record<Network, string> = {
  mainnet: 'Mainnet',
  testnet: 'Testnet',
  futurenet: 'Futurenet',
}

export default function ContractsPage() {
  const searchParams = useSearchParams()
  const [allContracts, setAllContracts] = useState<WatchedContract[]>([])
  const [mounted, setMounted] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const list = useContractListState(allContracts, searchParams?.get('q') ?? '')

  useEffect(() => {
    setAllContracts(getContracts())
    setMounted(true)
  }, [])

  // Check for a recently-created contract id in sessionStorage and highlight it once
  useEffect(() => {
    try {
      const id = sessionStorage.getItem(STORAGE_KEYS.LAST_CREATED_CONTRACT)
      if (id) {
        setHighlightedId(id)
        sessionStorage.removeItem(STORAGE_KEYS.LAST_CREATED_CONTRACT)
        const t = setTimeout(() => setHighlightedId(null), 6000)
        return () => clearTimeout(t)
      }
    } catch {
      // ignore (server-side or storage issues)
    }
  }, [])

  const handleDeleteSelected = () => {
    for (const id of list.selectedIds) {
      deleteContract(id)
    }
    list.clearSelection()
    setAllContracts(getContracts())
  }

  if (!mounted) return null

  const hasAnyContracts = allContracts.length > 0
  const hasFilteredContracts = list.filtered.length > 0

  const renderCard = (contract: WatchedContract) => {
    const selected = list.selectedIds.includes(contract.id)
    return (
      <div key={contract.id} className="relative">
        <ContractCard
          contract={contract}
          lastAlertTime={getAlerts(contract.contract_id)[0]?.timestamp}
          highlight={highlightedId === contract.id}
        />
        <input
          type="checkbox"
          checked={selected}
          onChange={() => list.toggleSelected(contract.id)}
          aria-label={`Select ${contract.label}`}
          className="absolute bottom-3 right-3 h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-indigo-600"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ContractListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        networkFilter={list.networkFilter}
        onNetworkFilterChange={list.setNetworkFilter}
        networkCounts={list.networkCounts}
        sortBy={list.sortBy}
        onSortChange={list.setSortBy}
        viewMode={list.viewMode}
        onViewModeChange={list.setViewMode}
        hasAnyContracts={hasAnyContracts}
        resultCount={list.filtered.length}
      />

      {hasFilteredContracts && (
        <BulkActionBar
          selectedCount={list.selectedIds.length}
          allVisibleSelected={list.allVisibleSelected}
          onToggleSelectAll={list.toggleSelectAllVisible}
          onClearSelection={list.clearSelection}
          onDeleteSelected={handleDeleteSelected}
        />
      )}

      {!hasAnyContracts ? (
        <EmptyState
          title="No contracts yet"
          description="Register a Soroban contract to begin monitoring transactions and configuring alert rules."
          action={
            <Link
              href="/contracts/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
            >
              Add Contract
            </Link>
          }
        />
      ) : !hasFilteredContracts ? (
        <EmptyState
          title="No contracts found"
          description="No contracts match the active search or network filter. Try clearing the search or selecting a different network."
          action={
            <button
              onClick={list.clearFilters}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
            >
              Clear Filters
            </button>
          }
        />
      ) : list.viewMode === 'grouped' ? (
        <div className="space-y-8">
          {(Object.entries(NETWORK_LABELS) as [Network, string][]).map(([network, label]) => {
            const networkContracts = list.grouped[network]
            if (networkContracts.length === 0) return null
            return (
              <section key={network}>
                <h2 className="text-lg font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-500" />
                  {label}
                  <span className="text-sm font-normal text-zinc-500">({networkContracts.length})</span>
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {networkContracts.map(renderCard)}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.paginated.map(renderCard)}
          </div>

          {list.totalPages > 1 && (
            <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
              <span>Page {list.page} of {list.totalPages}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => list.setPage(list.page - 1)}
                  disabled={list.page === 1}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-200 hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => list.setPage(Math.min(list.totalPages, list.page + 1))}
                  disabled={list.page === list.totalPages}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-200 hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
