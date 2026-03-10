import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Play, Square, X, XCircle } from 'lucide-react'
import type { Collection, RunnerStepResult } from '../../types'
import { getCollectionHttpRequests, getRunnableCollectionLabel, runCollectionRequests } from '../../lib/runner'
import { useRunnerStore } from '../../stores/runnerStore'
import { useCollectionStore } from '../../stores/collectionStore'

function StepStatusIcon({ step }: { step: RunnerStepResult }) {
  if (step.status === 'running') {
    return <Loader2 className="h-4 w-4 animate-spin text-accent" />
  }

  if (step.status === 'passed') {
    return <CheckCircle2 className="h-4 w-4 text-success" />
  }

  if (step.status === 'failed') {
    return <XCircle className="h-4 w-4 text-error" />
  }

  if (step.status === 'cancelled') {
    return <Square className="h-4 w-4 text-warning" />
  }

  return <div className="h-4 w-4 rounded-full border border-border" />
}

export function CollectionRunnerModal({
  collection,
  onClose,
}: {
  collection: Collection
  onClose: () => void
}) {
  const { addToHistory, getActiveEnvironmentForCollection } = useCollectionStore()
  const activeEnvironment = getActiveEnvironmentForCollection(collection.id)
  const {
    activeRun,
    runtimeVariables,
    startRun,
    updateStep,
    setRuntimeVariables,
    completeRun,
    requestCancel,
    resetRun,
  } = useRunnerStore()
  const [stopOnFail, setStopOnFail] = useState(true)
  const httpRequests = useMemo(() => getCollectionHttpRequests(collection), [collection])

  useEffect(() => {
    resetRun()
    return () => resetRun()
  }, [collection.id, resetRun])

  const handleRun = async () => {
    await runCollectionRequests({
      collection,
      baseUrl: activeEnvironment?.baseUrl,
      secrets: collection.secrets ?? [],
      stopOnFail,
      onRunStart: startRun,
      onStepStart: updateStep,
      onStepComplete: (stepIndex, step, nextRuntimeVariables) => {
        updateStep(stepIndex, step)
        setRuntimeVariables(nextRuntimeVariables)
        if (step.result) {
          const sourceRequest = httpRequests.find((request) => request.id === step.requestId)
          if (sourceRequest) {
            addToHistory({
              request: sourceRequest,
              response: step.result.response,
              timestamp: Date.now(),
              sourceCollectionId: collection.id,
              sourceRequestId: sourceRequest.id,
            })
          }
        }
      },
      onRunComplete: completeRun,
      isCancelled: () => useRunnerStore.getState().cancelRequested,
    })
  }

  const statusTone = activeRun?.status === 'completed'
    ? 'bg-success/15 text-success'
    : activeRun?.status === 'failed'
      ? 'bg-error/15 text-error'
      : activeRun?.status === 'cancelled'
        ? 'bg-warning/15 text-warning'
        : 'bg-accent/15 text-accent'
  const displaySteps: RunnerStepResult[] = activeRun?.steps ?? httpRequests.map((request) => ({
    requestId: request.id,
    requestName: request.name,
    status: 'pending',
  }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg glass-elevated animate-scale-in"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="text-[14px] font-medium text-text-primary">{getRunnableCollectionLabel(collection)}</div>
            <div className="mt-1 text-[12px] text-text-secondary">
              {collection.name} · {httpRequests.length} HTTP request{httpRequests.length === 1 ? '' : 's'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary"
            aria-label="Close runner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <label className="flex items-center gap-2 text-[12px] text-text-secondary">
            <input
              type="checkbox"
              checked={stopOnFail}
              onChange={(event) => setStopOnFail(event.target.checked)}
              className="h-4 w-4 rounded border-border bg-black/20 accent-accent"
              disabled={activeRun?.status === 'running'}
            />
            Stop on first failure
          </label>

          <div className="flex items-center gap-2">
            {activeRun && (
              <div className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusTone}`}>
                {activeRun.status}
              </div>
            )}
            {activeRun?.status === 'running' ? (
              <button onClick={requestCancel} className="btn-secondary flex items-center gap-2">
                <Square className="h-4 w-4" />
                Stop
              </button>
            ) : (
              <button onClick={handleRun} className="btn-primary flex items-center gap-2" disabled={httpRequests.length === 0}>
                <Play className="h-4 w-4" />
                {activeRun ? 'Run again' : 'Run now'}
              </button>
            )}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="min-h-0 overflow-auto border-r border-border p-4">
            {httpRequests.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-title">No HTTP requests to run</p>
                <p className="empty-state-desc">Add one or more HTTP requests to this collection first.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {displaySteps.map((step) => (
                  <div key={step.requestId} className="rounded-md border border-border bg-bg-secondary/60 px-3 py-3">
                    <div className="flex items-center gap-2">
                      <StepStatusIcon step={step} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-text-primary">{step.requestName}</div>
                        {step.error && (
                          <div className="mt-1 text-[12px] text-error">{step.error}</div>
                        )}
                        {step.result && step.result.assertions.length > 0 && (
                          <div className="mt-1 text-[12px] text-text-secondary">
                            {step.result.assertions.filter((assertion) => assertion.passed).length}/{step.result.assertions.length} assertions passed
                          </div>
                        )}
                      </div>
                      {step.result && (
                        <div className="text-[11px] text-text-muted">{step.result.response.status}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="min-h-0 overflow-auto p-4">
            <div className="rounded-md border border-border bg-bg-secondary/60 p-4">
              <div className="text-[13px] font-medium text-text-primary">Run summary</div>
              {activeRun ? (
                <div className="mt-3 space-y-2 text-[12px] text-text-secondary">
                  <div>
                    Passed: {activeRun.steps.filter((step) => step.status === 'passed').length}
                  </div>
                  <div>
                    Failed: {activeRun.steps.filter((step) => step.status === 'failed').length}
                  </div>
                  <div>
                    Cancelled: {activeRun.steps.filter((step) => step.status === 'cancelled').length}
                  </div>
                  {activeRun.finishedAt && (
                    <div>
                      Duration: {Math.max(activeRun.finishedAt - activeRun.startedAt, 0)}ms
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-[12px] text-text-secondary">
                  Start a run to see live progress and assertion results.
                </p>
              )}
            </div>

            <div className="mt-4 rounded-md border border-border bg-bg-secondary/60 p-4">
              <div className="text-[13px] font-medium text-text-primary">Runtime variables</div>
              {Object.keys(runtimeVariables).length === 0 ? (
                <p className="mt-3 text-[12px] text-text-secondary">
                  Values extracted during the run will appear here.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {Object.entries(runtimeVariables).map(([key, value]) => (
                    <div key={key} className="rounded bg-bg-primary/50 px-3 py-2">
                      <div className="font-mono text-[12px] text-text-primary">{key}</div>
                      <div className="mt-1 break-all font-mono text-[11px] text-text-secondary">{value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
