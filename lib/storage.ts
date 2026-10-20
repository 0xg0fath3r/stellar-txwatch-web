import { z } from 'zod'
import { WatchedContract, AlertPayload, Network } from '@/types'
import { WatchedContractSchema, AlertPayloadSchema } from '@/lib/schemas'
import { emitStorageError, safeParseStorage } from '@/lib/storageLogger'

const CONTRACTS_KEY = 'txwatch_contracts'
const ALERTS_KEY = 'txwatch_alerts'
const STORAGE_VERSION_KEY = 'txwatch_storage_version'
const CURRENT_STORAGE_VERSION = 1

function getStorage(): Storage | undefined {
  if (typeof window !== 'undefined') return window.localStorage
  return (globalThis as unknown as { localStorage?: Storage }).localStorage
}

function load<S extends z.ZodTypeAny>(key: string, schema: S): z.infer<S>[] {
  const storage = getStorage()
  if (!storage) return []
  // Parse errors are reported to registered handlers by safeParseStorage
  const parsed = safeParseStorage<unknown>(key, [], storage)

  if (!Array.isArray(parsed)) {
    emitStorageError({
      key,
      rawValue: storage.getItem(key),
      error: new Error('Expected an array of entries'),
      timestamp: new Date().toISOString(),
    })
    return []
  }

  // Drop malformed or outdated entries instead of letting them crash render
  const valid: z.infer<S>[] = []
  for (const entry of parsed) {
    const result = schema.safeParse(entry)
    if (result.success) {
      valid.push(result.data)
    } else {
      emitStorageError({
        key,
        rawValue: JSON.stringify(entry) ?? null,
        error: result.error,
        timestamp: new Date().toISOString(),
      })
    }
  }
  return valid
}

const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 // 5MB typical limit
const MAX_ALERTS_PER_CONTRACT = 500
const ALERTS_RETENTION_DAYS = 90

function getStorageSize(): number {
  const storage = getStorage()
  if (!storage) return 0
  let size = 0
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (!key) continue
    const value = storage.getItem(key)
    if (value !== null) {
      size += value.length + key.length
    }
  }
  return size
}

function pruneOldAlerts() {
  const storage = getStorage()
  if (!storage) return
  const cutoff = Date.now() - ALERTS_RETENTION_DAYS * 24 * 60 * 60 * 1000
  const alerts = load(ALERTS_KEY, AlertPayloadSchema)
  const pruned = alerts.filter((a) => a.timestamp >= cutoff)
  if (pruned.length < alerts.length) {
    storage.setItem(ALERTS_KEY, JSON.stringify(pruned))
  }
}

function trimAlertsToCutoff(cutoff: number) {
  const storage = getStorage()
  if (!storage) return
  const alerts = load(ALERTS_KEY, AlertPayloadSchema)
  const trimmed = alerts.filter((a) => a.timestamp >= cutoff)
  if (trimmed.length < alerts.length) {
    storage.setItem(ALERTS_KEY, JSON.stringify(trimmed))
  }
}

function save<T>(key: string, data: T[]) {
  const storage = getStorage()
  if (!storage) return

  if (key !== ALERTS_KEY) {
    pruneOldAlerts()
  }

  if (key === ALERTS_KEY) {
    const size = getStorageSize()
    if (size > STORAGE_QUOTA_BYTES * 0.9) {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
      data = (data as AlertPayload[]).filter((a) => a.timestamp >= cutoff) as unknown as T[]
    }
    storage.setItem(key, JSON.stringify(data))
    return
  }

  storage.setItem(key, JSON.stringify(data))

  const size = getStorageSize()
  if (size > STORAGE_QUOTA_BYTES * 0.9) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    trimAlertsToCutoff(cutoff)
  }
}

function getStorageVersion(): number {
  const storage = getStorage()
  if (!storage) return CURRENT_STORAGE_VERSION
  return parseInt(storage.getItem(STORAGE_VERSION_KEY) ?? '0', 10)
}

function setStorageVersion(version: number) {
  const storage = getStorage()
  if (!storage) return
  storage.setItem(STORAGE_VERSION_KEY, version.toString())
}

export function migrateStorage(migrations: Record<number, () => void>) {
  const currentVersion = getStorageVersion()
  for (let v = currentVersion + 1; v <= CURRENT_STORAGE_VERSION; v++) {
    if (migrations[v]) {
      migrations[v]()
    }
  }
  setStorageVersion(CURRENT_STORAGE_VERSION)
}

export function getContracts(): WatchedContract[] {
  return load(CONTRACTS_KEY, WatchedContractSchema)
}

export function getContract(id: string): WatchedContract | undefined {
  return getContracts().find((c) => c.id === id)
}

export function getNetworkDistribution(): Record<Network, number> {
  return getContracts().reduce((counts, contract) => {
    counts[contract.network] = (counts[contract.network] ?? 0) + 1
    return counts
  }, {} as Record<Network, number>)
}

