'use client'

import { useEffect, useState, useCallback } from 'react'
import { WatchedContract } from '@/types'
import { useStorageAdapter } from '@/lib/StorageContext'

export function useContracts() {
  const adapter = useStorageAdapter()
  const [contracts, setContracts] = useState<WatchedContract[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setContracts(await adapter.getContracts())
    setLoading(false)
  }, [adapter])

  useEffect(() => {
    refresh()
    return adapter.subscribe((change) => {
      if (change === 'contracts') refresh()
    })
  }, [adapter, refresh])

  function add(contract: WatchedContract): void {
    saveContract(contract)
    refresh()
  }

  function remove(id: string): void {
    deleteContract(id)
    refresh()
  }

  function update(contract: WatchedContract): void {
    saveContract(contract)
    refresh()
    return adapter.subscribe((change) => {
      if (change === 'contracts') refresh()
    })
  }, [adapter, refresh])

  const save = useCallback((updated: WatchedContract) => adapter.saveContract(updated), [adapter])
  const remove = useCallback(() => adapter.deleteContract(id), [adapter, id])

  return { contract, loading, notFound: !loading && !contract, save, remove, refresh }
}
