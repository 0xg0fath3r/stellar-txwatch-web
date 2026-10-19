'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  isConnected,
  requestAccess,
  getPublicKey,
  getNetworkDetails,
} from '@stellar/freighter-api'

export interface FreighterState {
  publicKey: string | null
  network: string | null
  loading: boolean
  error: string | null
}

export function useFreighter() {
  const [state, setState] = useState<FreighterState>({
    publicKey: null,
    network: null,
    loading: false,
    error: null,
  })

  const initialize = useCallback(async () => {
    try {
      const { isConnected: connected, error: connectedError } = await isConnected()
      if (connectedError) {
        setState((prev) => ({ ...prev, error: 'Freighter not installed' }))
        return
      }
      if (connected) {
        const [keyResult, networkResult] = await Promise.all([
          getPublicKey(),
          getNetworkDetails(),
        ])
        if (keyResult.error) {
          setState((prev) => ({ ...prev, error: 'Connection rejected' }))
          return
        }
        if (networkResult.error) {
          setState((prev) => ({ ...prev, error: 'Failed to initialize Freighter' }))
          return
        }
        setState({
          publicKey: keyResult.address,
          network: networkResult.network,
          loading: false,
          error: null,
        })
      }
    } catch {
      setState((prev) => ({ ...prev, error: 'Failed to initialize Freighter' }))
    }
  }, [])

  useEffect(() => {
    initialize()
  }, [initialize])

  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const { isConnected: connected, error: connectedError } = await isConnected()
      if (connectedError || !connected) {
        window.open('https://www.freighter.app/', '_blank')
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Freighter not installed',
        }))
        return
      }

      const accessResult = await requestAccess()
      if (accessResult.error) {
        const message = accessResult.error.message ?? ''
        const isLocked = /lock/i.test(message)
        setState((prev) => ({
          ...prev,
          loading: false,
          error: isLocked ? 'Freighter is locked' : 'Connection rejected',
        }))
        return
      }

      const [keyResult, networkResult] = await Promise.all([
        getPublicKey(),
        getNetworkDetails(),
      ])
      if (keyResult.error) {
        setState((prev) => ({ ...prev, loading: false, error: 'Connection rejected' }))
        return
      }
      if (networkResult.error) {
        setState((prev) => ({ ...prev, loading: false, error: 'Failed to initialize Freighter' }))
        return
      }

      setState({
        publicKey: keyResult.address,
        network: networkResult.network,
        loading: false,
        error: null,
      })
    } catch {
      setState((prev) => ({ ...prev, loading: false, error: 'Connection rejected' }))
    }
  }, [])

  const disconnect = useCallback(() => {
    setState({ publicKey: null, network: null, loading: false, error: null })
  }, [])

  return { ...state, connect, disconnect, initialize }
}
