# Development Guide - Frontend

## Prerequisites

- **Node.js**: 18+ (check with `node --version`)
- **npm**: 8+ (check with `npm --version`)
- **TypeScript**: ~5.5.4 (installed as dev dependency)

## Installation

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Install Playwright Browsers (for E2E tests)

```bash
npx playwright install
```

## Local Development

### Start Development Server

```bash
npm run dev
```

This starts the Vite development server, typically at `http://localhost:5173`.

### Development Scripts

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run unit tests
npm run test:unit

# Run E2E tests
npm run test:e2e

# Type check
npm run type-check

# Lint code
npm run lint

# Format code
npm run format

# Clean (lint + format + type-check + test + build)
npm run clean
```

## Project Structure

```
frontend/
├── src/
│   ├── main.ts            # Application entry point
│   ├── App.vue           # Root component
│   ├── assets/            # Static assets (CSS, images)
│   ├── components/        # Vue components
│   ├── views/            # Route views (pages)
│   ├── stores/           # Pinia stores (state)
│   ├── router/           # Vue Router configuration
│   ├── composables/      # Vue composables
│   ├── i18n/             # Internationalization
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── public/               # Public static assets
├── dist/                 # Build output
├── e2e/                  # End-to-end tests
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Development Workflow

### Adding a New View (Page)

1. Create view file in `src/views/`:
   ```vue
   <!-- src/views/MyView.vue -->
   <template>
     <div>My View</div>
   </template>
   
   <script setup lang="ts">
   // Component logic
   </script>
   ```

2. Add route in `src/router/index.ts`:
   ```typescript
   {
     path: '/my-view',
     name: 'my-view',
     component: () => import('../views/MyView.vue'),
   }
   ```

### Adding a New Component

1. Create component file in `src/components/`:
   ```vue
   <!-- src/components/MyComponent.vue -->
   <template>
     <div>{{ message }}</div>
   </template>
   
   <script setup lang="ts">
   interface Props {
     message: string;
   }
   
   defineProps<Props>();
   </script>
   ```

2. Use in views/components:
   ```vue
   <script setup lang="ts">
   import MyComponent from '@/components/MyComponent.vue';
   </script>
   
   <template>
     <MyComponent message="Hello" />
   </template>
   ```

### Adding a New Store (Pinia)

1. Create store file in `src/stores/`:
   ```typescript
   // src/stores/myStore.ts
   import { defineStore } from 'pinia'
   import { ref } from 'vue'
   
   export const useMyStore = defineStore('my', () => {
     const data = ref<string[]>([])
     
     const addItem = (item: string) => {
       data.value.push(item)
     }
     
     return { data, addItem }
   })
   ```

2. Use in components:
   ```vue
   <script setup lang="ts">
   import { useMyStore } from '@/stores/myStore'
   
   const myStore = useMyStore()
   myStore.addItem('test')
   </script>
   ```

### Working with i18n

```vue
<template>
  <div>{{ $t('key.path') }}</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const message = t('key.path')
</script>
```

## Testing

### Unit Tests (Vitest)

```bash
npm run test:unit
```

Test files: `*.spec.ts` or `*.test.ts` in `__tests__/` directories.

Example:
```typescript
// src/components/__tests__/MyComponent.spec.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MyComponent from '../MyComponent.vue'

describe('MyComponent', () => {
  it('renders correctly', () => {
    const wrapper = mount(MyComponent, {
      props: { message: 'Hello' }
    })
    expect(wrapper.text()).toContain('Hello')
  })
})
```

### E2E Tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# Run specific browser
npm run test:e2e -- --project=chromium

# Run in debug mode
npm run test:e2e -- --debug
```

Test files: `e2e/**/*.spec.ts`

Example:
```typescript
// e2e/home.spec.ts
import { test, expect } from '@playwright/test'

test('home page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Lelanation/)
})
```

## Code Quality

### Linting

```bash
npm run lint
```

Uses ESLint with Vue and TypeScript plugins.

### Formatting

```bash
npm run format
```

Uses Prettier for code formatting.

### Type Checking

```bash
npm run type-check
```

Uses `vue-tsc` for Vue + TypeScript type checking.

## API Integration

### Making API Calls

```typescript
import axios from 'axios'

// GET request
const response = await axios.get('/api/builds')
const builds = response.data

// POST request
await axios.post('/api/save/my-build', buildData)
```

### Using Stores with API

```typescript
// In a store
import axios from 'axios'

const loadBuilds = async () => {
  try {
    const response = await axios.get('/api/builds')
    builds.value = response.data
  } catch (error) {
    console.error('Failed to load builds:', error)
  }
}
```

## State Management

### Pinia Stores

Stores are organized by domain:
- `buildStore`: Build management
- `championStore`: Champion selection
- `itemStore`: Items data
- `runeStore`: Runes data
- etc.

### Using Stores

```vue
<script setup lang="ts">
import { useBuildStore } from '@/stores/buildStore'

const buildStore = useBuildStore()

// Access state
const builds = buildStore.userBuilds

// Call actions
buildStore.loadUserBuilds()
</script>
```

## Styling

### CSS Files

Main CSS: `src/assets/css/main.css`

### Component Styles

```vue
<style scoped>
.my-component {
  /* Scoped styles */
}
</style>
```

## Environment Variables

Create `.env` file (not committed):

```env
VITE_API_URL=http://localhost:3500
VITE_BUILD_ID=dev
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL
```

## Build Configuration

### Vite Config

Edit `vite.config.ts` for:
- Build optimization
- Code splitting
- Asset handling
- Proxy configuration

### Production Build

```bash
npm run build
```

Output: `dist/` directory

## Common Development Tasks

### Adding a New Route

1. Create view component
2. Add route in `src/router/index.ts`
3. Update meta tags if needed (in router `beforeEach`)

### Adding Translations

1. Add translation key in `src/i18n/locales/`
2. Use in components: `$t('key')` or `t('key')`

### Working with Builds

```typescript
import { useBuildStore } from '@/stores/buildStore'

const buildStore = useBuildStore()

// Create build
const build = buildStore.statsCalculator(championStats, itemStats)

// Save build
buildStore.saveBuild(buildData)

// Load builds
buildStore.loadUserBuilds()
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 5173
lsof -i :5173

# Kill process
kill -9 <PID>
```

### TypeScript Errors

```bash
# Clean and rebuild
rm -rf node_modules dist
npm install
npm run type-check
```

### Build Errors

```bash
# Clear cache and rebuild
rm -rf node_modules dist .vite
npm install
npm run build
```

## Best Practices

1. **Use Composition API**: Prefer `<script setup>` syntax
2. **TypeScript**: Define types for all props and data
3. **Component Organization**: Group related components
4. **State Management**: Use Pinia for shared state
5. **Testing**: Write tests for new features
6. **Performance**: Use lazy loading for routes
7. **Accessibility**: Follow WCAG guidelines
8. **Mobile-First**: Design for mobile, enhance for desktop

## Next Steps

- Set up CI/CD pipeline
- Add performance monitoring
- Implement error tracking (Sentry)
- Optimize bundle size
- Add SSR for SEO (future)
