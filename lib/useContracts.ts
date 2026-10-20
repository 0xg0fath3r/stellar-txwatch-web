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

  const add = useCallback((contract: WatchedContract) => adapter.saveContract(contract), [adapter])
  const update = add
  const remove = useCallback((id: string) => adapter.deleteContract(id), [adapter])

  return { contracts, loading, add, remove, update, refresh }
}

export function useContract(id: string) {
  const adapter = useStorageAdapter()
  const [contract, setContract] = useState<WatchedContract | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setContract(await adapter.getContract(id))
    setLoading(false)
  }, [adapter, id])

  useEffect(() => {
    refresh()
    return adapter.subscribe((change) => {
      if (change === 'contracts') refresh()
    })
  }, [adapter, refresh])

  const save = useCallback((updated: WatchedContract) => adapter.saveContract(updated), [adapter])
  const remove = useCallback(() => adapter.deleteContract(id), [adapter, id])

  return { contract, loading, notFound: !loading && !contract, save, remove, refresh }
}
