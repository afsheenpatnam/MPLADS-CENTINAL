# MPLAD SENTINEL

**Intelligent Vigilance for Every Project**

An AI-powered MPLAD (Member of Parliament Local Area Development) project monitoring and
integrity platform. Officers import a sanctioned project baseline, contractors report real
progress/expenditure/site-visit/evidence data against it, and a deterministic rule engine + a
from-scratch ML anomaly detector + a CV evidence pipeline surface **explainable findings** —
never automatic verdicts. Findings are always worded as "potential anomaly", "fraud risk
indicator", or "inefficiency indicator, requires verification" — the authorized officer always
makes the final determination.

The core loop is CSV-driven and real-time:

```
OFFICER imports a project CSV
   → sanction auto-generated → contractor assigned (created if new)
   → CONTRACTOR reviews & approves the sanction
   → CONTRACTOR imports a daily-activity CSV (or submits via the UI forms)
   → rule engine + ML engine run automatically
   → risk & priority recalculated
   → OFFICER's dashboard updates live over Socket.IO — no manual refresh
   → OFFICER investigates, requests clarification
   → CONTRACTOR responds
   → OFFICER resolves — every step is audit-logged
```

## Roles

Only two roles exist: **OFFICER** and **CONTRACTOR**. There is no admin role — see
`docs/ARCHITECTURE.md` for how officer-only intelligence (risk score, findings, ML output, AI
reports, priority) is enforced at the API level, not just hidden in the UI.

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full breakdown:

```
CSV IMPORT (officer: project baseline · contractor: daily activity)
                              ↓
                    SANCTION BASELINE + ACTUAL DATA
                              ↓
                        VALIDATION (Zod, idempotency)
                              ↓
          ┌───────────────────┼───────────────────┐
          ↓                   ↓                   ↓
    RULE ENGINE          ML ENGINE            CV ENGINE
   (rules.json)      (Isolation Forest)   (hash/pHash/GPS)
          └───────────────────┼───────────────────┘
                              ↓
                          FINDINGS
                              ↓
                    RISK ENGINE → PRIORITY ENGINE
                              ↓
                 SOCKET.IO push → OFFICER dashboard (live)
                              ↓
                 Groq LLM explanation (optional)
                              ↓
        OFFICER investigation ⇄ CONTRACTOR clarification ⇄ resolution
                              ↓
                          AUDIT LOG
```

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS (blue/purple/cyan analytics theme),
  hand-rolled shadcn-style components, React Router, TanStack Query, Recharts, Lucide icons,
  Leaflet/OpenStreetMap, `socket.io-client` for live updates.
- **Backend**: Node.js, Express, TypeScript, Mongoose, Socket.IO, JWT auth, bcrypt, Zod,
  Multer, `csv-parse`.
- **Database**: MongoDB (local or Atlas).
- **ML**: a from-scratch Isolation Forest (`server/src/services/ml/isolationForest.ts`) — see
  [`docs/ML.md`](docs/ML.md).
- **CV**: `sharp` for image metadata + a hand-rolled difference-hash (dHash) for reuse/similarity
  detection, plus SHA-256 file hashing for exact duplicates.
- **AI**: Groq LLM, used strictly as an explanation/summarization layer over pre-computed
  findings — never as the detector itself. Fails soft if unconfigured/unreachable.

## Setup

See [`docs/SETUP.md`](docs/SETUP.md) for full instructions. Quick start:

```bash
npm install                      # installs both server and client workspaces
cp .env.example server/.env
# edit server/.env: set MONGODB_URI, JWT_SECRET, optionally ASTRA_* keys

npm run seed --workspace=server  # demo users + 30 seeded projects (8 named scenarios)
npm run dev --workspace=server   # API + Socket.IO on http://localhost:5000
npm run dev --workspace=client   # UI on http://localhost:5173
```

To exercise the CSV-driven core workflow instead of (or in addition to) the seed script, see
[`docs/CSV_FORMATS.md`](docs/CSV_FORMATS.md) and [`samples/README.md`](samples/README.md).

