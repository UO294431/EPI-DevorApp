# EPI-DevorApp

A restaurant discovery and recommendation app with a React web frontend, FastAPI backend, and Keras-powered recommendation engine. The frontend is also distributed as an Android APK via Google Play.

---

## Architecture

```
epi-devorapp/
├── frontend/      # React 19 + TypeScript + Vite (web + Android via Capacitor)
├── backend/       # Python FastAPI REST API + PostgreSQL
├── keras-api/     # Neural network recommendation microservice
└── docker-compose.yml
```

| Layer | Technology |
|---|---|
| Web frontend | React 19, TypeScript, Vite 7 |
| Android packaging | Capacitor 7 |
| Backend API | FastAPI 0.129, Python 3.12 |
| Database | PostgreSQL 16 + SQLAlchemy + Alembic |
| ML engine | Keras (restaurant recommendations) |
| Auth | Firebase + JWT |
| CI/CD | GitLab CI |
| Android delivery | Google Play (internal → production) |

---

## Quick start

### Docker (recommended — runs everything)

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost |
| Backend API | http://localhost:8000 |
| API docs | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |

### Deploy scripts

Both scripts run lint → tests → build → start, exactly mirroring the CI pipeline.

#### Windows (`deploy.ps1`)

```powershell
# Full stack, Docker
.\deploy.ps1

# Backend only (no frontend)
.\deploy.ps1 -Component backend

# Frontend only (assumes backend already running)
.\deploy.ps1 -Component frontend

# Docker with hot reload (dev mode — volumes mounted, live changes)
.\deploy.ps1 -Dev

# Native host processes instead of Docker
.\deploy.ps1 -Mode native

# Native, backend only
.\deploy.ps1 -Mode native -Component backend

# Skip tests
.\deploy.ps1 -SkipTests

# Also build a debug Android APK (needs Java 17+ and ANDROID_HOME)
.\deploy.ps1 -Apk

# Stop all running containers
.\deploy.ps1 -Stop
```

#### Linux / macOS (`deploy.sh`)

```bash
chmod +x deploy.sh

./deploy.sh                              # Full stack, Docker
./deploy.sh --component backend          # Backend + DB only
./deploy.sh --component frontend         # Frontend only
./deploy.sh --dev                        # Docker with hot reload
./deploy.sh --mode native                # Native host processes
./deploy.sh --mode native --component backend
./deploy.sh --skip-tests                 # Skip tests
./deploy.sh --apk                        # Also build debug APK
./deploy.sh --stop                       # Stop containers
```

#### Prerequisites by mode

| Tool | docker | native | --apk |
|---|---|---|---|
| Docker Desktop / Docker Engine | required | — | — |
| Node.js 22 + npm | for checks/lint | required | required |
| Python 3.12 + Poetry | for tests | required | — |
| Java 17+ + `ANDROID_HOME` | — | — | required |

---

## Local development (without scripts)

### Backend

```bash
cd backend
poetry install --with dev
poetry run uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # https://localhost:5173
```

### Docker dev mode (hot reload)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Hot reload is active for both frontend (Vite HMR on :5173) and backend (uvicorn --reload on :8000).

---

## Running tests

```bash
# Backend (Firebase is mocked automatically)
cd backend && poetry run pytest tests/ -v

# Frontend unit tests
cd frontend && npm run test

# Frontend lint
cd frontend && npm run lint
```

---

## CI/CD pipeline

The GitLab CI pipeline (`.gitlab-ci.yml`) runs on every push to `main`, on merge requests, and on tags.

| Stage | Job | Trigger |
|---|---|---|
| `test` | `test_backend`, `lint_frontend`, `test_frontend` | main, MR, tags |
| `build` | `build_backend`, `build_frontend` (Docker images) | main, tags |
| `android` | `build_apk` (signed release APK) | main, tags |
| `deploy` | `deploy_play_store` (internal track) | **tags only** |

Trigger a Play Store release:

```bash
git tag v1.2.0 && git push origin v1.2.0
```

---

## Android build

### One-time local setup

```bash
cd frontend
npm install
npx cap add android      # generates frontend/android/ — commit this folder
npx cap sync android     # copies dist/ into the android project
```

Open in Android Studio:

```bash
npm run cap:open
```

### Local APK build (debug)

```bash
cd frontend
npm run cap:build        # npm run build + cap sync android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Play Store deployment

### Required GitLab CI variables

Go to **Settings → CI/CD → Variables** and add:

| Variable | Type | Description |
|---|---|---|
| `KEYSTORE_FILE` | Variable (masked) | `base64 -w 0 devorapp.jks` |
| `KEYSTORE_STORE_PASSWORD` | Variable (masked) | Keystore password |
| `KEYSTORE_KEY_ALIAS` | Variable | Key alias (`devorapp`) |
| `KEYSTORE_KEY_PASSWORD` | Variable (masked) | Key password |
| `GOOGLE_PLAY_JSON_KEY` | **File** | Google Play service account JSON |

### Create a Google Play service account

1. Open [Google Play Console](https://play.google.com/console) → Setup → API access
2. Link a Google Cloud project → create a service account with **Release manager** role
3. Download the JSON key → set as `GOOGLE_PLAY_JSON_KEY` file variable

---

## Environment variables (backend)

Set in `backend/.env` (gitignored):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/tfg_db` | PostgreSQL |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | `firebase-service-account.json` | Firebase credentials |
| `GOOGLE_API_KEY` | `""` | Google Maps / Places API |
| `KERAS_API_URL` | `http://127.0.0.1:8001/predict` | ML service |
| `SECRET_KEY` | dev default | JWT signing secret |

---

## License

MIT
