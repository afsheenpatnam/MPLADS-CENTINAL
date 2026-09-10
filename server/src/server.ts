import http from "http";
import { createApp } from "./app";
import { connectDatabase } from "./config/db";
import { env } from "./config/env";
import { initSocketServer } from "./realtime/socketServer";

async function main() {
  await connectDatabase();
  const app = createApp();
  const httpServer = http.createServer(app);
  initSocketServer(httpServer);

  httpServer.listen(env.port, () => {
    console.log(`[server] MPLAD Sentinel API listening on port ${env.port} (Socket.IO live)`);
  });
}

main().catch((err) => {
  console.error("[server] Fatal startup error:", err);
  process.exit(1);
});
