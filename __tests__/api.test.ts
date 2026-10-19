import { vi, beforeEach, describe, it, expect } from 'vitest'
import { apiFetch, sendTestWebhook, testApiConnection } from '@/lib/api'

// Clear stored API key between tests so auth header injection is predictable
vi.mock('@/lib/storage', () => ({
  getApiKey: vi.fn().mockReturnValue(null),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('apiFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches successfully and merges headers', async () => {
    const mockData = { id: 1 }
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const result = await apiFetch('/test', {
      headers: { 'X-Custom': 'value' },
    })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    )
    expect(result).toEqual(mockData)
  })

  it('throws error on non-OK response with text', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad request'),
    })

    await expect(apiFetch('/test')).rejects.toThrow('Bad request')
  })

  it('throws error on non-OK response without text', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve(''),
    })

    await expect(apiFetch('/test')).rejects.toThrow('HTTP 500')
  })
})

describe('sendTestWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends webhook with correct payload structure', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 })

    const result = await sendTestWebhook('https://example.com/webhook', 'CBCDEF')

    const call = mockFetch.mock.calls[0]
    const payload = JSON.parse(call[1].body)

    expect(payload).toMatchObject({
      label: 'Test Alert',
      contract_id: 'CBCDEF',
      network: 'testnet',
      rule_triggered: 'AnyTransaction',
    })
    expect(payload.transaction_hash).toMatch(/^TEST_HASH/)
    expect(result).toEqual({ ok: true, status: 200 })
  })

  it('returns { ok: false } on webhook failure without throwing', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 })

    const result = await sendTestWebhook('https://example.com/webhook', 'CBCDEF')
    expect(result).toEqual({ ok: false, status: 404 })
  })
})

describe('testApiConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns not-configured message when NEXT_PUBLIC_API_URL is empty', async () => {
    // BASE_URL is '' in test environment
    const result = await testApiConnection()
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/not configured/i)
  })
})
