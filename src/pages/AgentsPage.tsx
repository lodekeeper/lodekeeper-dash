import { useEffect } from "react";
import { useDataStore } from "../stores/dataStore";
import { Bot, Cpu, Clock, Hash, MessageSquare, ExternalLink, Timer } from "lucide-react";

const DISCORD_GUILDS: Record<string, string> = {
  "1197575814494035968": "593655374469660673",  // ChainSafe #lodestar-developer
  "1427995703514239160": "1359927674746835211", // STEEL #lodestar
};

function extractChannelId(key: string): string | null {
  const match = key.match(/channel:(\d+)/);
  return match?.[1] ?? null;
}

function discordLink(channelId: string): string {
  const guildId = DISCORD_GUILDS[channelId] || "593655374469660673";
  return `https://discord.com/channels/${guildId}/${channelId}`;
}

function formatAge(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function kindBadge(kind: string) {
  const colors: Record<string, string> = {
    direct: "bg-accent/20 text-accent",
    group: "bg-indigo-500/20 text-indigo-400",
    cron: "bg-amber-500/20 text-amber-400",
    isolated: "bg-purple-500/20 text-purple-400",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[kind] || "bg-surface-3 text-gray-400"}`}>
      {kind}
    </span>
  );
}

export function AgentsPage() {
  const sessions = useDataStore((s) => s.sessions);
  const fetchAgents = useDataStore((s) => s.fetchAgents);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 15000);
    return () => clearInterval(interval);
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
          {sessions.map((session) => {
            const channelId = extractChannelId(session.key);
            const isDiscord = session.key.includes("discord");
            const isCron = session.key.includes("cron");

            return (
              <div key={session.key} className="bg-surface-1 rounded-lg border border-surface-3 p-4 space-y-3 hover:border-surface-3/80 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {isDiscord ? (
                      <MessageSquare className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    ) : isCron ? (
                      <Timer className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    ) : (
                      <Bot className="w-4 h-4 text-accent flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate">{session.displayName}</span>
                  </div>
                  {kindBadge(session.kind)}
                </div>

                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Cpu className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                    <span className="truncate">{session.model}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Hash className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                    <span>{formatTokens(session.totalTokens)} tokens</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Clock className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                    <span>{formatAge(Date.now() - session.updatedAt)}</span>
                  </div>
                </div>

                {/* Discord channel link */}
                {isDiscord && channelId && (
                  <a
                    href={discordLink(channelId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open in Discord
                  </a>
                )}

                {/* Session key (truncated) */}
                <div className="text-[10px] text-gray-600 font-mono truncate border-t border-surface-3 pt-2" title={session.key}>
                  {session.key}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
