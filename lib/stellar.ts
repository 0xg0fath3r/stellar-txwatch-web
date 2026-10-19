import { Network } from '@/types'
import {
  Address,
  ContractDataDurability,
  Keypair,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk'

export const HORIZON_URLS: Record<Network, string> = {
  mainnet: 'https://horizon.stellar.org',
  testnet: 'https://horizon-testnet.stellar.org',
  futurenet: 'https://horizon-futurenet.stellar.org',
}

export const SOROBAN_RPC_URLS: Record<Network, string> = {
  mainnet: 'https://mainnet.stellar.validationcloud.io/v1/soroban/rpc',
  testnet: 'https://soroban-testnet.stellar.org',
  futurenet: 'https://rpc-futurenet.stellar.org',
}

export const STELLAR_EXPERT_BASE = 'https://stellar.expert/explorer'

export function explorerTxUrl(network: Network, txHash: string): string {
  const net = network === 'mainnet' ? 'public' : network
  return `${STELLAR_EXPERT_BASE}/${net}/tx/${txHash}`
}

export function explorerContractUrl(network: Network, contractId: string): string {
  const net = network === 'mainnet' ? 'public' : network
  return `${STELLAR_EXPERT_BASE}/${net}/contract/${contractId}`
}

export function truncateId(id: string, chars = 8): string {
  if (id.length <= chars * 2 + 3) return id
  return `${id.slice(0, chars)}...${id.slice(-chars)}`
}

export function isValidContractId(id: string): boolean {
  return /^C[A-Z2-7]{55}$/.test(id)
}

export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Soroban RPC helpers
// ---------------------------------------------------------------------------

const SOROBAN_RPC_TIMEOUT_MS = 10_000

/**
 * Number of ledgers to look back when fetching events. Soroban RPC nodes only
 * retain a limited window of events, so we start within that window.
 */
const EVENT_RETENTION_LEDGERS = 10_000

export interface SorobanRpcError {
  code: number
  message: string
  data?: unknown
}

/**
 * Low-level JSON-RPC wrapper for Soroban RPC. POSTs a JSON-RPC 2.0 request to
 * the RPC endpoint for the given network. Throws on network failure, timeout,
 * HTTP errors, or JSON-RPC errors.
 */
export async function sorobanRpc<T = unknown>(
  network: Network,
  method: string,
  params: unknown,
  timeoutMs: number = SOROBAN_RPC_TIMEOUT_MS,
): Promise<T> {
  const url = SOROBAN_RPC_URLS[network]
  if (!url) {
    throw new Error(`No Soroban RPC URL configured for network: ${network}`)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Soroban RPC request timed out (${method})`)
    }
    throw err instanceof Error ? err : new Error(String(err))
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    throw new Error(`Soroban RPC HTTP error ${res.status} (${method})`)
  }

  let json: {
    result?: T
    error?: SorobanRpcError
  }
  try {
    json = await res.json()
  } catch {
    throw new Error(`Soroban RPC returned invalid JSON (${method})`)
  }

  if (json.error) {
    throw new Error(
      `Soroban RPC error ${json.error.code}: ${json.error.message}`,
    )
  }

  if (json.result === undefined) {
    throw new Error(`Soroban RPC returned no result (${method})`)
  }

  return json.result
}

/**
 * Builds the base64-encoded ledger key for a contract's instance entry.
 * The instance is a persistent ContractData entry whose key is the contract
 * address (ScVal) and whose value is the contract executable.
 */
export function contractInstanceKey(contractId: string): string {
  const address = Address.fromString(contractId)
  const contractScVal = address.toScVal()

  const ledgerKey = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: contractScVal,
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: ContractDataDurability.persistent(),
    }),
  )

  return ledgerKey.toXDR('base64')
}

export interface ContractExistsResult {
  exists: boolean
  error?: string
}

/**
 * Checks whether a contract instance exists on-chain for the given network.
 * Never throws — RPC failures are surfaced via the `error` field.
 */
export async function checkContractExists(
  network: Network,
  contractId: string,
): Promise<ContractExistsResult> {
  try {
    const key = contractInstanceKey(contractId)
    const result = await sorobanRpc<{
      entries?: Array<{ key: string; xdr: string; lastModifiedLedgerSeq?: number } | null>
    }>(network, 'getLedgerEntries', { keys: [key] })

    const entries = result.entries ?? []
    const exists = entries.some((entry) => entry != null)
    return { exists }
  } catch (err) {
    return {
      exists: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export interface ContractMetadata {
  wasmHash: string | null
  lastModifiedLedger: number | null
  isSac: boolean
}

export interface ContractMetadataResult extends ContractMetadata {
  error?: string
}

/**
 * Fetches contract metadata (WASM hash, last-modified ledger, SAC flag) via
 * Soroban RPC getLedgerEntries. Never throws — failures are surfaced via the
 * `error` field.
 */
export async function fetchContractMetadata(
  network: Network,
  contractId: string,
): Promise<ContractMetadataResult> {
  const empty: ContractMetadataResult = {
    wasmHash: null,
    lastModifiedLedger: null,
    isSac: false,
  }

  try {
    const key = contractInstanceKey(contractId)
    const result = await sorobanRpc<{
      entries?: Array<{
        key: string
        xdr: string
        lastModifiedLedgerSeq?: number
      } | null>
    }>(network, 'getLedgerEntries', { keys: [key] })

    const entry = (result.entries ?? []).find((e) => e != null)
    if (!entry) {
      return { ...empty, error: 'Contract instance not found' }
    }

    const lastModifiedLedger =
      typeof entry.lastModifiedLedgerSeq === 'number'
        ? entry.lastModifiedLedgerSeq
        : null

    let wasmHash: string | null = null
    let isSac = false

    try {
      const ledgerEntry = xdr.LedgerEntryData.fromXDR(entry.xdr, 'base64')
      const contractData = ledgerEntry.contractData()
      const val = contractData.val()
      const executable = val.contractData().val().instance().executable()

      if (executable.switch() === xdr.ContractExecutableType.contractExecutableWasm()) {
        const wasm = executable.wasm()
        wasmHash = Buffer.from(wasm).toString('hex')
      } else if (
        executable.switch() === xdr.ContractExecutableType.contractExecutableStellarAsset()
      ) {
        isSac = true
      }
    } catch {
      // Parsing failure — leave metadata fields null.
    }

    return { wasmHash, lastModifiedLedger, isSac }
  } catch (err) {
    return {
      ...empty,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export interface ContractEvent {
  id: string
  type: string
  topics: unknown[]
  value: unknown
  ledger: number
  txHash: string
  contractId: string
}

export interface ContractEventsResult {
  events: ContractEvent[]
  latestLedger: number | null
  error?: string
}

/**
 * Fetches recent contract events via Soroban RPC getEvents. Starts within the
 * RPC retention window. Decodes topics and value XDR via scValToNative.
 * Never throws — failures are surfaced via the `error` field.
 */
export async function fetchContractEvents(
  network: Network,
  contractId: string,
  limit = 20,
): Promise<ContractEventsResult> {
  try {
    const latest = await sorobanRpc<{ sequence: number }>(
      network,
      'getLatestLedger',
      {},
    )
    const latestLedger = typeof latest.sequence === 'number' ? latest.sequence : null

    if (latestLedger == null) {
      return { events: [], latestLedger: null, error: 'Unable to determine latest ledger' }
    }

    const startLedger = Math.max(1, latestLedger - EVENT_RETENTION_LEDGERS)

    const result = await sorobanRpc<{
      events?: Array<{
        id?: string
        type?: string
        ledger?: number
        ledgerClosedAt?: string
        contractId?: string
        txHash?: string
        topic?: string[]
        value?: string
      }>
      latestLedger?: number
    }>(network, 'getEvents', {
      startLedger,
      filters: [{ type: 'contract', contractIds: [contractId] }],
      pagination: { limit },
    })

    const rawEvents = result.events ?? []

    const events: ContractEvent[] = rawEvents.map((raw) => {
      const topics: unknown[] = (raw.topic ?? []).map((t) => {
        try {
          return scValToNative(xdr.ScVal.fromXDR(t, 'base64'))
        } catch {
          return t
        }
      })

      let value: unknown = raw.value
      if (typeof raw.value === 'string') {
        try {
          value = scValToNative(xdr.ScVal.fromXDR(raw.value, 'base64'))
        } catch {
          value = raw.value
        }
      }

      return {
        id: raw.id ?? '',
        type: raw.type ?? 'contract',
        topics,
        value,
        ledger: typeof raw.ledger === 'number' ? raw.ledger : 0,
        txHash: raw.txHash ?? '',
        contractId: raw.contractId ?? contractId,
      }
    })

    return {
      events,
      latestLedger: typeof result.latestLedger === 'number' ? result.latestLedger : latestLedger,
    }
  } catch (err) {
    return {
      events: [],
      latestLedger: null,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}