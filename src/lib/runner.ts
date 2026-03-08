import type {
  Collection,
  HttpRequest,
  Request,
  RunnerResult,
  RunnerStepResult,
  RuntimeVariableMap,
  SecretVariable,
} from '../types'
import { executeHttpRequest } from './requestExecution'

export interface RunCollectionOptions {
  collection: Collection
  secrets?: SecretVariable[]
  stopOnFail?: boolean
  onRunStart?: (run: RunnerResult) => void
  onStepStart?: (stepIndex: number, step: RunnerStepResult) => void
  onStepComplete?: (stepIndex: number, step: RunnerStepResult, runtimeVariables: RuntimeVariableMap) => void
  onRunComplete?: (run: RunnerResult, runtimeVariables: RuntimeVariableMap) => void
  isCancelled?: () => boolean
}

interface RunnableRequestEntry {
  request: HttpRequest
  effectiveBaseUrl?: string
}

function flattenCollectionRequests(collection: Collection): HttpRequest[] {
  const requests = collection.requests.filter((request): request is HttpRequest => request.type === 'http')
  return [
    ...requests,
    ...collection.folders.flatMap((folder) => flattenCollectionRequests(folder)),
  ]
}

function flattenRunnableRequestEntries(
  collection: Collection,
  inheritedBaseUrl?: string
): RunnableRequestEntry[] {
  const effectiveBaseUrl = collection.baseUrl?.trim() || inheritedBaseUrl
  const requests = collection.requests
    .filter((request): request is HttpRequest => request.type === 'http')
    .map((request) => ({
      request,
      effectiveBaseUrl,
    }))

  return [
    ...requests,
    ...collection.folders.flatMap((folder) => flattenRunnableRequestEntries(folder, effectiveBaseUrl)),
  ]
}

export function getCollectionHttpRequests(collection: Collection): HttpRequest[] {
  return flattenCollectionRequests(collection)
}

export async function runCollectionRequests(options: RunCollectionOptions): Promise<RunnerResult> {
  const stopOnFail = options.stopOnFail ?? true
  const requestEntries = flattenRunnableRequestEntries(options.collection)
  const steps: RunnerStepResult[] = requestEntries.map(({ request }) => ({
    requestId: request.id,
    requestName: request.name,
    status: 'pending',
  }))

  const baseRun: RunnerResult = {
    id: crypto.randomUUID(),
    collectionId: options.collection.id,
    collectionName: options.collection.name,
    status: 'running',
    stopOnFail,
    startedAt: Date.now(),
    steps,
  }

  options.onRunStart?.(baseRun)

  let runtimeVariables: RuntimeVariableMap = {}
  let runStatus: RunnerResult['status'] = 'completed'

  for (let index = 0; index < requestEntries.length; index += 1) {
    if (options.isCancelled?.()) {
      runStatus = 'cancelled'
      break
    }

    const { request, effectiveBaseUrl } = requestEntries[index]
    const runningStep: RunnerStepResult = {
      ...steps[index],
      status: 'running',
      startedAt: Date.now(),
    }
    steps[index] = runningStep
    options.onStepStart?.(index, runningStep)

    try {
      const result = await executeHttpRequest(request, {
        secrets: options.secrets,
        runtimeVariables,
        baseUrl: effectiveBaseUrl,
      })

      runtimeVariables = { ...runtimeVariables, ...result.extractedVariables }
      const completedStep: RunnerStepResult = {
        ...runningStep,
        status: result.passed ? 'passed' : 'failed',
        result,
        finishedAt: Date.now(),
      }
      steps[index] = completedStep
      options.onStepComplete?.(index, completedStep, runtimeVariables)

      if (!result.passed) {
        runStatus = 'failed'
        if (stopOnFail) {
          break
        }
      }
    } catch (error) {
      const failedStep: RunnerStepResult = {
        ...runningStep,
        status: 'failed',
        error: String(error),
        finishedAt: Date.now(),
      }
      steps[index] = failedStep
      options.onStepComplete?.(index, failedStep, runtimeVariables)
      runStatus = 'failed'
      if (stopOnFail) {
        break
      }
    }
  }

  if (runStatus === 'completed' && steps.some((step) => step.status === 'failed')) {
    runStatus = 'failed'
  }

  const remainingStatus: RunnerStepResult['status'] = runStatus === 'cancelled' ? 'cancelled' : 'pending'
  const finalizedSteps: RunnerStepResult[] = steps.map((step) =>
    step.status === 'pending'
      ? { ...step, status: remainingStatus, finishedAt: step.finishedAt ?? Date.now() }
      : step
  )

  const finalRun: RunnerResult = {
    ...baseRun,
    status: runStatus,
    finishedAt: Date.now(),
    steps: finalizedSteps,
  }

  options.onRunComplete?.(finalRun, runtimeVariables)
  return finalRun
}

export function getRunnableCollectionLabel(collection: Collection): string {
  return collection.parentId ? 'Run folder' : 'Run collection'
}

export function filterHttpRequests(requests: Request[]): HttpRequest[] {
  return requests.filter((request): request is HttpRequest => request.type === 'http')
}
