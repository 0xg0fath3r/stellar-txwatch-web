# Freighter Wallet Integration

This guide explains how the dashboard integrates with the Freighter wallet extension for Stellar identity and transaction signing.

## Overview

Freighter is a browser extension that manages Stellar keypairs and signs transactions. The dashboard uses it to:
- Authenticate users (get their public key)
- Verify the user's current network (Mainnet, Testnet, Futurenet)
- Sign and submit transactions to the Stellar network

## Freighter API Package

The dashboard talks to Freighter through the official [`@stellar/freighter-api`](https://www.npmjs.com/package/@stellar/freighter-api) package rather than the injected `window.freighter` global. The package handles extension detection, permission requests and error reporting consistently across browsers.

Install it with:

```bash
npm install @stellar/freighter-api
```

The methods used by the dashboard are:

```ts
import {
  isConnected,
  requestAccess,
  getPublicKey,
  getNetworkDetails,
  signTransaction,
} from '@stellar/freighter-api'

isConnected(): Promise<{ isConnected: boolean; error?: FreighterApiError }>
requestAccess(): Promise<{ address: string; error?: FreighterApiError }>
getPublicKey(): Promise<{ publicKey: string; error?: FreighterApiError }>
getNetworkDetails(): Promise<{
  network: string
  networkUrl: string
  networkPassphrase: string
  error?: FreighterApiError
}>
signTransaction(
  txXdr: string,
  options: { networkPassphrase: string; address?: string }
): Promise<{ signedTxXdr: string; signerAddress: string; error?: FreighterApiError }>
```

Every call returns a result object. When `error` is present the call failed; the `error.code` values used by the dashboard are `NOT_INSTALLED`, `NOT_ALLOWED` and `LOCKED`.

## Connection Flow

### 1. Check if Freighter is installed

```ts
const { isConnected: installed, error } = await isConnected()

if (error?.code === 'NOT_INSTALLED') {
  // Extension not installed — prompt user to install
  window.open('https://www.freighter.app/', '_blank')
}
```

### 2. Check if already connected

```ts
const { isConnected: connected } = await isConnected()
if (connected) {
  const { publicKey } = await getPublicKey()
  // User is already connected
}
```

### 3. Request connection

```ts
const { address, error } = await requestAccess()

if (error?.code === 'NOT_ALLOWED') {
  // User rejected the connection request
} else if (error?.code === 'LOCKED') {
  // Freighter is locked — ask the user to unlock it
} else if (address) {
  // User approved connection
}
```

## Getting User Info

After connection, retrieve the user's public key and network details:

```ts
const { publicKey } = await getPublicKey()
// e.g. "GAAAA..."

const { network, networkPassphrase } = await getNetworkDetails()
// network: e.g. "TESTNET", "PUBLIC", "FUTURENET"
// networkPassphrase: e.g. "Test SDF Network ; September 2015"
```

## Signing Transactions

To sign a transaction:

```ts
import { Transaction, Networks } from '@stellar/stellar-sdk'

// Build your transaction XDR
const tx = new Transaction(...)
const txXdr = tx.toEnvelope().toXDR('base64')

// Sign with Freighter
const { signedTxXdr, error } = await signTransaction(txXdr, {
  networkPassphrase: Networks.TESTNET_NETWORK_PASSPHRASE,
})

if (error) {
  // Handle signing failure (e.g. user rejected, wallet locked)
}
```

## Implementation in the Dashboard

### FreighterConnect Component

`components/FreighterConnect.tsx` wraps `@stellar/freighter-api` and provides:
- Connection state management
- Distinct handling of the "not installed", "not allowed" and "locked" states
- UI for connected/disconnected states
- Disconnect button

Usage:

```tsx
import FreighterConnect from '@/components/FreighterConnect'

export default function MyPage() {
  function handleConnect(publicKey: string) {
    console.log('Connected:', publicKey)
  }

  return <FreighterConnect onConnect={handleConnect} />
}
```

### Checking Connection in Forms

To verify the wallet is connected before saving data:

```ts
import { isConnected } from '@stellar/freighter-api'

async function isWalletConnected(): Promise<boolean> {
  const { isConnected: connected } = await isConnected()
  return connected
}

if (!(await isWalletConnected())) {
  setError('Connect your Freighter wallet first')
  return
}
```

## Network Mismatch Handling

The dashboard supports three networks: Mainnet, Testnet, and Futurenet. When a user selects a network for contract monitoring, verify it matches their wallet's current network:

```ts
import { getNetworkDetails } from '@stellar/freighter-api'

const { network: walletNetwork } = await getNetworkDetails()
const selectedNetwork = 'testnet' // from form

if (walletNetwork !== selectedNetwork.toUpperCase()) {
  console.warn(`Wallet is on ${walletNetwork}, but contract is on ${selectedNetwork}`)
  // Show warning to user
}
```

## Error Handling

Common error scenarios:

| Scenario | Error code | Handling |
|----------|------------|----------|
| Extension not installed | `NOT_INSTALLED` | Prompt to install Freighter |
| User rejects connection | `NOT_ALLOWED` | Show "Connection rejected" message |
| Wallet is locked | `LOCKED` | Ask user to unlock Freighter and retry |
| Network mismatch | `getNetworkDetails()` returns different network | Warn user to switch networks |
| Transaction signing fails | `error` on `signTransaction` result | Show error message to user |

## Testing

To test Freighter integration locally:

1. Install the [Freighter extension](https://www.freighter.app/)
2. Create a test account or import an existing keypair
3. Switch to Testnet in the extension settings
4. Run `npm run dev` and test the connection flow

For automated testing, mock the `@stellar/freighter-api` module in your test setup:

```ts
jest.mock('@stellar/freighter-api', () => ({
  isConnected: jest.fn().mockResolvedValue({ isConnected: true }),
  requestAccess: jest.fn().mockResolvedValue({ address: 'GAAAA...' }),
  getPublicKey: jest.fn().mockResolvedValue({ publicKey: 'GAAAA...' }),
  getNetworkDetails: jest.fn().mockResolvedValue({
    network: 'TESTNET',
    networkUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
  }),
  signTransaction: jest.fn().mockResolvedValue({ signedTxXdr: '...', signerAddress: 'GAAAA...' }),
}))
```
