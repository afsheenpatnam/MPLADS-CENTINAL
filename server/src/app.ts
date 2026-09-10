import cors from "cors";
import express, { Express } from "express";
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

  // In production, this single service also serves the built React app — same-origin, so no
  // CORS/cross-origin-WebSocket configuration is needed between the SPA and the API/Socket.IO.
  // Render (or any single-service host) just needs one build + one start command.
  if (env.nodeEnv === "production") {
    const clientDist = path.resolve(process.cwd(), "..", "client", "dist");
    app.use(express.static(clientDist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path.startsWith("/socket.io")) {
        return next();
      }
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
