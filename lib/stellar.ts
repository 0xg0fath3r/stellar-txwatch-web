import { StrKey } from '@stellar/stellar-sdk'
import { Network } from '@/types'

const DEFAULT_HORIZON_URLS: Record<Network, string> = {
  mainnet: 'https://horizon.stellar.org',
  testnet: 'https://horizon-testnet.stellar.org',
  futurenet: 'https://horizon-futurenet.stellar.org',
}

const DEFAULT_SOROBAN_RPC_URLS: Record<Network, string> = {
  mainnet: 'https://mainnet.stellar.validationcloud.io/v1/soroban/rpc',
  testnet: 'https://soroban-testnet.stellar.org',
  futurenet: 'https://rpc-futurenet.stellar.org',
}

export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

const NETWORKS: Network[] = ['mainnet', 'testnet', 'futurenet']

function readEnv(name: string): string | undefined {
  const value = process.env[name]
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Resolve a per-network URL from environment variables.
 *
 * Resolution order for each network:
 *   1. `<prefix>_<NETWORK>` (e.g. NEXT_PUBLIC_SOROBAN_RPC_URL_MAINNET)
 *   2. Legacy single-variable form `<prefix>` (e.g. NEXT_PUBLIC_SOROBAN_RPC_URL),
 *      applied to testnet only for backwards compatibility.
 *   3. Hard-coded default.
 *
 * Overrides are validated with `isValidUrl`; invalid values are ignored and
 * fall through to the next source. Resolved URLs are logged in development.
 */
export function resolveUrlOverrides(
  prefix: string,
  defaults: Record<Network, string>,
  env: Record<string, string | undefined> = process.env,
): Record<Network, string> {
  const read = (name: string): string | undefined => {
    const value = env[name]
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  const resolved = {} as Record<Network, string>

  for (const network of NETWORKS) {
    const perNetworkVar = `${prefix}_${network.toUpperCase()}`
    const legacyVar = prefix

    let url = defaults[network]
    let source = 'default'

    const perNetworkValue = read(perNetworkVar)
    if (perNetworkValue !== undefined) {
      if (isValidUrl(perNetworkValue)) {
        url = perNetworkValue
        source = perNetworkVar
      } else if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[stellar] Ignoring invalid URL in ${perNetworkVar}: ${perNetworkValue}`,
        )
      }
    } else if (network === 'testnet') {
      const legacyValue = read(legacyVar)
      if (legacyValue !== undefined) {
        if (isValidUrl(legacyValue)) {
          url = legacyValue
          source = `${legacyVar} (legacy, applied to testnet)`
        } else if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[stellar] Ignoring invalid URL in ${legacyVar}: ${legacyValue}`,
          )
        }
      }
    }

    resolved[network] = url

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[stellar] ${prefix} for ${network} resolved from ${source}: ${url}`)
    }
  }

  return resolved
}

export const HORIZON_URLS: Record<Network, string> = resolveUrlOverrides(
  'NEXT_PUBLIC_HORIZON_URL',
  DEFAULT_HORIZON_URLS,
)

export const SOROBAN_RPC_URLS: Record<Network, string> = resolveUrlOverrides(
  'NEXT_PUBLIC_SOROBAN_RPC_URL',
  DEFAULT_SOROBAN_RPC_URLS,
)

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

const CONTRACT_ID_FORMAT = /^C[A-Z2-7]{55}$/

export type ContractIdValidationResult =
  | { valid: true }
  | { valid: false; reason: 'format' | 'checksum'; message: string }

/**
 * Validate a Stellar contract ID (StrKey `C...`).
 *
 * Distinguishes between a malformed ID (wrong prefix, length or alphabet) and
 * a well-formed ID whose CRC16 checksum does not verify (e.g. a one-character
 * typo).
 */
export function validateContractId(id: string): ContractIdValidationResult {
  if (typeof id !== 'string' || !CONTRACT_ID_FORMAT.test(id)) {
    return {
      valid: false,
      reason: 'format',
      message:
        'Invalid contract ID format: expected a 56-character string starting with "C" using the base32 alphabet (A-Z, 2-7).',
    }
  }

  if (!StrKey.isValidContract(id)) {
    return {
      valid: false,
      reason: 'checksum',
      message:
        'Invalid contract ID checksum: the ID looks well-formed but its checksum does not verify. Check for typos.',
    }
  }

  return { valid: true }
}

export function isValidContractId(id: string): boolean {
  return validateContractId(id).valid
}