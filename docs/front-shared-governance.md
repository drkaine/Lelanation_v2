# Front Shared Governance

This document defines guardrails to keep a single source of truth across web, companion, and mobile.

## Scope

- Build pages: discover, my builds, favorites, create, detail.
- Videos page: listing, filters, pagination.

## Rules

1. Business logic must live in `packages/front-core`.
2. Shared DTOs must live in `packages/shared-types`.
3. Shared visual primitives/components belong in `packages/builds-ui` (and `packages/videos-ui` when created).
4. App shells (`frontend`, `companion-app`, mobile) may only orchestrate routes/platform APIs.
5. New Build/Videos behavior must include tests in shared packages before app-level wiring.

## Platform adapters

- Web adapters: `frontend/adapters/frontCore.ts`
- Companion adapters: `companion-app/src/core/platformAdapters.ts`

Adapters are the only layer allowed to use platform-specific APIs (`localStorage`, router, Tauri APIs, runtime env).