## Environment Variables

See [`.env.example`](.env.example).

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Local or Atlas connection string |
| `JWT_SECRET` | Signs auth tokens |
| `ASTRA_API_KEY` / `ASTRA_API_URL` / `ASTRA_MODEL` | Optional — AI summaries show "AI summary unavailable" if unset, everything else keeps working |
| `PORT` | API + Socket.IO port, default `5000` |
| `CLIENT_URL` | Used for CORS and Socket.IO origin, default `http://localhost:5173` |

## MongoDB Setup

Run `mongod` locally, or set `MONGODB_URI` to an Atlas `mongodb+srv://...` string. No migrations
needed — Mongoose creates collections/indexes on first use.

## Astra Setup

`server/src/services/astra/astraClient.ts` assumes an OpenAI-compatible chat-completions
contract, so any provider using that shape works — you're not limited to a product literally
named "Groq". `Groq_API_KEY` is read from the environment only, on the server — never sent to
or hardcoded in the frontend. Leaving it unset is fully supported (AI summaries show
"temporarily unavailable"; deterministic detection is unaffected).

**Verified working, free option**: [Groq](https://console.groq.com) — no credit card required.

```
ASTRA_API_KEY=<your groq key>
ASTRA_API_URL=https://api.groq.com/openai/v1/chat/completions
ASTRA_MODEL=qwen/qwen3.8-27b
```

Avoid Groq's `openai/gpt-oss-*` models for this app specifically — they're reasoning models that
route their answer through a separate `reasoning` field and leave `message.content` empty, which
breaks this app's response parsing. `qwen/qwen3.8-27b` was tested and reliably returns clean,
valid JSON matching the report schema.

**Free-tier rate limits**: Groq's free tier caps requests per minute/day. If you generate several
AI summaries in quick succession you may see "AI summary temporarily unavailable" — that's a
`429` from Groq, logged server-side as `[astra] Call failed for project ...: Request failed with
status code 429`, and is exactly the graceful-degradation path working as intended (deterministic
detection is unaffected either way). Wait a minute and retry.

## Run Commands

| Command | What it does |
|---|---|
| `npm run dev --workspace=server` | API + Socket.IO with hot reload |
| `npm run dev --workspace=client` | Vite dev server |
| `npm run build` | Builds both workspaces |
| `npm run typecheck` | Type-checks both workspaces |
| `npm run lint` | Lints both workspaces |
| `npm run test --workspace=server` | Full Jest suite (unit + integration + e2e) |
| `npm run seed --workspace=server` | Wipes and reseeds demo data |

## Demo Credentials

Password for all seeded accounts: **`Demo@123`**

| Role | Email |
|---|---|
| Officer | `officer@mplad.local` |
| Contractor | `contractor@mplad.local` |

CSV-imported contractors get a randomly generated temporary password shown once in the import
summary — see `docs/CSV_FORMATS.md`.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — layering, auth, officer/contractor isolation
- [`docs/DETECTION_RULES_SOURCE.md`](docs/DETECTION_RULES_SOURCE.md) — the 18 rules, traced back to `ANAMOLIES.txt`
- [`docs/CSV_FORMATS.md`](docs/CSV_FORMATS.md) — every CSV column, for both import types
- [`docs/ML.md`](docs/ML.md) — the Isolation Forest, feature vector, and where to see it in the UI
- [`docs/REALTIME.md`](docs/REALTIME.md) — the Socket.IO live-update pipeline
- [`docs/API.md`](docs/API.md) — full endpoint reference
- [`docs/SETUP.md`](docs/SETUP.md) — step-by-step local setup
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production deployment notes, incl. file storage
- [`docs/DEMO_FLOW.md`](docs/DEMO_FLOW.md) — scripted walkthrough
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — branch strategy, pre-PR checks, code style
- [`PROGRESS.md`](PROGRESS.md) — full build log and engineering decisions
