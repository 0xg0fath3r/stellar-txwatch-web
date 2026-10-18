'use client'

import { useEffect, useState, useCallback } from 'react'
import { WatchedContract } from '@/types'
import { getContracts, saveContract, deleteContract, onContractsChange } from '@/lib/storage'
import {
  isApiConfigured,
  fetchContractsFromApi,
  saveContractToApi,
  deleteContractFromApi,
} from '@/lib/api'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

export function useContracts() {
  const [contracts, setContracts] = useState<WatchedContract[]>([])
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')

  /** Reload contracts from localStorage (always used as a cache). */
  const refresh = useCallback(() => {
    setContracts(getContracts())
  }, [])

  /**
   * When the API is configured, fetch the authoritative list from the server
   * and reconcile it into localStorage (server is source of truth).
   */
  const syncFromApi = useCallback(async () => {
    if (!isApiConfigured()) return
    setSyncStatus('syncing')
    try {
      const remote = await fetchContractsFromApi()
      // Write each remote contract into localStorage
      for (const c of remote) {
        saveContract(c)
      }
      setContracts(getContracts())
      setSyncStatus('synced')
    } catch {
      setSyncStatus('error')
    }
  }, [])

  useEffect(() => {
    refresh()
    // Attempt initial API sync; fall back to local data silently on error
    syncFromApi()
    const unsubscribe = onContractsChange(refresh)
    return unsubscribe
  }, [refresh, syncFromApi])

  async function add(contract: WatchedContract) {
    // Optimistic local write
    saveContract(contract)
    refresh()
    // Mirror to API
    if (isApiConfigured()) {
      setSyncStatus('syncing')
      try {
        await saveContractToApi(contract)
        setSyncStatus('synced')
      } catch {
        setSyncStatus('error')
      }
    }
  }

  async function remove(id: string) {
    // Optimistic local delete
    deleteContract(id)
    refresh()
    // Mirror to API
    if (isApiConfigured()) {
      setSyncStatus('syncing')
      try {
        await deleteContractFromApi(id)
        setSyncStatus('synced')
      } catch {
        setSyncStatus('error')
      }
    }
  }

  async function update(contract: WatchedContract) {
    // Optimistic local write
    saveContract(contract)
    refresh()
    // Mirror to API
    if (isApiConfigured()) {
      setSyncStatus('syncing')
      try {
        await saveContractToApi(contract)
        setSyncStatus('synced')
      } catch {
        setSyncStatus('error')
      }
    }
  }

  return { contracts, add, remove, update, refresh, syncStatus, apiEnabled: isApiConfigured() }
}
