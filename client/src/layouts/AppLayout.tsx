import {
  Bell,
  FileWarning,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  Radar,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../hooks/useSocket";

const OFFICER_LINKS = [
  { to: "/officer", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/officer/projects/import", label: "Import Projects", icon: Upload, end: true },
];

const CONTRACTOR_LINKS = [{ to: "/contractor", label: "My Projects", icon: FolderKanban, end: true }];

function timeAgo(date: Date | null): string {
  if (!date) return "never";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return date.toLocaleTimeString();
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const { connected, lastUpdatedAt, notifications, clearNotifications } = useSocket();
  const [bellOpen, setBellOpen] = useState(false);

  const links = user?.role === "OFFICER" ? OFFICER_LINKS : CONTRACTOR_LINKS;

  return (
    <div className="flex min-h-screen bg-surface-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-gradient-primary text-white shadow-xl lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Radar className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-extrabold leading-tight tracking-wide">MPLAD SENTINEL</p>
            <p className="text-[10px] leading-tight text-white/70">Intelligent Vigilance for Every Project</p>
          </div>
        </div>

        <nav className="mt-4 flex-1 space-y-1 px-3">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-white text-primary-700 shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/15 p-3">
          <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
              {user?.name?.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{user?.name}</p>
              <p className="text-[10px] text-white/70">{user?.role}</p>
            </div>
            <button onClick={logout} title="Logout" className="text-white/70 hover:text-white">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen w-full flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-surface-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <ShieldCheck className="h-5 w-5 text-primary-600" />
            <span className="text-sm font-bold text-primary-800">MPLAD SENTINEL</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-surface-200 px-2.5 py-1 text-xs font-medium text-surface-500">
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-surface-300"}`} />
              {connected ? "Live" : "Offline"}
              <span className="hidden text-surface-400 sm:inline">· Updated {timeAgo(lastUpdatedAt)}</span>
            </div>

            {/* Always visible regardless of screen width — the sidebar (and its logout button)
                is hidden below the lg breakpoint, so this is the only reliable logout control
                on narrower windows. */}
            <button
              onClick={logout}
              title="Logout"
              aria-label="Logout"
              className="flex items-center gap-1.5 rounded-full border border-surface-200 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setBellOpen((v) => !v)}
                aria-label="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-primary-700 hover:bg-primary-50"
              >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-secondary-600 text-[10px] font-bold text-white">
                    {notifications.length}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-surface-200 bg-white p-2 shadow-xl">
                  <div className="flex items-center justify-between px-2 py-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">Live Updates</p>
                    {notifications.length > 0 && (
                      <button onClick={clearNotifications} className="text-xs text-primary-600 hover:underline">
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 && (
                      <p className="flex items-center gap-2 px-2 py-4 text-sm text-surface-400">
                        <MessagesSquare className="h-4 w-4" /> No notifications yet
                      </p>
                    )}
                    {notifications.map((n) => (
                      <div key={n.id} className="flex gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-50">
                        <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-secondary-600" />
                        <div>
                          <p className="text-primary-900">{n.message}</p>
                          <p className="text-[11px] text-surface-400">{new Date(n.timestamp).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
