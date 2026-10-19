import { useState, useEffect } from 'react'
import { isConnected, getPublicKey } from '@stellar/freighter-api'

export function useWallet() {
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [isConnectedState, setIsConnected] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function checkConnection() {
      try {
        const connected = await isConnected()
        if (cancelled) return

        if (!connected) {
          setIsConnected(false)
          setPublicKey(null)
          return
        }

        const keyResult = await getPublicKey()
        if (cancelled) return

        if (keyResult.error) {
          setIsConnected(false)
          setPublicKey(null)
          return
        }

        setIsConnected(true)
        setPublicKey(keyResult.publicKey)
      } catch {
        if (cancelled) return
        setIsConnected(false)
        setPublicKey(null)
      }
    }

    checkConnection()

    return () => {
      cancelled = true
    }
  }, [])

  return { publicKey, isConnected: isConnectedState }
}