export function getContractByIdAndNetwork(
  contractId: string,
  network: string
): WatchedContract | undefined {
  return getContracts().find((c) => c.contract_id === contractId && c.network === network)
}

export function saveContract(contract: WatchedContract) {
  const contracts = getContracts().filter((c) => c.id !== contract.id)
  const updated = { ...contract, updated_at: Date.now() }
  save(CONTRACTS_KEY, [...contracts, updated])
}

export function deleteContract(id: string) {
  const contract = getContract(id)
  save(CONTRACTS_KEY, getContracts().filter((c) => c.id !== id))
  if (contract) {
    deleteAlerts(contract.contract_id)
  }
}

export function deleteAlerts(contractId: string) {
  const alerts = load(ALERTS_KEY, AlertPayloadSchema)
  save(ALERTS_KEY, alerts.filter((a) => a.contract_id !== contractId))
}

export function deleteAlert(alertId: string) {
  const alerts = load(ALERTS_KEY, AlertPayloadSchema)
  save(ALERTS_KEY, alerts.filter((a) => a.id !== alertId))
}

/** Most recent alert timestamp per contract_id, computed in a single pass. */
export function computeLastAlertTimes(alerts: AlertPayload[]): Record<string, number> {
  const times: Record<string, number> = {}
  for (const alert of alerts) {
    const current = times[alert.contract_id]
    if (current === undefined || alert.timestamp > current) {
      times[alert.contract_id] = alert.timestamp
    }
  }
  return times
}

// Keyed on the raw stored string so the alerts array is only re-parsed when it changes
let lastAlertTimesCache: { raw: string | null; times: Record<string, number> } | null = null

export function getLastAlertTimes(): Record<string, number> {
  const storage = getStorage()
  if (!storage) return {}
  const raw = storage.getItem(ALERTS_KEY)
  if (lastAlertTimesCache && lastAlertTimesCache.raw === raw) {
    return lastAlertTimesCache.times
  }
  const times = computeLastAlertTimes(load(ALERTS_KEY, AlertPayloadSchema))
  lastAlertTimesCache = { raw, times }
  return times
}

export function getAllAlerts(): AlertPayload[] {
  return load(ALERTS_KEY, AlertPayloadSchema)
}

export function getAlerts(contractId: string): AlertPayload[] {
  return load(ALERTS_KEY, AlertPayloadSchema).filter(
    (a) => a.contract_id === contractId
  )
}

export function seedMockAlerts(
  contractId: string,
  network: Network,
  count = 5
): void {
  const storage = getStorage()
  if (!storage) return

  const now = Date.now()
  const alerts = Array.from({ length: count }, (_, index) => {
    const sequence = index + 1
    const hash = `MOCK-${contractId.slice(0, 10)}-${sequence.toString().padStart(2, '0')}`
    const horizonHost = network === 'mainnet' ? 'horizon.stellar.org' : 'horizon-testnet.stellar.org'
    return {
      label: `Mock Alert ${sequence}`,
      contract_id: contractId,
      network,
      rule_triggered: 'AnyTransaction',
      transaction_hash: `${hash}-${Math.random().toString(16).slice(2, 18)}`,
      amount: 10 + index * 5,
      timestamp: now - index * 15 * 60 * 1000,
      horizon_link: `https://${horizonHost}/transactions/${hash}`,
    }
  })

  save(ALERTS_KEY, [...alerts, ...load(ALERTS_KEY, AlertPayloadSchema)])
}

export function addAlert(alert: AlertPayload | (AlertPayload & { contractId?: string; id?: string })) {
  const normalizedAlert = {
    ...alert,
    contract_id: alert.contract_id ?? (alert as { contractId?: string }).contractId,
  }
  const all = [...load(ALERTS_KEY, AlertPayloadSchema), normalizedAlert]
  const counts: Record<string, number> = {}
  save(ALERTS_KEY, all.filter((a) => {
    counts[a.contract_id] = (counts[a.contract_id] ?? 0) + 1
    return counts[a.contract_id] <= MAX_ALERTS_PER_CONTRACT
  }))
}

export function deleteAlertsByContractId(contractId: string) {
  const alerts = load(ALERTS_KEY, AlertPayloadSchema)
  save(ALERTS_KEY, alerts.filter((a) => a.contract_id !== contractId))
}

export const saveAlert = addAlert

export function getTodayAlertCount(): number {
  const start = new Date().setHours(0, 0, 0, 0)
  return load(ALERTS_KEY, AlertPayloadSchema).filter((a) => a.timestamp >= start).length
}

export function onAlertsChange(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === ALERTS_KEY) {
      callback()
    }
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}

export function onContractsChange(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === CONTRACTS_KEY) {
      callback()
    }
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}
