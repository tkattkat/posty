import { CheckCircle2, FlaskConical, Plus, Trash2, XCircle } from 'lucide-react'
import type { AssertionResult, RequestExecutionResult, RequestTest, RequestVariableExtraction } from '../../types'

function createDefaultTest(): RequestTest {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    type: 'status-code',
    expectedStatus: 200,
  }
}

function createDefaultExtraction(): RequestVariableExtraction {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    source: 'json-path',
    path: '',
    variableName: '',
  }
}

function AssertionRow({ assertion }: { assertion: AssertionResult }) {
  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-[12px] ${
      assertion.passed
        ? 'border-success/20 bg-success/10 text-text-primary'
        : 'border-error/20 bg-error/10 text-text-primary'
    }`}>
      {assertion.passed ? (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
      ) : (
        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error" />
      )}
      <div className="min-w-0 flex-1">
        <div className="font-medium">{assertion.testName}</div>
        <div className="mt-0.5 text-text-secondary">{assertion.message}</div>
      </div>
    </div>
  )
}

export function RequestTestsEditor({
  tests,
  onTestsChange,
  extractions,
  onExtractionsChange,
  latestExecution,
}: {
  tests: RequestTest[]
  onTestsChange: (tests: RequestTest[]) => void
  extractions: RequestVariableExtraction[]
  onExtractionsChange: (extractions: RequestVariableExtraction[]) => void
  latestExecution: RequestExecutionResult | null
}) {
  const updateTest = (id: string, updates: Partial<RequestTest>) => {
    onTestsChange(tests.map((test) => (test.id === id ? { ...test, ...updates } : test)))
  }

  const removeTest = (id: string) => {
    onTestsChange(tests.filter((test) => test.id !== id))
  }

  const updateExtraction = (id: string, updates: Partial<RequestVariableExtraction>) => {
    onExtractionsChange(extractions.map((extraction) => (
      extraction.id === id ? { ...extraction, ...updates } : extraction
    )))
  }

  const removeExtraction = (id: string) => {
    onExtractionsChange(extractions.filter((extraction) => extraction.id !== id))
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-bg-secondary/60">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-[13px] font-medium text-text-primary">
              <FlaskConical className="h-4 w-4 text-accent" />
              Request tests
            </div>
            <p className="mt-1 text-[12px] text-text-secondary">
              Run lightweight assertions after each request.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onTestsChange([...tests, createDefaultTest()])}
            className="btn-ghost flex items-center gap-1.5 text-[12px]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add test
          </button>
        </div>

        <div className="space-y-3 p-4">
          {tests.length === 0 ? (
            <p className="text-[12px] text-text-secondary">
              No tests yet. Add one to validate status codes, headers, JSON paths, or response times.
            </p>
          ) : (
            tests.map((test) => (
              <div key={test.id} className="space-y-3 rounded-md border border-border bg-bg-primary/40 p-3">
                <div className="flex items-center gap-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={test.enabled}
                      onChange={(e) => updateTest(test.id, { enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-border bg-black/20 accent-accent"
                    />
                  </label>
                  <select
                    value={test.type}
                    onChange={(e) => updateTest(test.id, { type: e.target.value as RequestTest['type'] })}
                    className="input-field min-w-0 flex-1 text-sm"
                  >
                    <option value="status-code">Status code equals</option>
                    <option value="header-equals">Header equals</option>
                    <option value="header-contains">Header contains</option>
                    <option value="json-path-exists">JSON path exists</option>
                    <option value="json-path-equals">JSON path equals</option>
                    <option value="response-time-under">Response time under</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeTest(test.id)}
                    className="rounded-md p-2 text-text-tertiary transition-colors hover:bg-error/10 hover:text-error"
                    title="Remove test"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <input
                  type="text"
                  value={test.label ?? ''}
                  onChange={(e) => updateTest(test.id, { label: e.target.value })}
                  placeholder="Optional label"
                  className="input-field text-sm"
                />

                {(test.type === 'header-equals' || test.type === 'header-contains' || test.type === 'json-path-exists' || test.type === 'json-path-equals') && (
                  <input
                    type="text"
                    value={test.target ?? ''}
                    onChange={(e) => updateTest(test.id, { target: e.target.value })}
                    placeholder={test.type.startsWith('header') ? 'Header name' : 'JSON path (e.g. data.user.id)'}
                    className="input-field text-sm font-mono"
                  />
                )}

                {(test.type === 'header-equals' || test.type === 'header-contains' || test.type === 'json-path-equals') && (
                  <input
                    type="text"
                    value={test.expectedValue ?? ''}
                    onChange={(e) => updateTest(test.id, { expectedValue: e.target.value })}
                    placeholder="Expected value"
                    className="input-field text-sm font-mono"
                  />
                )}

                {test.type === 'status-code' && (
                  <input
                    type="number"
                    value={test.expectedStatus ?? 200}
                    onChange={(e) => updateTest(test.id, { expectedStatus: Number(e.target.value) })}
                    placeholder="200"
                    className="input-field text-sm"
                  />
                )}

                {test.type === 'response-time-under' && (
                  <input
                    type="number"
                    value={test.maxDurationMs ?? 500}
                    onChange={(e) => updateTest(test.id, { maxDurationMs: Number(e.target.value) })}
                    placeholder="500"
                    className="input-field text-sm"
                  />
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-bg-secondary/60">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="text-[13px] font-medium text-text-primary">Value extraction</div>
            <p className="mt-1 text-[12px] text-text-secondary">
              Save response values as runtime variables for later requests in a collection run.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onExtractionsChange([...extractions, createDefaultExtraction()])}
            className="btn-ghost flex items-center gap-1.5 text-[12px]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add extraction
          </button>
        </div>

        <div className="space-y-3 p-4">
          {extractions.length === 0 ? (
            <p className="text-[12px] text-text-secondary">
              No extraction rules yet. Extract values like `accessToken` or `project.id` for downstream requests.
            </p>
          ) : (
            extractions.map((extraction) => (
              <div key={extraction.id} className="space-y-3 rounded-md border border-border bg-bg-primary/40 p-3">
                <div className="flex items-center gap-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={extraction.enabled}
                      onChange={(e) => updateExtraction(extraction.id, { enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-border bg-black/20 accent-accent"
                    />
                  </label>
                  <select
                    value={extraction.source}
                    onChange={(e) => updateExtraction(extraction.id, { source: e.target.value as RequestVariableExtraction['source'] })}
                    className="input-field min-w-0 flex-1 text-sm"
                  >
                    <option value="json-path">JSON path</option>
                    <option value="header">Header</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeExtraction(extraction.id)}
                    className="rounded-md p-2 text-text-tertiary transition-colors hover:bg-error/10 hover:text-error"
                    title="Remove extraction"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <input
                  type="text"
                  value={extraction.path}
                  onChange={(e) => updateExtraction(extraction.id, { path: e.target.value })}
                  placeholder={extraction.source === 'json-path' ? 'JSON path (e.g. data.token)' : 'Header name'}
                  className="input-field text-sm font-mono"
                />
                <input
                  type="text"
                  value={extraction.variableName}
                  onChange={(e) => updateExtraction(extraction.id, { variableName: e.target.value })}
                  placeholder="Runtime variable name"
                  className="input-field text-sm font-mono"
                />
              </div>
            ))
          )}
        </div>
      </section>

      {latestExecution && (
        <section className="rounded-lg border border-border bg-bg-secondary/60">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-[13px] font-medium text-text-primary">Latest test run</div>
              <p className="mt-1 text-[12px] text-text-secondary">
                {latestExecution.assertions.length === 0
                  ? 'This request has no enabled tests yet.'
                  : `${latestExecution.assertions.filter((assertion) => assertion.passed).length}/${latestExecution.assertions.length} assertions passed`}
              </p>
            </div>
            <div className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              latestExecution.passed
                ? 'bg-success/15 text-success'
                : 'bg-error/15 text-error'
            }`}>
              {latestExecution.passed ? 'Passing' : 'Failing'}
            </div>
          </div>

          <div className="space-y-2 p-4">
            {latestExecution.assertions.length === 0 ? (
              <p className="text-[12px] text-text-secondary">
                Send the request after adding tests to see results here.
              </p>
            ) : (
              latestExecution.assertions.map((assertion) => (
                <AssertionRow key={assertion.testId} assertion={assertion} />
              ))
            )}
          </div>
        </section>
      )}
    </div>
  )
}
