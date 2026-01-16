# Project Overview - Lelanation

## Project Name
**Lelanation**

## Purpose
Lelanation is a League of Legends build configuration and statistics website. It provides tools for:
- Creating and sharing champion builds
- Optimizing builds with stat calculations
- Viewing aggregated statistics for champions, builds, and items
- Filtering to find One-Trick-Ponies (OTP)
- Daily synchronization with Riot Games Data Dragon API
- Managing YouTube videos from League of Legends content creators

## Executive Summary

Lelanation is a full-stack web application for League of Legends players to create, share, and analyze champion builds. The application features a build configurator (similar to shyv.net), build optimization tools, comprehensive statistics, and content creator video management.

### Key Features
1. **Build Configurator**: Create and share champion builds
2. **Build Optimizer**: Calculate and optimize build statistics
3. **Statistics Dashboard**: Aggregated stats for champions, builds, and items with OTP filtering
4. **Data Synchronization**: Daily cron jobs to sync with Riot Games Data Dragon API
5. **YouTube Integration**: Admin-managed list of content creators with automatic video updates

## Tech Stack Summary

### Backend
- **Language**: TypeScript 5.6.3
- **Framework**: Express.js 4.21.1
- **Cache**: Redis 5.0.1
- **Task Scheduler**: node-cron 3.0.3

### Frontend
- **Framework**: Vue 3.5.12
- **Language**: TypeScript ~5.5.4
- **Build Tool**: Vite 6.3.5
- **State Management**: Pinia 2.2.4
- **Routing**: Vue Router 4.4.5
- **i18n**: vue-i18n 12.0.0-alpha.2

## Architecture Type

**Multi-part Application**:
- Separate backend API (Express.js)
- Separate frontend SPA (Vue 3)
- Communication via REST API

## Repository Structure

```
Lelanation/
├── backend/     # Express.js API server
├── frontend/     # Vue 3 SPA
├── load-test/    # k6 load testing scripts
└── script/       # Utility scripts
```

## Design Requirements

- **Style**: Clean, minimalist, League of Legends themed
- **Compliance**: RGPD compliant
- **Approach**: Mobile-first design
- **Methodology**: TDD (Test-Driven Development)
- **Scalability**: Optimized for 10k+ users
- **Database**: No database (file-based storage)
- **Authentication**: No authentication system

## Current Status

**Brownfield Project**: Existing v1 at https://www.lelanation.fr/ that needs complete refactoring.

## Next Steps

1. Complete project documentation (in progress)
2. Create PRD for v2 refactoring
3. Design UX for new version
4. Plan architecture for scalable, mobile-first application
5. Implement TDD methodology
6. Ensure RGPD compliance
