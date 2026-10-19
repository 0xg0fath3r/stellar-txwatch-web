import { useState, useEffect } from 'react'
import { isConnected, getPublicKey, isAllowed } from '@stellar/freighter-api'

export type FreighterStatus =
  | 'idle'
  | 'connected'
  | 'not-installed'
  | 'not-allowed'
  | 'locked'
  | 'error'

export function useFreighterConnection() {
  const [isConnectedState, setIsConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<FreighterStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkConnection()
  }, [])

  async function checkConnection() {
    setLoading(true)
    setError(null)
    try {
      const connectionResult = await isConnected()

      if (connectionResult.error) {
        // Distinguish "not installed" from other connection errors.
        const message = connectionResult.error.message || 'Freighter is not available'
        if (/install/i.test(message)) {
          setStatus('not-installed')
        } else {
          setStatus('error')
        }
        setError(message)
        setIsConnected(false)
        setPublicKey(null)
        return
      }

      if (!connectionResult.isConnected) {
        setStatus('not-installed')
        setIsConnected(false)
        setPublicKey(null)
        return
      }

      const allowedResult = await isAllowed()
      if (allowedResult.error) {
        setStatus('error')
        setError(allowedResult.error.message || 'Unable to check Freighter permissions')
        setIsConnected(false)
        setPublicKey(null)
        return
      }

      if (!allowedResult.isAllowed) {
        setStatus('not-allowed')
        setIsConnected(false)
        setPublicKey(null)
        return
      }

      const keyResult = await getPublicKey()
      if (keyResult.error) {
        const message = keyResult.error.message || 'Unable to retrieve public key'
        // A locked wallet typically surfaces here when access is denied.
        if (/lock/i.test(message)) {
          setStatus('locked')
        } else if (/allow|permission|denied/i.test(message)) {
          setStatus('not-allowed')
        } else {
          setStatus('error')
        }
        setError(message)
        setIsConnected(false)
        setPublicKey(null)
        return
      }

      setPublicKey(keyResult.publicKey)
      setIsConnected(true)
      setStatus('connected')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Freighter error'
      if (/lock/i.test(message)) {
        setStatus('locked')
      } else if (/allow|permission|denied/i.test(message)) {
        setStatus('not-allowed')
      } else if (/install/i.test(message)) {
        setStatus('not-installed')
      } else {
        setStatus('error')
      }
      setError(message)
      setIsConnected(false)
      setPublicKey(null)
    } finally {
      setLoading(false)
    }
  }

  return { isConnected: isConnectedState, publicKey, loading, status, error, refresh: checkConnection }
}