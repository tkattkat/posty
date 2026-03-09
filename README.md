<p align="center">
  <img src="assets/logo.png" width="128" height="128" alt="Posty">
</p>

<h1 align="center">Posty</h1>

<p align="center">
A fast, lightweight, privacy-focused API client. No sign-up required.
</p>

## Why Posty?

<img width="2912" height="1914" alt="image" src="https://github.com/user-attachments/assets/99db5d65-172d-4bed-b881-978911bccbb2" />

Postman became bloated. Insomnia requires accounts. You just want to test an API.

Posty is a native desktop app built with Tauri and Rust. It starts instantly, uses minimal memory, and keeps all your data local.

## Features

- HTTP/REST requests with full method support
- Request collections with nested folders
- Environments with base URLs, variables, and secrets
- Secrets manager with `/` insertion in headers
- Request history (auto-saved, searchable)
- Request diff comparison
- OpenAPI/Swagger import with auto-sync
- cURL import (paste directly into URL bar)
- Code generation (cURL, JavaScript, Python, Go, Rust, PHP)
- Collection runner for multi-step flows
- Request testing with assertions and variable extraction
- Light, Dark, and System themes
- Command palette (Cmd+K)
- Auto-updates

## Install

Download the latest release for your platform:

https://github.com/tkattkat/posty/releases

## Environments

Environments let you switch between dev, staging, and production without editing requests.

- Define multiple environments (Development, Staging, Production)
- Each environment has its own base URL, variables, and secrets
- Switch environments from the dropdown in the URL bar
- Reference variables with `{{variableName}}` in URLs, headers, or body
- Environment secrets are available via the `/` picker in header values

When you switch environments, all base URLs, variables, and secrets update automatically.

## Secrets

Secrets keep API keys and sensitive values out of request definitions.

- Store secrets per environment or per collection
- Type `/` in header value fields to open the secret picker
- Secrets render as chips in the editor (hidden values)
- Environment secrets override collection secrets with the same name
- Generated code uses placeholders by default, with option to reveal values

## OpenAPI Sync

Import OpenAPI specs from URLs or local files.

- Import creates a collection with request templates
- Track source file/URL for easy refresh
- Pull in body examples and auth headers from the spec

## Collection Runner

Run an entire collection or folder in sequence.

- Execute requests with shared runtime variables between steps
- Extract values from responses with `{{variableName}}`
- See live pass/fail status and response codes
- Useful for login-to-resource workflows

<img width="2916" height="1874" alt="image" src="https://github.com/user-attachments/assets/1501bdbd-2fcb-4aca-911b-0bfef6c909c7" />

## Request Testing

Add assertions and extractions to individual requests.

- Assert on status codes, headers, JSON paths, response time
- Extract response values into runtime variables
- View results inline after sending

<img width="2916" height="1874" alt="image" src="https://github.com/user-attachments/assets/11730fa4-cc0f-40d3-9130-25b85b2dc898" />

## Development

```bash
pnpm install
pnpm tauri dev
```

## Tech Stack

- Tauri (Rust)
- React, TypeScript, Vite
- Tailwind CSS

## License

MIT
