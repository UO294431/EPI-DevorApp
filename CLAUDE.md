# CLAUDE.md — EPI-DevorApp

## Project overview

Restaurant discovery and recommendation app. Users browse restaurants, call them, rate them, and receive personalised recommendations from a Keras neural network. The React web frontend is also packaged as an Android APK distributed through Google Play.

## Repository layout

```
epi-devorapp/
├── frontend/
│   ├── src/
│   │   ├── components/    # Shared UI (NotificationSystem, TopBar, …)
│   │   ├── controllers/   # Hooks and API wrappers
│   │   ├── models/        # TS types + API service clients (authService, etc.)
│   │   ├── views/         # Page components (HomePage, FavoritesPage, …)
│   │   └── tests/         # Vitest unit tests + setupTests.ts
│   ├── android/           # Capacitor Android project (committed — do not delete)
│   ├── fastlane/
│   │   ├── Fastfile       # deploy (internal), deploy_production lanes
│   │   └── Appfile        # com.devorapp.epi
│   ├── Dockerfile         # multi-stage: node build → nginx serve
│   ├── Dockerfile.dev     # node:22-alpine + npm run dev (hot reload)
│   ├── nginx.conf         # SPA fallback + /api/ proxy to backend:8000
│   ├── capacitor.config.ts
│   ├── vite.config.ts     # /api proxy → localhost:8000, BasicSSL
│   ├── eslint.config.js   # no-explicit-any off; _-prefix unused-var ignore
│   └── Gemfile            # fastlane ~> 2.225
├── backend/
│   ├── app/
│   │   ├── core/          # config.py (pydantic-settings), security.py (JWT)
│   │   ├── infrastructure/
│   │   │   ├── database.py
│   │   │   └── firebase/firebase_admin.py  # lazy singleton; mocked in tests
│   │   ├── models/dtos/   # Pydantic request/response schemas
│   │   ├── models/entities/ # SQLAlchemy ORM models
│   │   ├── presentation/routers/  # FastAPI routers
│   │   └── services/      # Business logic
│   ├── alembic/           # DB migrations
│   ├── tests/
│   │   └── conftest.py    # sys.modules firebase mock + async_client fixture
│   ├── Dockerfile         # python:3.12-slim + poetry install
│   ├── pyproject.toml     # [tool.poetry] packages = [{include = "app"}]
│   └── README.md          # required by pyproject.toml readme field
├── keras-api/             # Standalone ML recommendation microservice
├── docker-compose.yml     # Production: db + backend:8000 + frontend:80
├── docker-compose.dev.yml # Dev override: volumes + hot reload
├── .gitlab-ci.yml         # 4-stage pipeline: test → build → android → deploy
├── deploy.ps1             # Windows deploy script
├── deploy.sh              # Linux/macOS deploy script
└── devorapp.jks           # Android release keystore (gitignored)
```

## Key commands

### Frontend

```bash
cd frontend
npm install          # includes Capacitor packages
npm run dev          # https://localhost:5173
npm run build        # Vite production build → dist/
npm run test         # vitest
npm run lint         # eslint
npm run cap:sync     # npx cap sync android
npm run cap:open     # open Android Studio
npm run cap:build    # build + sync
```

### Backend

```bash
cd backend
poetry install --with dev
poetry run uvicorn app.main:app --reload --port 8000
poetry run pytest tests/ -v          # 74 tests (Firebase mocked)
poetry run alembic upgrade head      # run DB migrations
```

### Docker

```bash
docker compose up --build                                              # production
docker compose -f docker-compose.yml -f docker-compose.dev.yml up    # dev (hot reload)
docker compose up backend db                                           # backend only
docker compose up frontend                                             # frontend only
```

## Deploy scripts

### Windows (`deploy.ps1`)

```powershell
.\deploy.ps1                                   # docker, all, with tests
.\deploy.ps1 -Component backend                # backend + DB only
.\deploy.ps1 -Component frontend               # frontend only
.\deploy.ps1 -Dev                              # docker with hot reload overlay
.\deploy.ps1 -Mode native -Component backend   # native backend only
.\deploy.ps1 -SkipTests                        # skip pytest + vitest
.\deploy.ps1 -Apk                              # also build debug APK
.\deploy.ps1 -Stop                             # stop containers
```

