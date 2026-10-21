import {
  isValidContractId,
  truncateId,
  isValidUrl,
  explorerTxUrl,
  explorerContractUrl,
  STELLAR_EXPERT_BASE,
} from '@/lib/stellar'
import { Network } from '@/types'

describe('isValidContractId', () => {
  it('accepts valid C-addresses', () => {
    expect(isValidContractId('C' + 'A'.repeat(55))).toBe(true)
    expect(isValidContractId('C' + 'B'.repeat(55))).toBe(true)
    const mixed =
      'C' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567' + 'ABCDEFGHIJKLMNOPQRSTUVW'
    expect(mixed.length).toBe(56)
    expect(isValidContractId(mixed)).toBe(true)
  })

  it('rejects G-addresses', () => {
    expect(isValidContractId('G' + 'A'.repeat(55))).toBe(false)
  })

  it('rejects wrong prefix', () => {
    expect(isValidContractId('GBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ2345')).toBe(
      false
    )
  })

  it('rejects wrong length', () => {
    expect(isValidContractId('CBCDEF')).toBe(false)
    expect(isValidContractId('C' + 'A'.repeat(54))).toBe(false)
    expect(isValidContractId('C' + 'A'.repeat(56))).toBe(false)
  })

  it('rejects lowercase input', () => {
    expect(isValidContractId('c' + 'a'.repeat(55))).toBe(false)
  })

  it('rejects invalid characters', () => {
    expect(isValidContractId('C' + 'A'.repeat(54) + '!')).toBe(false)
    expect(isValidContractId('C' + 'A'.repeat(54) + '0')).toBe(false)
    expect(isValidContractId('C' + 'A'.repeat(54) + '1')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidContractId('')).toBe(false)
  })
})

describe('truncateId', () => {
  it('returns a short id unchanged', () => {
    expect(truncateId('abc')).toBe('abc')
    expect(truncateId('CABC1234')).toBe('CABC1234')
  })

  it('does not truncate at the exact boundary (chars * 2 + 3)', () => {
    const boundary = 'a'.repeat(8 * 2 + 3)
    expect(truncateId(boundary)).toBe(boundary)
    expect(truncateId(boundary).length).toBe(19)
  })

  it('truncates an id one character over the boundary', () => {
    const id = 'a'.repeat(20)
    expect(truncateId(id)).toBe(`${id.slice(0, 8)}...${id.slice(-8)}`)
  })

  it('truncates a long id in the middle', () => {
    const id = 'C' + 'B'.repeat(55)
    expect(truncateId(id)).toBe(`${id.slice(0, 8)}...${id.slice(-8)}`)
    expect(truncateId(id)).toContain('...')
  })

  it('honours a custom chars value', () => {
    const id = 'a'.repeat(4 * 2 + 3)
    expect(truncateId(id, 4)).toBe(id)

    const longer = 'a'.repeat(12)
    expect(truncateId(longer, 4)).toBe(`${longer.slice(0, 4)}...${longer.slice(-4)}`)
  })
})

describe('isValidUrl', () => {
  it('accepts http URLs', () => {
    expect(isValidUrl('http://example.com')).toBe(true)
  })

  it('accepts https URLs', () => {
    expect(isValidUrl('https://example.com/webhook')).toBe(true)
  })

  it('rejects ftp URLs', () => {
    expect(isValidUrl('ftp://example.com')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidUrl('')).toBe(false)
  })

  it('rejects malformed URLs', () => {
    expect(isValidUrl('not a url at all')).toBe(false)
    expect(isValidUrl('example.com')).toBe(false)
    expect(isValidUrl('https://')).toBe(false)
  })
})

describe('explorer URLs', () => {
  const cases: Array<{ network: Network; segment: string }> = [
    { network: 'mainnet', segment: 'public' },
    { network: 'testnet', segment: 'testnet' },
    { network: 'futurenet', segment: 'futurenet' },
  ]

  for (const { network, segment } of cases) {
    it(`maps ${network} to the "${segment}" tx segment`, () => {
      expect(explorerTxUrl(network, 'txhash')).toBe(
        `${STELLAR_EXPERT_BASE}/${segment}/tx/txhash`
      )
    })

    it(`maps ${network} to the "${segment}" contract segment`, () => {
      const contractId = 'C' + 'A'.repeat(55)
      expect(explorerContractUrl(network, contractId)).toBe(
        `${STELLAR_EXPERT_BASE}/${segment}/contract/${contractId}`
      )
    })
  }

  it('keeps testnet/futurenet names and renames only mainnet', () => {
    expect(explorerTxUrl('mainnet', 'h')).toContain('/public/')
    expect(explorerTxUrl('testnet', 'h')).toContain('/testnet/')
    expect(explorerTxUrl('futurenet', 'h')).toContain('/futurenet/')
  })
})
