# Posty

A fast, lightweight, privacy-focused API client. No sign-up required.

## Why Posty?

Postman became bloated. Insomnia requires accounts. You just want to test an API.

Posty is a native desktop app built with Tauri and Rust. It starts instantly, uses minimal memory, and keeps all your data local.

## Features

- HTTP/REST requests with full method support
- Request collections with nested folders
- Environment variables with scoping
- Request history (auto-saved, searchable)
- OpenAPI/Swagger import with auto-generated request templates
- Import from cURL commands (paste directly into URL bar)
- Code generation: cURL, JavaScript, Python, Go, Rust, PHP
- Light, Dark, and System themes
- Command palette (Cmd+K) for keyboard-first workflow
- Data persistence (collections and tabs survive app restarts)

## Install

Download the latest release for your platform:

https://github.com/tkattkat/posty/releases

## Development

```bash
npm install
npm run tauri dev
```

## Tech Stack

- Backend: Tauri (Rust)
- Frontend: React, TypeScript, Vite
- Styling: Tailwind CSS

## License

MIT
