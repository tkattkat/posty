import type { HttpRequest, KeyValue } from '../types'

export type CodeLanguage = 'curl' | 'javascript' | 'python' | 'go' | 'rust' | 'php'

export interface CodeGeneratorOptions {
  request: HttpRequest
  language: CodeLanguage
}

function getEnabledHeaders(headers: KeyValue[]): KeyValue[] {
  return headers.filter((h) => h.enabled && h.key)
}

function getEnabledParams(params: KeyValue[]): KeyValue[] {
  return params.filter((p) => p.enabled && p.key)
}

function getEnabledCookies(cookies: KeyValue[]): KeyValue[] {
  return cookies.filter((c) => c.enabled && c.key)
}

function buildCookieHeader(cookies: KeyValue[]): string {
  return cookies.map((c) => `${c.key}=${c.value}`).join('; ')
}

function buildUrl(url: string, params: KeyValue[]): string {
  const enabledParams = getEnabledParams(params)
  if (enabledParams.length === 0) return url

  const queryString = enabledParams
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join('&')

  return url.includes('?') ? `${url}&${queryString}` : `${url}?${queryString}`
}

function generateCurl(request: HttpRequest): string {
  const parts: string[] = ['curl']

  // Method (only if not GET)
  if (request.method !== 'GET') {
    parts.push(`-X ${request.method}`)
  }

  // URL with params
  const url = buildUrl(request.url, request.params)
  parts.push(`'${url}'`)

  // Headers
  const headers = getEnabledHeaders(request.headers)
  for (const header of headers) {
    parts.push(`-H '${header.key}: ${header.value}'`)
  }

  // Cookies
  const cookies = getEnabledCookies(request.cookies ?? [])
  if (cookies.length > 0) {
    parts.push(`-H 'Cookie: ${buildCookieHeader(cookies)}'`)
  }

  // Auth headers
  if (request.auth?.type === 'bearer' && request.auth.token) {
    parts.push(`-H 'Authorization: Bearer ${request.auth.token}'`)
  } else if (request.auth?.type === 'basic' && request.auth.username) {
    parts.push(`-u '${request.auth.username}:${request.auth.password || ''}'`)
  } else if (request.auth?.type === 'api-key' && request.auth.key) {
    parts.push(`-H '${request.auth.key}: ${request.auth.value || ''}'`)
  }

  // Body
  if (request.body.type !== 'none' && request.body.content) {
    if (request.body.type === 'json') {
      parts.push(`-H 'Content-Type: application/json'`)
    }
    parts.push(`-d '${request.body.content.replace(/'/g, "'\\''")}'`)
  }

  return parts.join(' \\\n  ')
}

function generateJavaScript(request: HttpRequest): string {
  const headers = getEnabledHeaders(request.headers)
  const cookies = getEnabledCookies(request.cookies ?? [])
  const url = buildUrl(request.url, request.params)

  let headersObj: Record<string, string> = {}

  for (const header of headers) {
    headersObj[header.key] = header.value
  }

  // Cookies
  if (cookies.length > 0) {
    headersObj['Cookie'] = buildCookieHeader(cookies)
  }

  // Auth
  if (request.auth?.type === 'bearer' && request.auth.token) {
    headersObj['Authorization'] = `Bearer ${request.auth.token}`
  } else if (request.auth?.type === 'api-key' && request.auth.key) {
    headersObj[request.auth.key] = request.auth.value || ''
  }

  // Content-Type for JSON body
  if (request.body.type === 'json') {
    headersObj['Content-Type'] = 'application/json'
  }

  const options: string[] = []
  options.push(`  method: '${request.method}'`)

  if (Object.keys(headersObj).length > 0) {
    options.push(`  headers: ${JSON.stringify(headersObj, null, 4).replace(/\n/g, '\n  ')}`)
  }

  if (request.body.type !== 'none' && request.body.content) {
    if (request.body.type === 'json') {
      options.push(`  body: JSON.stringify(${request.body.content})`)
    } else {
      options.push(`  body: ${JSON.stringify(request.body.content)}`)
    }
  }

  return `fetch('${url}', {
${options.join(',\n')}
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`
}

function generatePython(request: HttpRequest): string {
  const headers = getEnabledHeaders(request.headers)
  const params = getEnabledParams(request.params)
  const cookies = getEnabledCookies(request.cookies ?? [])

  const lines: string[] = ['import requests', '']

  // URL
  lines.push(`url = "${request.url}"`)

  // Headers
  const headersDict: Record<string, string> = {}
  for (const header of headers) {
    headersDict[header.key] = header.value
  }

  if (request.auth?.type === 'bearer' && request.auth.token) {
    headersDict['Authorization'] = `Bearer ${request.auth.token}`
  } else if (request.auth?.type === 'api-key' && request.auth.key) {
    headersDict[request.auth.key] = request.auth.value || ''
  }

  if (request.body.type === 'json') {
    headersDict['Content-Type'] = 'application/json'
  }

  if (Object.keys(headersDict).length > 0) {
    lines.push(`headers = ${JSON.stringify(headersDict, null, 4)}`)
  }

  // Cookies (Python requests has native cookie support)
  if (cookies.length > 0) {
    const cookiesDict: Record<string, string> = {}
    for (const cookie of cookies) {
      cookiesDict[cookie.key] = cookie.value
    }
    lines.push(`cookies = ${JSON.stringify(cookiesDict, null, 4)}`)
  }

  // Params
  if (params.length > 0) {
    const paramsDict: Record<string, string> = {}
    for (const param of params) {
      paramsDict[param.key] = param.value
    }
    lines.push(`params = ${JSON.stringify(paramsDict, null, 4)}`)
  }

  // Body
  if (request.body.type !== 'none' && request.body.content) {
    if (request.body.type === 'json') {
      lines.push(`data = ${request.body.content}`)
    } else {
      lines.push(`data = """${request.body.content}"""`)
    }
  }

  // Request call
  lines.push('')
  const callParts = [`requests.${request.method.toLowerCase()}(url`]

  if (Object.keys(headersDict).length > 0) {
    callParts.push('headers=headers')
  }
  if (cookies.length > 0) {
    callParts.push('cookies=cookies')
  }
  if (params.length > 0) {
    callParts.push('params=params')
  }
  if (request.body.type !== 'none' && request.body.content) {
    if (request.body.type === 'json') {
      callParts.push('json=data')
    } else {
      callParts.push('data=data')
    }
  }

  lines.push(`response = ${callParts.join(', ')})`)
  lines.push('print(response.json())')

  return lines.join('\n')
}

