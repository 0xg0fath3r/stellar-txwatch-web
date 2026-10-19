import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Networks } from '@stellar/stellar-sdk'
import FreighterConnect from '@/components/FreighterConnect'

describe('FreighterConnect', () => {
  beforeEach(() => {
    delete (window as any).freighter
    jest.clearAllMocks()
  })

  describe('connection states', () => {
    it('renders connect button when not connected', () => {
      render(<FreighterConnect />)
      expect(screen.getByText('Connect Freighter')).toBeInTheDocument()
    })

    it('renders connected state with public key', async () => {
      const mockPublicKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      ;(window as any).freighter = {
        isConnected: jest.fn().mockResolvedValue(true),
        getPublicKey: jest.fn().mockResolvedValue(mockPublicKey),
      }

      render(<FreighterConnect />)

      await waitFor(() => {
        expect(screen.getByText(/GAAA…AAAA/)).toBeInTheDocument()
      })
    })

    it('shows disconnect button when connected', async () => {
      const mockPublicKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      ;(window as any).freighter = {
        isConnected: jest.fn().mockResolvedValue(true),
        getPublicKey: jest.fn().mockResolvedValue(mockPublicKey),
      }

      render(<FreighterConnect />)

      await waitFor(() => {
        expect(screen.getByText('Disconnect')).toBeInTheDocument()
      })
    })

    it('disconnects when disconnect button is clicked', async () => {
      const mockPublicKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      ;(window as any).freighter = {
        isConnected: jest.fn().mockResolvedValue(true),
        getPublicKey: jest.fn().mockResolvedValue(mockPublicKey),
      }

      render(<FreighterConnect />)

      await waitFor(() => {
        expect(screen.getByText('Disconnect')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Disconnect'))

      await waitFor(() => {
        expect(screen.getByText('Connect Freighter')).toBeInTheDocument()
      })
    })
  })

  describe('rejection handling', () => {
    it('shows error when user rejects connection', async () => {
      ;(window as any).freighter = {
        isConnected: jest.fn().mockResolvedValue(false),
        getPublicKey: jest.fn().mockRejectedValue(new Error('User rejected')),
      }

      render(<FreighterConnect />)

      fireEvent.click(screen.getByText('Connect Freighter'))

      await waitFor(() => {
        expect(screen.getByText('Connection rejected')).toBeInTheDocument()
      })
    })

    it('clears error when user tries again', async () => {
      ;(window as any).freighter = {
        isConnected: jest.fn().mockResolvedValue(false),
        getPublicKey: jest
          .fn()
          .mockRejectedValueOnce(new Error('User rejected'))
          .mockResolvedValueOnce('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
      }

      render(<FreighterConnect />)

      fireEvent.click(screen.getByText('Connect Freighter'))

      await waitFor(() => {
        expect(screen.getByText('Connection rejected')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Connect Freighter'))

      await waitFor(() => {
        expect(screen.queryByText('Connection rejected')).not.toBeInTheDocument()
      })
    })
  })

  describe('unavailable extension', () => {
    it('shows error when extension is not installed', async () => {
      delete (window as any).freighter

      render(<FreighterConnect />)

      fireEvent.click(screen.getByText('Connect Freighter'))

      await waitFor(() => {
        expect(screen.getByText(/Freighter not installed/)).toBeInTheDocument()
      })
    })

    it('opens Freighter website when extension is not installed', async () => {
      delete (window as any).freighter
      const windowOpenSpy = jest.spyOn(window, 'open').mockImplementation()

      render(<FreighterConnect />)

      fireEvent.click(screen.getByText('Connect Freighter'))

      await waitFor(() => {
        expect(windowOpenSpy).toHaveBeenCalledWith('https://www.freighter.app/', '_blank')
      })

      windowOpenSpy.mockRestore()
    })
  })

  describe('callbacks', () => {
    it('calls onConnect callback when connection succeeds', async () => {
      const mockPublicKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      const onConnect = jest.fn()
      ;(window as any).freighter = {
        isConnected: jest.fn().mockResolvedValue(false),
        getPublicKey: jest.fn().mockResolvedValue(mockPublicKey),
      }

      render(<FreighterConnect onConnect={onConnect} />)

      fireEvent.click(screen.getByText('Connect Freighter'))

      await waitFor(() => {
        expect(onConnect).toHaveBeenCalledWith(mockPublicKey)
      })
    })

    it('calls onConnect callback on initial mount if already connected', async () => {
      const mockPublicKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      const onConnect = jest.fn()
      ;(window as any).freighter = {
        isConnected: jest.fn().mockResolvedValue(true),
        getPublicKey: jest.fn().mockResolvedValue(mockPublicKey),
      }

      render(<FreighterConnect onConnect={onConnect} />)

      await waitFor(() => {
        expect(onConnect).toHaveBeenCalledWith(mockPublicKey)
      })
    })
  })

  describe('network mismatch detection', () => {
    const mockPublicKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

    const setupFreighter = (networkPassphrase: string) => {
      ;(window as any).freighter = {
        isConnected: jest.fn().mockResolvedValue(true),
        getPublicKey: jest.fn().mockResolvedValue(mockPublicKey),
        getNetworkDetails: jest.fn().mockResolvedValue({
          network: 'CUSTOM',
          networkPassphrase,
          networkUrl: 'https://example.com',
        }),
      }
    }

    it('does not warn when wallet is on the public network', async () => {
      setupFreighter(Networks.PUBLIC)

      render(<FreighterConnect />)

      await waitFor(() => {
        expect(screen.getByText('Disconnect')).toBeInTheDocument()
      })

      expect(screen.queryByText(/Wallet is on/)).not.toBeInTheDocument()
    })

    it('does not warn when wallet is on the testnet network', async () => {
      setupFreighter(Networks.TESTNET)

      render(<FreighterConnect />)

      await waitFor(() => {
        expect(screen.getByText('Disconnect')).toBeInTheDocument()
      })

      expect(screen.queryByText(/Wallet is on/)).not.toBeInTheDocument()
    })

    it('does not warn when wallet is on the futurenet network', async () => {
      setupFreighter(Networks.FUTURENET)

      render(<FreighterConnect />)

      await waitFor(() => {
        expect(screen.getByText('Disconnect')).toBeInTheDocument()
      })

      expect(screen.queryByText(/Wallet is on/)).not.toBeInTheDocument()
    })

    it('shows custom network warning for an unknown passphrase', async () => {
      setupFreighter('Custom Network ; 2024')

      render(<FreighterConnect />)

      await waitFor(() => {
        expect(screen.getByText('Wallet is on a custom network')).toBeInTheDocument()
      })
    })
  })

  describe('loading state', () => {
    it('disables button while connecting', async () => {
      ;(window as any).freighter = {
        isConnected: jest.fn().mockResolvedValue(false),
        getPublicKey: jest.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve('GAAAA...'), 100))
        ),
      }

      render(<FreighterConnect />)

      const button = screen.getByText('Connect Freighter')
      fireEvent.click(button)

      await waitFor(() => {
        expect(button).toBeDisabled()
      })
    })
  })
})
