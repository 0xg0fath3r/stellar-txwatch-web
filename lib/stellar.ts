import { Network } from '@/types'

export const HORIZON_URLS: Record<Network, string> = {
  mainnet: 'https://horizon.stellar.org',
  testnet: 'https://horizon-testnet.stellar.org',
  futurenet: 'https://horizon-futurenet.stellar.org',
}

const mainnetRpcUrl =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL_MAINNET ||
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
  'https://mainnet.sorobanrpc.com'

if (
  typeof window !== 'undefined' &&
  !process.env.NEXT_PUBLIC_SOROBAN_RPC_URL_MAINNET &&
  !process.env.NEXT_PUBLIC_SOROBAN_RPC_URL
) {
  console.warn(
    '[stellar-txwatch-web] Warning: NEXT_PUBLIC_SOROBAN_RPC_URL_MAINNET is unset. Falling back to keyless public provider https://mainnet.sorobanrpc.com.',
  )
}

export const SOROBAN_RPC_URLS: Record<Network, string> = {
  mainnet: mainnetRpcUrl,
  testnet: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL_TESTNET || 'https://soroban-testnet.stellar.org',
  futurenet: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL_FUTURENET || 'https://rpc-futurenet.stellar.org',
}

export function getSorobanRpcUrl(network: Network): string {
  return SOROBAN_RPC_URLS[network]
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
