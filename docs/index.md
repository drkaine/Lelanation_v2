# Lelanation Project Documentation

**Generated**: 2026-01-14  
**Project Type**: Multi-part (Backend + Frontend)  
**Scan Level**: Exhaustive

## Project Overview

Lelanation is a League of Legends build configuration and statistics website. The project consists of:

- **Backend**: TypeScript/Express.js API with Redis caching
- **Frontend**: Vue 3 SPA with Vite, Pinia state management, and PWA support

### Quick Reference

#### Backend (TypeScript/Express/Redis)
- **Type**: Backend API
- **Tech Stack**: TypeScript 5.6.3, Express.js 4.21.1, Redis 5.0.1, node-cron 3.0.3
- **Root**: `/home/ubuntu/dev/Lelanation/backend`
- **Entry Point**: `src/app.ts`
- **Architecture Pattern**: Service-Oriented Architecture with RESTful API

#### Frontend (Vue 3/Vite)
- **Type**: Web Application
- **Tech Stack**: Vue 3.5.12, TypeScript ~5.5.4, Vite 6.3.5, Pinia 2.2.4, Vue Router 4.4.5
- **Root**: `/home/ubuntu/dev/Lelanation/frontend`
- **Entry Point**: `src/main.ts`
- **Architecture Pattern**: Component-Based SPA with PWA support

## Generated Documentation

### Core Documentation
- [Project Overview](./project-overview.md) ✓
- [Technology Stack](./technology-stack.md) ✓
- [Source Tree Analysis](./source-tree-analysis.md) ✓
- [Architecture - Backend](./architecture-backend.md) ✓
- [Architecture - Frontend](./architecture-frontend.md) ✓

### API Documentation
- [API Contracts - Backend](./api-contracts-backend.md) ✓

### Data & Models
- [Data Models](./data-models.md) ✓
- [Riot API – Collecte de matchs](./riot-api-match-collection.md) – Workflow, limites, file PUUID, TOS

### Components & UI
- [Component Inventory - Frontend](./component-inventory-frontend.md) ✓

### Development & Deployment
- [Development Guide - Backend](./development-guide-backend.md) ✓
- [Development Guide - Frontend](./development-guide-frontend.md) ✓
- [Deployment Guide](./deployment-guide.md) ✓

### Integration
- [Integration Architecture](./integration-architecture.md) ✓

## Existing Documentation

### Backend
- [Redis Documentation](../Lelanation/backend/docs/REDIS.md) - Redis cache implementation and strategy
- [Cache Deployment Guide](../Lelanation/backend/docs/CACHE_DEPLOYMENT.md) - Cache deployment and configuration

### Frontend
- [Frontend README](../Lelanation/frontend/README.md) - Basic setup instructions

### Load Testing
- [Load Test README](../Lelanation/load-test/README.md) - Load testing with k6

## Getting Started

### Prerequisites
- Node.js 18+
- Redis 7.0+ (for backend)
- npm 8+

### Quick Start

#### Backend
```bash
cd backend
npm install
npm start
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Documentation Inventory
See [Existing Documentation Inventory](./existing-documentation-inventory.md) for complete list of existing documentation files.

## Project Structure

### Repository Type
**Multi-part**: Separate backend and frontend applications

### Parts
1. **backend** - Express.js API server
2. **frontend** - Vue 3 SPA

### Integration
- Frontend communicates with backend via REST API (`/api/*`)
- Redis cache layer for backend performance
- Service Worker for frontend offline support

## Next Steps

For brownfield PRD creation, reference this index.md when running the PRD workflow.
