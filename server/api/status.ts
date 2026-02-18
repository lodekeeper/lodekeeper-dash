import { Router } from "express";
import type { Request, Response } from "express";
import { getAgentStatus, readWorkspaceFile } from "../collectors/workspace.js";
import { readJSON, writeJSON } from "../storage/store.js";

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

// GET /api/status — main status for header badge + dashboard card
router.get("/", async (_req: Request, res: Response) => {
  const agentInfo = await getAgentStatus();

  const status: StatusData = {
    agentStatus: (agentInfo.status as any) || "idle",
    currentTask: agentInfo.currentTask,
    model: "claude-opus-4-6",
    uptime: Date.now() - startTime,
    lastHeartbeat: null,
    contextUsage: null,
    tokenUsageToday: 0,
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
