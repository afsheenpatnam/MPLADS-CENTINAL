import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "./useAuth";

export interface LiveNotification {
  id: string;
  event: string;
  message: string;
  projectCode?: string;
  projectId?: string;
  timestamp: string;
}

interface SocketContextValue {
  connected: boolean;
  lastUpdatedAt: Date | null;
  notifications: LiveNotification[];
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

const OFFICER_INTELLIGENCE_EVENTS = ["findings:created", "risk:updated", "priority:updated", "project:updated", "dashboard:updated"];
const ALL_EVENTS = [
  ...OFFICER_INTELLIGENCE_EVENTS,
  "activity:imported",
  "sanction:pending",
  "processing:completed",
  "processing:failed",
  "clarification:requested",
  "clarification:responded",
  "clarification:reviewed",
  "exception:requested",
  "exception:reviewed",
  "investigation:resolved",
];

function describeEvent(event: string, payload: any): string {
  switch (event) {
    case "activity:imported":
      return payload.message ?? `Daily activity imported for ${payload.projectCode ?? "a project"} (${payload.rowsImported ?? 0} row(s))`;
    case "findings:created":
      return `${payload.findingCount ?? 0} finding(s) on ${payload.projectCode} — risk ${payload.riskLevel}`;
    case "risk:updated":
      return `Risk recalculated for ${payload.projectCode}: ${payload.riskScore}/100 (${payload.riskLevel})`;
    case "priority:updated":
      return `Priority updated for ${payload.projectCode}: ${payload.priority}`;
    case "sanction:pending":
      return `New sanction awaiting your approval: ${payload.projectCode}`;
    case "processing:completed":
      return "CSV processing completed";
    case "processing:failed":
      return "CSV processing failed";
    case "clarification:requested":
    case "clarification:responded":
    case "clarification:reviewed":
    case "exception:requested":
    case "exception:reviewed":
    case "investigation:resolved":
      return payload.message ?? `${payload.projectCode ?? "Project"} updated`;
    default:
      return `${payload.projectCode ?? "Project"} updated`;
  }
}

/**
 * Live-update transport: connects once per authenticated session, joins the server's private
 * `user:<userId>` room (see server/src/realtime/socketServer.ts), and on every event both (a)
 * invalidates the relevant TanStack Query caches so open screens refresh without a manual
 * reload, and (b) records a lightweight in-app notification for the bell icon / "Live" banner.
 * A contractor's socket only ever receives contractor-safe events — the server never emits
 * officer-only intelligence (findings/risk/priority) to a contractor's room.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("mplad_token");
    if (!user || !token) return;

    const socket = io("/", { auth: { token }, transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    const handler = (event: string) => (payload: any) => {
      setLastUpdatedAt(new Date());
      setNotifications((prev) => [
        {
          id: `${event}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          event,
          message: describeEvent(event, payload),
          projectCode: payload.projectCode,
          projectId: payload.projectId,
          timestamp: payload.updatedAt ?? new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 20));

      queryClient.invalidateQueries({ queryKey: ["project-summary"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["high-priority"] });
      if (payload.projectId) {
        queryClient.invalidateQueries({ queryKey: ["project", payload.projectId] });
        queryClient.invalidateQueries({ queryKey: ["findings", payload.projectId] });
        queryClient.invalidateQueries({ queryKey: ["risk", payload.projectId] });
        queryClient.invalidateQueries({ queryKey: ["activities", payload.projectId] });
        queryClient.invalidateQueries({ queryKey: ["sanction", payload.projectId] });
        queryClient.invalidateQueries({ queryKey: ["conditions", payload.projectId] });
        queryClient.invalidateQueries({ queryKey: ["progress", payload.projectId] });
        queryClient.invalidateQueries({ queryKey: ["expenditure", payload.projectId] });
        queryClient.invalidateQueries({ queryKey: ["site-visits", payload.projectId] });
        queryClient.invalidateQueries({ queryKey: ["evidence", payload.projectId] });
        queryClient.invalidateQueries({ queryKey: ["documents", payload.projectId] });
        queryClient.invalidateQueries({ queryKey: ["clarifications", payload.projectId] });
        queryClient.invalidateQueries({ queryKey: ["exceptions", payload.projectId] });
        queryClient.invalidateQueries({ queryKey: ["audit", payload.projectId] });
        queryClient.invalidateQueries({ queryKey: ["ai-report", payload.projectId] });
      }
      queryClient.invalidateQueries({ queryKey: ["sanction-pending"] });
    };

    for (const event of ALL_EVENTS) {
      socket.on(event, handler(event));
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const value = useMemo<SocketContextValue>(
    () => ({
      connected,
      lastUpdatedAt,
      notifications,
      dismissNotification: (id: string) => setNotifications((prev) => prev.filter((n) => n.id !== id)),
      clearNotifications: () => setNotifications([]),
    }),
    [connected, lastUpdatedAt, notifications]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within a SocketProvider");
  return ctx;
}
