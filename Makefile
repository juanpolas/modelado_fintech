SHELL := /bin/bash

.PHONY: setup setup-backend setup-frontend dev backend frontend test build

setup: setup-backend setup-frontend

setup-backend:
	python3 -m venv .venv
	. .venv/bin/activate && pip install --upgrade pip && pip install -r backend/requirements.txt

setup-frontend:
	cd frontend && npm install

dev:
	npm run dev

backend:
	./scripts/start_backend.sh

frontend:
	./scripts/start_frontend.sh

test:
	. .venv/bin/activate && cd backend && pytest -q

build:
	cd frontend && npm run build
