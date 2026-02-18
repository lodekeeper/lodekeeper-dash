import { useEffect } from "react";
import { useDataStore } from "../stores/dataStore";
import { Bot, Cpu, Clock, Hash } from "lucide-react";

export function AgentsPage() {
  const sessions = useDataStore((s) => s.sessions);
  const fetchAgents = useDataStore((s) => s.fetchAgents);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold">Agents & Sessions</h1>

      {sessions.length === 0 ? (
        <div className="bg-surface-1 rounded-lg border border-surface-3 p-8 text-center">
          <Bot className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No active sessions</p>
          <p className="text-sm text-gray-600 mt-1">Sessions will appear when the agent is running</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <div key={session.key} className="bg-surface-1 rounded-lg border border-surface-3 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-accent" />
                  <span className="text-sm font-medium truncate max-w-[200px]">{session.displayName}</span>
                </div>
                <span className="text-xs text-gray-500 bg-surface-2 px-1.5 py-0.5 rounded">{session.kind}</span>
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <Cpu className="w-3.5 h-3.5 text-gray-600" />
                  <span className="truncate">{session.model}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Hash className="w-3.5 h-3.5 text-gray-600" />
                  <span>{(session.totalTokens / 1000).toFixed(1)}k tokens</span>
                </div>
                {session.channel && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Clock className="w-3.5 h-3.5 text-gray-600" />
                    <span>via {session.channel}</span>
                  </div>
                )}
              </div>

              {session.lastMessage && (
                <p className="text-xs text-gray-500 border-t border-surface-3 pt-2 line-clamp-2">{session.lastMessage}</p>
              )}

              <div className="text-xs text-gray-600">
                Updated {new Date(session.updatedAt).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
