import { useState } from 'react'
import { X, Copy, Check } from 'lucide-react'
import { generateCode, languageLabels, CodeLanguage } from '../../lib/codegen'
import type { HttpRequest } from '../../types'

interface CodeGeneratorModalProps {
  request: HttpRequest
  onClose: () => void
}

const languages: CodeLanguage[] = ['curl', 'javascript', 'python', 'go', 'rust', 'php']

export function CodeGeneratorModal({ request, onClose }: CodeGeneratorModalProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<CodeLanguage>('curl')
  const [copied, setCopied] = useState(false)

  const code = generateCode({ request, language: selectedLanguage })

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-3xl bg-bg-secondary border border-border rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold">Generate Code</h2>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Language Tabs */}
        <div className="flex gap-1 p-2 border-b border-border overflow-x-auto">
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => setSelectedLanguage(lang)}
              className={`px-3 py-1.5 text-sm rounded whitespace-nowrap ${
                selectedLanguage === lang
                  ? 'bg-accent text-white'
                  : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
              }`}
            >
              {languageLabels[lang]}
            </button>
          ))}
        </div>

        {/* Code Display */}
        <div className="relative">
          <pre className="p-4 h-96 overflow-auto bg-bg-tertiary font-mono text-sm whitespace-pre-wrap">
            {code}
          </pre>

          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-2 bg-bg-secondary border border-border rounded hover:bg-bg-primary"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-4 h-4 text-success" />
            ) : (
              <Copy className="w-4 h-4 text-text-secondary" />
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-bg-tertiary/50">
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-accent text-white rounded hover:bg-accent-hover"
          >
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-bg-primary text-text-secondary rounded hover:bg-bg-tertiary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
