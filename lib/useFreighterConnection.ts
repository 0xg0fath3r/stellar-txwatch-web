import { useState, useEffect } from 'react'
import { Networks } from '@stellar/stellar-sdk'

export type KnownNetwork = 'PUBLIC' | 'TESTNET' | 'FUTURENET' | 'CUSTOM'

export function getKnownNetworkFromPassphrase(
  passphrase: string | null | undefined
): KnownNetwork {
  if (!passphrase) return 'CUSTOM'
  switch (passphrase) {
    case Networks.PUBLIC:
      return 'PUBLIC'
    case Networks.TESTNET:
      return 'TESTNET'
    case Networks.FUTURENET:
      return 'FUTURENET'
    default:
      return 'CUSTOM'
  }
}

export function useFreighterConnection() {
  const [isConnected, setIsConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [networkPassphrase, setNetworkPassphrase] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkConnection()
  }, [])

  async function checkConnection() {
    try {
      if (!window.freighter) {
        setIsConnected(false)
        setLoading(false)
        return
      }
      const connected = await window.freighter.isConnected()
      if (connected) {
        const key = await window.freighter.getPublicKey()
        setPublicKey(key)
        setIsConnected(true)
        try {
          const details = await window.freighter.getNetworkDetails()
          setNetworkPassphrase(details?.networkPassphrase ?? null)
        } catch {
          setNetworkPassphrase(null)
        }
      } else {
        setIsConnected(false)
      }
    } catch {
      setIsConnected(false)
    } finally {
      setLoading(false)
    }
  }

  const knownNetwork = getKnownNetworkFromPassphrase(networkPassphrase)

  return { isConnected, publicKey, networkPassphrase, knownNetwork, loading }
}