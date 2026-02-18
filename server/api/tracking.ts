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

// GET /api/tracking/pr-comments/:number — fetch recent comments for a PR
router.get("/pr-comments/:number", async (req: Request, res: Response) => {
  const prNumber = req.params.number;
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const exec = promisify(execFile);

  try {
    const { stdout } = await exec("gh", [
      "api",
      `repos/ChainSafe/lodestar/pulls/${prNumber}/comments`,
      "--jq",
      ".[-10:] | .[] | {id, author: .user.login, body: .body, createdAt: .created_at, path: .path}",
    ], { timeout: 15000 });

    const comments = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line: string) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);

    // Also fetch issue comments (non-review comments)
    const { stdout: issueStdout } = await exec("gh", [
      "api",
      `repos/ChainSafe/lodestar/issues/${prNumber}/comments`,
      "--jq",
      ".[-5:] | .[] | {id, author: .user.login, body: .body, createdAt: .created_at}",
    ], { timeout: 15000 });

    const issueComments = issueStdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line: string) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);

    const all = [...comments, ...issueComments]
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    res.json({ comments: all });
  } catch (err: any) {
    res.json({ comments: [], error: err.message });
  }
});

export { router as trackingRouter };
