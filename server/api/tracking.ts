import { Router } from "express";
import type { Request, Response } from "express";
import { getCachedGitHub, collectGitHub } from "../collectors/github.js";
import { getCachedDiscordThreads, collectDiscordThreads } from "../collectors/discord.js";

const router = Router();

// GET /api/tracking/github
router.get("/github", async (_req: Request, res: Response) => {
  const data = await collectGitHub();
  res.json(data);
});

// GET /api/tracking/discord
router.get("/discord", async (_req: Request, res: Response) => {
  const threads = await collectDiscordThreads();
  res.json({ threads });
});

// GET /api/tracking — combined
router.get("/", async (_req: Request, res: Response) => {
  const [github, threads] = await Promise.all([
    collectGitHub(),
    collectDiscordThreads(),
  ]);
  res.json({ github, discord: { threads } });
});

export { router as trackingRouter };
