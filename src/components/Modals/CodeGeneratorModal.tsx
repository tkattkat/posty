import { useMemo, useState } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-markup-templating'
import 'prismjs/components/prism-php'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-rust'
import 'prismjs/themes/prism-tomorrow.css'
import { X, Copy, Check } from 'lucide-react'
import { generateCode, languageLabels, type CodeLanguage } from '../../lib/codegen'
import type { HttpRequest, SecretVariable } from '../../types'
import { resolveRequestHeaderSecrets } from '../../lib/secrets'

interface CodeGeneratorModalProps {
  request: HttpRequest
  secrets?: SecretVariable[]
  onClose: () => void
}

const languages: CodeLanguage[] = ['curl', 'javascript', 'python', 'go', 'rust', 'php']

const prismLanguageMap: Record<CodeLanguage, string> = {
  curl: 'bash',
  javascript: 'javascript',
  python: 'python',
  go: 'go',
  rust: 'rust',
  php: 'php',
}

export function CodeGeneratorModal({ request, secrets = [], onClose }: CodeGeneratorModalProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<CodeLanguage>('curl')
  const [copied, setCopied] = useState(false)
  const [showResolvedSecrets, setShowResolvedSecrets] = useState(false)

  const requestForCode = showResolvedSecrets ? resolveRequestHeaderSecrets(request, secrets) : request
  const code = generateCode({ request: requestForCode, language: selectedLanguage })
  const prismLanguage = prismLanguageMap[selectedLanguage]
  const highlightedCode = useMemo(() => {
    const grammar = Prism.languages[prismLanguage] ?? Prism.languages.javascript
    return Prism.highlight(code, grammar, prismLanguage)
  }, [code, prismLanguage])
  const hasSecretReferences = request.headers.some((header) => header.value.startsWith('{{') && header.value.endsWith('}}'))

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
          <pre
            className={`codegen-highlight language-${prismLanguage} h-96 overflow-auto bg-bg-tertiary p-4 text-sm leading-6 whitespace-pre-wrap break-words`}
          >
            <code
              className={`language-${prismLanguage}`}
              dangerouslySetInnerHTML={{ __html: highlightedCode }}
            />
          </pre>

          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 z-10 p-2 bg-bg-secondary border border-border rounded hover:bg-bg-primary"
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
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border bg-bg-tertiary/50">
          <div>
            {hasSecretReferences && secrets.length > 0 && (
              <button
                onClick={() => setShowResolvedSecrets((current) => !current)}
                className="px-3 py-2 bg-bg-primary text-text-secondary rounded hover:bg-bg-tertiary"
              >
                {showResolvedSecrets ? 'Use Placeholders' : 'Use Secret Values'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
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
    </div>
  )
}
