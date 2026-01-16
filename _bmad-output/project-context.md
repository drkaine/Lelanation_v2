---
project_name: 'Lelanation_v2'
user_name: 'Darkaine'
date: '2026-01-14T15:30:00+00:00'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality_rules', 'workflow_rules', 'critical_rules']
existing_patterns_found: 15
status: 'complete'
rule_count: 80+
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

**Frontend:**
- Nuxt 3.17.0 (Vue 3 framework, SSR/SSG/MPA support)
- Vue 3.5.12 (included in Nuxt 3)
- Pinia 2.2.4 (state management, native Nuxt integration)
- TypeScript 5.6.3+ (strict mode, native Nuxt support)
- Vite (included in Nuxt 3, used internally)

**Backend:**
- Express.js 4.21.1 (TypeScript)
- Node.js 18+ (required)
- Redis 5.0.1 (caching)
- TypeScript 5.6.3+ (strict mode)
- node-cron 3.0.3 (scheduled tasks)

**Security:**
- Helmet.js v8.1.0 (requires Node.js 18+)

**Testing:**
- Jest (backend unit tests)
- Vitest (frontend unit tests)
- Playwright (E2E tests)

**Critical Version Constraints:**
- Node.js 18+ required (Helmet v8 requirement)
- TypeScript strict mode enabled
- All versions are current and stable (verified)

## Critical Implementation Rules

### Language-Specific Rules

**TypeScript Configuration:**
- **Strict mode enabled** - All TypeScript files must use strict mode
- **No `any` types** - Use proper types or `unknown` with type guards
- **Explicit return types** - Functions should have explicit return types (especially public APIs)
- **Use `Result<T, E>` pattern** - Never use `try/catch` for error handling, use Result monad pattern

**Import/Export Patterns:**
- **Named exports preferred** - Use named exports over default exports for better tree-shaking
- **Type-only imports** - Use `import type { ... }` for type-only imports
- **Barrel exports** - Use `index.ts` files for clean imports from directories

**Error Handling:**
- **Result<T, E> pattern mandatory** - All async operations must return `Result<T, E>`, never throw or return `Promise<T | Error>`
- **Error classes** - Use custom error classes (`AppError`, `ValidationError`, `NotFoundError`) with Result pattern
- **No try/catch in business logic** - Use Result pattern, only use try/catch for external library boundaries

**Async/Await Patterns:**
- **Always await** - Never forget `await` on async operations
- **Error propagation** - Use Result pattern to propagate errors, don't let errors bubble up unhandled
- **Promise.all for parallel operations** - Use `Promise.all()` for independent parallel operations

**Type Safety:**
- **No type assertions** - Avoid `as` assertions, use type guards instead
- **Discriminated unions** - Use discriminated unions for state management (e.g., `status: 'idle' | 'loading' | 'success' | 'error'`)
- **Branded types** - Consider branded types for IDs to prevent mixing different ID types

### Framework-Specific Rules

**Nuxt 3 / Vue 3 (Frontend):**
- **Composition API only** - Use `<script setup>` syntax, no Options API
- **Direct mutation in Pinia** - Mutate state directly in Pinia stores (Pinia handles reactivity), no need for immutability
- **Component naming** - PascalCase for components: `UserCard.vue`, not `user-card.vue` (auto-imported from `components/`)
- **Props validation** - Use TypeScript interfaces for props, not runtime validators
- **Reactive refs** - Use `ref()` for primitives, `reactive()` for objects (when needed)
- **Computed properties** - Use `computed()` for derived state, not methods that return values
- **Nuxt composables** - Use `useFetch()`, `useAsyncData()` for data fetching, `useSeoMeta()` for SEO
- **Auto-imports** - Components, composables, stores, utils are auto-imported (no `import` needed)

**Pinia (State Management):**
- **Store naming** - PascalCase with "Store" suffix: `ChampionsStore.ts`, `BuildEditorStore.ts`
- **Global vs local stores** - Global stores for shared data (champions, items, runes), local stores for page-specific state
- **Status enum pattern** - Use `status: 'idle' | 'loading' | 'success' | 'error'` instead of multiple booleans
- **Direct mutation** - Mutate state directly in actions: `this.champions = newChampions` (Pinia handles reactivity)
- **No unnecessary immutability** - Don't use spread operators unnecessarily: `this.data = newData` is fine

