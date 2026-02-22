import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as TerminalIcon, Pause, Play, RefreshCw, Trash2, Radio, Clock, Cpu, Search } from "lucide-react";
import { onWsMessage, sendWsMessage } from "../api/ws";
import { api } from "../api/client";

interface Session {
  key: string;
  kind: string;
  model: string;
  ageMin: number;
  totalTokens: number;
  contextTokens: number;
  inputTokens: number;
  outputTokens: number;
}

function formatAge(min: number): string {
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function sessionLabel(key: string): string {
  // "agent:main:main" → "main"
  // "agent:main:discord:channel:123" → "discord:123"
  // "agent:main:cron:abc:run:xyz" → "cron:abc (run)"
  const parts = key.split(":");
  if (parts.length <= 3) return parts[parts.length - 1];
  if (parts[2] === "discord") return `discord:${parts[parts.length - 1].slice(0, 8)}…`;
  if (parts[2] === "cron") {
    const cronId = parts[3]?.slice(0, 8);
    return parts.includes("run") ? `cron:${cronId}… (run)` : `cron:${cronId}…`;
  }
  return parts.slice(2).join(":");
}

function kindBadge(kind: string) {
  const colors: Record<string, string> = {
    direct: "bg-accent/20 text-accent",
    discord: "bg-indigo-500/20 text-indigo-400",
    cron: "bg-amber-500/20 text-amber-400",
    isolated: "bg-purple-500/20 text-purple-400",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[kind] || "bg-surface-3 text-gray-400"}`}>
      {kind}
    </span>
  );
}

export function StreamPage() {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const fitRef = useRef<any>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [filter, setFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const bufferRef = useRef<string[]>([]);
  const tabBuffersRef = useRef<Map<string, string[]>>(new Map());

  // Initialize xterm.js
  useEffect(() => {
    let term: any;
    let fit: any;

    async function initTerminal() {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      const { SearchAddon } = await import("@xterm/addon-search");
      await import("@xterm/xterm/css/xterm.css");

      if (!termRef.current) return;

      term = new Terminal({
        theme: {
          background: "#0f1117",
          foreground: "#d1d5db",
          cursor: "#6366f1",
          selectionBackground: "#6366f133",
          black: "#1f2937",
          red: "#ef4444",
          green: "#22c55e",
          yellow: "#eab308",
          blue: "#6366f1",
          magenta: "#a855f7",
          cyan: "#06b6d4",
          white: "#d1d5db",
        },
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        lineHeight: 1.4,
        cursorBlink: false,
        scrollback: 5000,
        convertEol: true,
      });

      fit = new FitAddon();
      const search = new SearchAddon();
      term.loadAddon(fit);
      term.loadAddon(search);
      (window as any).__xtermSearch = search;
      term.open(termRef.current);
      fit.fit();

      term.writeln("\x1b[90m🌟 Lodekeeper Live Stream\x1b[0m");
      term.writeln("\x1b[90mSelect a session from the sidebar to connect.\x1b[0m");
      term.writeln("");

      xtermRef.current = term;
      fitRef.current = fit;

      const resizeObserver = new ResizeObserver(() => {
        try { fit.fit(); } catch { /* ignore */ }
      });
      resizeObserver.observe(termRef.current);

      return () => {
        resizeObserver.disconnect();
        term.dispose();
      };
    }

    const cleanup = initTerminal();
    return () => { cleanup.then((fn) => fn?.()); };
  }, []);

  // Listen for stream data
  useEffect(() => {
    const unsub = onWsMessage((msg) => {
      if (msg.type === "stream:data") {
        const data = msg.data as { sessionId: string; data: string };
        // Buffer for all open tabs
        const buf = tabBuffersRef.current.get(data.sessionId);
        if (buf) buf.push(data.data);
        // Only write to terminal if this is the active tab
        if (data.sessionId === activeTab) {
          if (paused) {
            bufferRef.current.push(data.data);
          } else {
            xtermRef.current?.write(data.data);
          }
        }
      }
      if (msg.type === "stream:subscribed") {
        if ((msg as any).sessionId === activeTab) {
          xtermRef.current?.writeln(`\x1b[32m✓ Connected to ${(msg as any).sessionId}\x1b[0m\n`);
        }
      }
    });
    return unsub;
  }, [paused]);

  // Flush buffer when unpausing
  useEffect(() => {
    if (!paused && bufferRef.current.length > 0) {
      for (const line of bufferRef.current) {
        xtermRef.current?.write(line);
      }
      bufferRef.current = [];
    }
  }, [paused]);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const data = await api.get<{ sessions: Session[]; total: number }>("/api/stream/sessions");
      setSessions(data.sessions || []);
    } catch {
      setSessions([]);
    }
    setLoadingSessions(false);
  }, []);

  useEffect(() => {
    fetchSessions();
    // Refresh session list every 60s
    const interval = setInterval(fetchSessions, 60000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const connect = useCallback((sessionKey: string) => {
    // If tab already open, just switch to it
    if (openTabs.includes(sessionKey)) {
      switchTab(sessionKey);
      return;
    }

    // Open new tab
    setOpenTabs((prev) => [...prev, sessionKey]);
    tabBuffersRef.current.set(sessionKey, []);
    setActiveTab(sessionKey);
    setSelectedSession(sessionKey);
    setConnected(true);
    xtermRef.current?.clear();
    xtermRef.current?.writeln(`\x1b[90mConnecting to ${sessionKey}...\x1b[0m`);
    sendWsMessage({ type: "stream:subscribe", sessionId: sessionKey });
  }, [openTabs]);

  const switchTab = useCallback((sessionKey: string) => {
    if (sessionKey === activeTab) return;
    setActiveTab(sessionKey);
    setSelectedSession(sessionKey);
    // Replay buffered output for this tab
    xtermRef.current?.clear();
    const buf = tabBuffersRef.current.get(sessionKey) || [];
    for (const line of buf) {
      xtermRef.current?.write(line);
    }
  }, [activeTab]);

  const closeTab = useCallback((sessionKey: string) => {
    sendWsMessage({ type: "stream:unsubscribe", sessionId: sessionKey });
    tabBuffersRef.current.delete(sessionKey);
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t !== sessionKey);
      if (activeTab === sessionKey) {
        const newActive = next.length > 0 ? next[next.length - 1] : null;
        setActiveTab(newActive);
        setSelectedSession(newActive);
        if (newActive) {
          switchTab(newActive);
        } else {
          setConnected(false);
          xtermRef.current?.clear();
          xtermRef.current?.writeln("\x1b[90mSelect a session from the sidebar to connect.\x1b[0m");
        }
      }
      return next;
    });
  }, [activeTab, switchTab]);

  const disconnect = useCallback(() => {
    if (activeTab) {
      closeTab(activeTab);
    }
  }, [activeTab, closeTab]);

  const clearTerminal = useCallback(() => {
    xtermRef.current?.clear();
  }, []);

  const filtered = sessions.filter((s) =>
    !filter || s.key.toLowerCase().includes(filter.toLowerCase()) || s.kind.includes(filter.toLowerCase())
  );

  // Group sessions: recent (< 60 min) and older
  const recent = filtered.filter((s) => s.ageMin < 60);
  const older = filtered.filter((s) => s.ageMin >= 60);

  return (
    <div className="p-4 md:p-6 h-full flex flex-col md:flex-row gap-4 max-w-[1600px] mx-auto">
      {/* Session sidebar — collapsible on mobile */}
      <div className="hidden md:flex w-72 flex-shrink-0 flex-col bg-surface-1 rounded-lg border border-surface-3 overflow-hidden">
        <div className="p-3 border-b border-surface-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" />
              Sessions ({sessions.length})
            </h2>
            <button
              onClick={fetchSessions}
              disabled={loadingSessions}
              className="p-1 hover:bg-surface-2 rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSessions ? "animate-spin" : ""}`} />
            </button>
          </div>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter sessions..."
            className="w-full px-2.5 py-1.5 bg-surface-2 border border-surface-3 rounded text-xs focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Built-in log streams */}
          <div>
            <div className="px-3 py-1.5 text-[10px] font-medium uppercase text-gray-500 bg-surface-0/50">
              Log Streams
            </div>
            {[
              { key: "gateway-logs", label: "Gateway Logs", kind: "system" },
              { key: "dashboard-logs", label: "Dashboard Logs", kind: "system" },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => connect(s.key)}
                className={`w-full px-3 py-2 text-left border-l-2 transition-colors hover:bg-surface-2 ${
                  selectedSession === s.key ? "border-accent bg-accent/10" : "border-transparent"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-200">{s.label}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400">live</span>
                </div>
              </button>
            ))}
          </div>

          {recent.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-medium uppercase text-gray-500 bg-surface-0/50">
                Active ({"<"}1h)
              </div>
              {recent.map((s) => (
                <SessionRow
                  key={s.key}
                  session={s}
                  selected={selectedSession === s.key}
                  onClick={() => connect(s.key)}
                />
              ))}
            </div>
          )}
          {older.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-medium uppercase text-gray-500 bg-surface-0/50">
                Older
              </div>
              {older.map((s) => (
                <SessionRow
                  key={s.key}
                  session={s}
                  selected={selectedSession === s.key}
                  onClick={() => connect(s.key)}
                />
              ))}
            </div>
          )}
          {filtered.length === 0 && (
            <div className="p-4 text-xs text-gray-500 text-center">
              {loadingSessions ? "Loading..." : "No sessions found"}
            </div>
          )}
        </div>
      </div>

      {/* Terminal area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile: session count indicator (sessions panel hidden) */}
        <div className="md:hidden mb-2 px-3 py-2 bg-surface-1 rounded-lg border border-surface-3 text-xs text-gray-400">
          <Radio className="w-3.5 h-3.5 inline mr-1.5" />
          {sessions.length} sessions — use desktop for session picker
        </div>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg md:text-xl font-semibold flex items-center gap-2">
            <TerminalIcon className="w-5 h-5" />
            Live Stream
            {connected && selectedSession && (
              <span className="text-sm font-normal text-gray-400 ml-2">
                → {sessionLabel(selectedSession)}
              </span>
            )}
          </h1>
          <div className="flex items-center gap-1.5">
            {connected && (
              <button
                onClick={disconnect}
                className="px-2.5 py-1 bg-priority-urgent/20 text-priority-urgent hover:bg-priority-urgent/30 rounded text-xs font-medium transition-colors"
              >
                Disconnect
              </button>
            )}
            <button
              onClick={() => setPaused((p) => !p)}
              className={`p-1.5 rounded transition-colors ${
                paused ? "bg-priority-normal/20 text-priority-normal" : "bg-surface-2 hover:bg-surface-3"
              }`}
              title={paused ? "Resume" : "Pause"}
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                setShowSearch((s) => !s);
                if (showSearch) {
                  (window as any).__xtermSearch?.clearDecorations();
                  setSearchTerm("");
                }
              }}
              className={`p-1.5 rounded transition-colors ${showSearch ? "bg-accent/20 text-accent" : "bg-surface-2 hover:bg-surface-3"}`}
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={clearTerminal}
              className="p-1.5 bg-surface-2 hover:bg-surface-3 rounded transition-colors"
              title="Clear"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {connected && (
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
            <span className="w-2 h-2 rounded-full bg-status-idle animate-pulse" />
            Streaming
            {paused && <span className="text-priority-normal ml-1">⏸ Paused</span>}
          </div>
        )}

        {/* Tab bar */}
        {openTabs.length > 0 && (
          <div className="flex items-center gap-0.5 mb-2 overflow-x-auto">
            {openTabs.map((tab) => (
              <div
                key={tab}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs cursor-pointer transition-colors ${
                  activeTab === tab ? "bg-[#0f1117] text-gray-200 border border-b-0 border-surface-3" : "bg-surface-2 text-gray-500 hover:text-gray-300"
                }`}
                onClick={() => switchTab(tab)}
              >
                <span className="truncate max-w-[120px]">{sessionLabel(tab)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); closeTab(tab); }}
                  className="ml-1 text-gray-600 hover:text-gray-300 text-[10px]"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {showSearch && (
          <div className="flex items-center gap-2 bg-surface-1 border border-surface-3 rounded-lg px-3 py-1.5 mb-2">
            <Search className="w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (e.target.value) {
                  (window as any).__xtermSearch?.findNext(e.target.value);
                } else {
                  (window as any).__xtermSearch?.clearDecorations();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (e.shiftKey) {
                    (window as any).__xtermSearch?.findPrevious(searchTerm);
                  } else {
                    (window as any).__xtermSearch?.findNext(searchTerm);
                  }
                }
                if (e.key === "Escape") {
                  setShowSearch(false);
                  (window as any).__xtermSearch?.clearDecorations();
                  setSearchTerm("");
                }
              }}
              placeholder="Search... (Enter = next, Shift+Enter = prev, Esc = close)"
              className="flex-1 bg-transparent text-sm text-gray-200 focus:outline-none placeholder-gray-600"
              autoFocus
            />
          </div>
        )}

        <div
          className="flex-1 bg-[#0f1117] rounded-lg border border-surface-3 overflow-hidden min-h-[400px]"
          ref={termRef}
        />
      </div>
    </div>
  );
}

function SessionRow({ session, selected, onClick }: { session: Session; selected: boolean; onClick: () => void }) {
  const contextPct = session.contextTokens > 0 ? Math.round((session.totalTokens / session.contextTokens) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2 text-left border-l-2 transition-colors hover:bg-surface-2 ${
        selected ? "border-accent bg-accent/10" : "border-transparent"
      }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-medium text-gray-200 truncate max-w-[140px]">
          {sessionLabel(session.key)}
        </span>
        {kindBadge(session.kind)}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" />
          {formatAge(session.ageMin)}
        </span>
        <span className="flex items-center gap-0.5">
          <Cpu className="w-2.5 h-2.5" />
          {formatTokens(session.totalTokens)}
        </span>
        {contextPct > 0 && (
          <span className={contextPct > 80 ? "text-priority-urgent" : ""}>
            {contextPct}%
          </span>
        )}
      </div>
    </button>
  );
}