function generateGo(request: HttpRequest): string {
  const url = buildUrl(request.url, request.params)
  const headers = getEnabledHeaders(request.headers)
  const cookies = getEnabledCookies(request.cookies ?? [])

  let bodySetup = ''
  let bodyVar = 'nil'

  if (request.body.type !== 'none' && request.body.content) {
    bodySetup = `\n\tbody := strings.NewReader(\`${request.body.content}\`)`
    bodyVar = 'body'
  }

  let headerSetup = ''
  for (const header of headers) {
    headerSetup += `\n\treq.Header.Set("${header.key}", "${header.value}")`
  }

  // Cookies
  if (cookies.length > 0) {
    headerSetup += `\n\treq.Header.Set("Cookie", "${buildCookieHeader(cookies)}")`
  }

  if (request.auth?.type === 'bearer' && request.auth.token) {
    headerSetup += `\n\treq.Header.Set("Authorization", "Bearer ${request.auth.token}")`
  }

  if (request.body.type === 'json') {
    headerSetup += `\n\treq.Header.Set("Content-Type", "application/json")`
  }

  return `package main

import (
\t"fmt"
\t"io"
\t"net/http"${request.body.content ? '\n\t"strings"' : ''}
)

func main() {${bodySetup}
\treq, err := http.NewRequest("${request.method}", "${url}", ${bodyVar})
\tif err != nil {
\t\tpanic(err)
\t}${headerSetup}

\tclient := &http.Client{}
\tresp, err := client.Do(req)
\tif err != nil {
\t\tpanic(err)
\t}
\tdefer resp.Body.Close()

\tbody, _ := io.ReadAll(resp.Body)
\tfmt.Println(string(body))
}`
}

function generateRust(request: HttpRequest): string {
  const url = buildUrl(request.url, request.params)
  const headers = getEnabledHeaders(request.headers)
  const cookies = getEnabledCookies(request.cookies ?? [])

  let headerSetup = ''
  for (const header of headers) {
    headerSetup += `\n        .header("${header.key}", "${header.value}")`
  }

  // Cookies
  if (cookies.length > 0) {
    headerSetup += `\n        .header("Cookie", "${buildCookieHeader(cookies)}")`
  }

  if (request.auth?.type === 'bearer' && request.auth.token) {
    headerSetup += `\n        .header("Authorization", "Bearer ${request.auth.token}")`
  }

  if (request.body.type === 'json') {
    headerSetup += `\n        .header("Content-Type", "application/json")`
  }

  let bodySetup = ''
  if (request.body.type !== 'none' && request.body.content) {
    bodySetup = `\n        .body(r#"${request.body.content}"#)`
  }

  return `use reqwest;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();

    let response = client
        .${request.method.toLowerCase()}("${url}")${headerSetup}${bodySetup}
        .send()
        .await?;

    let body = response.text().await?;
    println!("{}", body);

    Ok(())
}`
}

function generatePHP(request: HttpRequest): string {
  const url = buildUrl(request.url, request.params)
  const headers = getEnabledHeaders(request.headers)
  const cookies = getEnabledCookies(request.cookies ?? [])

  const headerLines: string[] = []
  for (const header of headers) {
    headerLines.push(`    '${header.key}: ${header.value}'`)
  }

  // Cookies
  if (cookies.length > 0) {
    headerLines.push(`    'Cookie: ${buildCookieHeader(cookies)}'`)
  }

  if (request.auth?.type === 'bearer' && request.auth.token) {
    headerLines.push(`    'Authorization: Bearer ${request.auth.token}'`)
  }

  if (request.body.type === 'json') {
    headerLines.push(`    'Content-Type: application/json'`)
  }

  let bodySetup = ''
  if (request.body.type !== 'none' && request.body.content) {
    bodySetup = `\ncurl_setopt($ch, CURLOPT_POSTFIELDS, '${request.body.content.replace(/'/g, "\\'")}');`
  }

  return `<?php

$ch = curl_init();

curl_setopt($ch, CURLOPT_URL, '${url}');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${request.method}');
${headerLines.length > 0 ? `curl_setopt($ch, CURLOPT_HTTPHEADER, [\n${headerLines.join(',\n')}\n]);` : ''}${bodySetup}

$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>`
}

export function generateCode(options: CodeGeneratorOptions): string {
  const { request, language } = options

  switch (language) {
    case 'curl':
      return generateCurl(request)
    case 'javascript':
      return generateJavaScript(request)
    case 'python':
      return generatePython(request)
    case 'go':
      return generateGo(request)
    case 'rust':
      return generateRust(request)
    case 'php':
      return generatePHP(request)
    default:
      return generateCurl(request)
  }
}

export const languageLabels: Record<CodeLanguage, string> = {
  curl: 'cURL',
  javascript: 'JavaScript (Fetch)',
  python: 'Python (Requests)',
  go: 'Go',
  rust: 'Rust (Reqwest)',
  php: 'PHP (cURL)',
}
