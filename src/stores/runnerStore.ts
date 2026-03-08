import { create } from 'zustand'
import type { RunnerResult, RunnerStepResult, RuntimeVariableMap } from '../types'

interface RunnerStore {
  activeRun: RunnerResult | null
  runtimeVariables: RuntimeVariableMap
  cancelRequested: boolean
  startRun: (run: RunnerResult) => void
  updateStep: (index: number, step: RunnerStepResult) => void
  setRuntimeVariables: (runtimeVariables: RuntimeVariableMap) => void
  completeRun: (run: RunnerResult, runtimeVariables: RuntimeVariableMap) => void
  requestCancel: () => void
  resetRun: () => void
}

export const useRunnerStore = create<RunnerStore>((set) => ({
  activeRun: null,
  runtimeVariables: {},
  cancelRequested: false,
  startRun: (run) => {
    set({
      activeRun: run,
      runtimeVariables: {},
      cancelRequested: false,
    })
  },
  updateStep: (index, step) => {
    set((state) => ({
      activeRun: state.activeRun
        ? {
            ...state.activeRun,
            steps: state.activeRun.steps.map((currentStep, currentIndex) =>
              currentIndex === index ? step : currentStep
            ),
          }
        : null,
    }))
  },
  setRuntimeVariables: (runtimeVariables) => {
    set({ runtimeVariables })
  },
  completeRun: (run, runtimeVariables) => {
    set({
      activeRun: run,
      runtimeVariables,
      cancelRequested: false,
    })
  },
  requestCancel: () => {
    set({ cancelRequested: true })
  },
  resetRun: () => {
    set({
      activeRun: null,
      runtimeVariables: {},
      cancelRequested: false,
    })
  },
}))
