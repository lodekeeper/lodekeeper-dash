import { Router } from "express";
import type { Request, Response } from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(execFile);
const router = Router();

const NVM_NODE = "/home/openclaw/.nvm/versions/node/v22.22.0/bin";
const ENV = { ...process.env, PATH: `${NVM_NODE}:${process.env.PATH}` };

interface SessionInfo {
  key: string;
  kind: string;
  model: string;
  ageMin: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  label: string;
}

function sessionLabel(key: string): string {
  // agent:main:main → Main
  // agent:main:discord:channel:123 → Discord #123
  // agent:main:cron:abc → Cron abc
  // agent:main:cron:abc:run:xyz → Cron Run xyz
  const parts = key.split(":");
  if (parts.length <= 3 && parts[2] === "main") return "Main Session";
  if (parts.includes("discord")) {
    const channelIdx = parts.indexOf("channel");
    return channelIdx >= 0 ? `Discord #${parts[channelIdx + 1]?.slice(-6) || "?"}` : "Discord";
  }
  if (parts.includes("cron")) {
    if (parts.includes("run")) {
      const runId = parts[parts.indexOf("run") + 1]?.slice(0, 8) || "?";
      return `Cron Run ${runId}`;
    }
    const cronId = parts[parts.indexOf("cron") + 1]?.slice(0, 8) || "?";
    return `Cron ${cronId}`;
  }
  if (parts.includes("spawn")) return `Sub-agent ${parts[parts.length - 1]?.slice(0, 8) || "?"}`;
  return key.split(":").slice(2).join(":") || key;
}

// GET /api/stream/sessions — list OpenClaw sessions
router.get("/sessions", async (_req: Request, res: Response) => {
  try {
    const { stdout } = await execAsync(
      `${NVM_NODE}/openclaw`,
      ["sessions", "--json"],
      { timeout: 15000, env: ENV }
    );
    const data = JSON.parse(stdout);
    const sessions: SessionInfo[] = (data.sessions || []).map((s: any) => ({
      key: s.key,
      kind: s.kind || "unknown",
      model: s.model || "unknown",
      ageMin: Math.round((s.ageMs || 0) / 60000),
      totalTokens: s.totalTokens || 0,
      inputTokens: s.inputTokens || 0,
      outputTokens: s.outputTokens || 0,
      label: sessionLabel(s.key),
    }));
    res.json({ sessions, total: data.count || sessions.length });
  } catch (err: any) {
    console.error("Failed to list sessions:", err.message);
    res.json({ sessions: [], total: 0 });
  }
});

export { router as streamRouter };
