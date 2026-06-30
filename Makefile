.PHONY: help setup dev dev-backend dev-frontend build build-all build-backend build-frontend build-frontend-only build-companion build-companion-exe companion-tag exe-windows \
	pm2-status pm2-start pm2-restart pm2-restart-no-poller pm2-restart-frontend pm2-stop pm2-delete pm2-logs pm2-logs-backend pm2-logs-poller pm2-restart-poller pm2-logs-frontend \
	deploy deploy-frontend sync-data typecheck typecheck-frontend typecheck-companion lint lint-frontend format format-frontend \
	test test-packages clean \
	docker-db-up docker-db-down docker-db-restart docker-db-wait-healthy docker-db-verify wait-redis \
	migrate-drizzle-statistiques migrate-db merge-objective-histogram-global

ROOT_DIR := $(CURDIR)
COMPOSE := docker compose -f "$(ROOT_DIR)/docker-compose.yml"
BACKEND_DIR := backend
FRONTEND_DIR := frontend
COMPANION_APP_DIR := companion-app
PACKAGES_DIR := packages
BUILDS_UI_DIR := $(PACKAGES_DIR)/builds-ui
COMPANION_BUNDLE_DIR := $(COMPANION_APP_DIR)/src-tauri/target/release/bundle
COMPANION_EXE_NAME := lelanation-companion-setup.exe
WINDOWS_VCVARS64 := C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat
WINDOWS_MSVC_LINKER := C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64\link.exe
WINDOWS_EXE_OUTPUT := Lelanation.exe
LOGS_DIR := logs
ECOSYSTEM_FILE := ecosystem.config.js

NPM := npm
PM2 := pm2

help:
	@echo ""
	@echo "Lelanation v2 - Make targets"
	@echo ""
	@echo "Setup"
	@echo "  make setup              Install all deps (workspaces: root/backend/frontend/companion/packages; Node ^20.19.0 || >=22.12.0, see .nvmrc)"
	@echo ""
	@echo "Dev"
	@echo "  make dev                Run backend + frontend dev servers (parallel)"
	@echo "  make dev-backend        Run backend dev server only"
	@echo "  make dev-frontend       Run frontend dev server only"
	@echo ""
	@echo "Build"
	@echo "  make build              Build backend + frontend + companion; PM2 restart backend+frontend only (poller-v2 untouched)"
	@echo "  make build-all          Compile + migrations schéma + PM2 (ne remplit pas les tables stats ; pas de merge SQL)"
	@echo "  make build-backend      migrate-db (Drizzle) puis npm run build"
	@echo "  make build-frontend     Stop PM2, clean build, verify chunks, start frontend"
	@echo "  make build-frontend-only  Build frontend artifacts only (no PM2 restart)"
	@echo "  make deploy-frontend    Same as build-frontend (atomic deploy script)"
	@echo "  make build-companion    Build companion Vite app only"
	@echo "  make build-companion-exe  Build companion Windows .exe at project root"
	@echo "  make companion-tag      Sync version + commit + tag + push companion-v* (VERSION=1.0.0 MSG=..., NO_PUSH=1 to skip)"
	@echo "  make exe-windows        Build Tauri app and copy it to ./Lelanation.exe"
	@echo ""
	@echo "Bases de données (migrations)"
	@echo "  make migrate-db         Migrations Drizzle (DATABASE_URL → lelanation_statistiques)"
	@echo "  make merge-objective-histogram-global  Fusionne region GLOBAL → euw1 sur objective_outcome_histogram (DATABASE_URL)"
	@echo ""
	@echo "Docker PostgreSQL + Redis (local)"
	@echo "  make docker-db-up       docker compose up -d + attente healthcheck (postgres + redis)"
	@echo "  make wait-redis         Attendre redis-cli PONG sur 127.0.0.1:6379"
	@echo "  make docker-db-down     docker compose down"
	@echo "  make docker-db-restart  docker compose restart + attente healthcheck"
	@echo "  make docker-db-verify   down → up → restart, contrôle healthy (cycle type redémarrage)"
	@echo ""
	@echo "PM2"
	@echo "  make pm2-status         Show PM2 status"
	@echo "  make pm2-start          Start apps from ecosystem config"
	@echo "  make pm2-restart        Restart all apps from ecosystem config"
	@echo "  make pm2-restart-no-poller  Restart lelanation-backend + lelanation-frontend only"
	@echo "  make deploy             Build then pm2 startOrRestart"
	@echo "  make pm2-logs           Tail all PM2 logs"
	@echo "  make pm2-logs-backend   Tail backend logs"
	@echo "  make pm2-logs-poller    Tail poller-v2 logs"
	@echo "  make pm2-logs-frontend  Tail frontend logs"
	@echo "  make pm2-restart-poller Restart poller-v2 only"
	@echo ""
	@echo "Quality"
	@echo "  make typecheck          Typecheck backend + frontend + companion"
	@echo "  make typecheck-frontend Typecheck frontend only"
	@echo "  make typecheck-companion Typecheck companion only"
	@echo "  make lint               Lint frontend"
	@echo "  make lint-frontend      Lint frontend only"
	@echo "  make format             Format frontend"
	@echo "  make test               Run all tests (packages)"
	@echo "  make test-packages      Run builds-ui unit tests"
	@echo ""
	@echo "Utilities"
	@echo "  make sync-data          Run backend data sync script"
	@echo "  make clean              Remove build artifacts"
	@echo ""

