import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  apiFetch,
  sendTestWebhook,
  requestNotificationPermission,
  formatAlertNotification,
  showPushNotification,
  getWebSocketUrl,
  connectAlertWebSocket,
} from '@/lib/api'
import type { AlertPayload } from '@/types'

global.fetch = vi.fn()

describe('apiFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches successfully and merges headers', async () => {
    const mockData = { id: 1 }
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const result = await apiFetch('/test', {
      headers: { 'X-Custom': 'value' },
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Custom': 'value',
        }),
      })
    )
    expect(result).toEqual(mockData)
  })

  it('throws error on non-OK response with text', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad request'),
    })

    await expect(apiFetch('/test')).rejects.toThrow('Bad request')
  })

  it('throws error on non-OK response without text', async () => {
    ;(global.fetch as any).mockResolvedValue({
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

  it('sends webhook with correct payload structure and returns status', async () => {
    ;(global.fetch as any).mockResolvedValue({ ok: true, status: 200 })

    const result = await sendTestWebhook('https://example.com/webhook', 'CBCDEF')

    const call = (global.fetch as any).mock.calls[0]
    const payload = JSON.parse(call[1].body)

    expect(payload).toMatchObject({
      label: 'Test Alert',
      contract_id: 'CBCDEF',
      network: 'testnet',
      rule_triggered: 'AnyTransaction',
    })
    expect(payload.transaction_hash).toMatch(/^TEST_HASH/)
    expect(result).toEqual({ status: 200, ok: true })
  })

  it('handles non-ok response without uncaught error and returns status', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
    })

    const result = await sendTestWebhook('https://example.com/webhook', 'CBCDEF')
    expect(result).toEqual({ status: 404, ok: false })
  })

  it('supports passing AbortSignal', async () => {
    ;(global.fetch as any).mockResolvedValue({ ok: true, status: 200 })
    const controller = new AbortController()
    await sendTestWebhook('https://example.com/webhook', 'CBCDEF', 'testnet', controller.signal)
    const call = (global.fetch as any).mock.calls[0]
    expect(call[1].signal).toBe(controller.signal)
  })
})

describe('Web Push Notifications & WebSocket (#248 & #233)', () => {
  const originalNotification = globalThis.Notification
  const originalDocument = globalThis.document

  afterEach(() => {
    globalThis.Notification = originalNotification
    globalThis.document = originalDocument
    vi.restoreAllMocks()
  })

  describe('formatAlertNotification', () => {
    it('formats notification with contract label and rule type', () => {
      const alert: AlertPayload = {
        label: 'Vault Contract',
        contract_id: 'CAAAA123',
        network: 'testnet',
        rule_triggered: 'AdminFunctionCalled',
        transaction_hash: '0xabc',
        timestamp: Date.now(),
        horizon_link: 'https://horizon-testnet.stellar.org/transactions/0xabc',
      }
      const formatted = formatAlertNotification(alert)
      expect(formatted.title).toBe('Alert: Vault Contract')
      expect(formatted.body).toBe('AdminFunctionCalled')
    })

    it('includes amount if applicable', () => {
      const alert: AlertPayload = {
        label: 'Treasury',
        contract_id: 'CAAAA456',
        network: 'mainnet',
        rule_triggered: 'LargeTransfer',
        amount: 5000,
        transaction_hash: '0xdef',
        timestamp: Date.now(),
        horizon_link: 'https://horizon.stellar.org/transactions/0xdef',
      }
      const formatted = formatAlertNotification(alert)
      expect(formatted.title).toBe('Alert: Treasury')
      expect(formatted.body).toBe('LargeTransfer - Amount: 5000 XLM')
    })
  })

  describe('requestNotificationPermission', () => {
    it('requests permission if default and returns result', async () => {
      const mockRequest = vi.fn().mockResolvedValue('granted')
      ;(globalThis as any).Notification = {
        permission: 'default',
        requestPermission: mockRequest,
      }

      const res = await requestNotificationPermission()
      expect(mockRequest).toHaveBeenCalled()
      expect(res).toBe('granted')
    })

    it('returns existing permission if already granted or denied', async () => {
      const mockRequest = vi.fn()
      ;(globalThis as any).Notification = {
        permission: 'granted',
        requestPermission: mockRequest,
      }

      const res = await requestNotificationPermission()
      expect(mockRequest).not.toHaveBeenCalled()
      expect(res).toBe('granted')
    })
  })

  describe('showPushNotification', () => {
    const alert: AlertPayload = {
      label: 'Staking Pool',
      contract_id: 'C123',
      network: 'testnet',
      rule_triggered: 'TransactionFailed',
      amount: 10,
      transaction_hash: '0x123',
      timestamp: 1700000000,
      horizon_link: 'https://example.com',
    }

    it('returns null if permission is not granted', () => {
      ;(globalThis as any).Notification = class MockNotification {
        static permission = 'denied'
      }
      ;(globalThis as any).document = { hidden: true }

      const notif = showPushNotification(alert)
      expect(notif).toBeNull()
    })

    it('returns null if tab is active and not forced', () => {
      let created = false
      ;(globalThis as any).Notification = class MockNotification {
        static permission = 'granted'
        constructor() {
          created = true
        }
      }
      ;(globalThis as any).document = { hidden: false }

      const notif = showPushNotification(alert)
      expect(notif).toBeNull()
      expect(created).toBe(false)
    })

    it('displays notification when tab is in background (hidden)', () => {
      let createdTitle = ''
      let createdOptions: any = null
      ;(globalThis as any).Notification = class MockNotification {
        static permission = 'granted'
        constructor(title: string, options: any) {
          createdTitle = title
          createdOptions = options
        }
      }
      ;(globalThis as any).document = { hidden: true }

      const notif = showPushNotification(alert)
      expect(notif).not.toBeNull()
      expect(createdTitle).toBe('Alert: Staking Pool')
      expect(createdOptions.body).toContain('TransactionFailed - Amount: 10 XLM')
    })

    it('displays notification when forced even if tab is not hidden', () => {
      let createdTitle = ''
      ;(globalThis as any).Notification = class MockNotification {
        static permission = 'granted'
        constructor(title: string) {
          createdTitle = title
        }
      }
      ;(globalThis as any).document = { hidden: false }

      const notif = showPushNotification(alert, { force: true })
      expect(notif).not.toBeNull()
      expect(createdTitle).toBe('Alert: Staking Pool')
    })
  })

  describe('getWebSocketUrl', () => {
    it('derives ws URL from api url with contract id', () => {
      const url = getWebSocketUrl('CAAA999')
      expect(url).toContain('/ws?contractId=CAAA999')
    })
  })

  describe('connectAlertWebSocket', () => {
    it('creates WebSocket and requests permission onopen', () => {
      let wsInstance: any = null
      const mockRequest = vi.fn().mockResolvedValue('granted')
      ;(globalThis as any).Notification = {
        permission: 'default',
        requestPermission: mockRequest,
      }

      class MockWebSocket {
        url: string
        onopen: any = null
        onmessage: any = null
        onclose: any = null
        close = vi.fn()
        constructor(url: string) {
          this.url = url
          wsInstance = this
        }
      }
      ;(globalThis as any).WebSocket = MockWebSocket

      const disconnect = connectAlertWebSocket({ contractId: 'CAAA111' })
      expect(wsInstance).not.toBeNull()
      expect(wsInstance.url).toContain('contractId=CAAA111')

      // trigger onopen
      wsInstance.onopen()
      expect(mockRequest).toHaveBeenCalled()

      // cleanup
      disconnect()
      expect(wsInstance.close).toHaveBeenCalled()
    })
  })
})
