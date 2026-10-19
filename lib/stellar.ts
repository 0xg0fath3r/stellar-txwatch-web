import { Network } from '@/types'
import { StrKey } from '@stellar/stellar-sdk'
import { SorobanRpc, Horizon, contract } from '@stellar/stellar-sdk'

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
  try {
    return StrKey.isValidContract(id)
  } catch {
    return false
  }
}

export function isValidAccountId(id: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(id)
  } catch {
    return false
  }
}

export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function getSorobanServer(network: Network): SorobanRpc.Server {
  return new SorobanRpc.Server(SOROBAN_RPC_URLS[network])
}

export function getHorizonServer(network: Network): Horizon.Server {
  return new Horizon.Server(HORIZON_URLS[network])
}

/**
 * Fetches the contract WASM via the Soroban RPC server and parses its spec
 * to return the list of exported function names.
 *
 * Returns `null` on any failure so callers can fall back to free text input.
 */
export async function fetchContractSpec(
  network: Network,
  contractId: string,
): Promise<string[] | null> {
  try {
    if (!isValidContractId(contractId)) return null

    const server = getSorobanServer(network)

    const ledgerKey = contract.getFootprintData ? undefined : undefined
    void ledgerKey

    const instance = await server.getContractData(
      contractId,
      contract.ScVal.scvLedgerKeyContractInstance(),
      SorobanRpc.Durability.Persistent,
    )

    const contractInstance = instance?.val
    if (!contractInstance || contractInstance.switch().name !== 'scvContractInstance') {
      return null
    }

    const executable = contractInstance.instance().executable()
    if (executable.switch().name !== 'contractExecutableWasm') {
      return null
    }

    const wasmHash = executable.wasmHash()
    const wasmResponse = await server.getContractWasmByHash(wasmHash, 'base64')
    const wasmBytes = Buffer.from(wasmResponse, 'base64')

    const spec = contract.Spec.fromWasm(wasmBytes)
    const funcs = spec.funcs()
    return funcs.map((fn) => fn.name().toString())
  } catch {
    return null
  }
}