**Express.js (Backend):**
- **Middleware order matters** - Security middleware (Helmet) first, then CORS, then routes
- **Error middleware last** - Error handling middleware must be last in the chain
- **Result<T, E> in routes** - All route handlers must use Result pattern, never throw errors
- **Route naming** - Pluriel for resources: `/api/v1/builds`, not `/api/v1/build`
- **Action endpoints** - Use verb pattern: `/api/v1/builds/:id/calculate`, not `/api/v1/builds/calculate/:id`

**Nuxt 3 Server (Optional):**
- **Server API routes** - Can use `server/api/` for API routes (if not using separate Express backend)
- **Server middleware** - Use `server/middleware/` for server-side middleware
- **Server utilities** - Server-only code in `server/utils/`

**Nuxt 3 (Framework):**
- **File-based routing** - Use `pages/` directory for automatic routing (e.g., `pages/builds/index.vue` → `/builds`)
- **SSR/SSG configuration** - Configure rendering mode in `nuxt.config.ts` (SSR for dynamic, SSG for static pages)
- **Code splitting** - Automatic per route, use `import()` for manual lazy loading of heavy components
- **Auto-imports** - Components, composables, stores, and utils are auto-imported (no manual imports needed)
- **Asset optimization** - Images optimized automatically, assets in `public/` or `assets/` directory

### Testing Rules

**Test Organization:**
- **Unit tests co-located** - Unit tests next to source files: `BuildService.ts` + `BuildService.test.ts`
- **E2E tests separate** - E2E tests in `tests/e2e/` directory, not co-located
- **Test file naming** - Use `.test.ts` suffix for unit tests, `.spec.ts` for E2E tests

**Test Structure:**
- **Arrange-Act-Assert pattern** - Structure tests with clear sections
- **Descriptive test names** - Test names should describe what is being tested: `should return error when build not found`
- **One assertion per test** - Each test should verify one behavior (when possible)

**Mock Usage:**
- **Mock external dependencies** - Mock Redis, file system, external APIs
- **Don't mock internal code** - Don't mock your own services, test them directly
- **Mock data consistency** - Use consistent mock data across related tests

**Result<T, E> Testing:**
- **Test both success and error paths** - Always test `result.isOk()` and `result.isErr()` cases
- **Verify error types** - Check that correct error class is returned in error cases
- **No try/catch in tests** - Use Result pattern assertions, not try/catch blocks

**Coverage Requirements:**
- **Critical paths** - All API endpoints, services, and utilities must have tests
- **Error handling** - All error paths must be tested
- **Edge cases** - Test boundary conditions and edge cases

### Code Quality & Style Rules

**Naming Conventions:**
- **API endpoints** - Pluriel for resources: `/api/v1/builds`, verbs for actions: `/api/v1/builds/:id/calculate`
- **Files** - PascalCase: `BuildService.ts`, `UserCard.vue`, `ChampionsStore.ts`
- **JSON fields** - camelCase: `{ userId: 123, buildName: "My Build" }`
- **Build files** - UUID v4: `{uuid}.json` in `builds/{prefix}/` directory
- **Stores** - PascalCase with "Store" suffix: `ChampionsStore`, `BuildEditorStore`

**Code Organization:**
- **Pages** - File-based routing: `pages/{domain}/index.vue` (builds, champions, statistics, admin)
- **Components** - Shared in `components/` (auto-imported), feature-specific can be co-located
- **Composables** - API clients in `composables/use*.ts` (auto-imported)
- **Stores** - Global in `stores/` (auto-imported), use Pinia with Nuxt integration
- **Utils** - Utilities in `utils/` (auto-imported)

**Linting/Formatting:**
- **ESLint + Prettier** - Follow configured rules, no overrides without discussion
- **TypeScript strict** - No `any` types, explicit return types for public APIs
- **Import organization** - Group imports: external, internal, types, relative

**Documentation:**
- **JSDoc for public APIs** - Document public functions, classes, and interfaces
- **Comments for complex logic** - Explain "why", not "what" (code should be self-documenting)
- **No obvious comments** - Don't comment obvious code

