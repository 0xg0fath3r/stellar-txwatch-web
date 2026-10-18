import { HORIZON_URLS } from '@/lib/stellar'
import type { Network, WatchedContract } from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

/** Returns true when the backend API is configured. */
export function isApiConfigured(): boolean {
  return BASE_URL.length > 0
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers = new Headers(options?.headers)
  if (!headers.has('content-type')) {
    headers.set('Content-Type', 'application/json')
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

/** Fetch all contracts from the backend API (GET /contracts). */
export async function fetchContractsFromApi(): Promise<WatchedContract[]> {
  return apiFetch<WatchedContract[]>('/contracts')
}

/** Save (upsert) a contract to the backend API (POST /contracts). */
export async function saveContractToApi(contract: WatchedContract): Promise<WatchedContract> {
  return apiFetch<WatchedContract>('/contracts', {
    method: 'POST',
    body: JSON.stringify(contract),
  })
}

/** Delete a contract from the backend API (DELETE /contracts/:id). */
export async function deleteContractFromApi(id: string): Promise<void> {
  await apiFetch<void>(`/contracts/${id}`, { method: 'DELETE' })
}

export async function sendTestWebhook(
  webhookUrl: string,
  contractId: string,
  network: Network = 'testnet',
  signalOrTimeout?: AbortSignal | number
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

  let signal: AbortSignal | undefined
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  if (signalOrTimeout instanceof AbortSignal) {
    signal = signalOrTimeout
  } else {
    const timeoutMs = typeof signalOrTimeout === 'number' ? signalOrTimeout : 10000
    const controller = new AbortController()
    timeoutId = setTimeout(() => controller.abort(), timeoutMs)
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
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}
