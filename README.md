# Alae

Alae is a local-first AI reasoning workstation built with Tauri 2, Rust, React, and TypeScript. The desktop shell is optimized for a Phase 1 MVP focused on a progressive synthesis workspace, a right-side truth panel, secure local credentials, and a persisted reasoning tree.

## Status

- Phase 1 Module 2 is complete: the scaffold is in place and the core Zod schema contracts now live under `src/schema`.
- The next implementation module is the global state skeleton under `src/store`.
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
