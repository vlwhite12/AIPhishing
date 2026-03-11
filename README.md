# PhishCatch AI

**AI-powered phishing email detector** — paste or auto-extract a suspicious email and receive an instant risk score (0–100), categorised red flags, psychological-manipulation indicators, and actionable security guidance.

> Built as a full-stack showcase project demonstrating a production-grade FastAPI backend, a Next.js 14 web app, and a Manifest V3 Chrome Extension — all sharing a single secured API.

---

## Live Demo Flow

1. **Register** an account on the web app → `/register`
2. **Paste** a suspicious email into the dashboard → `/dashboard`
3. Receive a **risk score**, **red flags** list, and **remediation advice** in under 3 seconds
4. Browse your **scan history** → `/history` — click any scan for a full detail view
5. Install the **Chrome Extension**, open Gmail, click **"Analyse This Email"** — the extension extracts the email automatically and returns the same analysis inside the browser popup

---

## Features

### AI Analysis Engine
- **6-dimensional analysis**: domain/URL inspection, psychological manipulation tactics, urgency/scarcity language, sender authentication signals (SPF, DKIM, DMARC mentions), payload indicators (attachments, links), and writing style anomalies
- **Risk score 0–100** with five tiers: `SAFE` / `LOW` / `MEDIUM` / `HIGH` / `CRITICAL`
- **Structured red flags** — each flag has a title, description, evidence excerpt, category, and severity (`INFO` → `CRITICAL`)
- **Three-column actionable advice** — what to do, what *not* to do, and when to report
- **Confidence score** and a natural-language executive summary per analysis
- Powered by **Ollama (llama3.2:1b)** locally by default — fully offline and free. Swap to any OpenAI-compatible provider by changing two `.env` values

