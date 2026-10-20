'use client'

import RuleBuilder from '@/components/RuleBuilder'
import FreighterConnect from '@/components/FreighterConnect'
import { useNewContractForm } from '@/lib/useNewContractForm'

export default function NewContractPage() {
  const {
    label,
    setLabel,
    contractId,
    setContractId,
    network,
    setNetwork,
    webhookUrl,
    setWebhookUrl,
    rules,
    setRules,
    errors,
    setErrors,
    saving,
    setSaving,
    testStatus,
    setTestStatus,
    testError,
    setTestError,
    testStatusCode,
    setTestStatusCode,
    toast,
    setToast,
    networkWarning,
    setNetworkWarning,
    isConnected,
    publicKey,
    handleWalletConnect,
    validate,
    isFormValid,
    isWalletConnected,
    handleSave,
    handleTestWebhook,
    checkNetworkMismatch,
  } = useNewContractForm()

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Add Contract</h1>
        <p className="text-sm text-zinc-500 mt-1">Register a Soroban contract to monitor</p>
      </div>

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

        {/* Network */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Network</label>
          <select
            value={network}
            onChange={(e) => {
              const newNetwork = e.target.value as Network
              setNetwork(newNetwork)
              checkNetworkMismatch(newNetwork)
            }}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="testnet">Testnet</option>
            <option value="mainnet">Mainnet</option>
            <option value="futurenet">Futurenet</option>
          </select>
          {networkWarning && (
            <p className="mt-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2">
              ⚠️ {networkWarning}
            </p>
          )}
        </div>

        {/* Webhook URL */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Webhook URL</label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://your-server.com/webhook"
              value={webhookUrl}
              onChange={(e) => { setWebhookUrl(e.target.value); setErrors((prev) => ({ ...prev, webhook_url: undefined })); setTestStatus('idle'); setTestStatusCode(null) }}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              type="button"
              onClick={handleTestWebhook}
              disabled={testStatus === 'sending'}
              className="px-3 py-2.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-zinc-100 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {testStatus === 'sending' ? 'Sending…' : testStatus === 'ok' ? `${testStatusCode} OK` : testStatus === 'error' ? `${testStatusCode ?? 'ERR'} Failed` : 'Test'}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-zinc-400">HTTP and HTTPS are supported. Example: <span className="font-mono">https://api.example.com/alerts</span></p>
          {errors.webhook_url && <p className="mt-1 text-xs text-red-400">{errors.webhook_url}</p>}
          {testStatus === 'error' && testError && <p className="mt-1 text-xs text-red-400">{testError}</p>}
          {testStatus === 'ok' && <p className="mt-1 text-xs text-emerald-400">Test payload delivered — {testStatusCode} received</p>}
        </div>

        {/* Alert Rules */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Alert Rules</label>
          <RuleBuilder rules={rules} onChange={setRules} />
          {errors.rules && <p className="mt-1 text-xs text-red-400">{errors.rules}</p>}
        </div>

        {/* Wallet Connection */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Wallet</label>
          <FreighterConnect onConnect={handleWalletConnect} />
        </div>

        {errors.wallet && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            {errors.wallet}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isFormValid()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
          >
            {saving ? 'Saving...' : 'Save Contract'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
    </>
  )
}
