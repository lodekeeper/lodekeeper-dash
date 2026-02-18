import { Router } from "express";
import type { Request, Response } from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const exec = promisify(execFile);
const router = Router();

const NVM_NODE = "/home/openclaw/.nvm/versions/node/v22.22.0/bin";
const DATA_DIR = path.join(process.cwd(), "data");

interface SessionUsage {
  key: string;
  kind: string;
  category: string; // "main" | "heartbeat" | "discord" | "cron" | "sub-agent" | "other"
  model: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  contextTokens: number;
  ageMin: number;
}

function categorizeSession(key: string, kind: string): string {
  if (key === "agent:main:main") return "main";
  if (key.includes(":discord:")) return "discord";
  if (key.includes(":cron:") && key.includes(":run:")) return "cron-run";
  if (key.includes(":cron:")) return "cron";
  if (kind === "isolated") return "sub-agent";
  return "other";
}

// GET /api/usage — token usage breakdown
router.get("/", async (_req: Request, res: Response) => {
  try {
    const { stdout } = await exec(
      `${NVM_NODE}/node`,
      [`${NVM_NODE}/openclaw`, "sessions", "--json"],
      { timeout: 15000, env: { ...process.env, PATH: `${NVM_NODE}:${process.env.PATH}` } }
    );
    const data = JSON.parse(stdout);

    const sessions: SessionUsage[] = (data.sessions || []).map((s: any) => ({
      key: s.key,
      kind: s.kind,
      category: categorizeSession(s.key, s.kind),
      model: s.model || "unknown",
      totalTokens: s.totalTokens || 0,
      inputTokens: s.inputTokens || 0,
      outputTokens: s.outputTokens || 0,
      contextTokens: s.contextTokens || 0,
      ageMin: Math.round(s.ageMs / 60000),
    }));

    // Aggregate by category
    const byCategory: Record<string, { totalTokens: number; inputTokens: number; outputTokens: number; sessions: number }> = {};
    for (const s of sessions) {
      if (!byCategory[s.category]) {
        byCategory[s.category] = { totalTokens: 0, inputTokens: 0, outputTokens: 0, sessions: 0 };
      }
      byCategory[s.category].totalTokens += s.totalTokens;
      byCategory[s.category].inputTokens += s.inputTokens;
      byCategory[s.category].outputTokens += s.outputTokens;
      byCategory[s.category].sessions += 1;
    }

    // Grand total
    const grandTotal = sessions.reduce((acc, s) => acc + s.totalTokens, 0);

    // Top sessions by usage
    const topSessions = [...sessions]
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .slice(0, 15)
      .map((s) => ({
        key: s.key,
        category: s.category,
        model: s.model,
        totalTokens: s.totalTokens,
        inputTokens: s.inputTokens,
        outputTokens: s.outputTokens,
        ageMin: s.ageMin,
      }));

    // Load historical snapshots if available
    let history: any[] = [];
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, "usage-history.json"), "utf-8");
      history = JSON.parse(raw);
    } catch { /* no history yet */ }

    res.json({
      grandTotal,
      byCategory,
      topSessions,
      sessionCount: sessions.length,
      history,
    });
  } catch (err: any) {
    res.json({ grandTotal: 0, byCategory: {}, topSessions: [], sessionCount: 0, history: [], error: err.message });
  }
});

// POST /api/usage/snapshot — save current usage for historical tracking (called by collector)
router.post("/snapshot", async (_req: Request, res: Response) => {
  try {
    const { stdout } = await exec(
      `${NVM_NODE}/node`,
      [`${NVM_NODE}/openclaw`, "sessions", "--json"],
      { timeout: 15000, env: { ...process.env, PATH: `${NVM_NODE}:${process.env.PATH}` } }
    );
    const data = JSON.parse(stdout);
    const totalTokens = (data.sessions || []).reduce((acc: number, s: any) => acc + (s.totalTokens || 0), 0);

    const histPath = path.join(DATA_DIR, "usage-history.json");
    let history: any[] = [];
    try {
      const raw = await fs.readFile(histPath, "utf-8");
      history = JSON.parse(raw);
    } catch { /* first snapshot */ }

    history.push({
      timestamp: Date.now(),
      totalTokens,
      sessionCount: data.sessions?.length || 0,
    });

    // Keep last 7 days of hourly snapshots (~168 entries)
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    history = history.filter((h: any) => h.timestamp > weekAgo);

    await fs.writeFile(histPath, JSON.stringify(history, null, 2));
    res.json({ ok: true, entries: history.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as usageRouter };
