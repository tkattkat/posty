import { useState } from 'react'
import { FolderPlus, Clock, ChevronDown, Folder, Upload, Sun, Moon, Monitor, RefreshCw, Edit2, GitCompare, Check, Trash2, AlertTriangle, X, Lock, Plus, Save, Eye, EyeOff } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { useCollectionStore } from '../../stores/collectionStore'
import { useRequestStore } from '../../stores/requestStore'
import { ImportModal } from '../ImportModal/ImportModal'
import { EditSpecModal } from '../Modals/EditSpecModal'
import { DiffModal } from '../Modals/DiffModal'
import type { Collection, HttpRequest, HistoryEntry, SecretVariable } from '../../types'

const methodBadgeClass: Record<string, string> = {
  GET: 'method-badge method-badge-get',
  POST: 'method-badge method-badge-post',
  PUT: 'method-badge method-badge-put',
  PATCH: 'method-badge method-badge-patch',
  DELETE: 'method-badge method-badge-delete',
  OPTIONS: 'method-badge method-badge-options',
  HEAD: 'method-badge method-badge-head',
}

function CollectionItem({
  collection,
  depth = 0,
  onEditSpec,
  onDeleteCollection,
  onEditSecrets,
  activeSourceRequestId,
}: {
  collection: Collection
  depth?: number
  onEditSpec?: (collection: Collection) => void
  onDeleteCollection?: (collection: Collection) => void
  onEditSecrets?: (collection: Collection) => void
  activeSourceRequestId?: string | null
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const { addTab } = useRequestStore()

  const hasOpenApiSource = !!collection.openApiSource

  return (
    <div>
      <div
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover rounded cursor-pointer transition-colors group"
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-text-muted transition-transform duration-150" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
          <ChevronDown className="w-3 h-3" />
        </span>
        <Folder className="w-3.5 h-3.5 text-text-tertiary" />
        <span className="text-[13px] font-medium truncate flex-1 text-text-secondary group-hover:text-text-primary">{collection.name}</span>
        {hasOpenApiSource && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEditSpec?.(collection)
            }}
            className="p-1 rounded hover:bg-bg-active opacity-0 group-hover:opacity-100 transition-opacity"
            title={
              collection.openApiSource?.type === 'url'
                ? 'Refresh from URL'
                : collection.openApiSource?.type === 'file'
                  ? 'Refresh from file'
                  : 'Edit spec'
            }
          >
            {collection.openApiSource?.type === 'url' || collection.openApiSource?.type === 'file' ? (
              <RefreshCw className="w-3 h-3 text-text-muted hover:text-text-secondary" />
            ) : (
              <Edit2 className="w-3 h-3 text-text-muted hover:text-text-secondary" />
            )}
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEditSecrets?.(collection)
          }}
          className="p-1 rounded hover:bg-bg-active opacity-0 group-hover:opacity-100 transition-opacity"
          title="Collection secrets"
        >
          <Lock className="w-3 h-3 text-text-muted hover:text-text-secondary" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDeleteCollection?.(collection)
          }}
          className="p-1 rounded hover:bg-error-muted opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete collection"
        >
          <Trash2 className="w-3 h-3 text-text-muted hover:text-error" />
        </button>
        <span className="text-[11px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
          {collection.requests.length}
        </span>
      </div>

      {isExpanded && (
        <div>
          {collection.requests.map((request) => (
            <div
              key={request.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors group ${
                activeSourceRequestId === request.id
                  ? 'bg-accent/12 ring-1 ring-accent/20'
                  : 'hover:bg-bg-hover'
              }`}
              style={{ paddingLeft: `${(depth + 1) * 12 + 12}px` }}
              onClick={() => addTab(request, { collectionId: collection.id, requestId: request.id })}
            >
              {request.type === 'http' && (
                <span className={methodBadgeClass[request.method]}>
                  {request.method.slice(0, 3)}
                </span>
              )}
              <span
                className={`text-[13px] truncate transition-colors ${
                  activeSourceRequestId === request.id
                    ? 'text-text-primary'
                    : 'text-text-tertiary group-hover:text-text-secondary'
                }`}
              >
                {request.name}
              </span>
            </div>
          ))}
          {collection.folders.map((folder) => (
            <CollectionItem
              key={folder.id}
              collection={folder}
              depth={depth + 1}
              onEditSpec={onEditSpec}
              onDeleteCollection={onDeleteCollection}
              onEditSecrets={onEditSecrets}
              activeSourceRequestId={activeSourceRequestId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryPanel({
  onCompare,
  activeSourceRequestId,
}: {
  onCompare: (left: HistoryEntry, right: HistoryEntry) => void
  activeSourceRequestId?: string | null
}) {
  const { history } = useCollectionStore()
  const { addTab } = useRequestStore()
  const [compareMode, setCompareMode] = useState(false)
  const [selected, setSelected] = useState<HistoryEntry[]>([])

  if (history.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Clock className="w-5 h-5" />
        </div>
        <p className="empty-state-title">No history yet</p>
        <p className="empty-state-desc">Your requests will appear here</p>
      </div>
    )
  }

  const handleClick = (entry: HistoryEntry) => {
    if (compareMode) {
      if (selected.some(s => s.id === entry.id)) {
        setSelected(selected.filter(s => s.id !== entry.id))
      } else if (selected.length < 2) {
        const newSelected = [...selected, entry]
        setSelected(newSelected)
        if (newSelected.length === 2) {
          onCompare(newSelected[0], newSelected[1])
          setCompareMode(false)
          setSelected([])
        }
      }
    } else {
      addTab(entry.request, {
        collectionId: entry.sourceCollectionId,
        requestId: entry.sourceRequestId ?? entry.request.id,
      })
    }
  }

  const toggleCompareMode = () => {
    setCompareMode(!compareMode)
    setSelected([])
  }

  return (
    <div className="flex flex-col h-full">
      {/* Compare button */}
      <div className="px-2 pb-2">
        <button
          onClick={toggleCompareMode}
          className={`w-full flex items-center justify-center gap-1.5 text-[12px] py-1.5 rounded transition-colors ${
            compareMode
              ? 'bg-accent text-white'
              : 'btn-ghost'
          }`}
        >
          <GitCompare className="w-3.5 h-3.5" />
          {compareMode ? `Select 2 to compare (${selected.length}/2)` : 'Compare'}
        </button>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-auto py-1">
        {history.slice(0, 30).map((entry) => {
          const isSelected = selected.some(s => s.id === entry.id)
          const isActiveEntry = activeSourceRequestId === entry.request.id
          return (
            <div
              key={entry.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors group ${
                isSelected
                  ? 'bg-accent/20'
                  : isActiveEntry
                    ? 'bg-accent/12 ring-1 ring-accent/20'
                    : 'hover:bg-bg-hover'
              }`}
              onClick={() => handleClick(entry)}
            >
              {compareMode && (
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'bg-accent border-accent' : 'border-border'
                }`}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
              )}
              {entry.request.type === 'http' && (
                <span className={methodBadgeClass[(entry.request as HttpRequest).method]}>
                  {(entry.request as HttpRequest).method.slice(0, 3)}
                </span>
              )}
              <span
                className={`text-[13px] truncate flex-1 transition-colors ${
                  isActiveEntry
                    ? 'text-text-primary'
                    : 'text-text-tertiary group-hover:text-text-secondary'
                }`}
              >
                {entry.request.type === 'http' ? (() => {
                  try { return new URL((entry.request as HttpRequest).url).pathname }
                  catch { return (entry.request as HttpRequest).url || entry.request.name }
                })() : entry.request.name}
              </span>
              <span className="text-[10px] text-text-muted tabular-nums font-mono">
                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DeleteCollectionModal({
  collection,
  onClose,
  onConfirm,
}: {
  collection: Collection
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass-elevated rounded-lg flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-error" />
            <span className="text-[14px] font-medium">Delete Collection</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors text-text-muted hover:text-text-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4">
          <p className="text-[13px] text-text-primary">
            Delete "{collection.name}" and all nested requests/folders?
          </p>
          <p className="mt-2 text-[12px] text-text-secondary">
            This cannot be undone.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-error text-white hover:opacity-90 transition-opacity"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

function CollectionSecretsModal({
  collection,
  onClose,
  onSave,
}: {
  collection: Collection
  onClose: () => void
  onSave: (secrets: SecretVariable[]) => void
}) {
  const [draftSecrets, setDraftSecrets] = useState<SecretVariable[]>(
    collection.secrets?.length
      ? collection.secrets
      : [{ id: crypto.randomUUID(), name: '', value: '' }]
  )
  const [error, setError] = useState('')
  const [showSecretValues, setShowSecretValues] = useState(false)

  const updateSecret = (id: string, field: 'name' | 'value', value: string) => {
    setDraftSecrets((current) => current.map((secret) => (secret.id === id ? { ...secret, [field]: value } : secret)))
  }

  const addSecret = () => {
    setDraftSecrets((current) => [...current, { id: crypto.randomUUID(), name: '', value: '' }])
  }

  const removeSecret = (id: string) => {
    setDraftSecrets((current) => current.filter((secret) => secret.id !== id))
  }

  const handleSave = () => {
    const cleanedSecrets = draftSecrets
      .map((secret) => ({ ...secret, name: secret.name.trim() }))
      .filter((secret) => secret.name && secret.value)

    const secretNames = cleanedSecrets.map((secret) => secret.name)
    const hasDuplicateNames = new Set(secretNames).size !== secretNames.length

    if (hasDuplicateNames) {
      setError('Secret names must be unique')
      return
    }

    setError('')
    onSave(cleanedSecrets)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl glass-elevated rounded-lg flex flex-col animate-scale-in max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-accent" />
            <span className="text-[14px] font-medium">Collection Secrets</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors text-text-muted hover:text-text-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-auto">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[12px] text-text-secondary">
              Secrets are scoped to "{collection.name}". Use `/` in header value fields to insert them as hidden tokens.
            </p>
            <button
              type="button"
              onClick={() => setShowSecretValues((current) => !current)}
              className="btn-ghost flex items-center gap-1.5 text-[12px] whitespace-nowrap"
            >
              {showSecretValues ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showSecretValues ? 'Hide values' : 'Show values'}
            </button>
          </div>

          <div className="space-y-3">
            {draftSecrets.map((secret) => (
              <div key={secret.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={secret.name}
                  onChange={(e) => updateSecret(secret.id, 'name', e.target.value)}
                  placeholder="SECRET_NAME"
                  className="min-w-0 flex-1 input-field font-mono text-sm"
                />
                <input
                  type={showSecretValues ? 'text' : 'password'}
                  value={secret.value}
                  onChange={(e) => updateSecret(secret.id, 'value', e.target.value)}
                  placeholder="Secret value"
                  className="min-w-0 flex-1 input-field text-sm"
                />
                <button
                  onClick={() => removeSecret(secret.id)}
                  className="p-2 text-text-tertiary hover:text-error hover:bg-error/10 rounded-md transition-all"
                  title="Remove secret"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-4 rounded bg-error-muted px-3 py-2 text-[12px] text-error">
              {error}
            </div>
          )}

          <button
            onClick={addSecret}
            className="mt-4 flex items-center gap-1.5 text-xs text-text-secondary hover:text-accent transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add secret
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            Save Secrets
          </button>
        </div>
      </div>
    </div>
  )
}

export function Sidebar() {
  const { activePanel, setActivePanel, theme, setTheme } = useUIStore()
  const { collections, addCollection, deleteCollection, updateCollection } = useCollectionStore()
  const { tabs, activeTabId } = useRequestStore()
  const [isCreating, setIsCreating] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null)
  const [editingSecretsCollection, setEditingSecretsCollection] = useState<Collection | null>(null)
  const [diffEntries, setDiffEntries] = useState<{ left: HistoryEntry; right: HistoryEntry } | null>(null)
  const [pendingDeleteCollection, setPendingDeleteCollection] = useState<Collection | null>(null)

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  const activeSourceRequestId = tabs.find((tab) => tab.id === activeTabId)?.sourceRequestId ?? null

  const handleCreateCollection = () => {
    if (newCollectionName.trim()) {
      addCollection(newCollectionName.trim())
      setNewCollectionName('')
      setIsCreating(false)
    }
  }

  const handleDeleteCollection = (collection: Collection) => {
    setPendingDeleteCollection(collection)
  }

  const confirmDeleteCollection = () => {
    if (!pendingDeleteCollection) return

    if (editingCollection?.id === pendingDeleteCollection.id) {
      setEditingCollection(null)
    }

    deleteCollection(pendingDeleteCollection.id)
    setPendingDeleteCollection(null)
  }

  const handleSaveSecrets = (collectionId: string, secrets: SecretVariable[]) => {
    updateCollection(collectionId, { secrets })
    setEditingSecretsCollection(null)
  }

  return (
    <div className="flex flex-col h-full no-drag">
      {/* Segmented Control */}
      <div className="p-3 pb-2">
        <div className="segmented-control">
          <button
            onClick={() => setActivePanel('collections')}
            className={activePanel === 'collections' ? 'active' : ''}
          >
            Collections
          </button>
          <button
            onClick={() => setActivePanel('history')}
            className={activePanel === 'history' ? 'active' : ''}
          >
            History
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-2">
        {activePanel === 'collections' && (
          <div>
            {/* Actions */}
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => setIsCreating(true)}
                className="btn-ghost flex-1 flex items-center justify-center gap-1.5 text-[12px]"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                New
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="btn-ghost flex-1 flex items-center justify-center gap-1.5 text-[12px]"
              >
                <Upload className="w-3.5 h-3.5" />
                Import
              </button>
            </div>

            {isCreating && (
              <div className="mb-3 p-3 bg-bg-secondary rounded border border-border animate-fade-in">
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateCollection()
                    if (e.key === 'Escape') setIsCreating(false)
                  }}
                  placeholder="Collection name"
                  className="input-field text-[13px] mb-2"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={handleCreateCollection} className="btn-primary flex-1 text-[12px] py-1.5">
                    Create
                  </button>
                  <button
                    onClick={() => setIsCreating(false)}
                    className="btn-secondary flex-1 text-[12px] py-1.5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Collections List */}
            {collections.length === 0 && !isCreating ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Folder className="w-5 h-5" />
                </div>
                <p className="empty-state-title">No collections</p>
                <p className="empty-state-desc">Create a collection to organize requests</p>
              </div>
            ) : (
              <div>
                {collections.map((collection) => (
                  <CollectionItem
                    key={collection.id}
                    collection={collection}
                    onEditSpec={setEditingCollection}
                    onDeleteCollection={handleDeleteCollection}
                    onEditSecrets={setEditingSecretsCollection}
                    activeSourceRequestId={activeSourceRequestId}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activePanel === 'history' && (
          <HistoryPanel
            onCompare={(left, right) => setDiffEntries({ left, right })}
            activeSourceRequestId={activeSourceRequestId}
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            <span className="kbd">⌘K</span>
            <span className="kbd">⌘T</span>
          </div>
          <button
            onClick={cycleTheme}
            className="btn-ghost p-1.5"
            title={`Theme: ${theme}`}
          >
            <ThemeIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} />}

      {/* Edit Spec Modal */}
      {editingCollection && (
        <EditSpecModal
          collection={editingCollection}
          onClose={() => setEditingCollection(null)}
        />
      )}

      {editingSecretsCollection && (
        <CollectionSecretsModal
          collection={editingSecretsCollection}
          onClose={() => setEditingSecretsCollection(null)}
          onSave={(secrets) => handleSaveSecrets(editingSecretsCollection.id, secrets)}
        />
      )}

      {pendingDeleteCollection && (
        <DeleteCollectionModal
          collection={pendingDeleteCollection}
          onClose={() => setPendingDeleteCollection(null)}
          onConfirm={confirmDeleteCollection}
        />
      )}

      {/* Diff Modal */}
      {diffEntries && (
        <DiffModal
          left={diffEntries.left}
          right={diffEntries.right}
          onClose={() => setDiffEntries(null)}
        />
      )}
    </div>
  )
}
