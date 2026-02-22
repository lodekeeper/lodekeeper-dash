/**
 * Agent collector — reads OpenClaw session data via CLI.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const NVM_NODE = "/home/openclaw/.nvm/versions/node/v22.22.0/bin";

export interface AgentSession {
  key: string;
  kind: string;
  model: string;
  displayName: string;
  totalTokens: number;
  ageMin: number;
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

function sessionLabel(key: string): string {
  const parts = key.split(":");
  if (parts.length <= 3 && parts[2] === "main") return "Main Session";
  if (parts.includes("discord")) {
    const channelIdx = parts.indexOf("channel");
    return channelIdx >= 0 ? `Discord #${parts[channelIdx + 1]?.slice(-6) || "?"}` : "Discord";
  }
  if (parts.includes("cron")) {
    if (parts.includes("run")) return `Cron Run ${parts[parts.indexOf("run") + 1]?.slice(0, 8) || "?"}`;
    return `Cron ${parts[parts.indexOf("cron") + 1]?.slice(0, 8) || "?"}`;
  }
  return parts.slice(2).join(":") || key;
}

// Old collectAgents replaced by version with CLI process detection below

export interface CLIProcess {
  pid: number;
  command: string;
  agent: string; // "codex" | "claude" | "other"
  uptime: string;
}

let cachedCLIProcesses: CLIProcess[] = [];

async function detectCLIProcesses(): Promise<CLIProcess[]> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const exec = promisify(execFile);

  try {
    const { stdout } = await exec("ps", ["-eo", "pid,etime,args", "--no-headers"], { timeout: 5000 });
    const procs: CLIProcess[] = [];
    for (const line of stdout.split("\n")) {
      const match = line.trim().match(/^(\d+)\s+(\S+)\s+(.+)$/);
      if (!match) continue;
      const [, pid, etime, args] = match;
      const lower = args.toLowerCase();
      if (lower.includes("codex") && !lower.includes("node_modules")) {
        procs.push({ pid: Number(pid), command: args.slice(0, 120), agent: "codex", uptime: etime });
      } else if (lower.includes("claude") && lower.includes("cli") && !lower.includes("node_modules")) {
        procs.push({ pid: Number(pid), command: args.slice(0, 120), agent: "claude", uptime: etime });
      }
    }
    cachedCLIProcesses = procs;
    return procs;
  } catch {
    return cachedCLIProcesses;
  }
}

export async function collectAgents(): Promise<{
  sessions: AgentSession[];
  processes: RunningProcess[];
  cliProcesses: CLIProcess[];
}> {
  const cliProcs = await detectCLIProcesses();

  try {
    const { stdout } = await exec(
      `${NVM_NODE}/openclaw`,
      ["sessions", "--json", "--active", "120"],
      { timeout: 15000, env: { ...process.env, PATH: `${NVM_NODE}:${process.env.PATH}` } }
    );
    const data = JSON.parse(stdout);
    if (data.sessions && Array.isArray(data.sessions)) {
      cachedSessions = data.sessions.map((s: any) => ({
        key: s.key,
        kind: s.kind || "unknown",
        model: s.model || "unknown",
        displayName: sessionLabel(s.key),
        totalTokens: s.totalTokens || 0,
        ageMin: Math.round((s.ageMs || 0) / 60000),
        updatedAt: Date.now() - (s.ageMs || 0),
      }));
    }
  } catch (err: any) {
    console.error("Agent collector error:", err.message);
  }
  return { sessions: cachedSessions, processes: cachedProcesses, cliProcesses: cachedCLIProcesses };
}

export function getCachedAgents() {
  return { sessions: cachedSessions, processes: cachedProcesses, cliProcesses: cachedCLIProcesses };
}

export function updateSessionsCache(sessions: AgentSession[]) {
  cachedSessions = sessions;
}

export function updateProcessesCache(processes: RunningProcess[]) {
  cachedProcesses = processes;
}
