import { vi, describe, it, expect, beforeEach } from 'vitest'
import { apiFetch, sendTestWebhook } from '@/lib/api'

global.fetch = vi.fn()

describe('apiFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches successfully and merges headers', async () => {
    const mockData = { id: 1 }
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const result = await apiFetch('/test', {
      headers: { 'X-Custom': 'value' },
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    )
    // Verify the actual header values via the Headers object
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const headers: Headers = call[1].headers
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('X-Custom')).toBe('value')
    expect(result).toEqual(mockData)
  })

  it('throws error on non-OK response with text', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad request'),
    })

    await expect(apiFetch('/test')).rejects.toThrow('Bad request')
  })

  it('throws error on non-OK response without text', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
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
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200 })

    const result = await sendTestWebhook('https://example.com/webhook', 'CBCDEF')

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
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

  it('returns ok: false on webhook failure without throwing', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
    })

    const result = await sendTestWebhook('https://example.com/webhook', 'CBCDEF')
    expect(result).toEqual({ ok: false, status: 404 })
  })
})
