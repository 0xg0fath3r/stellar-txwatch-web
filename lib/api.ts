import { HORIZON_URLS } from '@/lib/stellar'
import { getApiKey } from '@/lib/storage'
import type { Network } from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

/**
 * Returns authentication headers when an API key has been saved.
 * When `NEXT_PUBLIC_API_URL` is configured this header is included on
 * every request made via `apiFetch`.
 */
function getAuthHeaders(): Record<string, string> {
  const key = getApiKey()
  if (key) {
    return { Authorization: `Bearer ${key}` }
  }
  return {}
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers = new Headers(options?.headers)
  if (!headers.has('content-type')) {
    headers.set('Content-Type', 'application/json')
  }
  for (const [name, value] of Object.entries(getAuthHeaders())) {
    headers.set(name, value)
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
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

/**
 * Pings the txwatch-core health endpoint with the stored API key.
 *
 * Tries `GET /health` first. If the server returns 404 we fall back to
 * `GET /` so the button works even when the health route is not exposed.
 *
 * Returns `{ ok, status, message }`:
 * - `ok`      — true when a 2xx response is received
 * - `status`  — the HTTP status code (or 0 on network error)
 * - `message` — human-readable result string shown in the UI
 */
export async function testApiConnection(): Promise<{
  ok: boolean
  status: number
  message: string
}> {
  if (!BASE_URL) {
    return {
      ok: false,
      status: 0,
      message: 'NEXT_PUBLIC_API_URL is not configured',
    }
  }

  try {
    const headers = new Headers({ 'Content-Type': 'application/json' })
    for (const [name, value] of Object.entries(getAuthHeaders())) {
      headers.set(name, value)
    }

    const res = await fetch(`${BASE_URL}/health`, { headers })

    // If /health doesn't exist, try the root to confirm reachability
    if (res.status === 404) {
      const rootRes = await fetch(`${BASE_URL}/`, { headers })
      const ok = rootRes.ok
      return {
        ok,
        status: rootRes.status,
        message: ok
          ? `Connected (${rootRes.status})`
          : `Server reachable but returned ${rootRes.status}`,
      }
    }

    const ok = res.ok
    return {
      ok,
      status: res.status,
      message: ok ? `Connected (${res.status})` : `Server returned ${res.status}`,
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 0, message: `Connection failed: ${detail}` }
  }
}

export interface TestWebhookResult {
  status: number
  ok: boolean
}

/**
 * Sends a mock alert payload to a webhook URL so users can verify delivery
 * before going live. Returns `{ status, ok }` so callers can display the
 * HTTP response code.
 *
 * Pass an `AbortSignal` to cancel in-flight requests (e.g. on component
 * unmount or when the user navigates away).
 */
export async function sendTestWebhook(
  webhookUrl: string,
  contractId: string,
  network: Network = 'testnet',
  signal?: AbortSignal
): Promise<TestWebhookResult> {
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

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })

  return { status: res.status, ok: res.ok }
}