# ─── Setup ───────────────────────────────────────────────────────────────────────
setup:
	$(NPM) ci

# ─── Dev ─────────────────────────────────────────────────────────────────────────
dev:
	@$(MAKE) -j2 dev-backend dev-frontend

dev-backend:
	$(NPM) --prefix "$(BACKEND_DIR)" run dev

dev-frontend:
	$(NPM) --prefix "$(FRONTEND_DIR)" run dev

# ─── Build ───────────────────────────────────────────────────────────────────────
build: test-packages build-backend build-frontend build-companion pm2-restart-no-poller

build-all: test-packages build-backend build-frontend build-companion pm2-restart

# Applique les migrations Drizzle (statistiques) avant le build.
build-backend: migrate-db
	$(NPM) --prefix "$(BACKEND_DIR)" run build

migrate-drizzle-statistiques:
	$(NPM) --prefix "$(BACKEND_DIR)" run drizzle:statistiques:migrate

migrate-db: migrate-drizzle-statistiques

# ─── Docker (PostgreSQL local) ─────────────────────────────────────────────────
wait-redis:
	@elapsed=0; max=60; \
	while [ $$elapsed -lt $$max ]; do \
	  if redis-cli -h 127.0.0.1 -p 6379 ping 2>/dev/null | grep -q PONG; then \
	    echo "redis: ready"; exit 0; \
	  fi; \
	  sleep 2; elapsed=$$((elapsed+2)); \
	done; \
	echo "redis: timeout — lancer Redis (make docker-db-up ou systemctl start redis-server)"; exit 1

docker-db-wait-healthy:
	@elapsed=0; max=60; \
	while [ $$elapsed -lt $$max ]; do \
	  pg=$$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' lelanation-postgres-statistiques 2>/dev/null || echo missing); \
	  rd=$$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' lelanation-redis 2>/dev/null || echo missing); \
	  if [ "$$pg" = "healthy" ] && [ "$$rd" = "healthy" ]; then echo "docker-db: healthy (postgres=$$pg redis=$$rd)"; exit 0; fi; \
	  sleep 2; elapsed=$$((elapsed+2)); \
	done; \
	echo "docker-db: timeout (postgres=$$pg redis=$$rd)"; exit 1

docker-db-up:
	$(COMPOSE) up -d
	@$(MAKE) docker-db-wait-healthy

docker-db-down:
	$(COMPOSE) down

docker-db-restart:
	$(COMPOSE) restart
	@$(MAKE) docker-db-wait-healthy

docker-db-verify:
	@echo "docker-db-verify: down → up → wait healthy → restart → wait healthy"
	$(COMPOSE) down
	$(COMPOSE) up -d
	@$(MAKE) docker-db-wait-healthy
	$(COMPOSE) restart
	@$(MAKE) docker-db-wait-healthy
	@echo "docker-db-verify: OK"

build-frontend deploy-frontend:
	bash "$(ROOT_DIR)/scripts/deploy-frontend.sh"

build-frontend-only:
	bash "$(ROOT_DIR)/scripts/build-frontend.sh"

