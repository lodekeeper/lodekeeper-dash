import { useEffect, useState, useCallback } from "react";
import { useDataStore } from "../stores/dataStore";
import { ExternalLink, GitPullRequest, MessageSquare, Bell, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../api/client";

type Tab = "github" | "discord";

interface PRComment {
  id: number;
  author: string;
  body: string;
  createdAt: string;
  path?: string;
}

function PRExpandedRow({ number }: { number: number }) {
  const [comments, setComments] = useState<PRComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ comments: PRComment[] }>(`/api/tracking/pr-comments/${number}`)
      .then((data) => setComments(data.comments || []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [number]);

  if (loading) return <tr><td colSpan={7} className="p-3 text-xs text-gray-500">Loading comments...</td></tr>;
  if (comments.length === 0) return <tr><td colSpan={7} className="p-3 text-xs text-gray-500">No recent comments</td></tr>;

  return (
    <tr>
      <td colSpan={7} className="px-3 pb-3">
        <div className="bg-surface-0 rounded-lg border border-surface-3 divide-y divide-surface-3/50 max-h-[300px] overflow-y-auto">
          {comments.map((c) => (
            <div key={c.id} className="p-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-accent">{c.author}</span>
                {c.path && <span className="text-[10px] text-gray-600 font-mono">{c.path}</span>}
                <span className="text-[10px] text-gray-600 ml-auto">{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-xs text-gray-400 whitespace-pre-wrap line-clamp-4">{c.body}</p>
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
}

function GitHubTab() {
  const prs = useDataStore((s) => s.prs);
  const notifications = useDataStore((s) => s.notifications);
  const [expandedPR, setExpandedPR] = useState<number | null>(null);

  const togglePR = useCallback((num: number) => {
    setExpandedPR((prev) => (prev === num ? null : num));
  }, []);

  return (
    <div className="space-y-6">
      {/* PRs */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
          <GitPullRequest className="w-4 h-4" />
          Pull Requests ({prs.length})
        </h3>
        <div className="bg-surface-1 rounded-lg border border-surface-3 overflow-hidden">
          {prs.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No open PRs</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-3 text-gray-500 text-xs">
                  <th className="text-left p-3 font-medium w-6"></th>
                  <th className="text-left p-3 font-medium">#</th>
                  <th className="text-left p-3 font-medium">Title</th>
                  <th className="text-left p-3 font-medium">Author</th>
                  <th className="text-left p-3 font-medium">CI</th>
                  <th className="text-left p-3 font-medium">Review</th>
                  <th className="p-3 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {prs.map((pr) => (
                  <>
                    <tr
                      key={pr.number}
                      className={`border-b border-surface-3/50 hover:bg-surface-2 transition-colors cursor-pointer ${expandedPR === pr.number ? "bg-surface-2" : ""}`}
                      onClick={() => togglePR(pr.number)}
                    >
                      <td className="pl-3 pr-0">
                        {expandedPR === pr.number ? (
                          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                        )}
                      </td>
                      <td className="p-3 text-accent font-mono">{pr.number}</td>
                      <td className="p-3">
                        <span className="text-gray-200">{pr.title}</span>
                        {pr.isDraft && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">Draft</span>
                        )}
                      </td>
                      <td className="p-3 text-gray-400">{pr.author}</td>
                      <td className="p-3">
                        <CIBadge status={(pr as any).ciStatus} />
                      </td>
                      <td className="p-3">
                        <ReviewBadge decision={pr.reviewDecision} />
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <a href={pr.url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-accent">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                    {expandedPR === pr.number && <PRExpandedRow key={`exp-${pr.number}`} number={pr.number} />}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Notifications */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Notifications ({notifications.length})
        </h3>
        <div className="bg-surface-1 rounded-lg border border-surface-3 overflow-hidden">
          {notifications.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No notifications</p>
          ) : (
            <div className="divide-y divide-surface-3/50">
              {notifications.slice(0, 15).map((n) => (
                <div key={n.id} className="p-3 flex items-center gap-3 hover:bg-surface-2 transition-colors">
                  {n.unread && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
                  {!n.unread && <span className="w-2 h-2 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{n.title}</p>
                    <p className="text-xs text-gray-500">
                      {n.type} · {n.reason} · {new Date(n.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiscordTab() {
  const threads = useDataStore((s) => s.threads);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);

  const STATUS_COLOR: Record<string, string> = {
    active: "bg-status-idle",
    quiet: "bg-status-working",
    archived: "bg-gray-600",
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
        <MessageSquare className="w-4 h-4" />
        Tracked Threads ({threads.length})
      </h3>
      <div className="bg-surface-1 rounded-lg border border-surface-3 overflow-hidden">
        {threads.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No tracked threads</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-3 text-gray-500 text-xs">
                <th className="text-left p-3 font-medium w-6"></th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Thread</th>
                <th className="text-left p-3 font-medium">Server</th>
                <th className="p-3 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {threads.map((t) => (
                <>
                  <tr
                    key={t.id}
                    className={`border-b border-surface-3/50 hover:bg-surface-2 transition-colors cursor-pointer ${expandedThread === t.id ? "bg-surface-2" : ""}`}
                    onClick={() => setExpandedThread((prev) => (prev === t.id ? null : t.id))}
                  >
                    <td className="pl-3 pr-0">
                      {expandedThread === t.id ? (
                        <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                      )}
                    </td>
                    <td className="p-3">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[t.status]}`} />
                        <span className="text-xs capitalize text-gray-400">{t.status}</span>
                      </span>
                    </td>
                    <td className="p-3 text-gray-200">{t.name}</td>
                    <td className="p-3 text-gray-400">{t.guildName}</td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-accent">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                  {expandedThread === t.id && (
                    <tr key={`exp-${t.id}`}>
                      <td colSpan={5} className="px-3 pb-3">
                        <div className="bg-surface-0 rounded-lg border border-surface-3 p-3 space-y-2">
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-gray-500">ID: <span className="font-mono text-gray-400">{t.id}</span></span>
                            {t.channelId && <span className="text-gray-500">Channel: <span className="font-mono text-gray-400">{t.channelId}</span></span>}
                          </div>
                          {t.notes && (
                            <div>
                              <span className="text-[10px] font-medium text-gray-500 uppercase">Notes</span>
                              <p className="text-xs text-gray-400 mt-0.5 whitespace-pre-wrap">{t.notes}</p>
                            </div>
                          )}
                          {!t.notes && <p className="text-xs text-gray-500">No additional notes</p>}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CIBadge({ status }: { status?: string }) {
  if (!status || status === "unknown") return <span className="text-xs text-gray-600">—</span>;
  const colors: Record<string, string> = {
    pass: "bg-status-idle/20 text-status-idle",
    fail: "bg-priority-urgent/20 text-priority-urgent",
    pending: "bg-priority-normal/20 text-priority-normal",
  };
  const labels: Record<string, string> = {
    pass: "✓ Pass",
    fail: "✗ Fail",
    pending: "⏳ Running",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[status] || "bg-surface-3 text-gray-400"}`}>
      {labels[status] || status}
    </span>
  );
}

function ReviewBadge({ decision }: { decision: string }) {
  if (!decision) return <span className="text-xs text-gray-600">—</span>;
  const colors: Record<string, string> = {
    APPROVED: "bg-status-idle/20 text-status-idle",
    CHANGES_REQUESTED: "bg-priority-urgent/20 text-priority-urgent",
    REVIEW_REQUIRED: "bg-priority-normal/20 text-priority-normal",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[decision] || "bg-surface-3 text-gray-400"}`}>
      {decision.replace(/_/g, " ")}
    </span>
  );
}

export function TrackingPage() {
  const [tab, setTab] = useState<Tab>("github");
  const fetchGitHub = useDataStore((s) => s.fetchGitHub);
  const fetchDiscord = useDataStore((s) => s.fetchDiscord);

  useEffect(() => {
    fetchGitHub();
    fetchDiscord();
  }, [fetchGitHub, fetchDiscord]);

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold">Tracking</h1>

      <div className="flex gap-1 bg-surface-1 p-1 rounded-lg w-fit">
        {(["github", "discord"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm transition-colors capitalize ${
              tab === t ? "bg-accent text-white" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {t === "github" ? "GitHub" : "Discord"}
          </button>
        ))}
      </div>

      {tab === "github" ? <GitHubTab /> : <DiscordTab />}
    </div>
  );
}
