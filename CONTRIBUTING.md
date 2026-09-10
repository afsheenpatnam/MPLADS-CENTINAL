# Contributing to MPLAD Sentinel

A short guide for a small (2-person) team working on this together.

## Branch strategy

- `main` is always deployable — every commit on it has passed CI.
- Work on feature branches: `feature/<short-description>` or `fix/<short-description>`.
- Rebase or merge `main` into your branch before opening a PR if it's fallen behind.
- Delete branches after merge.

## Environment setup

```bash
npm install
cp .env.example server/.env   # fill in MONGODB_URI, JWT_SECRET; ASTRA_* optional
npm run seed --workspace=server
npm run dev --workspace=server   # terminal 1
npm run dev --workspace=client   # terminal 2
```

See `docs/SETUP.md` for the full walkthrough and `docs/CSV_FORMATS.md` /
`samples/README.md` for exercising the CSV import flows.

## Before opening a PR

Run the same checks CI runs, locally, first:

```bash
npm run lint
npm run typecheck
npm run test --workspace=server
npm run build
```

All four must pass. If you touched detection rules, risk weights, or the ML feature set, also
manually re-run `npm run seed --workspace=server` and spot-check that the seeded "MAIN DEMO"
project still lands in a sensible risk/priority tier — these are integration behaviors that
type-checking alone won't catch.

## No secrets in commits

Never commit `.env`, API keys, or real credentials. If you accidentally commit one, rotate it
immediately (don't just delete the commit — assume it's compromised) and let the other
maintainer know.

## Commit conventions

Plain, descriptive, present-tense messages are fine — this isn't a project that enforces
Conventional Commits, but do keep the *why* in the message when it's not obvious from the diff
(a bug fix, a deliberate scope decision, a workaround for a specific issue).

## Code style

- Backend and frontend each have their own ESLint config (`server/.eslintrc.json`,
  `client/.eslintrc.json`) — let the linter be the style authority rather than personal
  preference.
- Prefer extending an existing service/engine over adding a new one with overlapping
  responsibility — e.g. new detection logic belongs in `server/src/services/detection/ruleEngine.ts`
  and `server/src/config/rules.json`, not scattered into controllers.
- Officer-only data (risk score, findings, ML output, AI reports, priority) must be enforced at
  the API level (`authorize("OFFICER")` on the route, and redacted in `projectController.ts`'s
  `serializeProject` where the same document is shared across roles) — never rely on the frontend
  alone to hide it.

## Pull requests

Keep them scoped to one concern. Include in the description: what changed, why, and how you
verified it (which commands you ran, what you clicked through manually if it's a UI change).
