import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { WebSocketServer } from "ws";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter, verifyToken } from "./auth/index.js";
import { tasksRouter } from "./api/tasks.js";
import { trackingRouter } from "./api/tracking.js";
import { agentsRouter } from "./api/agents.js";
import { jobsRouter } from "./api/jobs.js";
import { statusRouter } from "./api/status.js";
import { streamRouter } from "./api/stream.js";
import { usageRouter } from "./api/usage.js";
import { setupWsHub } from "./ws/hub.js";
import { ensureDataDir, loadConfig } from "./storage/store.js";
import { startCollectors } from "./collectors/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 7777;
const HOST = process.env.HOST || "0.0.0.0";

async function main() {
  await ensureDataDir();

  const app = express();
  const server = http.createServer(app);

  // Security
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Required by Tailwind CSS runtime
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));

  // Rate limiting
  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: "Too many auth attempts" },
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { error: "Rate limit exceeded" },
  });

  // Auth routes (public)
  app.use("/api/auth", authLimiter, authRouter);

  // Protected API routes
  app.use("/api/tasks", verifyToken, apiLimiter, tasksRouter);
  app.use("/api/tracking", verifyToken, apiLimiter, trackingRouter);
  app.use("/api/agents", verifyToken, apiLimiter, agentsRouter);
  app.use("/api/jobs", verifyToken, apiLimiter, jobsRouter);
  app.use("/api/status", verifyToken, apiLimiter, statusRouter);
  app.use("/api/stream", verifyToken, apiLimiter, streamRouter);
  app.use("/api/usage", verifyToken, apiLimiter, usageRouter);

  // WebSocket
  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 64 * 1024 });
  setupWsHub(wss);

  // Custom error handler — no stack traces in responses
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Server error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  });

  // Serve static frontend in production
  const clientDist = path.join(__dirname, "../dist/client");
  app.use(express.static(clientDist));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });

  // Start data collectors
  startCollectors();

  server.listen(PORT, HOST, () => {
    console.log(`🌟 Lodekeeper Dashboard running at http://${HOST}:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
