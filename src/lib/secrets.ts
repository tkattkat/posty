import type { HttpRequest, SecretVariable } from '../types'

const SECRET_REFERENCE_REGEX = /^\{\{([A-Za-z0-9_-]+)\}\}$/

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

export function resolveSecretReference(value: string, secrets: SecretVariable[]): string {
  const secretName = getSecretReferenceName(value)
  if (!secretName) return value

  const secret = secrets.find((item) => item.name === secretName)
  return secret?.value ?? value
}

export function resolveRequestHeaderSecrets(request: HttpRequest, secrets: SecretVariable[]): HttpRequest {
  return {
    ...request,
    headers: request.headers.map((header) => ({
      ...header,
      value: resolveSecretReference(header.value, secrets),
    })),
  }
}
