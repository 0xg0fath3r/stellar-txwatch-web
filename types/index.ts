export type Network = 'mainnet' | 'testnet' | 'futurenet'

export type AlertRuleType =
  | 'LargeTransfer'
  | 'AdminFunctionCalled'
  | 'AnyTransaction'
  | 'FunctionCalled'
  | 'TransactionFailed'

export interface AlertRule {
  type: AlertRuleType
  threshold_xlm?: number
  function_names?: string[]
  function_name?: string
}

export interface WatchedContract {
  id: string
  label: string
  contract_id: string
  network: Network
  rules: AlertRule[]
  webhook_url: string
  created_at: number
  updated_at: number
}

export interface AlertPayload {
  label: string
  contract_id: string
  network: string
  rule_triggered: string
  transaction_hash: string
  function_name?: string
  amount?: number
  timestamp: number
  horizon_link: string
}

export interface ContractExistenceResult {
  exists: boolean
  error?: string
}

export interface ContractMetadata {
  wasmHash: string | null
  lastModifiedLedger: number
  isSac: boolean
}

export interface ContractEvent {
  id: string
  type: string
  topics: unknown[]
  value: unknown
  ledger: number
  txHash: string
  closedAt: string
}

export type ContractExistenceMap = Record<string, boolean | 'unknown'>