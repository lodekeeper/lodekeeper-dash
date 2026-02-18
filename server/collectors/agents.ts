/**
 * Agent collector — reads OpenClaw session data via CLI.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export interface AgentSession {
  key: string;
  kind: string;
  model: string;
  displayName: string;
  totalTokens: number;
  updatedAt: number;
  lastMessage?: string;
  channel?: string;
}

export interface RunningProcess {
  sessionId: string;
  pid?: number;
  command?: string;
  running: boolean;
}

let cachedSessions: AgentSession[] = [];
let cachedProcesses: RunningProcess[] = [];

export async function collectAgents(): Promise<{
  sessions: AgentSession[];
  processes: RunningProcess[];
}> {
  try {
    // Try to get sessions from openclaw CLI
    const { stdout } = await exec("openclaw", ["sessions", "list", "--json"], {
      timeout: 10000,
    });
    const data = JSON.parse(stdout);
    if (Array.isArray(data)) {
      cachedSessions = data.map((s: any) => ({
        key: s.key || s.sessionKey || "unknown",
        kind: s.kind || "main",
        model: s.model || "unknown",
        displayName: s.displayName || s.label || s.key || "Session",
        totalTokens: s.totalTokens || s.tokens || 0,
        updatedAt: s.updatedAt ? new Date(s.updatedAt).getTime() : Date.now(),
        lastMessage: s.lastMessage,
        channel: s.channel,
      }));
    }
  } catch {
    // CLI may not support --json; keep cached data
  }
  return { sessions: cachedSessions, processes: cachedProcesses };
}

export function updateSessionsCache(sessions: AgentSession[]) {
  cachedSessions = sessions;
}

export function updateProcessesCache(processes: RunningProcess[]) {
  cachedProcesses = processes;
}

export function getCachedAgents() {
  return { sessions: cachedSessions, processes: cachedProcesses };
}
