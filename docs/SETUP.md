# Setup Guide

## Prerequisites

- Node.js ≥ 18.18
- npm ≥ 9 (ships with Node 18+)
- MongoDB — either a local `mongod` or a MongoDB Atlas cluster
- (Optional) Astra LLM API credentials for AI-generated investigation summaries

## 1. Install dependencies

From the repo root (this installs both `client` and `server` workspaces):

```bash
npm install
```

## 2. Configure environment variables

Copy `.env.example` to `server/.env`:

```bash
cp .env.example server/.env
```

Edit `server/.env`:

```
MONGODB_URI=mongodb://127.0.0.1:27017/mplad_insight
JWT_SECRET=<a long random string>
ASTRA_API_KEY=
ASTRA_API_URL=
ASTRA_MODEL=
PORT=5000
CLIENT_URL=http://localhost:5173
```

Leaving `ASTRA_*` blank is fine — AI summaries will show "AI summary temporarily unavailable"
and every other feature (rule/ML/CV detection, risk, priority, investigation workflow) works
normally.

## 3. Start MongoDB

**Local:**

```bash
mongod --dbpath /path/to/your/data/dir --port 27017
```

**Atlas:** set `MONGODB_URI` to your `mongodb+srv://...` connection string instead — no other
change needed.

> **Port note:** if `localhost:5000` is already used by another process on your machine, either
> stop that process or change `PORT` in `server/.env` (and update `client/vite.config.ts`'s proxy
> target + `CLIENT_URL` to match).

## 4. Seed demo data

```bash
npm run seed --workspace=server
```

This wipes existing data and creates:

- 3 officers, 8 contractors, 1 admin (see [Demo Credentials](../README.md#demo-credentials))
- 30 projects across 6 districts, including the 8 named scenarios from the brief (progress
  anomaly, cost-progress mismatch, visit violation, image reuse, location mismatch, quantity
  deviation, a normal LOW-risk baseline, and the combined MAIN DEMO project)
- Each project is run through the full detection pipeline immediately, so risk scores/findings
  are already populated when you log in.

## 5. Run the app

Two terminals:

```bash
npm run dev --workspace=server   # http://localhost:5000
npm run dev --workspace=client   # http://localhost:5173
```

Open `http://localhost:5173` and log in with any demo account (`Demo@123`).

## 6. Run tests

```bash
npm run test --workspace=server
```

The first run downloads a `mongod` binary for `mongodb-memory-server` (used by the integration
and end-to-end tests) — this can take a minute or two on a clean machine but is cached after
that.

## Troubleshooting

- **`EADDRINUSE` on port 5000/5173** — another process (possibly an old dev server) is holding
  the port. Find and stop it, or change the port as noted above.
- **Jest hangs instead of exiting** — `jest.config.js` sets `forceExit: true` specifically
  because `mongodb-memory-server`/mongoose can leave a handle open after tests finish; this is
  expected and does not indicate a leaked test failure.
- **Evidence thumbnails 404 for seeded projects** — seed data creates `Evidence` *records*
  (hashes, GPS, similarity scores) without real backing image files, since there's nothing to
  photograph in synthetic data. Evidence uploaded through the actual UI (Contractor → Evidence
  tab) saves and serves real files normally via `/uploads`.
