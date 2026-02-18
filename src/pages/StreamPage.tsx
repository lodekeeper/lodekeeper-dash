import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as TerminalIcon, Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import { onWsMessage, sendWsMessage } from "../api/ws";
import { api } from "../api/client";

interface ExecProcess {
  sessionId: string;
  pid?: number;
  command?: string;
  running: boolean;
}

export function StreamPage() {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const fitRef = useRef<any>(null);
  const [sessionId, setSessionId] = useState("");
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [processes, setProcesses] = useState<ExecProcess[]>([]);
  const [loadingProcesses, setLoadingProcesses] = useState(false);
  const bufferRef = useRef<string[]>([]);

  // Initialize xterm.js
  useEffect(() => {
    let term: any;
    let fit: any;

    async function initTerminal() {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      // Import xterm CSS
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
      term.loadAddon(fit);
      term.open(termRef.current);
      fit.fit();

      term.writeln("\x1b[90m🌟 Lodekeeper Live Stream\x1b[0m");
      term.writeln("\x1b[90mSelect a process or enter a session ID to connect.\x1b[0m");
      term.writeln("");

      xtermRef.current = term;
      fitRef.current = fit;

      // Handle resize
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
        if (paused) {
          bufferRef.current.push(data.data);
        } else {
          xtermRef.current?.write(data.data);
        }
      }
      if (msg.type === "stream:subscribed") {
        xtermRef.current?.writeln(`\x1b[32m✓ Connected to ${(msg as any).sessionId}\x1b[0m\n`);
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

  const fetchProcesses = useCallback(async () => {
    setLoadingProcesses(true);
    try {
      const data = await api.get<{ processes: ExecProcess[] }>("/api/stream/processes");
      setProcesses(data.processes || []);
    } catch {
      setProcesses([]);
    }
    setLoadingProcesses(false);
  }, []);

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  const connect = useCallback((sid: string) => {
    if (!sid) return;
    if (connected) {
      sendWsMessage({ type: "stream:unsubscribe" });
    }
    setSessionId(sid);
    setConnected(true);
    xtermRef.current?.clear();
    xtermRef.current?.writeln(`\x1b[90mConnecting to ${sid}...\x1b[0m`);
    sendWsMessage({ type: "stream:subscribe", sessionId: sid });
  }, [connected]);

  const disconnect = useCallback(() => {
    sendWsMessage({ type: "stream:unsubscribe" });
    setConnected(false);
    xtermRef.current?.writeln("\n\x1b[31m✗ Disconnected\x1b[0m");
  }, []);

  const clearTerminal = useCallback(() => {
    xtermRef.current?.clear();
  }, []);

  return (
    <div className="p-6 space-y-4 h-full flex flex-col max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <TerminalIcon className="w-5 h-5" />
          Live Stream
        </h1>
        <div className="flex items-center gap-2">
          {/* Process selector */}
          {processes.length > 0 && (
            <select
              value={sessionId}
              onChange={(e) => {
                if (e.target.value) connect(e.target.value);
              }}
              className="px-3 py-1.5 bg-surface-2 border border-surface-3 rounded-lg text-sm focus:outline-none focus:border-accent"
            >
              <option value="">Select process...</option>
              {processes.map((p) => (
                <option key={p.sessionId} value={p.sessionId}>
                  {p.sessionId} {p.running ? "🟢" : "⚪"} {p.command ? `(${p.command.slice(0, 30)})` : ""}
                </option>
              ))}
            </select>
          )}

          {/* Manual session ID */}
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && connect(sessionId)}
            placeholder="Session ID..."
            className="px-3 py-1.5 bg-surface-2 border border-surface-3 rounded-lg text-sm focus:outline-none focus:border-accent w-40"
          />

          {connected ? (
            <button
              onClick={disconnect}
              className="px-3 py-1.5 bg-priority-urgent/20 text-priority-urgent hover:bg-priority-urgent/30 rounded-lg text-sm font-medium transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => connect(sessionId)}
              disabled={!sessionId}
              className="px-3 py-1.5 bg-accent hover:bg-accent-hover rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
            >
              Connect
            </button>
          )}

          <button
            onClick={() => fetchProcesses()}
            disabled={loadingProcesses}
            className="p-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors"
            title="Refresh processes"
          >
            <RefreshCw className={`w-4 h-4 ${loadingProcesses ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setPaused((p) => !p)}
            className={`p-1.5 rounded-lg transition-colors ${
              paused ? "bg-priority-normal/20 text-priority-normal" : "bg-surface-2 hover:bg-surface-3"
            }`}
            title={paused ? "Resume" : "Pause"}
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>

          <button
            onClick={clearTerminal}
            className="p-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors"
            title="Clear terminal"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Connection status */}
      {connected && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full bg-status-idle animate-pulse" />
          Connected to <code className="bg-surface-2 px-1.5 py-0.5 rounded">{sessionId}</code>
          {paused && <span className="text-priority-normal ml-2">⏸ Paused</span>}
        </div>
      )}

      {/* Terminal */}
      <div
        className="flex-1 bg-[#0f1117] rounded-lg border border-surface-3 overflow-hidden min-h-[400px]"
        ref={termRef}
      />
    </div>
  );
}
