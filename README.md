# MiroFish Argentina Fintech Behavior Simulation Platform

## Project Overview
This repository adapts the open-source [MiroFish](https://github.com/666ghj/MiroFish) into a web-based fintech behavior simulation platform focused on Argentina. It simulates synthetic user behavior under product, macro, company, and future-scenario conditions.

## How MiroFish Was Adapted
### How MiroFish works today (base repo)
- Backend was Flask-first, built around multi-agent social simulation workflows (graph building, environment setup, simulation, reporting).
- Frontend was a Vue app for the original multi-step simulation flow.
- LLM integration existed for simulation/report tasks with OpenAI-compatible APIs.
- Persistence existed for project/simulation artifacts in upload folders.

### Reused
- Monorepo structure (`backend`, `frontend`, root scripts).
- Vue + Vite frontend stack.
- OpenAI-compatible LLM access pattern, now generalized by provider vars.

### Modified
- Backend adapted to a Flask MVP service (base repo already Flask) for fintech simulation APIs.
- Frontend replaced with a pragmatic dashboard flow: gate + simulation + managers + runs + settings.
- Config and start scripts updated for local and RunPod Pod workflows.

### Added
- Access-code gate using cookie session (`APP_ACCESS_CODE`).
- Dynamic archetype/scenario CRUD with SQLite persistence.
- Argentina-specific simulation engine and default archetypes/scenarios.
- Future scenario translator, global impact translator, tactical strategy advisor, disruptive innovation advisor.
- Run persistence, duplication, export-ready JSON.
- Tests for simulation/parsing/fallback.

## Architecture
- `backend`: Flask + SQLite + simulation engine + LLM abstraction.
- `frontend`: Vue SPA with required pages and charts.
- `data`: SQLite DB (`fintech_sim.db`) and runtime artifacts.
- `scripts`: local/RunPod setup and startup helpers.
- `docker`: optional container flow.

## Key Features
- Public URL access gate with shared code and logout.
- Dynamic archetype management (CRUD, duplicate, import/export JSON).
- Dynamic scenario management (CRUD, duplicate, import/export JSON).
- Country + company context editing per simulation.
- Future scenario and global-event impact translation into structured qualitative variables.
- Multi-step simulation with synthetic Argentine fintech user agents.
- Tactical recommendations and disruptive innovation ideas.
- Past runs, run duplication, run export.
- DeepSeek/Qwen/mock provider switching through env vars.

## Local Development Setup
```bash
git clone https://github.com/666ghj/MiroFish.git
cd MiroFish
cp .env.example .env
# set APP_ACCESS_CODE in .env

make setup
make dev
```

Default URLs:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

### Optional Modern Frontend (Next.js)

An upgraded demo-oriented frontend is available in `frontend-next/`.

```bash
cd frontend-next
cp .env.example .env.local
# set NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 (or your RunPod backend URL)
npm install
npm run dev
```

Default URL: `http://localhost:3000`

## Environment Variables
```env
APP_ACCESS_CODE=change-me
SESSION_SECRET=replace-with-long-random-secret
LLM_PROVIDER=mock
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=qwen-plus
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
FRONTEND_PORT=3000
FRONTEND_ORIGIN=http://localhost:3000
DATABASE_PATH=./data/fintech_sim.db
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

X_API_KEY=
X_API_SECRET=
X_BEARER_TOKEN=
X_CLIENT_ID=
X_CLIENT_SECRET=
X_QUERY_DEFAULT="((dolar blue OR devaluacion OR inflacion OR bcra OR bancos OR fintech OR mercado pago OR uala OR naranja x OR corralito OR retiro de fondos OR stablecoin OR usdt OR bitcoin argentina OR cashback OR promo) (argentina OR ar)) lang:es -is:retweet -is:reply -has:links -futbol -amistoso -uefa -conmebol -mundial -piñon -españa -dominicanos"
X_MAX_RESULTS=50

NEWS_REFRESH_INTERVAL_MINUTES=20
NEWS_SOURCES_ENABLED=
NEWS_FETCH_LIMIT_PER_SOURCE=12
SIGNALS_BACKGROUND_ENABLED=false
```

## Configuring DeepSeek
```env
LLM_PROVIDER=deepseek
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=your_key
LLM_MODEL=deepseek-chat
```

## Configuring Qwen
```env
LLM_PROVIDER=qwen
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_API_KEY=your_key
LLM_MODEL=qwen-plus
```

## Running In Mock Mode
```env
LLM_PROVIDER=mock
```
No external API calls are needed; deterministic fallback remains active.

## API Reference
- `GET /health`
- `POST /simulate`
- `GET /scenarios`
- `POST /scenarios`
- `PUT /scenarios/{id}`
- `DELETE /scenarios/{id}`
- `GET /archetypes`
- `POST /archetypes`
- `PUT /archetypes/{id}`
- `DELETE /archetypes/{id}`
- `GET /runs`
- `GET /runs/{id}`
- `POST /runs/{id}/duplicate`
- `GET /runs/{id}/report-pdf?lang=es|en`
- `POST /translate-scenario`
- `POST /impact-translate`
- `POST /strategy-recommend`
- `POST /innovation-recommend`
- `POST /contexts/review`
- `POST /scenarios/review`
- `POST /scenarios/generate`
- `POST /signals/twitter/fetch`
- `POST /signals/twitter/analyze`
- `POST /signals/news/fetch`
- `POST /signals/news/analyze`
- `POST /signals/fuse`
- `GET /signals/recent`
- `POST /signals/refresh`

Support endpoints:
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/status`
- `GET /settings`
- `PUT /settings`

## Sample curl Commands
```bash
curl -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"code":"change-me"}' \
  -c cookies.txt

