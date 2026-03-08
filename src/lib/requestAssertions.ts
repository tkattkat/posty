import type {
  AssertionResult,
  HttpResponse,
  RequestTest,
  RequestVariableExtraction,
  RuntimeVariableMap,
} from '../types'

function normalizeHeaderKey(headerName: string): string {
  return headerName.trim().toLowerCase()
}

function parseJsonBody(body: string): unknown | null {
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

function parseJsonPath(path: string): string[] {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

export function getJsonPathValue(body: string, path: string): unknown {
  const parsedBody = parseJsonBody(body)
  if (parsedBody === null) return undefined

  let current: unknown = parsedBody
  for (const segment of parseJsonPath(path)) {
    if (current === null || current === undefined) {
      return undefined
    }

    if (Array.isArray(current)) {
      const index = Number(segment)
      current = Number.isInteger(index) ? current[index] : undefined
      continue
    }

    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment]
      continue
    }

    return undefined
  }

  return current
}

function getResponseHeader(response: HttpResponse, headerName: string): string | undefined {
  const normalizedTarget = normalizeHeaderKey(headerName)
  const match = Object.entries(response.headers).find(([key]) => normalizeHeaderKey(key) === normalizedTarget)
  return match?.[1]
}

function formatTestName(test: RequestTest): string {
  if (test.label?.trim()) {
    return test.label.trim()
  }

  switch (test.type) {
    case 'status-code':
      return `Status is ${test.expectedStatus ?? 200}`
    case 'header-equals':
      return `Header ${test.target || 'header'} equals`
    case 'header-contains':
      return `Header ${test.target || 'header'} contains`
    case 'json-path-exists':
      return `JSON path ${test.target || 'path'} exists`
    case 'json-path-equals':
      return `JSON path ${test.target || 'path'} equals`
    case 'response-time-under':
      return `Response time under ${test.maxDurationMs ?? 0}ms`
  }
}

export function evaluateRequestTests(tests: RequestTest[], response: HttpResponse): AssertionResult[] {
  return tests
    .filter((test) => test.enabled)
    .map((test) => {
      switch (test.type) {
        case 'status-code': {
          const expectedStatus = test.expectedStatus ?? 200
          const passed = response.status === expectedStatus
          return {
            testId: test.id,
            testName: formatTestName(test),
            passed,
            message: passed
              ? `Returned ${expectedStatus}`
              : `Expected ${expectedStatus}, got ${response.status}`,
            actualValue: response.status,
          }
        }
        case 'header-equals': {
          const actual = getResponseHeader(response, test.target ?? '')
          const expected = test.expectedValue ?? ''
          const passed = actual === expected
          return {
            testId: test.id,
            testName: formatTestName(test),
            passed,
            message: passed
              ? `Header matched "${expected}"`
              : `Expected "${expected}", got "${actual ?? ''}"`,
            actualValue: actual ?? null,
          }
        }
        case 'header-contains': {
          const actual = getResponseHeader(response, test.target ?? '')
          const expected = test.expectedValue ?? ''
          const passed = actual?.includes(expected) ?? false
          return {
            testId: test.id,
            testName: formatTestName(test),
            passed,
            message: passed
              ? `Header contains "${expected}"`
              : `Header did not contain "${expected}"`,
            actualValue: actual ?? null,
          }
        }
        case 'json-path-exists': {
          const actual = getJsonPathValue(response.body, test.target ?? '')
          const passed = actual !== undefined
          return {
            testId: test.id,
            testName: formatTestName(test),
            passed,
            message: passed
              ? `Found value at ${test.target}`
              : `Missing value at ${test.target}`,
            actualValue: typeof actual === 'string' || typeof actual === 'number' || typeof actual === 'boolean'
              ? actual
              : actual === null
                ? null
                : actual !== undefined
                  ? JSON.stringify(actual)
                  : undefined,
          }
        }
        case 'json-path-equals': {
          const actual = getJsonPathValue(response.body, test.target ?? '')
          const expected = test.expectedValue ?? ''
          const normalizedActual =
            typeof actual === 'string'
              ? actual
              : actual === undefined
                ? undefined
                : JSON.stringify(actual)
          const passed = normalizedActual === expected
          return {
            testId: test.id,
            testName: formatTestName(test),
            passed,
            message: passed
              ? `JSON path matched "${expected}"`
              : `Expected "${expected}", got "${normalizedActual ?? ''}"`,
            actualValue:
              typeof actual === 'string' || typeof actual === 'number' || typeof actual === 'boolean'
                ? actual
                : actual === null
                  ? null
                  : normalizedActual ?? null,
          }
        }
        case 'response-time-under': {
          const maxDuration = test.maxDurationMs ?? 0
          const passed = response.time <= maxDuration
          return {
            testId: test.id,
            testName: formatTestName(test),
            passed,
            message: passed
              ? `Completed in ${response.time}ms`
              : `Expected under ${maxDuration}ms, got ${response.time}ms`,
            actualValue: response.time,
          }
        }
      }
    })
}

export function extractRuntimeVariables(
  extractions: RequestVariableExtraction[],
  response: HttpResponse
): RuntimeVariableMap {
  return extractions
    .filter((extraction) => extraction.enabled && extraction.variableName.trim() && extraction.path.trim())
    .reduce<RuntimeVariableMap>((variables, extraction) => {
      if (extraction.source === 'header') {
        const headerValue = getResponseHeader(response, extraction.path)
        if (headerValue !== undefined) {
          variables[extraction.variableName.trim()] = headerValue
        }
        return variables
      }

      const jsonValue = getJsonPathValue(response.body, extraction.path)
      if (jsonValue !== undefined) {
        variables[extraction.variableName.trim()] =
          typeof jsonValue === 'string' ? jsonValue : JSON.stringify(jsonValue)
      }
      return variables
    }, {})
}
