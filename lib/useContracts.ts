'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { WatchedContract } from '@/types'
import { getContracts, saveContract, deleteContract, onContractsChange } from '@/lib/storage'

const UNDO_WINDOW_MS = 8000

export function useContracts() {
  const [contracts, setContracts] = useState<WatchedContract[]>([])
  const [pendingDeletions, setPendingDeletions] = useState<Record<string, WatchedContract>>({})
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const refresh = useCallback(() => {
    setContracts(getContracts())
  }, [])

  useEffect(() => {
    refresh()
    const unsubscribe = onContractsChange(refresh)
    return unsubscribe
  }, [refresh])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
    }
  }, [])

  function add(contract: WatchedContract) {
    saveContract(contract)
    refresh()
  }

  function remove(id: string | string[]) {
    const ids = Array.isArray(id) ? id : [id]
    const captured: Record<string, WatchedContract> = {}

    for (const contractId of ids) {
      const existing = getContracts().find((c) => c.id === contractId)
      if (!existing) continue
      captured[contractId] = existing
      deleteContract(contractId)
    }

    if (Object.keys(captured).length === 0) return

    setPendingDeletions((prev) => ({ ...prev, ...captured }))
    refresh()

    for (const contractId of Object.keys(captured)) {
      if (timersRef.current[contractId]) {
        clearTimeout(timersRef.current[contractId])
      }
      timersRef.current[contractId] = setTimeout(() => {
        delete timersRef.current[contractId]
        setPendingDeletions((prev) => {
          if (!(contractId in prev)) return prev
          const next = { ...prev }
          delete next[contractId]
          return next
        })
      }, UNDO_WINDOW_MS)
    }
  }

  function undoRemove(id: string | string[]) {
    const ids = Array.isArray(id) ? id : [id]
    const restored: Record<string, WatchedContract> = {}

    for (const contractId of ids) {
      const contract = pendingDeletions[contractId]
      if (!contract) continue
      restored[contractId] = contract
      if (timersRef.current[contractId]) {
        clearTimeout(timersRef.current[contractId])
        delete timersRef.current[contractId]
      }
      saveContract(contract)
    }

    if (Object.keys(restored).length === 0) return

    setPendingDeletions((prev) => {
      const next = { ...prev }
      for (const contractId of Object.keys(restored)) {
        delete next[contractId]
      }
      return next
    })
    refresh()
  }

  function setEnabled(id: string, enabled: boolean) {
    const existing = getContracts().find((c) => c.id === id)
    if (!existing) return
    saveContract({ ...existing, enabled })
    refresh()
  }

  function toggleEnabled(id: string) {
    const existing = getContracts().find((c) => c.id === id)
    if (!existing) return
    saveContract({ ...existing, enabled: !existing.enabled })
    refresh()
  }

  function update(contract: WatchedContract) {
    saveContract(contract)
    refresh()
  }

  return {
    contracts,
    add,
    remove,
    undoRemove,
    pendingDeletions,
    setEnabled,
    toggleEnabled,
    update,
    refresh,
  }
}