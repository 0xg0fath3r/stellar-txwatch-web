'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WatchedContract, AlertPayload, AlertRule } from '@/types'
import { getContract, deleteContract, getAlerts, saveContract } from '@/lib/storage'
import { useAnalytics } from '@/lib/useAnalytics'
import WebhookLog from '@/components/WebhookLog'
import ContractHeader from '@/components/ContractHeader'
import ContractMetadataCards from '@/components/ContractMetadataCards'
import ActiveRulesList from '@/components/ActiveRulesList'
import EditDetailsModal from '@/components/EditDetailsModal'
import EditRulesModal from '@/components/EditRulesModal'
import DeleteContractModal from '@/components/DeleteContractModal'
import ContractDetailLoading from './loading'

export default function ContractDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { trackEvent } = useAnalytics()

  const [contract, setContract] = useState<WatchedContract | null>(null)
  const [alerts, setAlerts] = useState<AlertPayload[]>([])
  const [contractNotFound, setContractNotFound] = useState(false)

  const [showDelete, setShowDelete] = useState(false)
  const [showEditDetails, setShowEditDetails] = useState(false)
  const [showEditRules, setShowEditRules] = useState(false)

  useEffect(() => {
    const c = getContract(params.id)
    if (!c) { setContractNotFound(true); return }
    setContract(c)
    setAlerts(getAlerts(params.id))
  }, [params.id])

  function handleDelete() {
    deleteContract(params.id)
    router.push('/contracts')
  }

  function handleSaveDetails(updated: WatchedContract) {
    saveContract(updated)
    setContract(updated)
    setShowEditDetails(false)
    trackEvent('metadata_edit_saved', { contractId: params.id })
  }

  function handleSaveRules(rules: AlertRule[]) {
    const updated = { ...contract!, rules }
    saveContract(updated)
    setContract(updated)
    setShowEditRules(false)
    trackEvent('rule_edit_saved', { contractId: params.id, ruleCount: rules.length })
  }

  if (contractNotFound) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-sm">
          <div className="flex justify-center">
            <svg className="w-16 h-16 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-100">Contract Not Found</h2>
          <p className="text-sm text-zinc-400">
            The contract you&apos;re looking for doesn&apos;t exist or has been deleted.
          </p>
          <button
            onClick={() => router.push('/contracts')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Contracts
          </button>
        </div>
      </div>
    )
  }

  if (!contract) return <ContractDetailLoading />

  return (
    <div className="space-y-8 max-w-4xl">
      <ContractHeader
        contract={contract}
        onEditDetails={() => {
          trackEvent('metadata_edit_opened', { contractId: params.id })
          setShowEditDetails(true)
        }}
        onEditRules={() => {
          trackEvent('rule_edit_opened', { contractId: params.id, ruleCount: contract.rules.length })
          setShowEditRules(true)
        }}
        onDelete={() => setShowDelete(true)}
      />

      <ContractMetadataCards contract={contract} alerts={alerts} />

      <ActiveRulesList rules={contract.rules} />

      <div>
        <h2 className="text-lg font-semibold text-zinc-100 mb-3">Alert History</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <WebhookLog alerts={alerts} network={contract.network} />
        </div>
      </div>

      {showEditDetails && (
        <EditDetailsModal
          contract={contract}
          onSave={handleSaveDetails}
          onClose={() => setShowEditDetails(false)}
        />
      )}

      {showEditRules && (
        <EditRulesModal
          initialRules={contract.rules}
          onSave={handleSaveRules}
          onClose={() => setShowEditRules(false)}
          onRuleEvent={(rules, action) =>
            trackEvent(action === 'remove' ? 'rule_removed' : 'rule_added', {
              contractId: params.id,
              ruleCount: rules.length,
            })
          }
        />
      )}

      {showDelete && (
        <DeleteContractModal
          contractLabel={contract.label}
          alertCount={alerts.length}
          onConfirm={handleDelete}
          onClose={() => setShowDelete(false)}
        />
      )}
    </div>
  )
}