### Linux / macOS (`deploy.sh`)

```bash
./deploy.sh                              # docker, all, with tests
./deploy.sh --component backend          # backend + DB only
./deploy.sh --component frontend         # frontend only
./deploy.sh --dev                        # docker with hot reload overlay
./deploy.sh --mode native --component backend
./deploy.sh --skip-tests
./deploy.sh --apk
./deploy.sh --stop
```

## CI/CD pipeline

| Stage | Job | Runs on | Notes |
|---|---|---|---|
| test | `test_backend` | main, MR, tags | libpq-dev+gcc for psycopg2 compile |
| test | `lint_frontend` | main, MR, tags | eslint |
| test | `test_frontend` | main, MR, tags | vitest |
| build | `build_backend` | main, tags | Docker image → registry |
| build | `build_frontend` | main, tags | Docker image → registry |
| android | `build_apk` | main, tags | signed APK; needs test jobs |
| deploy | `deploy_play_store` | **tags only** | internal track via fastlane |

## Docker services

| Service | Image | Port | Notes |
|---|---|---|---|
| `db` | postgres:16-alpine | 5432 | healthcheck before backend starts |
| `backend` | ./backend/Dockerfile | 8000 | waits for db healthy |
| `frontend` | ./frontend/Dockerfile | 80 | nginx + SPA fallback + /api/ proxy |

Dev overlay (`docker-compose.dev.yml`): backend source mounted → uvicorn --reload; frontend → Dockerfile.dev → npm run dev on :5173.

## Android

- App ID: `com.devorapp.epi`
- Config: `frontend/capacitor.config.ts`, `frontend/fastlane/Appfile`
- `frontend/android/` is committed — do not delete
- After web changes: `cd frontend && npm run cap:sync`
- Keystore: `devorapp.jks` in repo root (gitignored), alias `devorapp`, password `zNMFWxXVyGJy7XKFPZnwH5J1`

## Required CI variables

| Variable | Type | Value |
|---|---|---|
| `KEYSTORE_FILE` | masked | `base64 -w 0 devorapp.jks` |
| `KEYSTORE_STORE_PASSWORD` | masked | `zNMFWxXVyGJy7XKFPZnwH5J1` |
| `KEYSTORE_KEY_ALIAS` | plain | `devorapp` |
| `KEYSTORE_KEY_PASSWORD` | masked | `zNMFWxXVyGJy7XKFPZnwH5J1` |
| `GOOGLE_PLAY_JSON_KEY` | **file** | Play Store service account JSON |

## Backend environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/tfg_db` | PostgreSQL |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | `firebase-service-account.json` | Firebase credentials |
| `GOOGLE_API_KEY` | `""` | Google Maps / Places |
| `KERAS_API_URL` | `http://127.0.0.1:8001/predict` | ML service |
| `SECRET_KEY` | dev default | JWT secret |

## Known gotchas

- **Firebase in tests**: `conftest.py` patches `firebase_admin` in `sys.modules` before importing `app.main` (which calls `get_firebase_app()` at module level). `UserNotFoundError` / `EmailAlreadyExistsError` are real exception subclasses so `except` clauses work correctly.
- **psycopg2 in CI**: `python:3.12-slim` has no PostgreSQL headers — `test_backend` installs `libpq-dev gcc` via apt.
- **Poetry package resolution**: code lives in `app/` but `pyproject.toml` names the project `backend`. `[tool.poetry] packages = [{include = "app"}]` points Poetry to the right place.
- **Android versionCode**: hardcoded `1` in `android/app/build.gradle`. Bump manually before tagging a Play Store release.
- **Vite HTTPS**: BasicSSL generates a self-signed cert. Browsers warn in dev — click "proceed". Disabled inside Docker builds (`VITE_DISABLE_SSL=true`).
- **ESLint `no-explicit-any`**: disabled project-wide. API responses are untyped at the service boundary.
- **Poetry on Windows PATH**: Poetry installs to `%APPDATA%\Python\Scripts`. The deploy script adds this to PATH automatically if `poetry` is not found in the default PATH.