curl http://localhost:8000/archetypes -b cookies.txt

curl -X POST http://localhost:8000/translate-scenario \
  -H 'Content-Type: application/json' -b cookies.txt \
  -d '{"text":"Cambio de gobierno con incertidumbre"}'

curl -X POST http://localhost:8000/impact-translate \
  -H 'Content-Type: application/json' -b cookies.txt \
  -d '{"text":"There is a war in the Middle East"}'

curl -X POST http://localhost:8000/signals/twitter/fetch \
  -H 'Content-Type: application/json' -b cookies.txt \
  -d '{"query":"dolar blue OR devaluacion argentina lang:es -is:retweet","max_results":40}'

curl -X POST http://localhost:8000/signals/news/analyze \
  -H 'Content-Type: application/json' -b cookies.txt \
  -d '{}'

curl -X POST http://localhost:8000/signals/fuse \
  -H 'Content-Type: application/json' -b cookies.txt \
  -d '{}'
```

## Real-World Signals Layer
- **Twitter/X Live**: real X API recent search integration (requires `X_BEARER_TOKEN`).
- **News Live**: RSS-first + parser adapters for Argentine outlets.
- **Signal Fusion Engine**: combines Twitter narratives + news events + user context into reviewed simulation modifiers.
- **Persistence**: fetched/analyzed/fused signals are stored in SQLite (`signals` table).
- **UI**: `Real-World Signals` tab in `frontend-next` with:
  - `Twitter/X Live`
  - `News Live`
  - `Fused Context` with editable impact vectors and `Apply to New Simulation`.

## Running A Sample Simulation
1. Login from web UI with `APP_ACCESS_CODE`.
2. Go to `New Simulation`.
3. Select scenario/archetype mix, edit country+company context.
4. Optionally apply AI translation and edit generated fields.
5. Click `Run Simulation`.

## Using The Archetype Manager
- Open `Archetype Manager`.
- Create/edit/delete/duplicate archetypes.
- Import/export archetypes as JSON.
- Edit `behavioral_prompt_template` per archetype.

## Using The Scenario Manager
- Open `Scenario Manager`.
- Create/edit/delete/duplicate scenarios.
- Import/export scenarios as JSON.

## Using Scenario Translation
- Enter future scenario text in `New Simulation`.
- Click `Translate Scenario`.
- Review/edit structured output before running.

## Using Impact Translation
- Enter global event text in `New Simulation`.
- Click `Translate Global Event Impact`.
- Review/edit structured local impact variables before running.

## Using Tactical Recommendations
- Generated automatically after simulation.
- Also available via `POST /strategy-recommend`.

## Using Disruptive Innovation Ideas
- Generated automatically after simulation under `Innovation Lab`.
- Also available via `POST /innovation-recommend`.

## Viewing Results
Results panel includes:
- Executive metric cards
- Downloadable executive PDF report (Spanish/English) generated from run inputs + outputs + recommendation analysis.
- Timeline chart lines (churn, trust deterioration, liquidity stress)
- Final action distribution
- Archetype-level breakdown in output payload
- Tactical recommendations
- Disruptive recommendations
- Duplicate/export run actions

## Deploy On RunPod
### Fresh Pod commands (copy-paste)
```bash
sudo apt update
sudo apt install -y git

git clone https://github.com/666ghj/MiroFish.git
cd MiroFish
cp .env.example .env
# edit .env (set APP_ACCESS_CODE, optional LLM vars)

./scripts/runpod_setup.sh
```

### Start services with tmux
```bash
./scripts/start_all.sh
tmux attach -t mirofish-fintech
```

Default `start_frontend.sh` now prefers `frontend-next` (port `3000`).

### Manual start
```bash
./scripts/start_backend.sh
# in another shell
./scripts/start_frontend.sh
```

### nohup alternative
```bash
nohup ./scripts/start_backend.sh > backend.log 2>&1 &
nohup ./scripts/start_frontend.sh > frontend.log 2>&1 &
```

RunPod notes:
- Bind host is `0.0.0.0`.
- Use Pod public TCP/HTTP mapping for `FRONTEND_PORT` and optionally `BACKEND_PORT`.
- Keep backend private if possible and expose frontend publicly.

## Security / Data Safety Notes
- Use only synthetic users and synthetic scenario variables.
- Do not upload PII or customer-level data.
- Do not send customer-level sensitive data to external LLM APIs.
- Access gate is MVP auth for demo/internal usage, not enterprise IAM.

## Cost Notes
Approximate per simulation (LLM-enabled):
- Agent reasoning calls are sampled, not full-agent every step.
- Typical run (`300 agents`, `12 steps`, `1 MC`) with sampled LLM usage: usually low single-digit cents to low tens of cents depending on model/provider.
- Translation and recommendation endpoints add small extra cost (typically far less than full simulation reasoning).
- `mock` mode has zero LLM token cost.

## Tests
Run:
```bash
make test
```
Covers:
- simulation logic
- seeded archetype/scenario loading
- scenario translation parsing
- impact translation parsing
- tactical recommendation parsing
- disruptive recommendation parsing
- fallback behavior in mock mode
