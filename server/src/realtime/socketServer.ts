import type { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { env } from "../config/env";
import { verifyToken } from "../utils/jwt";

let io: SocketIOServer | null = null;

/**
 * Real-time transport for the contractor -> officer live-update pipeline. Each authenticated
 * socket joins a private room `user:<userId>` — nothing is ever broadcast globally, so a
 * contractor's socket can only ever receive events explicitly addressed to their own userId
 * (their own "activity received" confirmations), never another user's findings/risk/priority
 * data. Officer-only intelligence events are emitted solely to `user:<officerId>`.
 */
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.clientUrl, credentials: true },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Missing auth token"));
    try {
      const payload = verifyToken(token);
      socket.data.userId = payload.userId;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    socket.join(`user:${socket.data.userId}`);
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitToUser(userId: string | undefined | null, event: string, payload: unknown): void {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
}
