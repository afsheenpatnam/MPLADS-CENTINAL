import cors from "cors";
import express, { Express } from "express";
import fs from "fs";
import morgan from "morgan";
import path from "path";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import routes from "./routes";

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true }));
  if (env.nodeEnv !== "test") {
    app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
  }

  app.use("/uploads", express.static(path.resolve(process.cwd(), "..", env.uploadDir)));

  app.get("/api/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  app.use("/api", routes);

  // This single service also serves the built React app whenever one has actually been built —
  // same-origin, so no CORS/cross-origin-WebSocket configuration is needed between the SPA and
  // the API/Socket.IO. Detecting this via the presence of client/dist/index.html (rather than
  // solely trusting NODE_ENV) means it works even on hosts where NODE_ENV=production wasn't set
  // correctly in a manually-configured dashboard, as long as `npm run build` actually ran.
  const clientDist = path.resolve(process.cwd(), "..", "client", "dist");
  const clientIndexPath = path.join(clientDist, "index.html");
  if (env.nodeEnv !== "test" && fs.existsSync(clientIndexPath)) {
    app.use(express.static(clientDist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path.startsWith("/socket.io")) {
        return next();
      }
      res.sendFile(clientIndexPath);
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
