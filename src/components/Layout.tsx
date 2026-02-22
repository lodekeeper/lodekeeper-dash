import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  KanbanSquare,
  Radar,
  Bot,
  Clock,
  Terminal,
  MessageSquare,
  BarChart3,
  LogOut,
  Star,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { useDataStore } from "../stores/dataStore";
import { StatusBadge } from "./StatusBadge";
import { MobileBottomNav } from "./MobileBottomNav";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/tasks", icon: KanbanSquare, label: "Tasks" },
  { to: "/tracking", icon: Radar, label: "Tracking" },
  { to: "/agents", icon: Bot, label: "Agents" },
  { to: "/jobs", icon: Clock, label: "Jobs" },
  { to: "/stream", icon: Terminal, label: "Stream" },
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/usage", icon: BarChart3, label: "Usage" },
];

export function Layout() {
  const logout = useAuthStore((s) => s.logout);
  const status = useDataStore((s) => s.status);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — hidden on mobile, visible on md+ */}
      <aside className="hidden md:flex w-56 bg-surface-1 border-r border-surface-3 flex-col shrink-0">
        {/* Logo */}
        <div className="p-4 border-b border-surface-3 flex items-center gap-2">
          <Star className="w-5 h-5 text-accent" />
          <span className="font-semibold text-sm">Lodekeeper</span>
          <StatusBadge status={status?.agentStatus || "idle"} className="ml-auto" />
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-accent/10 text-accent"
                    : "text-gray-400 hover:text-gray-200 hover:bg-surface-2"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-surface-3">
          <button
            onClick={() => logout()}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm transition-colors w-full px-2 py-1"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content — bottom padding on mobile for nav bar */}
      <main className="flex-1 overflow-y-auto bg-surface-0 pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <MobileBottomNav />
    </div>
  );
}
