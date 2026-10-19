import { isValidContractId } from '@/lib/stellar'

describe('isValidContractId', () => {
  it('accepts valid contract IDs', () => {
    expect(isValidContractId('CBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ2345')).toBe(
      true
    )
    expect(isValidContractId('CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7')).toBe(true)
  })

  it('rejects wrong prefix', () => {
    expect(isValidContractId('GBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ2345')).toBe(
      false
    )
  })

  it('rejects wrong length', () => {
    expect(isValidContractId('CBCDEF')).toBe(false)
    expect(isValidContractId('CBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ2345EXTRA')).toBe(
      false
    )
  })

  it('rejects lowercase input', () => {
    expect(isValidContractId('cbcdefghijklmnopqrstuvwxyz234567abcdefghijklmnopqrstuvwxyz2345')).toBe(
      false
    )
  })

  it('rejects invalid characters', () => {
    expect(isValidContractId('CBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ234!')).toBe(
      false
    )
  })
})

// ---------------------------------------------------------------------------
// Soroban RPC helper tests
// ---------------------------------------------------------------------------

const mockScValToNative = jest.fn((val: unknown) => val)

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk')
  return {
    ...actual,
    scValToNative: (val: unknown) => mockScValToNative(val),
  }
})

// Imported after the mock so the helpers pick up the mocked scValToNative.
import {
  checkContractExists,
  fetchContractMetadata,
  fetchContractEvents,
} from '@/lib/stellar'

const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7'

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response
}

describe('checkContractExists', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('returns exists true when an entry is present', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        result: {
          entries: [{ key: 'instance', xdr: 'AAAA' }],
          latestLedger: 1234,
        },
      })
    ) as unknown as typeof fetch

    const result = await checkContractExists(CONTRACT_ID, 'testnet')

    expect(result.exists).toBe(true)
    expect(result.error).toBeUndefined()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('returns exists false when the entry is null', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        result: {
          entries: null,
          latestLedger: 1234,
        },
      })
    ) as unknown as typeof fetch

    const result = await checkContractExists(CONTRACT_ID, 'testnet')

    expect(result.exists).toBe(false)
    expect(result.error).toBeUndefined()
  })

  it('surfaces an error when the RPC responds with an error', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          error: { code: -32600, message: 'Invalid request' },
        },
        true,
        200
      )
    ) as unknown as typeof fetch

    const result = await checkContractExists(CONTRACT_ID, 'testnet')

    expect(result.exists).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('returns a non-throwing error result when fetch rejects', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch

    const result = await checkContractExists(CONTRACT_ID, 'testnet')

    expect(result.exists).toBe(false)
    expect(result.error).toBeDefined()
  })
})

describe('fetchContractMetadata', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
    mockScValToNative.mockClear()
  })

  it('returns isSac true for SAC executables', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        result: {
          entries: [
            {
              key: 'instance',
              xdr: 'AAAA',
              lastModifiedLedgerSeq: 42,
              val: {
                contractData: {
                  val: {
                    executable: { sac: {} },
                  },
                },
              },
            },
          ],
          latestLedger: 100,
        },
      })
    ) as unknown as typeof fetch

    const metadata = await fetchContractMetadata(CONTRACT_ID, 'testnet')

    expect(metadata).toBeDefined()
    expect(metadata?.isSac).toBe(true)
    expect(metadata?.wasmHash).toBeUndefined()
  })

  it('returns a wasm hash for wasm executables', async () => {
    const wasmHash = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'

    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        result: {
          entries: [
            {
              key: 'instance',
              xdr: 'AAAA',
              lastModifiedLedgerSeq: 77,
              val: {
                contractData: {
                  val: {
                    executable: { wasm: wasmHash },
                  },
                },
              },
            },
          ],
          latestLedger: 100,
        },
      })
    ) as unknown as typeof fetch

    const metadata = await fetchContractMetadata(CONTRACT_ID, 'testnet')

    expect(metadata).toBeDefined()
    expect(metadata?.isSac).toBe(false)
    expect(metadata?.wasmHash).toBe(wasmHash)
    expect(metadata?.lastModifiedLedger).toBe(77)
  })
})

describe('fetchContractEvents', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
    mockScValToNative.mockClear()
  })

  it('builds a startLedger within retention and decodes topics via scValToNative', async () => {
    const latestLedger = 5000
    const retentionWindow = 1000

    mockScValToNative.mockImplementation((val: unknown) => {
      if (val === 'topic-xdr') return 'transfer'
      return val
    })

    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        result: {
          events: [
            {
              type: 'contract',
              ledger: 4990,
              txHash: 'deadbeef',
              topic: ['topic-xdr'],
              value: 'value-xdr',
            },
          ],
          latestLedger,
        },
      })
    ) as unknown as typeof fetch

    const events = await fetchContractEvents(CONTRACT_ID, 'testnet')

    expect(global.fetch).toHaveBeenCalledTimes(1)

    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(init.body)
    const startLedger = body.params.startLedger

    expect(typeof startLedger).toBe('number')
    expect(startLedger).toBeGreaterThan(0)
    expect(startLedger).toBeLessThanOrEqual(latestLedger)
    expect(latestLedger - startLedger).toBeLessThanOrEqual(retentionWindow)

    expect(mockScValToNative).toHaveBeenCalled()
    expect(events).toHaveLength(1)
    expect(events[0].topics).toContain('transfer')
  })
})