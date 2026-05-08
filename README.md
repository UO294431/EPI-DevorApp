# EPI-DevorApp

A restaurant discovery and recommendation app with a React web frontend, FastAPI backend, and Keras-powered recommendation engine. The frontend is also distributed as an Android APK via Google Play.

---

## Architecture

```
epi-devorapp/
├── frontend/      # React 19 + TypeScript + Vite (web + Android via Capacitor)
├── backend/       # Python FastAPI REST API + PostgreSQL
├── keras-api/     # Neural network recommendation engine
└── docker-compose.yml
```

| Layer | Technology |
|---|---|
| Web frontend | React 19, TypeScript, Vite 7 |
| Android packaging | Capacitor 7 |
| Backend API | FastAPI 0.129, Python 3.12 |
| Database | PostgreSQL + SQLAlchemy + Alembic |
| ML engine | Keras (restaurant recommendations) |
| Auth | Firebase + JWT |
| CI/CD | GitLab CI |
| Android delivery | Google Play (internal → production) |

---

## Local development

### Prerequisites

- Docker + Docker Compose (recommended)
- Or: Node 22, Python 3.12, Poetry

### With Docker (recommended)

```bash
docker compose up --build
```

- Frontend: http://localhost:5173  
- Backend API: http://localhost:8080

### Without Docker

**Backend:**

```bash
cd backend
poetry install
poetry run uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

---

## Running tests

```bash
# Backend
cd backend && poetry run pytest tests/ -v

# Frontend (unit tests with Vitest)
cd frontend && npm run test

# Frontend lint
cd frontend && npm run lint
```

---

## CI/CD pipeline

The GitLab CI pipeline (`.gitlab-ci.yml`) runs on every push to `main`, on merge requests, and on tags.

| Stage | Jobs | Trigger |
|---|---|---|
| `test` | `test_backend`, `lint_frontend`, `test_frontend` | main, MR, tags |
| `build` | `build_backend`, `build_frontend` (Docker images) | main, tags |
| `android` | `build_apk` (signed release APK) | main, tags |
| `deploy` | `deploy_play_store` (internal track) | tags only |

The `build_apk` job starts as soon as the frontend tests pass — it does not block on the Docker image builds.

A Play Store release is triggered by pushing a Git tag:

```bash
git tag v1.2.0
git push origin v1.2.0
```

---

## Android build

### One-time local setup

The `android/` folder must be generated once locally and committed to the repo:

```bash
cd frontend
npm install
npx cap add android     # generates frontend/android/
npx cap sync android    # copies dist/ into the android project
```

Open the project in Android Studio to adjust icons, splash screen, and `minSdk`:

```bash
npm run cap:open
```

### Local APK build (debug)

```bash
cd frontend
npm run cap:build       # runs `npm run build && cap sync android`
cd android
./gradlew assembleDebug
# APK at: android/app/build/outputs/apk/debug/app-debug.apk
```

### Local APK build (release, signed)

```bash
cd frontend/android
./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file=/path/to/keystore.jks \
  -Pandroid.injected.signing.store.password=<store-password> \
  -Pandroid.injected.signing.key.alias=<key-alias> \
  -Pandroid.injected.signing.key.password=<key-password>
```

---

## Play Store deployment

### Required GitLab CI variables

Go to **Settings → CI/CD → Variables** in your GitLab project and add:

| Variable | Type | Description |
|---|---|---|
| `KEYSTORE_FILE` | Variable (masked) | Base64-encoded `.jks` keystore file |
| `KEYSTORE_STORE_PASSWORD` | Variable (masked) | Keystore password |
| `KEYSTORE_KEY_ALIAS` | Variable | Key alias inside the keystore |
| `KEYSTORE_KEY_PASSWORD` | Variable (masked) | Key password |
| `GOOGLE_PLAY_JSON_KEY` | File | Google Play service account JSON |

### Encode the keystore for CI

```bash
base64 -w 0 keystore.jks
# paste the output as the KEYSTORE_FILE variable value
```

### Create a Google Play service account

1. Open [Google Play Console](https://play.google.com/console) → Setup → API access
2. Link to a Google Cloud project and create a service account with **Release manager** role
3. Download the JSON key and set it as the `GOOGLE_PLAY_JSON_KEY` file variable

### Promotion to production

After CI deploys to the **internal track**, promote the release to production manually via the Play Console or change `track:` in `frontend/fastlane/Fastfile` to `'production'`.

---

## Environment variables (backend)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `FIREBASE_CREDENTIALS` | Path to Firebase service account JSON |
| `SECRET_KEY` | JWT signing secret |

---

## License

MIT
