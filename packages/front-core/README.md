# @lelanation/front-core

Framework-agnostic front business logic shared between web, companion, and mobile.

## Contains

- Platform ports (`StoragePort`, `ApiClientPort`, etc.)
- Build discovery filtering/sorting/pagination helpers
- Video filtering/deduping/format/category helpers

## Constraints

- No Nuxt, Vue, DOM, or Tauri imports in this package.
- Keep all functions deterministic and testable.
