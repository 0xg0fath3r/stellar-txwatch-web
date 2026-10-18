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

export type DeliveryStatus = 'delivered' | 'retrying' | 'failed'

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
  /** Webhook delivery status reported by the core engine.
   *  Absent for older alerts stored before this field existed. */
  delivery_status?: DeliveryStatus
  /** Number of retry attempts the core engine has made for this alert. */
  delivery_retry_count?: number
  /** Timestamp (ms) of the last delivery attempt. */
  delivery_last_attempt?: number
}
