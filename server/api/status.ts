import { Router } from "express";
import type { Request, Response } from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getAgentStatus, readWorkspaceFile } from "../collectors/workspace.js";
import { readJSON, writeJSON } from "../storage/store.js";

const exec = promisify(execFile);

const router = Router();

interface StatusData {
  agentStatus: "idle" | "working" | "busy";
  currentTask: string | null;
  model: string;
  uptime: number;
  lastHeartbeat: string | null;
  contextUsage: number | null;
  tokenUsageToday: number;
  messagesHandledToday: number;
}

interface UsageHistory {
  daily: Array<{
    date: string;
    tokens: number;
    cost: number;
    messages: number;
  }>;
}

const startTime = Date.now();

// Cache for OpenClaw session data (refreshed every 30s)
let sessionCache: { tokens: number; context: number; contextMax: number; compactions: number; model: string; updatedAt: number } = {
  tokens: 0, context: 0, contextMax: 200000, compactions: 0, model: "claude-opus-4-6", updatedAt: 0,
};

async function refreshSessionData() {
  try {
    const { stdout } = await exec("openclaw", ["status", "--json"], { timeout: 10000 });
    const data = JSON.parse(stdout);
    if (data.session) {
      sessionCache = {
        tokens: data.session.tokens?.total || 0,
        context: data.session.context?.used || 0,
        contextMax: data.session.context?.max || 200000,
        compactions: data.session.compactions || 0,
        model: data.session.model || "claude-opus-4-6",
        updatedAt: Date.now(),
      };
    }
  } catch {
    // openclaw status --json may not exist; fall back to parsing text output
    try {
      const { stdout } = await exec("openclaw", ["status"], { timeout: 10000 });
      // Parse context from output like "Context: 164k/200k (82%)"
      const contextMatch = stdout.match(/Context:\s*([\d.]+)k\/([\d.]+)k\s*\((\d+)%\)/);
      if (contextMatch) {
        sessionCache.context = Math.round(parseFloat(contextMatch[1]) * 1000);
        sessionCache.contextMax = Math.round(parseFloat(contextMatch[2]) * 1000);
      }
      // Parse tokens
      const tokenMatch = stdout.match(/Tokens:\s*([\d,]+)\s*in\s*\/\s*([\d,]+)\s*out/);
      if (tokenMatch) {
        sessionCache.tokens = parseInt(tokenMatch[1].replace(/,/g, "")) + parseInt(tokenMatch[2].replace(/,/g, ""));
      }
      const modelMatch = stdout.match(/Model:\s*(\S+)/);
      if (modelMatch) sessionCache.model = modelMatch[1];
      sessionCache.updatedAt = Date.now();
    } catch {
      // keep cached data
    }
  }
}

// Refresh every 30s
setInterval(refreshSessionData, 30000);
setTimeout(refreshSessionData, 3000); // initial fetch

// GET /api/status — main status for header badge + dashboard card
router.get("/", async (_req: Request, res: Response) => {
  const agentInfo = await getAgentStatus();

  const status: StatusData = {
    agentStatus: (agentInfo.status as any) || "idle",
    currentTask: agentInfo.currentTask,
    model: sessionCache.model || "claude-opus-4-6",
    uptime: Date.now() - startTime,
    lastHeartbeat: null,
    contextUsage: sessionCache.contextMax > 0 ? Math.round((sessionCache.context / sessionCache.contextMax) * 100) : null,
    tokenUsageToday: sessionCache.tokens,
    messagesHandledToday: 0,
  };

  res.json(status);
});

// POST /api/status — update from agent
router.post("/", async (req: Request, res: Response) => {
  const { agentStatus, currentTask, contextUsage, tokenUsage } = req.body;

  // Write to agent-status file so it persists
  const WORKSPACE = process.env.WORKSPACE_PATH || "/home/openclaw/.openclaw/workspace";
  const fs = await import("node:fs/promises");
  const path = await import("node:path");

  await fs.writeFile(
    path.join(WORKSPACE, "memory/agent-status.json"),
    JSON.stringify({
      status: agentStatus || "idle",
      currentTask: currentTask || null,
      contextUsage,
      tokenUsage,
      updatedAt: new Date().toISOString(),
    }),
    "utf-8"
  );

  res.json({ ok: true });
});

// GET /api/status/usage — historical token usage
router.get("/usage", async (_req: Request, res: Response) => {
  const history = await readJSON<UsageHistory>("usage-history.json", { daily: [] });
  res.json(history);
});

// POST /api/status/usage — append usage data point
router.post("/usage", async (req: Request, res: Response) => {
  const { date, tokens, cost, messages } = req.body;
  const history = await readJSON<UsageHistory>("usage-history.json", { daily: [] });

  // Upsert for today
  const existing = history.daily.find((d) => d.date === date);
  if (existing) {
    existing.tokens = tokens;
    existing.cost = cost;
    existing.messages = messages;
  } else {
    history.daily.push({ date, tokens, cost, messages });
  }

  // Keep last 90 days
  history.daily = history.daily.slice(-90);
  await writeJSON("usage-history.json", history);

  res.json({ ok: true });
});

export { router as statusRouter };
