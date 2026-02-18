import { useEffect, useRef, useState } from "react";
import { Terminal as TerminalIcon, Pause, Play } from "lucide-react";
import { onWsMessage, sendWsMessage } from "../api/ws";

export function StreamPage() {
  const termRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onWsMessage((msg) => {
      if (msg.type === "stream:data") {
        const data = msg.data as { sessionId: string; data: string };
        setLines((prev) => {
          const next = [...prev, data.data];
          // Keep last 1000 lines
          return next.length > 1000 ? next.slice(-1000) : next;
        });
      }
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (!paused && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines, paused]);

  const subscribe = (sid: string) => {
    if (sessionId) {
      sendWsMessage({ type: "stream:unsubscribe" });
    }
    setSessionId(sid);
    setLines([]);
    if (sid) {
      sendWsMessage({ type: "stream:subscribe", sessionId: sid });
    }
  };

  return (
    <div className="p-6 space-y-4 h-full flex flex-col max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <TerminalIcon className="w-5 h-5" />
          Live Stream
        </h1>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="Session ID..."
            className="px-3 py-1.5 bg-surface-2 border border-surface-3 rounded-lg text-sm focus:outline-none focus:border-accent w-48"
          />
          <button
            onClick={() => subscribe(sessionId)}
            className="px-3 py-1.5 bg-accent hover:bg-accent-hover rounded-lg text-sm font-medium transition-colors"
          >
            Connect
          </button>
          <button
            onClick={() => setPaused((p) => !p)}
            className="p-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors"
            title={paused ? "Resume scroll" : "Pause scroll"}
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex-1 bg-surface-1 rounded-lg border border-surface-3 overflow-hidden">
        <div className="h-full overflow-y-auto p-4 font-mono text-xs leading-5" ref={termRef}>
          {lines.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-600">
              <div className="text-center">
                <TerminalIcon className="w-8 h-8 mx-auto mb-2" />
                <p>No stream connected</p>
                <p className="text-xs mt-1">Enter a session ID and click Connect to watch live output</p>
              </div>
            </div>
          ) : (
            <>
              {lines.map((line, i) => (
                <div key={i} className="text-gray-300 whitespace-pre-wrap break-all">
                  {line}
                </div>
              ))}
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
