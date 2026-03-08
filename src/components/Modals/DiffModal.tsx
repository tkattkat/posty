import { useState } from 'react'
import { X, GitCompare, ChevronDown, ChevronRight } from 'lucide-react'
import { diffRequests, type DiffResult } from '../../lib/diff'
import type { HistoryEntry, HttpRequest } from '../../types'

interface DiffModalProps {
  left: HistoryEntry
  right: HistoryEntry
  onClose: () => void
}

function DiffBadge({ type }: { type: DiffResult['type'] }) {
  const styles = {
    added: 'bg-success/20 text-success',
    removed: 'bg-error/20 text-error',
    changed: 'bg-warning/20 text-warning',
    unchanged: 'bg-text-muted/10 text-text-muted',
  }

  const labels = {
    added: '+',
    removed: '-',
    changed: '~',
    unchanged: '=',
  }

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${styles[type]}`}>
      {labels[type]}
    </span>
  )
}

function DiffRow({ diff, showValues = true }: { diff: DiffResult; showValues?: boolean }) {
  if (diff.type === 'unchanged' && !showValues) return null

  return (
    <div className={`flex items-start gap-3 py-1.5 px-2 rounded text-[13px] ${
      diff.type === 'added' ? 'bg-success/5' :
      diff.type === 'removed' ? 'bg-error/5' :
      diff.type === 'changed' ? 'bg-warning/5' : ''
    }`}>
      <DiffBadge type={diff.type} />
      <span className="font-medium text-text-secondary min-w-[100px]">{diff.key}</span>
      {showValues && (
        <div className="flex-1 flex gap-2 font-mono text-[12px] overflow-hidden">
          {diff.type === 'changed' ? (
            <>
              <span className="text-error line-through truncate flex-1">{diff.left}</span>
              <span className="text-text-muted">→</span>
              <span className="text-success truncate flex-1">{diff.right}</span>
            </>
          ) : diff.type === 'added' ? (
            <span className="text-success truncate">{diff.right}</span>
          ) : diff.type === 'removed' ? (
            <span className="text-error truncate">{diff.left}</span>
          ) : (
            <span className="text-text-tertiary truncate">{diff.left}</span>
          )}
        </div>
      )}
    </div>
  )
}

function DiffSection({
  title,
  diffs,
  defaultOpen = true,
  showUnchanged = false
}: {
  title: string
  diffs: DiffResult[]
  defaultOpen?: boolean
  showUnchanged?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const changedCount = diffs.filter(d => d.type !== 'unchanged').length
  const filteredDiffs = showUnchanged ? diffs : diffs.filter(d => d.type !== 'unchanged')

  if (filteredDiffs.length === 0 && !showUnchanged) return null

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-bg-secondary hover:bg-bg-hover transition-colors"
      >
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <span className="font-medium text-[13px]">{title}</span>
        {changedCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-warning/20 text-warning text-[11px] font-medium">
            {changedCount} change{changedCount !== 1 ? 's' : ''}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="p-2 space-y-0.5">
          {filteredDiffs.length === 0 ? (
            <p className="text-[12px] text-text-muted py-2 text-center">No changes</p>
          ) : (
            filteredDiffs.map((diff, i) => <DiffRow key={i} diff={diff} />)
          )}
        </div>
      )}
    </div>
  )
}

function BodyDiff({ left, right, diff }: { left?: string; right?: string; diff: DiffResult }) {
  const [view, setView] = useState<'split' | 'unified'>('split')

  if (diff.type === 'unchanged') {
    return (
      <div className="border border-border rounded-lg p-3">
        <p className="text-[12px] text-text-muted text-center">Bodies are identical</p>
      </div>
    )
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-bg-secondary border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[13px]">Body</span>
          <DiffBadge type={diff.type} />
        </div>
        <div className="segmented-control text-[11px]">
          <button onClick={() => setView('split')} className={view === 'split' ? 'active' : ''}>
            Split
          </button>
          <button onClick={() => setView('unified')} className={view === 'unified' ? 'active' : ''}>
            Unified
          </button>
        </div>
      </div>

      {view === 'split' ? (
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="p-3">
            <p className="text-[11px] text-text-muted mb-2 uppercase tracking-wide">Before</p>
            <pre className="text-[12px] font-mono text-error/80 whitespace-pre-wrap break-all max-h-48 overflow-auto">
              {left || '(empty)'}
            </pre>
          </div>
          <div className="p-3">
            <p className="text-[11px] text-text-muted mb-2 uppercase tracking-wide">After</p>
            <pre className="text-[12px] font-mono text-success/80 whitespace-pre-wrap break-all max-h-48 overflow-auto">
              {right || '(empty)'}
            </pre>
          </div>
        </div>
      ) : (
        <div className="p-3">
          <pre className="text-[12px] font-mono whitespace-pre-wrap break-all max-h-64 overflow-auto">
            {left && <div className="text-error/80 bg-error/5 -mx-3 px-3">- {left}</div>}
            {right && <div className="text-success/80 bg-success/5 -mx-3 px-3">+ {right}</div>}
          </pre>
        </div>
      )}
    </div>
  )
}

export function DiffModal({ left, right, onClose }: DiffModalProps) {
  const diff = diffRequests(left, right)
  const leftReq = left.request as HttpRequest
  const rightReq = right.request as HttpRequest

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-4xl max-h-[85vh] glass-elevated rounded-lg flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <GitCompare className="w-4 h-4 text-accent" />
            <span className="text-[14px] font-medium">Compare Requests</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors text-text-muted hover:text-text-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Request Summary */}
        <div className="grid grid-cols-2 gap-4 px-4 py-3 border-b border-border bg-bg-secondary/50">
          <div>
            <p className="text-[11px] text-text-muted uppercase tracking-wide mb-1">Before</p>
            <p className="text-[13px] font-mono truncate">
              <span className="text-accent font-medium">{leftReq.method}</span>{' '}
              <span className="text-text-secondary">{leftReq.url}</span>
            </p>
            <p className="text-[11px] text-text-muted mt-1">
              {new Date(left.timestamp).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-text-muted uppercase tracking-wide mb-1">After</p>
            <p className="text-[13px] font-mono truncate">
              <span className="text-accent font-medium">{rightReq.method}</span>{' '}
              <span className="text-text-secondary">{rightReq.url}</span>
            </p>
            <p className="text-[11px] text-text-muted mt-1">
              {new Date(right.timestamp).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Method & URL */}
          {(diff.method.type !== 'unchanged' || diff.url.type !== 'unchanged') && (
            <DiffSection
              title="Request"
              diffs={[diff.method, diff.url]}
              showUnchanged
            />
          )}

          {/* Headers */}
          <DiffSection title="Headers" diffs={diff.headers} />

          {/* Params */}
          <DiffSection title="Query Parameters" diffs={diff.params} />

          {/* Body */}
          {diff.body.type !== 'unchanged' && (
            <BodyDiff
              left={leftReq.body.content}
              right={rightReq.body.content}
              diff={diff.body}
            />
          )}

          {/* Response */}
          {(diff.response.status.type !== 'unchanged' || diff.response.body.type !== 'unchanged') && (
            <div className="space-y-3">
              <h3 className="text-[14px] font-medium text-text-primary">Response</h3>
              <DiffSection
                title="Response Info"
                diffs={[diff.response.status, diff.response.time, diff.response.size]}
              />
              {diff.response.body.type !== 'unchanged' && (
                <BodyDiff
                  left={left.response?.body}
                  right={right.response?.body}
                  diff={diff.response.body}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
