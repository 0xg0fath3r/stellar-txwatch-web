import { HORIZON_URLS } from '@/lib/stellar'
import type { Network, AlertPayload } from '@/types'
import { addAlert } from '@/lib/storage'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

export function getAuthHeaders(): Record<string, string> {
  // Extension point for future authenticated requests
  // Implement token/header logic here
  return {}
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headersRecord: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (options?.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headersRecord[key] = value
      })
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => {
        headersRecord[key] = value
      })
    } else {
      Object.assign(headersRecord, options.headers)
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: headersRecord,
  })

  if (!res.ok) {
    const text = await res.text()
    let message = `HTTP ${res.status}`
    if (text) {
      try {
        const body = JSON.parse(text)
        message = body?.message || body?.error || text
      } catch {
        message = text
      }
    }
    throw new Error(message)
  }

  return res.json() as Promise<T>
}

export async function sendTestWebhook(
  webhookUrl: string,
  contractId: string,
  network: Network = 'testnet',
  signalOrTimeoutMs: AbortSignal | number = 10000
): Promise<{ status: number; ok: boolean }> {
  const payload = {
    label: 'Test Alert',
    contract_id: contractId,
    network,
    rule_triggered: 'AnyTransaction',
    transaction_hash:
      'TEST_HASH_0000000000000000000000000000000000000000000000000000000000000000',
    timestamp: Date.now(),
    horizon_link: `${HORIZON_URLS[network]}/transactions/test`,
  }

  let controller: AbortController | undefined
  let timeoutId: NodeJS.Timeout | number | undefined
  let signal: AbortSignal | undefined

  if (signalOrTimeoutMs instanceof AbortSignal) {
    signal = signalOrTimeoutMs
  } else if (typeof signalOrTimeoutMs === 'number') {
    controller = new AbortController()
    timeoutId = setTimeout(() => controller!.abort(), signalOrTimeoutMs)
    signal = controller.signal
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
    return { status: res.status, ok: res.ok }
  } catch (error) {
    const err = error as { name?: string }
    if (err?.name === 'AbortError') {
      throw new Error('Webhook request timed out')
    }
    throw error
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

function getEnvironmentScope(): typeof globalThis | undefined {
  if (typeof window !== 'undefined') return window
  if (typeof globalThis !== 'undefined') return globalThis
  return undefined
}

/**
 * Request browser Notification permission on first connection or user prompt.
 * Safe for SSR and non-supporting environments.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  const scope = getEnvironmentScope()
  if (!scope || !('Notification' in scope)) {
    return null
  }
  const NotificationClass = (scope as unknown as { Notification: typeof Notification }).Notification
  if (NotificationClass.permission === 'default') {
    return await NotificationClass.requestPermission()
  }
  return NotificationClass.permission
}

/**
 * Format alert notification title and body text.
 * Includes contract label, rule type, and amount if applicable.
 */
export function formatAlertNotification(alert: AlertPayload): { title: string; body: string } {
  const title = `Alert: ${alert.label}`
  const body = alert.amount !== undefined && alert.amount !== null
    ? `${alert.rule_triggered} - Amount: ${alert.amount} XLM`
    : `${alert.rule_triggered}`
  return { title, body }
}

/**
 * Show a browser push notification for a newly arrived alert.
 * Only triggers if:
 * 1. Notification API is supported and permission is granted
 * 2. Browser tab is in the background (document.hidden), unless forced via options
 */
export function showPushNotification(
  alert: AlertPayload,
  options?: { force?: boolean }
): Notification | null {
  const scope = getEnvironmentScope()
  if (!scope || !('Notification' in scope)) {
    return null
  }

  const NotificationClass = (scope as unknown as { Notification: typeof Notification }).Notification
  if (NotificationClass.permission !== 'granted') {
    return null
  }

  const doc = typeof document !== 'undefined'
    ? document
    : (scope as unknown as { document?: Document })?.document

  const isBackground = doc ? Boolean(doc.hidden) : false
  if (!options?.force && !isBackground) {
    return null
  }

  const { title, body } = formatAlertNotification(alert)
  try {
    const notification = new NotificationClass(title, {
      body,
      icon: '/favicon.ico',
      tag: alert.transaction_hash || `${alert.contract_id}-${alert.timestamp}`,
    })
    notification.onclick = () => {
      if (typeof window !== 'undefined' && window.focus) {
        window.focus()
      }
      if (alert.horizon_link && typeof window !== 'undefined' && window.open) {
        window.open(alert.horizon_link, '_blank')
      }
    }
    return notification
  } catch {
    return null
  }
}

export function getWebSocketUrl(contractId?: string): string {
  const explicitWs = process.env.NEXT_PUBLIC_WS_URL
  if (explicitWs) {
    return contractId ? `${explicitWs}?contractId=${encodeURIComponent(contractId)}` : explicitWs
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  const wsProto = apiUrl.startsWith('https') ? 'wss' : 'ws'
  const host = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const base = `${wsProto}://${host}/ws`
  return contractId ? `${base}?contractId=${encodeURIComponent(contractId)}` : base
}

export interface WebSocketAlertOptions {
  contractId?: string
  onAlert?: (alert: AlertPayload) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (error: Event) => void
  autoRequestPermission?: boolean
}

/**
 * Connect to real-time WebSocket alert updates.
 * - Requests Notification permission on first connection
 * - On receiving a new alert event, updates local storage and shows background push notification
 * - Automatically attempts reconnect with exponential backoff
 */
export function connectAlertWebSocket(options: WebSocketAlertOptions = {}): () => void {
  const scope = getEnvironmentScope()
  if (!scope || !('WebSocket' in scope)) {
    return () => {}
  }

  const WebSocketClass = (scope as unknown as { WebSocket: typeof WebSocket }).WebSocket

  const {
    contractId,
    onAlert,
    onOpen,
    onClose,
    onError,
    autoRequestPermission = true,
  } = options

  let ws: WebSocket | null = null
  let isClosed = false
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  let retryCount = 0
  const maxDelay = 30000
  const initialDelay = 1000

  function connect() {
    if (isClosed) return

    try {
      const url = getWebSocketUrl(contractId)
      ws = new WebSocketClass(url)

      ws.onopen = () => {
        retryCount = 0
        if (autoRequestPermission) {
          requestNotificationPermission().catch(() => {})
        }
        onOpen?.()
      }

      ws.onmessage = (event) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
          const alertCandidate = data?.payload || data
          if (alertCandidate && (alertCandidate.contract_id || alertCandidate.contractId)) {
            const alert = alertCandidate as AlertPayload
            addAlert(alert)
            showPushNotification(alert)
            onAlert?.(alert)
          }
        } catch {
          // ignore non-alert or malformed json messages
        }
      }

      ws.onerror = (event) => {
        onError?.(event)
      }

      ws.onclose = () => {
        onClose?.()
        if (!isClosed) {
          const delay = Math.min(initialDelay * Math.pow(2, retryCount), maxDelay)
          retryCount++
          reconnectTimeout = setTimeout(connect, delay)
        }
      }
    } catch {
      if (!isClosed) {
        const delay = Math.min(initialDelay * Math.pow(2, retryCount), maxDelay)
        retryCount++
        reconnectTimeout = setTimeout(connect, delay)
      }
    }
  }

  connect()

  return () => {
    isClosed = true
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
    }
    if (ws) {
      ws.close()
    }
  }
}
