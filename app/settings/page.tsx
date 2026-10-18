'use client'

import { useState, useEffect } from 'react'
import {
  getSettings,
  saveSettings,
  resetSettings,
  exportAllLocalData,
  clearAllLocalData,
  DEFAULT_SETTINGS,
  type AppSettings,
} from '@/lib/storage'
import type { Network } from '@/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSettings(getSettings())
  }, [])

  if (!settings) return <div className="p-4 text-zinc-400">Loading…</div>

  const update = (partial: Partial<AppSettings>) => {
    setSettings(saveSettings(partial))
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleExport = () => {
    const json = exportAllLocalData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'txwatch-local-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClear = () => {
    if (confirm('Clear ALL local data? This cannot be undone.')) {
      clearAllLocalData()
      setSettings(DEFAULT_SETTINGS)
    }
  }

  return (
    <div className="p-4 max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>

      <label className="block">
        <span className="block mb-1 font-medium text-zinc-200">Default Network</span>
        <select
          value={settings.defaultNetwork}
          onChange={(e) => update({ defaultNetwork: e.target.value as Network })}
          className="border border-zinc-700 bg-zinc-900 text-zinc-100 p-2 w-full rounded"
        >
          <option value="testnet">Testnet</option>
          <option value="mainnet">Mainnet</option>
        </select>
      </label>

      <label className="block">
        <span className="block mb-1 font-medium text-zinc-200">Alert Retention (days)</span>
        <input
          type="number"
          min={1}
          value={settings.alertRetentionDays}
          onChange={(e) => update({ alertRetentionDays: parseInt(e.target.value, 10) || 90 })}
          className="border border-zinc-700 bg-zinc-900 text-zinc-100 p-2 w-full rounded"
        />
      </label>

      <label className="block">
        <span className="block mb-1 font-medium text-zinc-200">Theme Preference</span>
        <select
          value={settings.theme}
          onChange={(e) => update({ theme: e.target.value as AppSettings['theme'] })}
          className="border border-zinc-700 bg-zinc-900 text-zinc-100 p-2 w-full rounded"
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <p className="text-sm text-zinc-500 mt-1">
          Stored now; will apply when the theme toggle is implemented.
        </p>
      </label>

      <div className="space-y-2 border-t border-zinc-800 pt-4">
        <button onClick={handleExport} className="border border-zinc-700 text-zinc-200 px-4 py-2 block w-full rounded hover:bg-zinc-800">
          Export All Local Data
        </button>
        <button onClick={handleClear} className="border border-red-500 text-red-500 px-4 py-2 block w-full rounded hover:bg-red-950">
          Clear All Local Data
        </button>
        <button onClick={() => { setSettings(resetSettings()); setSaved(true); setTimeout(() => setSaved(false), 1500) }} className="border border-zinc-700 text-zinc-200 px-4 py-2 block w-full rounded hover:bg-zinc-800">
          Reset Settings to Defaults
        </button>
      </div>

      {saved && <p className="text-green-500 text-sm">Saved.</p>}
    </div>
  )
}
