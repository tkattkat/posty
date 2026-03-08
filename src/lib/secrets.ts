import type { HttpRequest, RuntimeVariableMap, SecretVariable } from '../types'

const SECRET_REFERENCE_REGEX = /^\{\{([A-Za-z0-9_.-]+)\}\}$/
const TEMPLATE_REFERENCE_REGEX = /\{\{([A-Za-z0-9_.-]+)\}\}/g

export function createSecretReference(secretName: string): string {
  return `{{${secretName}}}`
}

export function getSecretReferenceName(value: string): string | null {
  const match = value.match(SECRET_REFERENCE_REGEX)
  return match ? match[1] : null
}

export function isSecretReference(value: string): boolean {
  return getSecretReferenceName(value) !== null
}

export function resolveSecretReference(
  value: string,
  secrets: SecretVariable[],
  runtimeVariables: RuntimeVariableMap = {}
): string {
  const secretName = getSecretReferenceName(value)
  if (!secretName) return value

  if (secretName in runtimeVariables) {
    return runtimeVariables[secretName]
  }

  const secret = secrets.find((item) => item.name === secretName)
  return secret?.value ?? value
}

export function resolveTemplateReferences(
  value: string,
  secrets: SecretVariable[],
  runtimeVariables: RuntimeVariableMap = {}
): string {
  return value.replace(TEMPLATE_REFERENCE_REGEX, (match, referenceName: string) => {
    if (referenceName in runtimeVariables) {
      return runtimeVariables[referenceName]
    }

    const secret = secrets.find((item) => item.name === referenceName)
    return secret?.value ?? match
  })
}

export function resolveRequestHeaderSecrets(
  request: HttpRequest,
  secrets: SecretVariable[],
  runtimeVariables: RuntimeVariableMap = {}
): HttpRequest {
  return {
    ...request,
    headers: request.headers.map((header) => ({
      ...header,
      value: resolveTemplateReferences(header.value, secrets, runtimeVariables),
    })),
  }
}
