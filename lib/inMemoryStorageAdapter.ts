import { WatchedContract, AlertPayload } from '@/types'
import { StorageAdapter, StorageChange, StorageListener } from '@/lib/storageAdapter'

/**
 * Non-persistent StorageAdapter for tests and other environments without
 * localStorage. Returned values are copies so callers cannot mutate state.
 */
export class InMemoryStorageAdapter implements StorageAdapter {
  private contracts: WatchedContract[]
  private alerts: AlertPayload[]
  private listeners = new Set<StorageListener>()

  constructor(initial: { contracts?: WatchedContract[]; alerts?: AlertPayload[] } = {}) {
    this.contracts = [...(initial.contracts ?? [])]
    this.alerts = [...(initial.alerts ?? [])]
  }

  private notify(change: StorageChange) {
    this.listeners.forEach((listener) => listener(change))
  }

  async getContracts() {
    return this.contracts.map((c) => ({ ...c }))
  }

  async getContract(id: string) {
    const contract = this.contracts.find((c) => c.id === id)
    return contract ? { ...contract } : undefined
  }

  async saveContract(contract: WatchedContract) {
    this.contracts = [
      ...this.contracts.filter((c) => c.id !== contract.id),
      { ...contract, updated_at: Date.now() },
    ]
    this.notify('contracts')
  }

  async deleteContract(id: string) {
    const contract = this.contracts.find((c) => c.id === id)
    this.contracts = this.contracts.filter((c) => c.id !== id)
    this.notify('contracts')
    if (contract) {
      this.alerts = this.alerts.filter((a) => a.contract_id !== contract.contract_id)
      this.notify('alerts')
    }
  }

  async getAlerts(contractId: string) {
    return this.alerts.filter((a) => a.contract_id === contractId).map((a) => ({ ...a }))
  }

  async getAllAlerts() {
    return this.alerts.map((a) => ({ ...a }))
  }

  async addAlert(alert: AlertPayload) {
    this.alerts = [...this.alerts, { ...alert }]
    this.notify('alerts')
  }

  async getTodayAlertCount() {
    const start = new Date().setHours(0, 0, 0, 0)
    return this.alerts.filter((a) => a.timestamp >= start).length
  }

  subscribe(listener: StorageListener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}
