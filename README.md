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

## Collection Testing

Posty can run an entire collection or folder in sequence so you can validate multi-step flows instead of firing requests one at a time.

- Run a full collection or a nested folder from the collection context menu
- Execute requests sequentially with shared runtime variables between steps
- Stop on the first failure or continue through the full run
- See live pass/fail status, response codes, and extracted runtime variables in the runner modal
- Re-run the same flow quickly while iterating on auth, request bodies, or extracted values

This is especially useful for login-to-resource workflows where one request extracts a token or ID and later requests reference it with `{{variableName}}`.

<img width="2916" height="1874" alt="image" src="https://github.com/user-attachments/assets/1501bdbd-2fcb-4aca-911b-0bfef6c909c7" />


## Request Testing

Each HTTP request can also define its own lightweight test and extraction rules in the `Tests` tab.

- Add assertions for status codes, headers, JSON paths, and response time
- Extract response values into runtime variables for later requests in a collection run
- Review the latest assertion results directly in the request editor after sending a request
- Let imported OpenAPI requests start with sensible default success status assertions
- Catch unexpected `4xx` and `5xx` responses even when no manual assertions are defined

Typical setup:

- Add a status-code test to confirm the request returns the expected response
- Add a JSON path extraction such as `token` or `project.id`
- Reference that extracted value later with `{{token}}` or `{{projectId}}`

<img width="2916" height="1874" alt="image" src="https://github.com/user-attachments/assets/11730fa4-cc0f-40d3-9130-25b85b2dc898" />


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
