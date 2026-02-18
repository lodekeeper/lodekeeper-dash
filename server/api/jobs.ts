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

export { router as jobsRouter };
