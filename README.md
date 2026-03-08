<p align="center">
  <img src="assets/logo.png" width="128" height="128" alt="Posty">
</p>

<h1 align="center">Posty</h1>

<p align="center">
A fast, lightweight, privacy-focused API client. No sign-up required.
</p>

## Why Posty?

Postman became bloated. Insomnia requires accounts. You just want to test an API.

Posty is a native desktop app built with Tauri and Rust. It starts instantly, uses minimal memory, and keeps all your data local.

## Features

- HTTP/REST requests with full method support
- Request collections with nested folders
- Collection-scoped secrets manager for API keys and other sensitive values
- Secret token insertion in headers with generated code placeholders or resolved values
- Request history (auto-saved, searchable)
- Request diff comparison (compare any two requests side-by-side)
- OpenAPI/Swagger import with auto-generated request templates
- Local OpenAPI file support with refresh friendly source tracking and auto sync
- Import from cURL commands (paste directly into URL bar)
- Code generation: cURL, JavaScript, Python, Go, Rust, PHP
- Light, Dark, and System themes
- Command palette (Cmd+K) for keyboard-first workflow
- Resizable sidebar and request/response panes
- Data persistence (collections and tabs survive app restarts)

## Install

Download the latest release for your platform:

https://github.com/tkattkat/posty/releases

## Secrets Manager

Posty supports collection scoped secrets so you can keep API keys and other sensitive header values out of request definitions.

- Store secrets per collection
- Insert secrets into header values from the `/` picker
- Render secret references as chips in the request editor
- Keep generated code on placeholder references by default, with an option to reveal resolved values when needed

## Local OpenAPI Sync

Posty can import OpenAPI specs from local files as well as remote sources.

- Import a local OpenAPI file into a collection
- Keep track of the source file path and modification time
- Refresh the collection when the source file changes
- Pull in request templates, body examples, and supported auth headers from the spec

## Development

```bash
pnpm install
pnpm tauri dev
```

## Tech Stack

- Backend: Tauri (Rust)
- Frontend: React, TypeScript, Vite
- Styling: Tailwind CSS

## License

MIT
