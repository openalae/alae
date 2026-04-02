# Local Setup

## Prerequisites

- Node.js 22+
- npm 10+
- Rust toolchain with `cargo`
- Xcode on macOS, or the equivalent Tauri desktop prerequisites on Windows

## Install

```bash
npm install
```

## Daily Commands

```bash
npm test
npm run build
npm run tauri dev
```

## Notes

- `npm run tauri dev` starts Vite on port `1420` and then launches the Rust shell.
- The first Tauri launch can take noticeably longer because Cargo has to download and compile the desktop dependencies.
- Frontend build output goes to `dist/`.
- Rust build artifacts live under `src-tauri/target/` and are ignored by Git.
- To use the free-first live preset, add an OpenRouter key from the desktop settings panel.
- Ollama is optional but recommended for the free preset. If you want local candidates, keep Ollama running at `http://127.0.0.1:11434/v1` and pull the models you plan to use.

## Recommended Tooling

- VS Code
- Tauri VS Code extension
- rust-analyzer
