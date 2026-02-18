import { Router } from "express";
import type { Request, Response } from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const router = Router();

interface ExecProcess {
  sessionId: string;
  pid?: number;
  command?: string;
  running: boolean;
}

// GET /api/stream/processes — list available exec processes
router.get("/processes", async (_req: Request, res: Response) => {
  try {
    // Try reading from openclaw exec process list
    const { stdout } = await exec("openclaw", ["exec", "list", "--json"], {
      timeout: 10000,
    });
    const procs = JSON.parse(stdout);
    res.json({ processes: procs });
  } catch {
    // Fallback: return empty list
    res.json({ processes: [] });
  }
});

// GET /api/stream/log/:sessionId — get recent log output
router.get("/log/:sessionId", async (req: Request, res: Response) => {
  try {
    const { stdout } = await exec(
      "openclaw",
      ["exec", "log", req.params.sessionId, "--limit", "200", "--json"],
      { timeout: 10000 }
    );
    res.json({ log: stdout });
  } catch {
    res.json({ log: "" });
  }
});

export { router as streamRouter };
