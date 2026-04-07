import { useState } from 'react'
import ManageAccessModal from '../ManageAccessModal'
import ShareChildModal from '../ShareChildModal'
import TextPromptModal from '../TextPromptModal'
import type { ChildAccount, ChildParentInfo } from '../../types/domain'

type ActionTab = 'account' | 'share' | 'ledger'

interface ShareAccessManagementProps {
  actionChild: ChildAccount | null
  onCloseActions: () => void
  onRequestRatesEdit: (child: ChildAccount) => void
  onToggleFreeze: (child: ChildAccount) => void
  onRequestCodeUpdate: (child: ChildAccount) => void
  onRequestShare: (child: ChildAccount) => void
  onRequestAccess: (child: ChildAccount) => void
  onViewLedger: (child: ChildAccount) => void
  sharingChild: ChildAccount | null
  onCreateShareCode: (permissions: string[]) => Promise<void>
  onCloseShare: () => void
  accessChild: ChildAccount | null
  accessParents: ChildParentInfo[]
  onRemoveAccess: (parentId: number) => Promise<void>
  onCloseAccess: () => void
  redeemOpen: boolean
  onRedeemCode: (value: string) => Promise<void>
  onCloseRedeem: () => void
  codeChild: ChildAccount | null
  onUpdateCode: (child: ChildAccount, value: string) => Promise<void>
  onCloseCodePrompt: () => void
}

export default function ShareAccessManagement({
  actionChild,
  onCloseActions,
  onRequestRatesEdit,
  onToggleFreeze,
  onRequestCodeUpdate,
  onRequestShare,
  onRequestAccess,
  onViewLedger,
  sharingChild,
  onCreateShareCode,
  onCloseShare,
  accessChild,
  accessParents,
  onRemoveAccess,
  onCloseAccess,
  redeemOpen,
  onRedeemCode,
  onCloseRedeem,
  codeChild,
  onUpdateCode,
  onCloseCodePrompt,
}: ShareAccessManagementProps) {
  const [actionTab, setActionTab] = useState<ActionTab>('account')

  return (
    <>
      {actionChild && (
        <div className="modal-overlay" onClick={onCloseActions}>
          <div
            className="modal actions-modal"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <h3>Actions for {actionChild.first_name}</h3>
            <div className="tabs">
              <button onClick={() => setActionTab('account')} className={actionTab === 'account' ? 'selected' : ''}>
                Account
              </button>
              <button onClick={() => setActionTab('share')} className={actionTab === 'share' ? 'selected' : ''}>
                Share
              </button>
              <button onClick={() => setActionTab('ledger')} className={actionTab === 'ledger' ? 'selected' : ''}>
                Ledger
              </button>
            </div>
            <div className="child-actions">
              {actionTab === 'account' && (
                <>
                  <button
                    onClick={() => {
                      onRequestRatesEdit(actionChild)
                      onCloseActions()
                    }}
                  >
                    Rates
                  </button>
                  <button
                    onClick={() => {
                      onToggleFreeze(actionChild)
                      onCloseActions()
                    }}
                  >
                    {actionChild.frozen ? 'Unfreeze' : 'Freeze'}
                  </button>
                  <button
                    onClick={() => {
                      onRequestCodeUpdate(actionChild)
                      onCloseActions()
                    }}
                  >
                    Change Code
                  </button>
                </>
              )}
              {actionTab === 'share' && (
                <>
                  <button
                    onClick={() => {
                      onRequestShare(actionChild)
                      onCloseActions()
                    }}
                  >
                    Share
                  </button>
                  <button
                    onClick={() => {
                      onRequestAccess(actionChild)
                      onCloseActions()
                    }}
                  >
                    Manage Access
                  </button>
                </>
              )}
              {actionTab === 'ledger' && (
                <button
                  onClick={() => {
                    onViewLedger(actionChild)
                    onCloseActions()
                  }}
                >
                  View Ledger
                </button>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" onClick={onCloseActions}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {sharingChild && (
        <ShareChildModal
          onSubmit={async (permissions) => {
            await onCreateShareCode(permissions)
          }}
          onCancel={onCloseShare}
        />
      )}

      {accessChild && (
        <ManageAccessModal
          parents={accessParents}
          onRemove={async (parentId) => {
            await onRemoveAccess(parentId)
          }}
          onClose={onCloseAccess}
        />
      )}

      {redeemOpen && (
        <TextPromptModal
          title="Redeem Share Code"
          label="Code"
          onCancel={onCloseRedeem}
          onSubmit={async (value) => {
            await onRedeemCode(value)
          }}
        />
      )}

      {codeChild && (
        <TextPromptModal
          title={`New access code for ${codeChild.first_name}`}
          label="Access Code"
          onCancel={onCloseCodePrompt}
          onSubmit={async (value) => {
            await onUpdateCode(codeChild, value)
          }}
        />
      )}
    </>
  )
}
