import { Router } from "express";
import type { Request, Response } from "express";
import { getCachedCronJobs, collectCronJobs } from "../collectors/cron.js";
import { parseHeartbeat } from "../collectors/workspace.js";

const router = Router();

// GET /api/jobs
router.get("/", async (_req: Request, res: Response) => {
  const [cronJobs, heartbeat] = await Promise.all([
    collectCronJobs(),
    parseHeartbeat(),
  ]);
  res.json({ cronJobs, heartbeat });
});

// GET /api/jobs/cron
router.get("/cron", async (_req: Request, res: Response) => {
  const jobs = await collectCronJobs();
  res.json({ jobs });
});

// GET /api/jobs/heartbeat
router.get("/heartbeat", async (_req: Request, res: Response) => {
  const heartbeat = await parseHeartbeat();
  res.json(heartbeat);
});

// GET /api/jobs/runs/:jobId — fetch run history for a cron job
router.get("/runs/:jobId", async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const exec = promisify(execFile);
  const NVM_NODE = "/home/openclaw/.nvm/versions/node/v22.22.0/bin";

  try {
    const { stdout } = await exec(
      `${NVM_NODE}/openclaw`,
      ["cron", "runs", jobId, "--json"],
      { timeout: 15000, env: { ...process.env, PATH: `${NVM_NODE}:${process.env.PATH}` } }
    );
    const runs = JSON.parse(stdout);
    res.json({ runs: Array.isArray(runs) ? runs.slice(0, 20) : [] });
  } catch (err: any) {
    // Fallback: try via CLI without --json
    res.json({ runs: [], error: err.message });
  }
});

export { router as jobsRouter };
