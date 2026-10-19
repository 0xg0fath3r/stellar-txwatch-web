export type Network = 'mainnet' | 'testnet' | 'futurenet'

export type AlertRuleType =
  | 'LargeTransfer'
  | 'AdminFunctionCalled'
  | 'AnyTransaction'
  | 'FunctionCalled'
  | 'TransactionFailed'

export type ExplorerId = 'stellar-expert' | 'stellarchain' | 'horizon'

export interface AppSettings {
  explorer: ExplorerId
}

export interface AlertRule {
  type: AlertRuleType
  threshold_xlm?: number
  asset?: string
  threshold?: number
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
  instanceLiveUntilLedgerSeq?: number
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