### Security-First Design
- **Prompt injection defence** — user email content wrapped in `<EMAIL_CONTENT>` XML delimiters; system prompt explicitly classifies that region as untrusted data
- **Input sanitisation** — strips null bytes, Unicode bidirectional overrides, and C0/C1 control characters before any DB write or LLM call
- **Token bombing prevention** — email input hard-capped at 50 KB (client + server)
- **Rate limiting** — `slowapi` limits analysis requests per authenticated user
- **Broken Access Control** — all history queries filter by `user_id = current_user.id`
- **UUID primary keys** — prevents sequential ID enumeration
- **bcrypt password hashing** with constant-time comparison
- **JWT** authentication (HS256, 60-minute expiry by default)
- **CORS whitelist**, `TrustedHostMiddleware`, and HTTP security headers on the frontend (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- **No sensitive data in logs** — passwords, raw tokens, and PII are never written to application logs

### Web Application (Next.js 14)
- **App Router** with TypeScript strict mode
- **Authentication** — register, login, protected routes via Next.js Edge middleware
- **Dashboard** — multi-step form with real-time validation (react-hook-form + zod), animated SVG risk-score arc meter, expandable red flag cards, 50 KB soft-cap progress indicator
- **Scan history** — paginated table, per-scan status badge, one-click delete with confirmation
- **Scan detail** — deep-linkable by UUID, collapsible original email view, full results panel
- **Auth state** managed by Zustand with in-memory token storage (never `localStorage` — XSS-resistant)
- **Axios interceptors** handle 401 auto-logout without breaking the user flow

### Chrome Extension (Manifest V3)
- **Gmail DOM extraction** — intelligently walks the email DOM and reconstructs plain text with paragraph structure; handles multi-message threads; skips hidden collapsed replies
- **One-click analysis** while viewing any email in Gmail
- **JWT stored in `chrome.storage.session`** — memory-only, cleared on browser close, never accessible to web-page scripts
- **All API calls route through the background service worker** — CORS bypass via `host_permissions`, no origin changes needed on the FastAPI backend
- Login form with loading states, full results view (arc meter, risk badge, red-flag cards) inside a 380 px popup
- MV3-compliant CSP — zero inline scripts, all styles self-hosted (no Tailwind CDN)

---

## Tech Stack

| Layer | Technology |
|---|---|
| AI / LLM | Ollama (llama3.2:1b, local) — or any OpenAI-compatible API |
| Backend API | FastAPI 0.111, Python 3.11+ |
| Database | SQLite via aiosqlite + SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| Auth | python-jose (JWT) + passlib/bcrypt |
| Rate limiting | slowapi |
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS 3.4 |
| State management | Zustand 4.5 |
| Form validation | react-hook-form + zod |
| HTTP client | axios (with interceptors) |
| Chrome Extension | Manifest V3, Vanilla JS, `chrome.storage.session` |

---

## Project Structure

```
AIPhishing/
├── backend/
│   ├── app/
│   │   ├── config.py              # pydantic-settings singleton
│   │   ├── database.py            # Async SQLAlchemy engine + get_db dependency
│   │   ├── main.py                # App factory, CORS, rate limiter, error handler
│   │   ├── models/
│   │   │   ├── user.py            # User ORM (UUID PK, bcrypt hash, timestamps)
│   │   │   └── scan.py            # Scan ORM (JSONB result, status tracking)
│   │   ├── schemas/
│   │   │   ├── user.py            # Register / login / profile schemas
│   │   │   ├── analysis.py        # AIAnalysisResult, RedFlag, RiskLevel enums
│   │   │   └── scan.py            # ScanSummary, ScanDetail, ScanListResponse
│   │   ├── services/
│   │   │   ├── auth_service.py    # hash_password, JWT encode/decode, get_current_user
│   │   │   └── ai_engine.py       # ★ PhishingAnalysisEngine + hardened system prompt
│   │   └── routers/
│   │       ├── auth.py            # POST /api/auth/register|login  GET /api/auth/me
│   │       ├── analysis.py        # POST /api/analysis/analyze (rate-limited)
│   │       └── history.py         # GET|DELETE /api/history  GET /api/history/{id}
│   ├── alembic/
│   │   ├── env.py                 # Async→sync URL conversion for Alembic runner
│   │   └── versions/              # Generated migration files
│   ├── alembic.ini
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx             # Root layout (font, metadata)
│   │   ├── page.tsx               # Root redirect → /dashboard
│   │   ├── globals.css            # Tailwind base + custom scrollbar
│   │   ├── (auth)/
│   │   │   ├── layout.tsx         # Centred card layout for auth pages
│   │   │   ├── login/page.tsx     # Login form with callbackUrl support
│   │   │   └── register/page.tsx  # Register form with password complexity
│   │   ├── dashboard/
│   │   │   └── page.tsx           # Main analysis page (form → results state machine)
│   │   └── history/
│   │       ├── page.tsx           # Paginated scan history table
│   │       └── [id]/page.tsx      # Individual scan detail (deep-link by UUID)
│   ├── components/
│   │   ├── layout/
│   │   │   └── Navbar.tsx         # Shared sticky navbar with active-link highlighting
│   │   ├── dashboard/
│   │   │   └── EmailAnalysisForm.tsx  # react-hook-form + zod, 50 KB limit
│   │   └── results/
│   │       └── ResultsPanel.tsx       # SVG arc meter, red flag cards, advice columns
│   ├── lib/
│   │   ├── api.ts                 # axios client + authApi / analysisApi / historyApi
│   │   ├── types.ts               # TypeScript interfaces mirroring Pydantic schemas
│   │   └── utils.ts               # cn(), RISK_STYLES, SEVERITY_STYLES, formatDate
│   ├── store/
│   │   └── authStore.ts           # Zustand store (in-memory JWT, login/logout actions)
│   ├── middleware.ts               # Edge middleware — route protection + auth redirects
│   ├── next.config.js             # CSP, X-Frame-Options, security headers
│   ├── tailwind.config.ts         # Custom risk-level colour tokens
│   ├── postcss.config.js
│   ├── tsconfig.json
│   └── .env.local.example
│
└── chrome-extension/
    ├── manifest.json              # MV3 — permissions, content scripts, service worker
    ├── background.js              # Service worker: token storage, login, API calls
    ├── content.js                 # Gmail DOM extractor (injected into mail.google.com)
    ├── popup.html                 # 4-view shell (loading → login → analyze → results)
    ├── popup.css                  # Self-hosted styles (MV3 CSP disallows CDN scripts)
    ├── popup.js                   # State machine + results renderer
    └── icons/
        └── README.md              # Icon generation instructions
```

---

## Database Schema

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK, v4 — prevents enumeration |
| `email` | `VARCHAR(254)` | Unique, indexed |
| `username` | `VARCHAR(50)` | Unique |
| `hashed_password` | `VARCHAR(255)` | bcrypt hash, never plaintext |
| `is_active` | `BOOLEAN` | Soft-disable support |
| `created_at` | `TIMESTAMPTZ` | Auto-set |
| `last_login_at` | `TIMESTAMPTZ` | Nullable |

### `scans`
| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK, v4 |
| `user_id` | `UUID` | FK → `users.id` `ON DELETE CASCADE` |
| `email_input` | `TEXT` | Raw submitted email (max 50 KB) |
| `label` | `VARCHAR(200)` | Optional user label |
| `risk_score` | `INTEGER` | 0–100 |
| `risk_level` | `VARCHAR(10)` | `SAFE/LOW/MEDIUM/HIGH/CRITICAL` |
| `result_json` | `JSONB` | Full structured AI analysis |
| `status` | `VARCHAR(20)` | `pending/processing/completed/failed` |
| `error_message` | `TEXT` | Nullable — populated on failure |
| `created_at` | `TIMESTAMPTZ` | Indexed |
| `completed_at` | `TIMESTAMPTZ` | Nullable |

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | `node --version` |
| Ollama | latest | [ollama.com/download](https://ollama.com/download) — free, runs locally |
| Google Chrome | any | For the extension only |

> **No database or API key required.** The backend uses SQLite (auto-created) and Ollama (local AI) by default.

---

## Setup & Running

### 1. Clone the repository

```bash
git clone https://github.com/your-username/AIPhishing.git
cd AIPhishing
```

---

### 2. Backend Setup

#### 2a. Create a virtual environment

```bash
cd backend

# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python -m venv .venv
source .venv/bin/activate
```

#### 2b. Install dependencies

```bash
pip install -r requirements.txt
```

#### 2c. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and set the required values:

```env
# SQLite default — no changes needed
DATABASE_URL=sqlite+aiosqlite:///./phishcatch.db

# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=your-super-secret-key-at-least-32-chars

# Ollama (local, free) — install from https://ollama.com/download
OPENAI_API_KEY=ollama
OPENAI_MODEL=llama3.2:1b
OPENAI_BASE_URL=http://localhost:11434/v1
```

> To use OpenAI instead, set `OPENAI_API_KEY=sk-...`, `OPENAI_MODEL=gpt-4o`, and remove `OPENAI_BASE_URL`.

#### 2d. Create the database tables

```bash
python -c "
import asyncio
from app.database import engine, Base
import app.models
async def create():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('Tables created.')
asyncio.run(create())
"
```

> Creates a `phishcatch.db` SQLite file in the `backend/` folder automatically.

#### 2e. Start the backend server

```bash
uvicorn app.main:app --reload --port 8000
```

The API is now running at **http://localhost:8000**

| URL | Description |
|---|---|
| http://localhost:8000/docs | Interactive Swagger UI |
| http://localhost:8000/redoc | ReDoc API reference |
| http://localhost:8000/health | Health check endpoint |

---

### 3. Frontend Setup

Open a **new terminal** (keep the backend running).

#### 3a. Install dependencies

```bash
cd frontend
npm install
```

#### 3b. Configure environment variables

```bash
cp .env.local.example .env.local
```

`.env.local` defaults work out of the box if your backend is on port 8000:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

#### 3c. Start the development server

```bash
npm run dev
```

The web app is now running at **http://localhost:3000**

| Route | Description |
|---|---|
| `/` | Redirects to `/dashboard` (or `/login` if unauthenticated) |
| `/register` | Create a new account |
| `/login` | Sign in |
| `/dashboard` | Main email analysis page |
| `/history` | Paginated scan history |
| `/history/:id` | Individual scan detail |

---

### 4. Chrome Extension Setup

#### 4a. Generate extension icons

Run this once from the `chrome-extension/` folder to create placeholder icons:

```bash
cd chrome-extension
python -c "
import struct, zlib, os
def make_png(size, r, g, b):
    def chunk(name, data):
        c = zlib.crc32(name + data) & 0xffffffff
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', c)
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    row = b'\x00' + bytes([r, g, b]) * size
    idat = zlib.compress(row * size)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')
os.makedirs('icons', exist_ok=True)
for size in [16, 48, 128]:
    open(f'icons/icon{size}.png', 'wb').write(make_png(size, 99, 102, 241))
    print(f'icons/icon{size}.png created')
"
```

#### 4b. Point the extension at your backend

Open `chrome-extension/background.js` and confirm the `API_BASE` constant at the top:

```js
const API_BASE = "http://localhost:8000";
```

For a deployed backend, change this to your production URL **and** add that origin to `host_permissions` in `manifest.json`.

#### 4c. Load as an unpacked extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select the `chrome-extension/` folder
5. The PhishCatch AI icon will appear in your toolbar

#### 4d. Using the extension

1. Navigate to **https://mail.google.com** and open any email
2. Click the **PhishCatch AI** toolbar icon
3. Sign in with your PhishCatch account credentials
4. Click **"Analyse This Email"**
5. Results appear in the popup within a few seconds

> The extension uses `chrome.storage.session` for token storage — the JWT is memory-only, cleared when the browser closes, and never accessible to web-page scripts.

---

## API Reference

All authenticated endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | — | Create a new user account |
| `POST` | `/api/auth/login` | — | Login; returns `access_token` |
| `GET` | `/api/auth/me` | ✓ | Current user profile |
| `POST` | `/api/analysis/analyze` | ✓ | **Analyse an email for phishing** |
| `GET` | `/api/history` | ✓ | List scans (paginated, `?page=1&page_size=20`) |
| `GET` | `/api/history/{id}` | ✓ | Full scan detail including AI result |
| `DELETE` | `/api/history/{id}` | ✓ | Delete a scan record |
| `GET` | `/health` | — | Returns `{"status":"ok"}` |

### Example: Analyse an email

```bash
# 1. Get a token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -d "username=you@example.com&password=YourPassword123!" \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. Submit an email for analysis
curl -X POST http://localhost:8000/api/analysis/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email_text": "From: security@paypa1.com\nSubject: Your account is suspended!\n\nClick here immediately: http://paypa1-verify.ru/login"}'
```

### Example response

```json
{
  "scan_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "analysis": {
    "risk_score": 94,
    "risk_level": "CRITICAL",
    "summary": "This email exhibits multiple high-confidence phishing indicators including a spoofed domain (paypa1.com vs paypal.com), a Russian-hosted redirect URL, and extreme urgency language designed to bypass rational evaluation.",
    "confidence": 0.97,
    "red_flags": [
      {
        "category": "DOMAIN_SPOOFING",
        "severity": "CRITICAL",
        "title": "Typosquatted sender domain",
        "description": "Sender domain 'paypa1.com' replaces the letter 'l' with '1' to impersonate PayPal.",
        "evidence": "security@paypa1.com"
      }
    ],
    "actionable_advice": {
      "do": ["Delete the email immediately", "Report to your email provider as phishing"],
      "dont": ["Do not click any links", "Do not enter credentials on any linked page"],
      "report_to": ["Forward to reportphishing@paypal.com", "Report to APWG at reportphishing@apwg.org"]
    }
  },
  "cached": false
}
```

---

## Running in Production

### Backend

```bash
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

Key production `.env` changes:
```env
ENVIRONMENT=production
CORS_ALLOW_ORIGINS=https://your-frontend-domain.com
SECRET_KEY=<cryptographically-random 64-char hex string>
```

### Frontend

```bash
npm run build
npm start
```

Or deploy to **Vercel** (zero config — push to GitHub and connect the repo). Set one environment variable in the Vercel dashboard:
```
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

### Chrome Extension for production

1. Update `API_BASE` in `background.js` to your production API URL
2. Add the production origin to `host_permissions` in `manifest.json`
3. Package via `chrome://extensions` → "Pack extension"
4. Submit to the Chrome Web Store or distribute the `.crx` privately

---

## Environment Variable Reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | | `sqlite+aiosqlite:///./phishcatch.db` | Local SQLite file (default) or a PostgreSQL URL for production |
| `SECRET_KEY` | ✓ | — | JWT signing secret (min 32 chars) |
| `OPENAI_API_KEY` | ✓ | — | OpenAI API key, **or any string (e.g. `ollama`) when using a local Ollama server** |
| `ALGORITHM` | | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | | `60` | JWT expiry in minutes |
| `CORS_ALLOW_ORIGINS` | | `http://localhost:3000` | Comma-separated allowed origins |
| `RATE_LIMIT_ANALYSIS_PER_HOUR` | | `20` | Analysis requests per user per hour |
| `ENVIRONMENT` | | `development` | `development` or `production` |

### Frontend (`frontend/.env.local`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✓ | `http://localhost:8000` | Backend API base URL |

---

## Troubleshooting

**`alembic upgrade head` fails — "unable to open database file"**
→ Make sure you are running the command from inside the `backend/` directory (where the `.env` file lives), not from the repo root.

**OpenAI `AuthenticationError`**
→ Verify `OPENAI_API_KEY` in `.env`. Ensure your key has access to `gpt-4o` (not just `gpt-3.5-turbo`).

**Frontend shows "Network Error"**
→ Confirm the backend is running on the port matching `NEXT_PUBLIC_API_URL` and that `CORS_ALLOW_ORIGINS` includes `http://localhost:3000`.

**Chrome extension "Could not connect to the Gmail tab"**
→ Refresh the Gmail tab after installing the extension. Content scripts inject at `document_idle` and won't be present in tabs opened before installation.

**Extension login fails with a CORS error**
→ Add your production API URL to `host_permissions` in `manifest.json` and reload the extension in `chrome://extensions`.

**`npm run dev` — "Cannot find module 'tailwindcss'"**
→ Run `npm install` from inside the `frontend/` directory, not from the repo root.
