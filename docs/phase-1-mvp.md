# Phase 1 MVP

This repository follows a strict one-module-at-a-time execution model. Each module is implemented, verified locally, and then paused for confirmation before the next module starts.

## Scope Boundary

- Included: desktop scaffold, schema contracts, state skeleton, secure API key bridge, PGLite reasoning tree, synthesis orchestration, center workspace UI, right-side truth panel, and end-to-end MVP wiring
- Excluded: left explorer, canvas view, MCP integration, local model orchestration, SaaS sync and sharing

## Module Order

- [x] Module 1: project scaffold
- [x] Module 2: core schema contracts
- [ ] Module 3: global state skeleton
- [ ] Module 4: native API key security
- [ ] Module 5: PGLite reasoning tree bootstrap
- [ ] Module 6: multi-model consensus and conflict engine
- [ ] Module 7: center progressive workspace
- [ ] Module 8: right-side truth panel
- [ ] Module 9: end-to-end Phase 1 hardening

## Current Baseline

- Tauri 2 + React + TypeScript + Vite scaffold is running
- Tailwind v4 and shadcn base primitives are installed
- Vitest and React Testing Library are configured
- Core feature directories for `consensus`, `reasoning-tree`, `settings`, `schema`, and `store` already exist
- `src/schema` now exports strict Zod contracts for synthesis reports, model runs, reasoning-tree snapshots, and truth-panel telemetry

## Next Module

Module 3 will introduce the Zustand state skeleton for the current session, active node, API key status, truth-panel visibility, and the latest synthesis result.
