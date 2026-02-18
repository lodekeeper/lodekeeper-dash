import { useEffect } from "react";
import { useDataStore, type Task } from "../stores/dataStore";
import { StatusBadge } from "../components/StatusBadge";
import { Activity, GitPullRequest, MessageSquare, Cpu, Clock, Zap, BarChart3 } from "lucide-react";

function TaskSummaryCard({ tasks }: { tasks: Task[] }) {
  const counts = {
    backlog: tasks.filter((t) => t.status === "backlog").length,
    todo: tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    review: tasks.filter((t) => t.status === "review").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  return (
    <div className="bg-surface-1 rounded-lg border border-surface-3 p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Tasks</h3>
      <div className="grid grid-cols-5 gap-2">
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
              <span className="text-gray-200 truncate max-w-[400px]">{currentWork}</span>
            </div>
            {status?.uptime != null && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-gray-300">{formatUptime(status.uptime)}</span>
              </div>
            )}
            {status?.tokenUsageToday != null && status.tokenUsageToday > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <BarChart3 className="w-4 h-4 text-gray-500" />
                <span className="text-gray-300">{(status.tokenUsageToday / 1000).toFixed(1)}k tokens</span>
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
            <a href="/tracking" className="text-xs text-accent hover:text-accent-hover">View tracking →</a>
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
              className={`w-2 h-2 rounded-full ${
                t.status === "active" ? "bg-status-idle" : t.status === "quiet" ? "bg-status-working" : "bg-gray-600"
              }`}
            />
            <span className="truncate text-gray-300">{t.name}</span>
          </a>
        ))}
        {threads.length === 0 && (
          <div className="text-center py-2">
            <p className="text-sm text-gray-500">No tracked threads</p>
            <a href="/tracking" className="text-xs text-accent hover:text-accent-hover">View tracking →</a>
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
            <span className="w-2 h-2 rounded-full bg-status-idle" />
            <span className="truncate text-gray-300">{s.displayName}</span>
            <span className="ml-auto text-xs text-gray-500">{(s.totalTokens / 1000).toFixed(1)}k tok</span>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="text-center py-2">
            <p className="text-sm text-gray-500">No active sessions</p>
            <a href="/agents" className="text-xs text-accent hover:text-accent-hover">View agents →</a>
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
            <span className={`w-2 h-2 rounded-full ${j.enabled ? "bg-status-idle" : "bg-gray-600"}`} />
            <span className="truncate text-gray-300">{j.name}</span>
            <span className="ml-auto text-xs text-gray-500">{j.schedule}</span>
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

export function DashboardPage() {
  const fetchTasks = useDataStore((s) => s.fetchTasks);
  const fetchGitHub = useDataStore((s) => s.fetchGitHub);
  const fetchDiscord = useDataStore((s) => s.fetchDiscord);
  const fetchAgents = useDataStore((s) => s.fetchAgents);
  const fetchJobs = useDataStore((s) => s.fetchJobs);
  const fetchStatus = useDataStore((s) => s.fetchStatus);
  const tasks = useDataStore((s) => s.tasks);

  useEffect(() => {
    fetchTasks();
    fetchGitHub();
    fetchDiscord();
    fetchAgents();
    fetchJobs();
    fetchStatus();
  }, [fetchTasks, fetchGitHub, fetchDiscord, fetchAgents, fetchJobs, fetchStatus]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatusCard />
        <TaskSummaryCard tasks={tasks} />
        <PRSummaryCard />
        <ThreadSummaryCard />
        <SessionsCard />
        <JobsSummaryCard />
      </div>
    </div>
  );
}
