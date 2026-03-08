import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RequestTestsEditor } from './RequestTestsEditor'

describe('RequestTestsEditor', () => {
  it('renders the latest execution summary', () => {
    render(
      <RequestTestsEditor
        tests={[]}
        onTestsChange={vi.fn()}
        extractions={[]}
        onExtractionsChange={vi.fn()}
        latestExecution={{
          requestId: 'request-1',
          requestName: 'Request 1',
          response: {
            status: 200,
            statusText: 'OK',
            headers: {},
            body: '{}',
            time: 12,
            size: 2,
          },
          assertions: [
            {
              testId: 'assertion-1',
              testName: 'Status is 200',
              passed: true,
              message: 'Returned 200',
              actualValue: 200,
            },
          ],
          extractedVariables: {},
          passed: true,
        }}
      />
    )

    expect(screen.getByText('Latest test run')).toBeInTheDocument()
    expect(screen.getByText('Status is 200')).toBeInTheDocument()
    expect(screen.getByText('Passing')).toBeInTheDocument()
  })
})
