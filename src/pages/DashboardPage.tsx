import { useEffect, useState } from "react";
import { useDataStore, type Task } from "../stores/dataStore";
import { StatusBadge } from "../components/StatusBadge";
import { Activity, GitPullRequest, MessageSquare, Cpu, Clock, Zap, BarChart3, Hash, TrendingUp } from "lucide-react";
import { api } from "../api/client";

interface QuickStats {
  totalTokensToday: number;
  totalSessions: number;
  sessionTypes: number;
  avgPerSession: number;
}

function TaskSummaryCard({ tasks }: { tasks: Task[] }) {
  const counts = {
    todo: tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    review: tasks.filter((t) => t.status === "review").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  return (
    <div className="bg-surface-1 rounded-lg border border-surface-3 p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Tasks</h3>
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(counts).map(([key, count]) => (
          <div key={key} className="text-center">
            <div className="text-2xl font-bold">{count}</div>
            <div className="text-xs text-gray-500 capitalize">{key.replace("_", " ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusCard() {
  const status = useDataStore((s) => s.status);
  const tasks = useDataStore((s) => s.tasks);
  const inProgress = tasks.filter((t) => t.status === "in_progress");
  const currentWork = status?.currentTask || (inProgress.length > 0 ? inProgress.map((t) => t.title).join(" · ") : "Nothing active");

  return (
    <div className="bg-surface-1 rounded-lg border border-surface-3 p-4 col-span-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <StatusBadge status={status?.agentStatus || "idle"} />
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm">
              <Cpu className="w-4 h-4 text-gray-500" />
              <span className="text-gray-200">{status?.model || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4 text-gray-500" />
              <span className="text-gray-200 truncate max-w-[200px] sm:max-w-[400px]">{currentWork}</span>
            </div>
            {status?.uptime != null && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-gray-300">{formatUptime(status.uptime)}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {status?.contextUsage != null && (
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    status.contextUsage > 80 ? "bg-priority-urgent" : status.contextUsage > 50 ? "bg-priority-normal" : "bg-status-idle"
                  }`}
                  style={{ width: `${status.contextUsage}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{status.contextUsage}% ctx</span>
            </div>
          )}
          <span className="text-xs text-zinc-500">Updated just now</span>
        </div>
      </div>
    </div>
  );
}

function QuickStatsCard({ stats }: { stats: QuickStats | null }) {
  return (
    <div className="bg-surface-1 rounded-lg border border-surface-3 p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-medium text-gray-400">Quick Stats</h3>
      </div>
      {stats ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-lg font-bold text-accent">{formatTokens(stats.totalTokensToday)}</div>
            <div className="text-[10px] text-gray-500">Total Tokens</div>
          </div>
          <div>
            <div className="text-lg font-bold">{stats.totalSessions}</div>
            <div className="text-[10px] text-gray-500">Sessions</div>
          </div>
          <div>
            <div className="text-lg font-bold">{stats.sessionTypes}</div>
            <div className="text-[10px] text-gray-500">Session Types</div>
          </div>
          <div>
            <div className="text-lg font-bold">{formatTokens(stats.avgPerSession)}</div>
            <div className="text-[10px] text-gray-500">Avg / Session</div>
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-500">Loading...</div>
      )}
    </div>
  );
}

function PRSummaryCard() {
  const prs = useDataStore((s) => s.prs);

  return (
    <div className="bg-surface-1 rounded-lg border border-surface-3 p-4">
      <div className="flex items-center gap-2 mb-3">
        <GitPullRequest className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-medium text-gray-400">Open PRs</h3>
        <span className="ml-auto text-lg font-bold">{prs.length}</span>
      </div>
      <div className="space-y-1.5">
        {prs.slice(0, 5).map((pr) => (
          <a
            key={pr.number}
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm hover:bg-surface-2 rounded px-1.5 py-1 -mx-1.5 transition-colors"
          >
            <span className="text-accent">#{pr.number}</span>
            <span className="truncate text-gray-300">{pr.title}</span>
          </a>
        ))}
        {prs.length === 0 && (
          <div className="text-center py-2">
            <p className="text-sm text-gray-500">No open PRs 🎉</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ThreadSummaryCard() {
  const threads = useDataStore((s) => s.threads);

  return (
    <div className="bg-surface-1 rounded-lg border border-surface-3 p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-medium text-gray-400">Discord Threads</h3>
        <span className="ml-auto text-lg font-bold">{threads.length}</span>
      </div>
      <div className="space-y-1.5">
        {threads.slice(0, 5).map((t) => (
          <a
            key={t.id}
            href={t.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm hover:bg-surface-2 rounded px-1.5 py-1 -mx-1.5 transition-colors"
          >
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                t.status === "active" ? "bg-status-idle" : t.status === "quiet" ? "bg-status-working" : "bg-gray-600"
              }`}
            />
            <span className="truncate text-gray-300">{t.name}</span>
          </a>
        ))}
        {threads.length === 0 && (
          <div className="text-center py-2">
            <p className="text-sm text-gray-500">No tracked threads</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SessionsCard() {
  const sessions = useDataStore((s) => s.sessions);

  return (
    <div className="bg-surface-1 rounded-lg border border-surface-3 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-medium text-gray-400">Active Sessions</h3>
        <span className="ml-auto text-lg font-bold">{sessions.length}</span>
      </div>
      <div className="space-y-1.5">
        {sessions.slice(0, 5).map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-status-idle flex-shrink-0" />
            <span className="truncate text-gray-300">{s.displayName}</span>
            <span className="ml-auto text-xs text-gray-500 flex-shrink-0">{(s.totalTokens / 1000).toFixed(1)}k</span>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="text-center py-2">
            <p className="text-sm text-gray-500">No active sessions</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RecentActivityCard() {
  const tasks = useDataStore((s) => s.tasks);
  const prs = useDataStore((s) => s.prs);

  // Build activity items from recent task changes and PR activity
  const activities: { id: string; icon: string; text: string; time: string }[] = [];

  // Recent task completions
  tasks
    .filter((t) => t.status === "done" && t.updatedAt)
    .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())
    .slice(0, 5)
    .forEach((t) => {
      activities.push({
        id: `task-${t.id}`,
        icon: "✅",
        text: `Completed: ${t.title}`,
        time: t.updatedAt ? timeAgo(new Date(t.updatedAt)) : "",
      });
    });

  // In-progress tasks
  tasks
    .filter((t) => t.status === "in_progress")
    .forEach((t) => {
      activities.push({
        id: `wip-${t.id}`,
        icon: "🔧",
        text: `Working on: ${t.title}`,
        time: "now",
      });
    });

  // Open PRs as activity
  prs.slice(0, 3).forEach((pr) => {
    activities.push({
      id: `pr-${pr.number}`,
      icon: "🔀",
      text: `PR #${pr.number}: ${pr.title}`,
      time: pr.ci || "open",
    });
  });

  return (
    <div className="bg-surface-1 rounded-lg border border-surface-3 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Hash className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-medium text-gray-400">Recent Activity</h3>
      </div>
      <div className="space-y-2">
        {activities.slice(0, 8).map((a) => (
          <div key={a.id} className="flex items-start gap-2 text-sm">
            <span className="flex-shrink-0">{a.icon}</span>
            <span className="truncate text-gray-300">{a.text}</span>
            <span className="ml-auto text-[10px] text-gray-500 flex-shrink-0">{a.time}</span>
          </div>
        ))}
        {activities.length === 0 && (
          <div className="text-center py-2">
            <p className="text-sm text-gray-500">No recent activity</p>
          </div>
        )}
      </div>
    </div>
  );
}

function JobsSummaryCard() {
  const cronJobs = useDataStore((s) => s.cronJobs);
  const heartbeatChecks = useDataStore((s) => s.heartbeatChecks);

  return (
    <div className="bg-surface-1 rounded-lg border border-surface-3 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-medium text-gray-400">Periodic Jobs</h3>
        <span className="ml-auto text-lg font-bold">{cronJobs.length}</span>
      </div>
      <div className="space-y-1.5">
        {cronJobs.slice(0, 5).map((j) => (
          <div key={j.id} className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${j.enabled ? "bg-status-idle" : "bg-gray-600"}`} />
            <span className="truncate text-gray-300">{j.name}</span>
            <span className="ml-auto text-xs text-gray-500 flex-shrink-0">{j.schedule}</span>
          </div>
        ))}
        {heartbeatChecks.length > 0 && (
          <div className="text-xs text-gray-500 mt-2">+ {heartbeatChecks.length} heartbeat checks</div>
        )}
      </div>
    </div>
  );
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function timeAgo(date: Date): string {
  const min = Math.round((Date.now() - date.getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
}

export function DashboardPage() {
  const fetchTasks = useDataStore((s) => s.fetchTasks);
  const fetchGitHub = useDataStore((s) => s.fetchGitHub);
  const fetchDiscord = useDataStore((s) => s.fetchDiscord);
  const fetchAgents = useDataStore((s) => s.fetchAgents);
  const fetchJobs = useDataStore((s) => s.fetchJobs);
  const fetchStatus = useDataStore((s) => s.fetchStatus);
  const tasks = useDataStore((s) => s.tasks);
  const [stats, setStats] = useState<QuickStats | null>(null);

  useEffect(() => {
    fetchTasks();
    fetchGitHub();
    fetchDiscord();
    fetchAgents();
    fetchJobs();
    fetchStatus();

    // Fetch quick stats from session aggregation
    api.get<{ grandTotal: { totalTokens: number }; byKind: Record<string, any>; totalSessions: number }>("/api/status/sessions")
      .then((data) => {
        const kinds = Object.keys(data.byKind || {}).length;
        setStats({
          totalTokensToday: data.grandTotal?.totalTokens || 0,
          totalSessions: data.totalSessions || 0,
          sessionTypes: kinds,
          avgPerSession: data.totalSessions ? Math.round((data.grandTotal?.totalTokens || 0) / data.totalSessions) : 0,
        });
      })
      .catch(() => {});
  }, [fetchTasks, fetchGitHub, fetchDiscord, fetchAgents, fetchJobs, fetchStatus]);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatusCard />
        <TaskSummaryCard tasks={tasks} />
        <QuickStatsCard stats={stats} />
        <RecentActivityCard />
        <PRSummaryCard />
        <ThreadSummaryCard />
        <SessionsCard />
        <JobsSummaryCard />
      </div>
    </div>
  );
}
