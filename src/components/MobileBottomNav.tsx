import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  KanbanSquare,
  Radar,
  Bot,
  Clock,
  Terminal,
  MessageSquare,
  BarChart3,
  MoreHorizontal,
  LogOut,
  Star,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { useDataStore } from "../stores/dataStore";
import { StatusBadge } from "./StatusBadge";

const PRIMARY_TABS = [
  { to: "/", icon: LayoutDashboard, label: "Home" },
  { to: "/tasks", icon: KanbanSquare, label: "Tasks" },
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/stream", icon: Terminal, label: "Stream" },
  { to: "/usage", icon: BarChart3, label: "Usage" },
];

const MORE_TABS = [
  { to: "/tracking", icon: Radar, label: "Tracking" },
  { to: "/agents", icon: Bot, label: "Agents" },
  { to: "/jobs", icon: Clock, label: "Jobs" },
];

export function MobileBottomNav() {
  const [showMore, setShowMore] = useState(false);
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const status = useDataStore((s) => s.status);

  const isMoreActive = MORE_TABS.some((t) =>
    t.to === "/" ? location.pathname === "/" : location.pathname.startsWith(t.to)
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-surface-1 border-t border-surface-3 z-50">
      {/* More menu popover */}
      {showMore && (
        <>
          {/* Backdrop to close */}
          <div
            className="fixed inset-0 z-[-1]"
            onClick={() => setShowMore(false)}
          />
          <div className="absolute bottom-full left-0 right-0 bg-surface-1 border-t border-surface-3 p-2 space-y-0.5">
            {MORE_TABS.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setShowMore(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm ${
                    isActive
                      ? "bg-accent/10 text-accent"
                      : "text-gray-400 hover:text-gray-200"
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
            <div className="border-t border-surface-3 mt-1 pt-1 flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-accent" />
                <StatusBadge
                  status={status?.agentStatus || "idle"}
                />
              </div>
              <button
                onClick={() => logout()}
                className="text-gray-500 hover:text-gray-300"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Tab bar */}
      <div className="flex items-center justify-around px-2 pt-1 pb-[max(env(safe-area-inset-bottom),4px)]">
        {PRIMARY_TABS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-1.5 px-2 min-w-[3rem] ${
                isActive ? "text-accent" : "text-gray-500"
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px]">{label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setShowMore((s) => !s)}
          className={`flex flex-col items-center gap-0.5 py-1.5 px-2 min-w-[3rem] ${
            isMoreActive || showMore ? "text-accent" : "text-gray-500"
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px]">More</span>
        </button>
      </div>
    </nav>
  );
}
