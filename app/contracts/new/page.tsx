'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertRule, Network, WatchedContract } from '@/types'
import { isValidContractId, isValidUrl } from '@/lib/stellar'
import { saveContract, getContracts } from '@/lib/storage'
import { sendTestWebhook } from '@/lib/api'
import { useFreighterConnection } from '@/lib/useFreighterConnection'
import RuleBuilder from '@/components/RuleBuilder'
import FreighterConnect from '@/components/FreighterConnect'

interface FormErrors {
  label?: string
  contract_id?: string
  webhook_url?: string
  rules?: string
  wallet?: string
  network?: string
}

interface ImportRowError {
  line: number
  message: string
}

interface ImportSummary {
  imported: number
  skipped: number
  errors: ImportRowError[]
}

const VALID_NETWORKS: Network[] = ['testnet', 'mainnet', 'futurenet']
const CSV_HEADER = ['contract_id', 'label', 'network', 'webhook_url']

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = false
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cells.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells.map((c) => c.trim())
}

export default function NewContractPage() {
  const router = useRouter()
  const { isConnected, publicKey } = useFreighterConnection()
  const [networkWarning, setNetworkWarning] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [contractId, setContractId] = useState('')
  const [network, setNetwork] = useState<Network>('testnet')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [rules, setRules] = useState<AlertRule[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [testError, setTestError] = useState<string | null>(null)
  const [testStatusCode, setTestStatusCode] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [importing, setImporting] = useState(false)
  const testAbortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => () => testAbortRef.current?.abort(), [])

  function handleWalletConnect() {
    setErrors((prev) => ({ ...prev, wallet: undefined }))
  }

  function validate(): FormErrors {
    const e: FormErrors = {}
    const trimmedLabel = label.trim()
    const trimmedContractId = contractId.trim()
    const trimmedWebhookUrl = webhookUrl.trim()

    if (!trimmedLabel) e.label = 'Label is required'
    if (!trimmedContractId) e.contract_id = 'Contract ID is required'
    else if (!isValidContractId(trimmedContractId)) e.contract_id = 'Must be a valid Soroban contract address (starts with C, 56 chars)'
    else {
      // Check for duplicate contract_id + network combination
      const isDuplicate = getContracts().some(
        (c) => c.contract_id === trimmedContractId && c.network === network
      )
      if (isDuplicate) e.contract_id = `This contract is already registered on ${network}`
    }
    if (!trimmedWebhookUrl) e.webhook_url = 'Webhook URL is required'
    else if (!isValidUrl(trimmedWebhookUrl)) e.webhook_url = 'Must be a valid http/https URL'
    if (rules.length === 0) e.rules = 'Add at least one alert rule'
    return e
  }

  function isFormValid(): boolean {
    return (
      label.trim().length > 0 &&
      label.length <= 100 &&
      contractId.trim().length > 0 &&
      isValidContractId(contractId.trim()) &&
      webhookUrl.trim().length > 0 &&
      isValidUrl(webhookUrl.trim()) &&
      rules.length > 0
    )
  }

  function isWalletConnected(): boolean {
    return isConnected && !!publicKey
  }

  async function checkNetworkMismatch(selectedNetwork: Network) {
    if (!window.freighter) return
    try {
      const walletNetwork = await window.freighter.getNetwork()
      const networkMap: Record<string, string> = {
        testnet: 'TESTNET',
        mainnet: 'PUBLIC',
        futurenet: 'FUTURENET',
      }
      const expectedNetwork = networkMap[selectedNetwork]
      if (walletNetwork !== expectedNetwork) {
        setNetworkWarning(
          `Your wallet is on ${walletNetwork}, but this contract is on ${selectedNetwork.toUpperCase()}`
        )
      } else {
        setNetworkWarning(null)
      }
    } catch {
      setNetworkWarning(null)
    }
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    if (!isConnected) {
      setErrors({ wallet: 'Connect your Freighter wallet to save contracts' })
      return
    }

    setSaving(true)
    const contract: WatchedContract = {
      id: crypto.randomUUID(),
      label: label.trim(),
      contract_id: contractId.trim(),
      network,
      rules,
      webhook_url: webhookUrl.trim(),
      created_at: Date.now(),
    }
    saveContract(contract)
    try {
      sessionStorage.setItem('txwatch_last_created_contract', contract.id)
    } catch {
      // ignore storage errors
    }
    setToast({ message: `Contract "${contract.label}" saved successfully!`, type: 'success' })
    setTimeout(() => {
      router.push(`/contracts/${contract.id}`)
    }, 1500)
  }

  async function handleTestWebhook() {
    const trimmedWebhookUrl = webhookUrl.trim()
    if (!trimmedWebhookUrl || !isValidUrl(trimmedWebhookUrl)) {
      setErrors((e) => ({ ...e, webhook_url: 'Enter a valid URL to test' }))
      return
    }
    testAbortRef.current?.abort()
    const controller = new AbortController()
    testAbortRef.current = controller
    const trimmedContractId = contractId.trim()
    if (!trimmedContractId || !isValidContractId(trimmedContractId)) {
      setErrors((e) => ({ ...e, contract_id: 'Enter a valid contract ID before testing' }))
      return
    }
    setTestStatus('sending')
    setTestError(null)
    setTestStatusCode(null)
    try {
      const { status, ok } = await sendTestWebhook(trimmedWebhookUrl, trimmedContractId, network, controller.signal)
      setTestStatusCode(status)
      if (ok) {
        setTestStatus('ok')
      } else {
        setTestStatus('error')
        setTestError(`Server responded with ${status}`)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setTestStatus('error')
      setTestError(err instanceof Error ? err.message : 'Request failed')
    }
  }

  function handleImportClick() {
    setImportSummary(null)
    fileInputRef.current?.click()
  }

  async function handleCsvFile(file: File) {
    if (!isConnected) {
      setErrors((prev) => ({ ...prev, wallet: 'Connect your Freighter wallet to import contracts' }))
      return
    }
    setImporting(true)
    setImportSummary(null)
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
      const rowErrors: ImportRowError[] = []
      let imported = 0
      let skipped = 0

      if (lines.length === 0) {
        setImportSummary({ imported: 0, skipped: 0, errors: [{ line: 0, message: 'CSV file is empty' }] })
        return
      }

      const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase())
      const hasHeader = CSV_HEADER.every((col) => header.includes(col))
      const colIndex: Record<string, number> = {}
      if (hasHeader) {
        CSV_HEADER.forEach((col) => { colIndex[col] = header.indexOf(col) })
      } else {
        CSV_HEADER.forEach((col, i) => { colIndex[col] = i })
      }

      const existing = getContracts()
      const seen = new Set(existing.map((c) => `${c.contract_id}:${c.network}`))
      const dataLines = hasHeader ? lines.slice(1) : lines

      dataLines.forEach((line, idx) => {
        const lineNumber = hasHeader ? idx + 2 : idx + 1
        const cells = parseCsvLine(line)
        const get = (col: string) => (cells[colIndex[col]] ?? '').trim()
        const rowContractId = get('contract_id')
        const rowLabel = get('label')
        const rowNetwork = get('network').toLowerCase()
        const rowWebhookUrl = get('webhook_url')

        const rowIssues: string[] = []
        if (!rowContractId) rowIssues.push('contract_id is required')
        else if (!isValidContractId(rowContractId)) rowIssues.push('invalid contract_id')
        if (!rowLabel) rowIssues.push('label is required')
        if (!rowNetwork) rowIssues.push('network is required')
        else if (!VALID_NETWORKS.includes(rowNetwork as Network)) rowIssues.push(`invalid network "${rowNetwork}"`)
        if (!rowWebhookUrl) rowIssues.push('webhook_url is required')
        else if (!isValidUrl(rowWebhookUrl)) rowIssues.push('invalid webhook_url')

        if (rowIssues.length === 0) {
          const key = `${rowContractId}:${rowNetwork}`
          if (seen.has(key)) rowIssues.push('duplicate contract already registered')
        }

        if (rowIssues.length > 0) {
          skipped++
          rowErrors.push({ line: lineNumber, message: rowIssues.join('; ') })
          return
        }

        const contract: WatchedContract = {
          id: crypto.randomUUID(),
          label: rowLabel,
          contract_id: rowContractId,
          network: rowNetwork as Network,
          rules: [],
          webhook_url: rowWebhookUrl,
          created_at: Date.now(),
        }
        saveContract(contract)
        seen.add(`${rowContractId}:${rowNetwork}`)
        imported++
      })

      setImportSummary({ imported, skipped, errors: rowErrors })
      setToast({
        message: `${imported} contract${imported === 1 ? '' : 's'} imported, ${skipped} skipped`,
        type: skipped > 0 ? 'error' : 'success',
      })
    } catch (err) {
      setImportSummary({
        imported: 0,
        skipped: 0,
        errors: [{ line: 0, message: err instanceof Error ? err.message : 'Failed to read CSV file' }],
      })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Add Contract</h1>
          <p className="text-sm text-zinc-500 mt-1">Register a Soroban contract to monitor</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleCsvFile(file)
            }}
          />
          <button
            type="button"
            onClick={handleImportClick}
            disabled={importing}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-zinc-700 text-zinc-200 hover:border-indigo-500 hover:text-indigo-300 transition-colors disabled:opacity-50"
          >
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
        </div>
      </div>

      {importSummary && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-2">
          <p className="text-sm text-zinc-200">
            {importSummary.imported} contract{importSummary.imported === 1 ? '' : 's'} imported, {importSummary.skipped} skipped
          </p>
          {importSummary.errors.length > 0 && (
            <ul className="space-y-1">
              {importSummary.errors.map((err, i) => (
                <li key={i} className="text-xs text-red-400">
                  {err.line > 0 ? `Row ${err.line}: ` : ''}{err.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-5">
        {/* Label */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Label</label>
          <input
            type="text"
            placeholder="e.g. My DEX Contract"
            value={label}
            onChange={(e) => { setLabel(e.target.value); setErrors((prev) => ({ ...prev, label: undefined })) }}
            maxLength={100}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <div className="flex justify-between items-start mt-1">
            <div>
              {errors.label && <p className="text-xs text-red-400">{errors.label}</p>}
            </div>
            <p className="text-xs text-zinc-500">{label.length}/100</p>
          </div>
        </div>

        {/* Contract ID */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Contract ID</label>
          <input
            type="text"
            placeholder="CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
            value={contractId}
            onChange={(e) => { setContractId(e.target.value); setErrors((prev) => ({ ...prev, contract_id: undefined })) }}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <p className="mt-1.5 text-xs text-zinc-400">Soroban contract addresses start with <span className="font-mono">C</span> and are 56 characters long</p>
          {errors.contract_id && <p className="mt-1 text-xs text-red-400">{errors.contract_id}</p>}
        </div>
      </div>
      </div>
    </>
  )
}
