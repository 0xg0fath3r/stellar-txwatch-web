import { Network } from '@/types'

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

export type ExplorerId = 'stellar-expert' | 'stellar-chain' | 'horizon'

export interface ExplorerMeta {
  id: ExplorerId
  name: string
  description: string
}

export const EXPLORERS: ExplorerMeta[] = [
  {
    id: 'stellar-expert',
    name: 'Stellar Expert',
    description: 'Rich explorer with contract and transaction details.',
  },
  {
    id: 'stellar-chain',
    name: 'StellarChain',
    description: 'Alternative block explorer for the Stellar network.',
  },
  {
    id: 'horizon',
    name: 'Horizon (raw JSON)',
    description: 'View the raw Horizon API response for the transaction.',
  },
]

export const DEFAULT_EXPLORER: ExplorerId = 'stellar-expert'

export function isExplorerId(value: unknown): value is ExplorerId {
  return (
    value === 'stellar-expert' ||
    value === 'stellar-chain' ||
    value === 'horizon'
  )
}

function stellarExpertNet(network: Network): string {
  return network === 'mainnet' ? 'public' : network
}

function stellarChainNet(network: Network): string {
  return network === 'mainnet' ? 'public' : network
}

export function explorerTxUrl(
  network: Network,
  txHash: string,
  explorer: ExplorerId = DEFAULT_EXPLORER,
): string {
  switch (explorer) {
    case 'stellar-chain':
      return `https://stellarchain.io/${stellarChainNet(network)}/tx/${txHash}`
    case 'horizon':
      return `${HORIZON_URLS[network]}/transactions/${txHash}`
    case 'stellar-expert':
    default:
      return `${STELLAR_EXPERT_BASE}/${stellarExpertNet(network)}/tx/${txHash}`
  }
}

export function explorerContractUrl(
  network: Network,
  contractId: string,
  explorer: ExplorerId = DEFAULT_EXPLORER,
): string {
  switch (explorer) {
    case 'stellar-chain':
      return `https://stellarchain.io/${stellarChainNet(network)}/contracts/${contractId}`
    case 'horizon':
      // Horizon does not expose contracts directly; fall back to the account
      // endpoint which returns the raw JSON for the contract's account.
      return `${HORIZON_URLS[network]}/accounts/${contractId}`
    case 'stellar-expert':
    default:
      return `${STELLAR_EXPERT_BASE}/${stellarExpertNet(network)}/contract/${contractId}`
  }
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