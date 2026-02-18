import { useEffect, useState, useCallback } from "react";
import { BarChart3, RefreshCw, Zap, Hash, Cpu, TrendingUp } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";
import { api } from "../api/client";

interface Session {
  key: string;
  kind: string;
  model: string;
  ageMin: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  contextTokens: number;
}

interface SessionsData {
  sessions: Session[];
  byKind: Record<string, { tokens: number; count: number }>;
  totalTokens: number;
  totalSessions: number;
}

const KIND_COLORS: Record<string, string> = {
  direct: "#6366f1",    // indigo/accent
  discord: "#818cf8",   // indigo lighter
  cron: "#f59e0b",      // amber
  isolated: "#a855f7",  // purple
  unknown: "#6b7280",   // gray
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function sessionLabel(key: string): string {
  const parts = key.split(":");
  if (parts.length <= 3) return parts[parts.length - 1];
  if (parts[2] === "discord") return `discord:${parts[parts.length - 1].slice(0, 8)}…`;
  if (parts[2] === "cron") {
    const cronId = parts[3]?.slice(0, 8);
    return parts.includes("run") ? `cron:${cronId}…` : `cron:${cronId}…`;
  }
  return parts.slice(2).join(":");
}

function formatAge(min: number): string {
  if (min < 60) return `${min}m`;
  if (min < 1440) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / 1440)}d`;
}

// Custom tooltip for charts
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-2 border border-surface-3 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="font-medium text-gray-200 mb-1">{label || payload[0]?.name}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-gray-400">
          <span style={{ color: entry.color || entry.fill }}>●</span>{" "}
          {entry.name || entry.dataKey}: {formatTokens(entry.value)}
        </p>
      ))}
    </div>
  );
}

interface DailyUsage {
  date: string;
  tokens: number;
  sessions: number;
}

export function UsagePage() {
  const [data, setData] = useState<SessionsData | null>(null);
  const [history, setHistory] = useState<DailyUsage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [d, h] = await Promise.all([
        api.get<SessionsData>("/api/status/sessions"),
        api.get<{ daily: DailyUsage[] }>("/api/status/usage"),
      ]);
      setData(d);
      setHistory(h.daily || []);
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 60000);
    return () => clearInterval(interval);
  }, [fetch]);

  if (!data) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-gray-500">{loading ? "Loading..." : "No data"}</div>
      </div>
    );
  }

  // Prepare pie chart data
  const pieData = Object.entries(data.byKind).map(([kind, info]) => ({
    name: kind,
    value: info.tokens,
    count: info.count,
  }));

  // Top sessions by token usage (bar chart)
  const topSessions = [...data.sessions]
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 15)
    .map((s) => ({
      name: sessionLabel(s.key),
      fullKey: s.key,
      tokens: s.totalTokens,
      input: s.inputTokens,
      output: s.outputTokens,
      kind: s.kind,
      age: formatAge(s.ageMin),
    }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Token Usage
        </h1>
        <button
          onClick={fetch}
          disabled={loading}
          className="p-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Zap className="w-4 h-4 text-accent" />}
          label="Total Tokens"
          value={formatTokens(data.totalTokens)}
        />
        <SummaryCard
          icon={<Hash className="w-4 h-4 text-purple-400" />}
          label="Sessions"
          value={String(data.totalSessions)}
        />
        <SummaryCard
          icon={<Cpu className="w-4 h-4 text-amber-400" />}
          label="Session Types"
          value={String(Object.keys(data.byKind).length)}
        />
        <SummaryCard
          icon={<TrendingUp className="w-4 h-4 text-green-400" />}
          label="Avg / Session"
          value={data.totalSessions > 0 ? formatTokens(Math.round(data.totalTokens / data.totalSessions)) : "0"}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie: by kind */}
        <div className="bg-surface-1 rounded-lg border border-surface-3 p-4">
          <h2 className="text-sm font-semibold mb-3">Tokens by Session Type</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={KIND_COLORS[entry.name] || KIND_COLORS.unknown} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-400">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: KIND_COLORS[d.name] || KIND_COLORS.unknown }}
                />
                {d.name} ({d.count})
              </div>
            ))}
          </div>
        </div>

        {/* Bar: top sessions */}
        <div className="lg:col-span-2 bg-surface-1 rounded-lg border border-surface-3 p-4">
          <h2 className="text-sm font-semibold mb-3">Top Sessions by Token Usage</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topSessions} layout="vertical" margin={{ left: 80, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis type="number" tickFormatter={formatTokens} tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#d1d5db", fontSize: 11 }}
                width={75}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="tokens" radius={[0, 4, 4, 0]}>
                {topSessions.map((entry) => (
                  <Cell key={entry.fullKey} fill={KIND_COLORS[entry.kind] || KIND_COLORS.unknown} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full session table */}
      <div className="bg-surface-1 rounded-lg border border-surface-3 overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-3">
          {/* Usage Over Time */}
          {history.length > 1 && (
            <>
              <h2 className="text-sm font-semibold mt-6 mb-3">Usage Over Time</h2>
              <div className="bg-surface-1 rounded-lg border border-surface-3 p-4 mb-6">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(v)} />
                    <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} labelStyle={{ color: "#9ca3af" }} formatter={(value: number) => [value.toLocaleString(), "Tokens"]} />
                    <Line type="monotone" dataKey="tokens" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          <h2 className="text-sm font-semibold">All Sessions ({data.sessions.length})</h2>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-2">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-2 font-medium">Session</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Model</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
                <th className="px-4 py-2 font-medium text-right">Input</th>
                <th className="px-4 py-2 font-medium text-right">Output</th>
                <th className="px-4 py-2 font-medium text-right">Context</th>
                <th className="px-4 py-2 font-medium text-right">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-3">
              {[...data.sessions]
                .sort((a, b) => b.totalTokens - a.totalTokens)
                .map((s) => {
                  const ctxPct = s.contextTokens > 0 ? Math.round((s.totalTokens / s.contextTokens) * 100) : 0;
                  return (
                    <tr key={s.key} className="hover:bg-surface-2/50 transition-colors">
                      <td className="px-4 py-2 font-mono text-gray-300 max-w-[200px] truncate" title={s.key}>
                        {sessionLabel(s.key)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{
                            backgroundColor: `${KIND_COLORS[s.kind] || KIND_COLORS.unknown}22`,
                            color: KIND_COLORS[s.kind] || KIND_COLORS.unknown,
                          }}
                        >
                          {s.kind}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-400">{s.model?.replace("claude-", "") || "—"}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-200">{formatTokens(s.totalTokens)}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-400">{formatTokens(s.inputTokens)}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-400">{formatTokens(s.outputTokens)}</td>
                      <td className="px-4 py-2 text-right">
                        {ctxPct > 0 ? (
                          <span className={ctxPct > 80 ? "text-priority-urgent" : "text-gray-400"}>{ctxPct}%</span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-500">{formatAge(s.ageMin)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-surface-1 rounded-lg border border-surface-3 p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-100">{value}</div>
    </div>
  );
}
