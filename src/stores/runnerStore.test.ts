import { beforeEach, describe, expect, it } from 'vitest'
import { useRunnerStore } from './runnerStore'

describe('runnerStore', () => {
  beforeEach(() => {
    useRunnerStore.getState().resetRun()
  })

  it('tracks active runs and runtime variables', () => {
    useRunnerStore.getState().startRun({
      id: 'run-1',
      collectionId: 'collection-1',
      collectionName: 'Demo collection',
      status: 'running',
      stopOnFail: true,
      startedAt: 1,
      steps: [
        {
          requestId: 'request-1',
          requestName: 'Request 1',
          status: 'pending',
        },
      ],
    })

    useRunnerStore.getState().setRuntimeVariables({ token: 'abc123' })

    const state = useRunnerStore.getState()
    expect(state.activeRun?.collectionName).toBe('Demo collection')
    expect(state.runtimeVariables).toEqual({ token: 'abc123' })
  })

  it('can request cancellation', () => {
    useRunnerStore.getState().requestCancel()
    expect(useRunnerStore.getState().cancelRequested).toBe(true)
  })
})
