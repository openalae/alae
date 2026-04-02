# Alae

Alae is a local-first AI reasoning workstation built with Tauri 2, Rust, React, and TypeScript. The desktop shell is optimized for a Phase 1 MVP focused on a progressive synthesis workspace, a right-side truth panel, secure local credentials, and a persisted reasoning tree.

## Status

- Phase 1 MVP is implemented locally: the current baseline includes the progressive synthesis workspace, truth panel, secure desktop API key bridge, local reasoning tree persistence, and end-to-end wiring across the desktop shell.
- Live model access now supports OpenAI, Anthropic, Google, OpenRouter, and local Ollama. The desktop workspace defaults to a free-first preset that uses OpenRouter plus optional local Ollama models.
- Frontend tests, Rust tests, and the production frontend build are all passing in the current repository state.
- The next planning pass should begin with the first Phase 2 module.
- The working PRD stays local and is intentionally not committed. The repository tracks the engineering-facing MVP breakdown in `docs/phase-1-mvp.md`.

## Stack

- Tauri 2 + Rust
- React 19 + TypeScript + Vite
- Tailwind CSS v4 + shadcn base primitives
- Zustand, Zod, Vercel AI SDK, PGLite
- Vitest + React Testing Library

## Quick Start

```bash
npm install
npm test
npm run tauri dev
```

The first `npm run tauri dev` will fetch and compile Rust crates for the Tauri shell.

## Live Providers

- Hosted keys: OpenAI, Anthropic, Google, and OpenRouter keys can be added from the desktop settings panel and are stored in the native secure store.
- Local runtime: Ollama does not require an API key. Run Ollama locally at `http://127.0.0.1:11434/v1` and pull the models you want to use.
- Default preset: the desktop workspace currently defaults to a free-first preset built around `openrouter/free` plus local Ollama candidates.

## Useful Scripts

- `npm run dev`: start the Vite frontend only
- `npm test`: run the current unit test suite
- `npm run build`: build the frontend bundle
- `npm run tauri dev`: launch the desktop app in development mode

## Project Structure

```text
src/
  components/           UI primitives and layout shells
  features/
    consensus/          Phase 1 synthesis engine
    reasoning-tree/     Phase 1 local conversation tree
    settings/           Phase 1 desktop settings and API key surfaces
  lib/                  Shared utilities
  schema/               Zod contracts
  store/                Zustand slices
  test/                 Test setup helpers
src-tauri/              Rust desktop shell
docs/                   Engineering docs for setup and MVP sequencing
```

## Docs

- `docs/setup.md`: local environment and runbook
- `docs/phase-1-mvp.md`: committed Phase 1 execution map

## License

This project is available under the GNU Affero General Public License v3.0 only. See `LICENSE`.
