'use client'

import { useEffect, useState, useCallback } from 'react'
import { AlertPayload, WatchedContract } from '@/types'
import { useStorageAdapter } from '@/lib/StorageContext'

export function useAlerts(contractId: string | undefined) {
  const adapter = useStorageAdapter()
  const [alerts, setAlerts] = useState<AlertPayload[]>([])

  const refresh = useCallback(async () => {
    setAlerts(contractId ? await adapter.getAlerts(contractId) : [])
  }, [adapter, contractId])

  useEffect(() => {
    refresh()
    return adapter.subscribe((change) => {
      if (change === 'alerts') refresh()
    })
  }, [adapter, refresh])

  const add = useCallback((alert: AlertPayload) => adapter.addAlert(alert), [adapter])

  return { alerts, add, refresh }
}

export function useTodayAlertCount() {
  const adapter = useStorageAdapter()
  const [count, setCount] = useState(0)

  useEffect(() => {
    const refresh = async () => setCount(await adapter.getTodayAlertCount())
    refresh()
    return adapter.subscribe((change) => {
      if (change === 'alerts') refresh()
    })
  }, [adapter])

  return count
}

/** Timestamp of the most recent alert for each contract, keyed by contract_id. */
export function useLastAlertTimes(contracts: WatchedContract[]) {
  const adapter = useStorageAdapter()
  const [times, setTimes] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      const entries = await Promise.all(
        contracts.map(async (c) => [c.contract_id, (await adapter.getAlerts(c.contract_id))[0]?.timestamp] as const)
      )
      if (cancelled) return
      const next: Record<string, number> = {}
      for (const [contractId, timestamp] of entries) {
        if (timestamp !== undefined) next[contractId] = timestamp
      }
      setTimes(next)
    }
    refresh()
    const unsubscribe = adapter.subscribe((change) => {
      if (change === 'alerts') refresh()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [adapter, contracts])

  return times
}
