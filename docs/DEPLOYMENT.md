# Deployment Guide

This app is a standard two-service deployment (Node/Express API + static React SPA) plus
MongoDB — nothing exotic, but a few things matter for a production-style setup beyond
`npm run dev`.

## 1. Database — MongoDB Atlas

Local `mongod` is fine for development; for anything shared, point `MONGODB_URI` at an Atlas
connection string (`mongodb+srv://...`). No schema migration step is needed — Mongoose creates
collections/indexes on first use. Recommended for production:

- A dedicated database user with read/write scoped to just this database.
- IP allowlisting (or Atlas's "allow from anywhere" only for quick demos, never long-term).
- Enable Atlas backups if the data matters beyond a hackathon demo.

## 2. Backend — Express + Socket.IO

Build with `npm run build --workspace=server` (emits `server/dist`), then run
`node server/dist/server.js`. Requirements for the host:

- **A single long-lived process**, not a serverless/edge function — Socket.IO needs a persistent
  connection, and the ML engine's Isolation Forest is trained once per process (`ensureModel()`
  in `mlEngine.ts` memoizes it) rather than per-request.
- **WebSocket support** on the platform/proxy in front of it (Render, Railway, Fly.io, a plain
  VM, or any host that isn't strictly HTTP-request/response-only). If you must sit behind a proxy
  that only speaks HTTP, Socket.IO falls back to long-polling automatically, but a proxy that
  actively drops `Upgrade` headers will break real-time updates entirely.
- Environment variables from `.env.example` — see the root `README.md`.

## 3. Frontend — static SPA

Build with `npm run build --workspace=client` (emits `client/dist`), then serve those static
files from any static host (Vercel, Netlify, S3+CloudFront, or the backend's own Express static
middleware). Two things must point at the deployed backend:

- `vite.config.ts`'s dev-only proxy does **not** apply in production — set the actual API/socket
  origin via a build-time env var if the frontend and backend are on different domains (this
  repo assumes same-origin/reverse-proxied `/api` and `/socket.io` paths for simplicity; adjust
  `client/src/api/client.ts`'s `baseURL` and `useSocket.tsx`'s `io("/")` call if you deploy them
  separately).
- CORS: `server/src/app.ts` and `socketServer.ts` both restrict `origin` to `env.clientUrl` — set
  `CLIENT_URL` to the frontend's real deployed origin.

## 4. File storage — evidence & documents

**Current state**: `server/src/middleware/upload.ts` writes uploaded evidence/documents to a
local `uploads/` directory, served back via `express.static`. This is fine for development and
for this hackathon prototype, but **local disk storage does not survive a redeploy or scale past
one instance** on most PaaS hosts (ephemeral filesystems).

**For a real deployment**, replace the disk storage with an object-storage-backed multer engine:

- `multer-s3` (or any S3-compatible bucket — AWS S3, Cloudflare R2, MinIO), or
- `multer-storage-cloudinary` for Cloudinary.

The integration point is exactly one file: swap the `multer.diskStorage(...)` in
`server/src/middleware/upload.ts` for the chosen engine's storage adapter, and change
`evidenceController.ts`/`documentController.ts` to store the returned URL instead of a local
filename (`Evidence.filePath` / `ProjectDocument.filePath` currently store a bare filename served
from `/uploads/<name>` — store a full URL instead when using cloud storage, and update
`client/src/api/client.ts`'s `fileUrl()` helper accordingly). This was intentionally left as
local-disk-only in this codebase rather than wiring in an untested cloud integration with no
real credentials to verify against — swapping it in is a contained, well-scoped change.

## 5. Secrets

Never commit `.env`. `.gitignore` already excludes `.env`, `.env.*` (with `.env.example` allowed
back in), `node_modules`, `uploads`, `dist`, `build`, `coverage`. Rotate `JWT_SECRET` and
`ASTRA_API_KEY` if either is ever accidentally exposed.

## 6. CI

`.github/workflows/ci.yml` runs `npm install`, `lint`, `typecheck`, `test`, and `build` on every
push/PR — treat a red CI run as a merge blocker (see `CONTRIBUTING.md`).
