import { Router } from "express";
import type { Request, Response } from "express";
import { getCachedAgents, collectAgents } from "../collectors/agents.js";
import { broadcast } from "../ws/hub.js";

const router = Router();

// GET /api/agents — fetch fresh data
router.get("/", async (_req: Request, res: Response) => {
  const data = await collectAgents();
  res.json(data);
});

// POST /api/agents/sessions — update sessions cache (called by Lodekeeper agent)
router.post("/sessions", async (req: Request, res: Response) => {
  const { sessions } = req.body;
  if (Array.isArray(sessions)) {
    updateSessionsCache(sessions);
    broadcast({ type: "agents", data: getCachedAgents() });
  }
  res.json({ ok: true });
});

// POST /api/agents/processes — update processes cache
router.post("/processes", async (req: Request, res: Response) => {
  const { processes } = req.body;
  if (Array.isArray(processes)) {
    updateProcessesCache(processes);
    broadcast({ type: "agents", data: getCachedAgents() });
  }
  res.json({ ok: true });
});

export { router as agentsRouter };
