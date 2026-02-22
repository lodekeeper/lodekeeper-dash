import { Router } from "express";
import type { Request, Response } from "express";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const router = Router();
const GATEWAY_URL = "http://127.0.0.1:18789/v1/chat/completions";
const DEFAULT_USER = "dashboard-chat";

interface GatewayConfig {
  gateway?: {
    auth?: {
      token?: string;
    };
  };
}

async function readGatewayToken(): Promise<string> {
  const configPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
  let raw: string;
  try {
    raw = await fs.readFile(configPath, "utf-8");
  } catch {
    throw new Error(`Gateway config not found at ${configPath}`);
  }

  let parsed: GatewayConfig;
  try {
    parsed = JSON.parse(raw) as GatewayConfig;
  } catch {
    throw new Error(`Gateway config at ${configPath} is not valid JSON`);
  }

  const token = parsed.gateway?.auth?.token;
  if (!token) {
    throw new Error(`Missing gateway.auth.token in ${configPath}`);
  }
  return token;
}

async function safeReadBody(req: Request): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === "object") {
    return req.body as Record<string, unknown>;
  }
  return {};
}

router.post("/", async (req: Request, res: Response) => {
  let token: string;
  try {
    token = await readGatewayToken();
  } catch (err) {
    res.status(503).json({
      error: err instanceof Error ? err.message : "Gateway token is unavailable",
    });
    return;
  }

  const requestBody = await safeReadBody(req);
  const stream = Boolean(requestBody.stream);
  const body = {
    ...requestBody,
    user: typeof requestBody.user === "string" && requestBody.user.length > 0 ? requestBody.user : DEFAULT_USER,
  };

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-openclaw-agent-id": "main",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    res.status(503).json({
      error: "OpenClaw gateway is unreachable",
      details: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (!upstream.ok) {
    let details = upstream.statusText;
    try {
      details = await upstream.text();
    } catch {
      // noop
    }
    res.status(upstream.status).json({
      error: "Gateway request failed",
      status: upstream.status,
      details,
    });
    return;
  }

  if (!stream) {
    try {
      const json = await upstream.json();
      res.json(json);
    } catch {
      res.status(502).json({ error: "Gateway returned invalid JSON" });
    }
    return;
  }

  if (!upstream.body) {
    res.status(502).json({ error: "Gateway returned an empty stream" });
    return;
  }

  const contentType = upstream.headers.get("content-type") || "text/event-stream; charset=utf-8";
  console.log("[chat] streaming response, content-type:", contentType);

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const reader = upstream.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        const chunk = Buffer.from(value);
        res.write(chunk);
        // Force flush — critical for SSE through Express
        if (typeof (res as any).flush === "function") {
          (res as any).flush();
        }
      }
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({
        error: "Failed to stream gateway response",
        details: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    res.write(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`);
    res.end();
  } finally {
    reader.releaseLock();
  }
});

export { router as chatRouter };
