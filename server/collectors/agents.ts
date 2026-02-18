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
  // For now, return cached data. The main session updates this via API.
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