**Error Messages:**
- **Structured error format** - Use monad-style: `{ error: { type, message, code, cause? } }`
- **User-friendly messages** - Error messages should be clear and actionable
- **Error codes** - Use uppercase snake_case: `BUILD_NOT_FOUND`, `VALIDATION_FAILED`

### Development Workflow Rules

**Git/Repository:**
- **Branch naming** - Use descriptive branch names: `feature/build-editor`, `fix/build-validation-error`
- **Commit messages** - Clear, descriptive commit messages explaining what and why
- **Small commits** - Make focused commits, one logical change per commit
- **No force push to main** - Never force push to main/master branch

**Pull Requests:**
- **Descriptive PR titles** - Clear title describing the change
- **PR descriptions** - Explain what changed, why, and how to test
- **Code review required** - All PRs must be reviewed before merge
- **Tests required** - PRs must include tests for new functionality

**CI/CD:**
- **GitHub Actions** - All tests must pass in CI before merge
- **Type checking** - TypeScript compilation must succeed
- **Linting** - ESLint must pass without errors
- **Build must succeed** - Both frontend and backend builds must complete successfully

**Environment:**
- **Environment variables** - Use `.env.example` to document required variables
- **Never commit secrets** - Never commit `.env` files or secrets to repository
- **Local development** - Use `.env.local` for local overrides (gitignored)

### Critical Don't-Miss Rules

**Anti-Patterns to Avoid:**
- **❌ Never use try/catch for error handling** - Always use Result<T, E> pattern
- **❌ Never use `any` type** - Use proper types or `unknown` with type guards
- **❌ Never mutate Pinia state immutably** - Direct mutation is correct: `this.data = newData`
- **❌ Never use singular for API resources** - Always plural: `/api/v1/builds`, not `/api/v1/build`
- **❌ Never use snake_case for JSON fields** - Always camelCase: `{ userId: 123 }`, not `{ user_id: 123 }`
- **❌ Never use multiple booleans for loading states** - Use status enum: `status: 'idle' | 'loading' | 'success' | 'error'`
- **❌ Never use kebab-case for component files** - Always PascalCase: `UserCard.vue`, not `user-card.vue`
- **❌ Never use fixed delay for retry** - Always use exponential backoff

**Edge Cases to Handle:**
- **File storage** - Always use prefix-based sharding: `builds/{prefix}/{uuid}.json` (2-4 first chars of UUID)
- **Build migration** - Always migrate builds automatically when reading (transparent to user)
- **Cache invalidation** - Always invalidate cache when data changes (cache-aside pattern)
- **Rate limiting** - Different limits per endpoint (sync endpoints more restrictive)
- **Error responses** - Always use structured format: `{ error: { type, message, code, cause? } }`

**Security Rules:**
- **Input validation** - Always validate all inputs with Zod/Joi schemas
- **Helmet middleware** - Always use Helmet.js for security headers (first in middleware chain)
- **Admin routes** - Always protect with `/admin/{ADMIN_NAME}` URL pattern + basic auth
- **HTTPS only** - Always use HTTPS in production (no HTTP)
- **No secrets in code** - Never hardcode secrets, always use environment variables

**Performance Gotchas:**
- **Web Workers for heavy calculations** - Use Web Workers for stats calculations, not main thread
- **Memoization for frequent calculations** - Cache calculation results to avoid recomputation
- **Lazy loading for heavy components** - Use `import()` for charts, visualizations, heavy components
- **Code splitting** - Vite handles per-page automatically, but use manual splitting for heavy features
- **Redis caching** - Always use cache-aside pattern, never cache-aside with write-through

**Data Consistency:**
- **UUID for build files** - Always use UUID v4 for build file names (no slugs or timestamps)
- **ISO 8601 for dates** - Always use ISO 8601 strings: `"2025-01-14T10:00:00Z"`, not timestamps
- **Null vs undefined** - Use `null` in JSON, never `undefined` (undefined is not valid JSON)
- **Boolean values** - Always use `true`/`false`, never `1`/`0` or strings

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

**Last Updated:** 2026-01-14
