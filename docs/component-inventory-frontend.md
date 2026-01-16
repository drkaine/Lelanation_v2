# Component Inventory - Frontend

## Overview

This document catalogs all Vue components in the Lelanation frontend application, organized by category and purpose.

## Component Organization

Components are located in `src/components/` and organized by feature/domain.

## Build Components

**Location**: `src/components/composants/`

### BuildRecap.vue
**Purpose**: Display build summary/recap  
**Usage**: Build review and sharing  
**Props**: Build data  
**Features**: Build visualization, stat display

### SheetBuild.vue
**Purpose**: Build sheet/configuration display  
**Usage**: Build tool interface  
**Props**: Build configuration  
**Features**: Build editing interface

### SkillUp.vue
**Purpose**: Skill upgrade order display  
**Usage**: Build skill order configuration  
**Props**: Skill order data  
**Features**: Skill level progression visualization

### ExtraInfo.vue
**Purpose**: Additional build information  
**Usage**: Build details display  
**Props**: Build metadata  
**Features**: Additional context display

### MenuBuild.vue
**Purpose**: Build menu/navigation  
**Usage**: Build tool navigation  
**Props**: Build state  
**Features**: Build tool navigation menu

### InfosBuild.vue
**Purpose**: Build information display  
**Usage**: Build details view  
**Props**: Build data  
**Features**: Build metadata display

### StatistiquesBuild.vue
**Purpose**: Build statistics display  
**Usage**: Build stats visualization  
**Props**: Calculated stats  
**Features**: Stat calculations, charts

## Tooltip Components

**Location**: `src/components/Tooltip/`

### ChampionTooltip.vue
**Purpose**: Champion information tooltip  
**Usage**: Hover tooltips for champions  
**Props**: Champion data  
**Features**: Champion stats, abilities display

### ItemTooltip.vue
**Purpose**: Item information tooltip  
**Usage**: Hover tooltips for items  
**Props**: Item data  
**Features**: Item stats, description, cost

## Selection Components

**Location**: `src/components/Selection/`

**Purpose**: Selection interfaces for builds  
**Usage**: Build configuration  
**Features**: Item selection, rune selection, etc.

## Modal Components

**Location**: `src/components/Modal/`

**Purpose**: Modal dialogs  
**Usage**: User interactions, confirmations  
**Features**: Dialog management, overlay

## Admin Components

**Location**: `src/components/Admin/`

**Purpose**: Admin-specific components  
**Usage**: Admin panel  
**Features**: Admin functionality

## Home Components

**Location**: `src/components/home/`

**Purpose**: Home page components  
**Usage**: Landing page  
**Features**: Home page sections

## Script Components

**Location**: `src/components/script/`

**Purpose**: Calculation/script components  
**Usage**: Build calculations  
**Features**: Stat calculations, build optimization

## Shared Components

### AlphabetNavigation.vue
**Purpose**: Alphabet-based navigation  
**Usage**: List navigation (champions, items)  
**Props**: Items list, current selection  
**Features**: Alphabet filtering, navigation

### DictionaryPagination.vue
**Purpose**: Dictionary pagination  
**Usage**: Dictionary view pagination  
**Props**: Dictionary entries, page size  
**Features**: Pagination controls

### FooterComponent.vue
**Purpose**: Site footer  
**Usage**: All pages  
**Props**: None  
**Features**: Footer links, legal info

### LanguageSwitcher.vue
**Purpose**: Language selection  
**Usage**: i18n language switching  
**Props**: Current locale  
**Features**: Language dropdown, locale switching

### MetaTags.vue
**Purpose**: Meta tags management  
**Usage**: SEO meta tags  
**Props**: Title, description, og tags  
**Features**: Dynamic meta tag updates

## Component Patterns

### Composition API
All components use Vue 3 Composition API with `<script setup>` syntax.

### TypeScript
All components are written in TypeScript with type definitions.

### Props Validation
Props are typed using TypeScript interfaces.

### State Management
Components use Pinia stores for shared state:
- `buildStore`: Build-related state
- `championStore`: Champion selection
- `itemStore`: Items data
- `runeStore`: Runes data
- etc.

## Component Categories

### By Purpose

**Display Components**:
- BuildRecap, SheetBuild, InfosBuild
- StatistiquesBuild, ExtraInfo

**Interactive Components**:
- MenuBuild, Selection components
- Modal components

**Navigation Components**:
- AlphabetNavigation, DictionaryPagination
- LanguageSwitcher

**Utility Components**:
- Tooltip components
- MetaTags, FooterComponent

### By Reusability

**Highly Reusable**:
- Tooltip components
- Modal components
- Selection components
- AlphabetNavigation
- LanguageSwitcher

**Feature-Specific**:
- Build components (composants/)
- Admin components
- Home components

## Component Dependencies

### External Libraries
- **@iconify/vue**: Icons
- **chart.js / vue-chartjs**: Charts (StatistiquesBuild)
- **dom-to-image-more**: Image generation
- **html2canvas**: Canvas rendering
- **vuedraggable**: Drag and drop

### Internal Dependencies
- Pinia stores for state
- Vue Router for navigation
- i18n for translations
- Type definitions from `src/types/`

## Component Testing

### Test Coverage
- Unit tests: `*.spec.ts` files in `__tests__/` directories
- E2E tests: Playwright tests in `e2e/`

### Testing Tools
- **Vitest**: Unit testing
- **@vue/test-utils**: Vue component testing
- **Playwright**: E2E testing

## Component Documentation

### Current State
- Components are self-documenting via TypeScript types
- No separate documentation files
- Props and events defined in component files

### Future Improvements
- JSDoc comments for complex components
- Storybook for component library
- Component usage examples
- Design system documentation

## Component Statistics

- **Total Components**: ~30+ components
- **Build Components**: 7
- **Tooltip Components**: 2
- **Shared Components**: 5+
- **Feature Components**: 15+

## Component Best Practices

### Current Patterns
- Composition API with `<script setup>`
- TypeScript for type safety
- Pinia for state management
- Props validation via TypeScript
- Computed properties for derived state

### Recommendations
- Extract reusable logic to composables
- Use provide/inject for deep prop passing
- Implement proper error boundaries
- Add loading states
- Optimize with `v-memo` for large lists
