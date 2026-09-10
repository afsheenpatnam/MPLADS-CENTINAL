# Real-Time Architecture

The brief's non-negotiable requirement: **when a contractor uploads activity, the officer's view
updates automatically — no manual refresh.** This is implemented with Socket.IO, not polling.

## Server side (`server/src/realtime/socketServer.ts`)

- `initSocketServer(httpServer)` is called once from `server.ts` (wrapping the Express app in a
  plain `http.Server` so Socket.IO and REST share the same port).
- Every socket connection is authenticated with the same JWT used for REST calls
  (`socket.handshake.auth.token`), verified with the same `verifyToken` helper as HTTP requests.
- On connect, a socket joins **one private room**: `user:<userId>`. Nothing is ever broadcast
  globally.
- `emitToUser(userId, event, payload)` is the only way server code emits — it always targets a
  single user's room, so a contractor's socket can only ever receive events explicitly addressed
  to their own `userId`.

## What gets emitted, and to whom

| Event | Emitted from | Sent to | Payload highlights |
|---|---|---|---|
| `activity:imported` | `activityImportService.ts` | both the importing contractor and the project's officer | row counts, project code |
| `sanction:pending` | `sanctionController.createSanction` | the assigned contractor | new sanction awaiting approval |
| `findings:created`, `risk:updated`, `priority:updated`, `project:updated`, `dashboard:updated` | `detectionPipeline.ts` (end of every detection run) | **the officer only** | riskScore, riskLevel, priority, findingCount, actualProgress, spentAmount |
| `processing:completed` / `processing:failed` | activity import | the contractor | lets the contractor's own UI show "done" without polling |

**Officer-only intelligence is never emitted to a contractor's room** — this mirrors the REST API,
where `authorize("OFFICER")` blocks the same fields at the HTTP layer. The real-time channel does
not introduce a second, less-guarded path to the same data.

## Client side (`client/src/hooks/useSocket.tsx`)

`SocketProvider` wraps the whole authenticated app (in `main.tsx`, inside `AuthProvider`). It:

1. Opens one `socket.io-client` connection per login session, authenticated with the stored JWT.
2. On every event, invalidates the relevant TanStack Query cache keys (`["project", id]`,
   `["findings", id]`, `["risk", id]`, `["projects"]`, `["project-summary"]`, etc.) — any open
   screen refetches and re-renders with the new data automatically.
3. Records a lightweight notification (shown in the bell icon in `AppLayout`) and updates a
   `lastUpdatedAt` timestamp, rendered as the "Live · Updated Ns ago" badge in the header.

No component polls. No component requires a manual reload to see new data — this was verified
live: uploading a contractor activity CSV in one browser session updates the KPI tiles, the
"Projects Requiring Immediate Attention" table, and the notification bell in a **second, already-open**
officer browser session within about a second, with zero page navigation.

## Dev proxy note

Vite's dev server proxies `/socket.io` to the backend with `ws: true` (see
`client/vite.config.ts`) so the browser only ever talks to `http://localhost:5173` — this matters
because Socket.IO's client defaults to connecting to the page's own origin.

## Failure behavior

If the socket disconnects (server restart, network blip), the header badge flips to "Offline" and
`socket.io-client`'s built-in reconnection logic reconnects automatically; once reconnected, the
next detection run's events bring the UI back in sync. No data is lost — everything the socket
would have delivered is also sitting in MongoDB and is fetched normally on the next page load or
query refetch.
