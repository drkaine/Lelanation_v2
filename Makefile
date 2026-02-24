.PHONY: help setup dev dev-backend dev-frontend build build-backend build-frontend build-companion build-companion-exe exe-windows \
	pm2-status pm2-start pm2-restart pm2-stop pm2-delete pm2-logs pm2-logs-backend pm2-logs-frontend \
	deploy sync-data typecheck lint-frontend format-frontend clean

ROOT_DIR := $(CURDIR)
BACKEND_DIR := backend
FRONTEND_DIR := frontend
COMPANION_APP_DIR := companion-app
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
	@echo "  make setup            Install deps (root/backend/frontend) via npm ci"
	@echo ""
	@echo "Dev"
	@echo "  make dev              Run backend + frontend dev servers (parallel)"
	@echo "  make dev-backend      Run backend dev server only"
	@echo "  make dev-frontend     Run frontend dev server only"
	@echo ""
	@echo "Build"
	@echo "  make build            Build backend + frontend + companion app"
	@echo "  make build-companion-exe  Build companion Windows .exe at project root"
	@echo "  make exe-windows      Build Tauri app and copy it to ./Lelanation.exe"
	@echo ""
	@echo "PM2"
	@echo "  make pm2-status       Show PM2 status"
	@echo "  make pm2-start        Start apps from ecosystem config"
	@echo "  make pm2-restart      Restart apps from ecosystem config"
	@echo "  make deploy           Build then pm2 startOrRestart"
	@echo "  make pm2-logs         Tail all PM2 logs"
	@echo "  make pm2-logs-backend Tail backend logs"
	@echo "  make pm2-logs-frontend Tail frontend logs"
	@echo ""
	@echo "Utilities"
	@echo "  make sync-data        Run backend data sync script"
	@echo "  make typecheck        Typecheck backend + frontend"
	@echo "  make lint-frontend    Lint frontend"
	@echo "  make format-frontend  Format frontend (prettier)"
	@echo "  make clean            Remove build artifacts"
	@echo ""

setup:
	$(NPM) ci
	$(NPM) --prefix "$(BACKEND_DIR)" ci
	$(NPM) --prefix "$(FRONTEND_DIR)" ci

dev:
	@$(MAKE) -j2 dev-backend dev-frontend

dev-backend:
	$(NPM) --prefix "$(BACKEND_DIR)" run dev

dev-frontend:
	$(NPM) --prefix "$(FRONTEND_DIR)" run dev

build: build-backend build-frontend build-companion pm2-restart

build-backend:
	$(NPM) --prefix "$(BACKEND_DIR)" run build

build-frontend:
	$(NPM) --prefix "$(FRONTEND_DIR)" run build

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

exe-windows:
	powershell -NoProfile -ExecutionPolicy Bypass -File "$(ROOT_DIR)/scripts/exe-windows.ps1"

pm2-status:
	$(PM2) status

pm2-start:
	mkdir -p "$(LOGS_DIR)"
	$(PM2) start "$(ECOSYSTEM_FILE)" --update-env

pm2-restart:
	$(PM2) restart "$(ECOSYSTEM_FILE)" --update-env

pm2-stop:
	$(PM2) stop "$(ECOSYSTEM_FILE)"

pm2-delete:
	$(PM2) delete "$(ECOSYSTEM_FILE)"

pm2-logs:
	$(PM2) logs

pm2-logs-backend:
	$(PM2) logs lelanation-backend

pm2-logs-frontend:
	$(PM2) logs lelanation-frontend

deploy: build
	mkdir -p "$(LOGS_DIR)"
	$(PM2) startOrRestart "$(ECOSYSTEM_FILE)" --update-env

sync-data:
	$(NPM) --prefix "$(BACKEND_DIR)" run sync:data

typecheck:
	$(NPM) --prefix "$(BACKEND_DIR)" run typecheck
	$(NPM) --prefix "$(FRONTEND_DIR)" run typecheck

lint-frontend:
	$(NPM) --prefix "$(FRONTEND_DIR)" run lint

format-frontend:
	$(NPM) --prefix "$(FRONTEND_DIR)" run format

clean:
	rm -rf "$(BACKEND_DIR)/dist" "$(FRONTEND_DIR)/.output" "$(FRONTEND_DIR)/.nuxt" "$(FRONTEND_DIR)/node_modules/.cache/nuxt"