pm2-restart-frontend:
	$(PM2) restart lelanation-frontend --update-env

build-companion:
	$(NPM) --prefix "$(COMPANION_APP_DIR)" run build

build-companion-exe:
	$(NPM) --prefix "$(COMPANION_APP_DIR)" run tauri build
	@set -e; \
	EXE_PATH="$$(ls -1 "$(COMPANION_BUNDLE_DIR)"/*/*.exe 2>/dev/null | head -n 1)"; \
	if [ -z "$$EXE_PATH" ]; then \
	  echo "No .exe produced by Tauri build. Build on Windows or configure cross-compilation."; \
	  exit 1; \
	fi; \
	cp "$$EXE_PATH" "$(ROOT_DIR)/$(COMPANION_EXE_NAME)"; \
	echo "Copied companion installer to $(ROOT_DIR)/$(COMPANION_EXE_NAME)"

# Sync companion-app version files, commit bump, tag companion-v*, push to origin (triggers CI).
# Example: make companion-tag VERSION=1.0.0 MSG="Companion installer 1.0.0"
companion-tag:
	@test -n "$(VERSION)" || (echo "Usage: make companion-tag VERSION=1.0.0 [MSG='Companion installer 1.0.0'] [NO_PUSH=1]" && exit 1)
	@ARGS="$(VERSION)"; \
	if [ -n "$(MSG)" ]; then ARGS="$$ARGS -m $(MSG)"; fi; \
	if [ -n "$(NO_PUSH)" ]; then ARGS="$$ARGS --no-push"; fi; \
	node "$(COMPANION_APP_DIR)/scripts/companion-tag.mjs" $$ARGS

exe-windows:
	powershell -NoProfile -ExecutionPolicy Bypass -File "$(ROOT_DIR)/scripts/exe-windows.ps1"

# ─── PM2 ─────────────────────────────────────────────────────────────────────────
pm2-status:
	$(PM2) status

pm2-start: wait-redis
	mkdir -p "$(LOGS_DIR)"
	$(PM2) start "$(ECOSYSTEM_FILE)" --update-env

pm2-restart: wait-redis
	$(PM2) restart "$(ECOSYSTEM_FILE)" --update-env

pm2-restart-no-poller:
	$(PM2) restart lelanation-backend --update-env

pm2-stop:
	$(PM2) stop "$(ECOSYSTEM_FILE)"

pm2-delete:
	$(PM2) delete "$(ECOSYSTEM_FILE)"

pm2-logs:
	$(PM2) logs

pm2-logs-backend:
	$(PM2) logs lelanation-backend

pm2-logs-poller:
	$(PM2) logs lelanation-poller-v2

pm2-restart-poller:
	$(PM2) restart lelanation-poller-v2

pm2-logs-frontend:
	$(PM2) logs lelanation-frontend

deploy: build wait-redis
	mkdir -p "$(LOGS_DIR)"
	$(PM2) startOrRestart "$(ECOSYSTEM_FILE)" --update-env

# ─── Quality ─────────────────────────────────────────────────────────────────────
typecheck: typecheck-frontend typecheck-companion
	$(NPM) --prefix "$(BACKEND_DIR)" run typecheck

typecheck-frontend:
	$(NPM) --prefix "$(FRONTEND_DIR)" run typecheck

typecheck-companion:
	cd "$(COMPANION_APP_DIR)" && npx vue-tsc --noEmit

lint: lint-frontend

lint-frontend:
	$(NPM) --prefix "$(FRONTEND_DIR)" run lint

format: format-frontend

format-frontend:
	$(NPM) --prefix "$(FRONTEND_DIR)" run format

test: test-packages

test-packages:
	$(NPM) --prefix "$(BUILDS_UI_DIR)" test

# ─── Utilities ───────────────────────────────────────────────────────────────────
sync-data:
	$(NPM) --prefix "$(BACKEND_DIR)" run sync:data

clean:
	rm -rf "$(BACKEND_DIR)/dist" \
	       "$(FRONTEND_DIR)/.output" \
	       "$(FRONTEND_DIR)/.nuxt" \
	       "$(FRONTEND_DIR)/node_modules/.cache/nuxt" \
	       "$(COMPANION_APP_DIR)/src-tauri/target"
