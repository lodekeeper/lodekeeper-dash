/**
 * WebSocket hub — manages connections, auth, broadcasting, and terminal streams.
 */
import type { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { spawn, type ChildProcess } from "node:child_process";

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  username?: string;
  authenticated?: boolean;
  streamSubscription?: string;
}

const clients = new Set<AuthenticatedSocket>();

// Active log tail processes per stream subscription
const activeStreams = new Map<string, { proc: ChildProcess; refCount: number }>();

const NVM_NODE = "/home/openclaw/.nvm/versions/node/v22.22.0/bin";

function startLogStream(sessionId: string): ChildProcess | null {
  // For "gateway-logs", tail the openclaw systemd journal
  if (sessionId === "gateway-logs") {
    return spawn("journalctl", ["--user", "-u", "openclaw-gateway.service", "-f", "-n", "50", "-o", "cat"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
  // For "dashboard-logs", tail the dashboard service
  if (sessionId === "dashboard-logs") {
    return spawn("journalctl", ["--user", "-u", "lodekeeper-dash.service", "-f", "-n", "50", "-o", "cat"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
  return null;
}

/**
 * Fetch session history and send as formatted terminal output, then poll for updates.
 */
async function streamSessionHistory(sessionId: string, ws: AuthenticatedSocket) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const exec = promisify(execFile);

  let lastCount = 0;

  async function fetchAndSend() {
    try {
      const { stdout } = await exec(
        `${NVM_NODE}/openclaw`,
        ["sessions", "history", "--key", sessionId, "--json", "--limit", "50"],
        { timeout: 10000, env: { ...process.env, PATH: `${NVM_NODE}:${process.env.PATH}` } }
      );
      const data = JSON.parse(stdout);
      const messages = data.messages || data || [];
      if (!Array.isArray(messages)) return;

      // Only send new messages
      const newMessages = messages.slice(lastCount);
      lastCount = messages.length;

      for (const msg of newMessages) {
        const role = msg.role || "unknown";
        const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        const roleColor = role === "user" ? "\x1b[36m" : role === "assistant" ? "\x1b[32m" : "\x1b[33m";
        const truncated = content.length > 500 ? content.slice(0, 500) + "…" : content;
        const line = `${roleColor}[${role}]\x1b[0m ${truncated}\n`;
        if (ws.readyState === 1 && ws.streamSubscription === sessionId) {
          ws.send(JSON.stringify({ type: "stream:data", sessionId, data: line, timestamp: Date.now() }));
        }
      }
    } catch (err: any) {
      const errMsg = `\x1b[31m[error] Failed to fetch history: ${err.message}\x1b[0m\n`;
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "stream:data", sessionId, data: errMsg, timestamp: Date.now() }));
      }
    }
  }

  // Initial fetch
  await fetchAndSend();

  // Poll every 5s for updates
  const interval = setInterval(async () => {
    if (ws.readyState !== 1 || ws.streamSubscription !== sessionId) {
      clearInterval(interval);
      return;
    }
    await fetchAndSend();
  }, 5000);

  // Store interval ref for cleanup
  (ws as any)._sessionPollInterval = interval;
}

function subscribeToStream(sessionId: string, ws: AuthenticatedSocket) {
  console.log(`[stream] Client subscribing to: ${sessionId}`);
  ws.streamSubscription = sessionId;

  // Check if it's a log stream (journalctl-based)
  const proc = startLogStream(sessionId);
  if (proc) {
    let stream = activeStreams.get(sessionId);
    if (!stream) {
      stream = { proc, refCount: 0 };
      activeStreams.set(sessionId, stream);

      proc.stdout?.on("data", (data: Buffer) => {
        broadcastStream(sessionId, data.toString());
      });
      proc.stderr?.on("data", (data: Buffer) => {
        broadcastStream(sessionId, data.toString());
      });
      proc.on("close", () => {
        activeStreams.delete(sessionId);
      });
    } else {
      // Already running, just bump refCount
      proc.kill(); // Kill the duplicate we just spawned
    }
    stream.refCount++;
    ws.send(JSON.stringify({ type: "stream:subscribed", sessionId }));
    return;
  }

  // Otherwise it's an OpenClaw session — stream history with polling
  ws.send(JSON.stringify({ type: "stream:subscribed", sessionId }));
  streamSessionHistory(sessionId, ws);
}

function unsubscribeFromStream(ws: AuthenticatedSocket) {
  const sessionId = ws.streamSubscription;
  if (!sessionId) return;
  ws.streamSubscription = undefined;

  // Clean up session history poll if active
  if ((ws as any)._sessionPollInterval) {
    clearInterval((ws as any)._sessionPollInterval);
    (ws as any)._sessionPollInterval = null;
  }

  const stream = activeStreams.get(sessionId);
  if (stream) {
    stream.refCount--;
    if (stream.refCount <= 0) {
      stream.proc.kill();
      activeStreams.delete(sessionId);
    }
  }
}

export function setupWsHub(wss: WebSocketServer) {
  wss.on("connection", (ws: AuthenticatedSocket) => {
    // Client must authenticate within 5 seconds
    const authTimeout = setTimeout(() => {
      if (!ws.authenticated) {
        ws.close(4001, "Authentication timeout");
      }
    }, 5000);

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // Auth message
        if (msg.type === "auth") {
          const secret = process.env.JWT_SECRET;
          if (!secret) {
            ws.close(4003, "Server misconfigured");
            return;
          }
          try {
            const payload = jwt.verify(msg.token, secret) as jwt.JwtPayload;
            ws.userId = payload.sub as string;
            ws.username = payload.username;
            ws.authenticated = true;
            clearTimeout(authTimeout);
            clients.add(ws);
            ws.send(JSON.stringify({ type: "auth", ok: true }));
          } catch {
            ws.close(4002, "Invalid token");
          }
          return;
        }

        // Only process messages from authenticated clients
        if (!ws.authenticated) return;

        // Subscribe to terminal stream
        if (msg.type === "stream:subscribe") {
          unsubscribeFromStream(ws); // Clean up any previous subscription
          subscribeToStream(msg.sessionId, ws);
          return;
        }

        // Unsubscribe from stream
        if (msg.type === "stream:unsubscribe") {
          unsubscribeFromStream(ws);
          return;
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      clearTimeout(authTimeout);
      unsubscribeFromStream(ws);
      clients.delete(ws);
    });

    ws.on("error", () => {
      unsubscribeFromStream(ws);
      clients.delete(ws);
    });
  });
}

/**
 * Broadcast a message to all authenticated clients.
 */
export function broadcast(msg: { type: string; data: unknown }) {
  const payload = JSON.stringify(msg);
  for (const client of clients) {
    if (client.authenticated && client.readyState === 1) {
      client.send(payload);
    }
  }
}

/**
 * Send terminal output to clients subscribed to a specific stream.
 */
export function broadcastStream(sessionId: string, output: string) {
  const payload = JSON.stringify({
    type: "stream:data",
    sessionId,
    data: output,
    timestamp: Date.now(),
  });

  for (const client of clients) {
    if (
      client.authenticated &&
      client.streamSubscription === sessionId &&
      client.readyState === 1
    ) {
      client.send(payload);
    }
  }
}

export function getConnectedClients(): number {
  return clients.size;
}
