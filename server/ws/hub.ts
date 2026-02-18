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

function startLogStream(sessionId: string): ChildProcess | null {
  // For "gateway-logs", tail the openclaw systemd journal
  if (sessionId === "gateway-logs") {
    const proc = spawn("journalctl", ["--user", "-u", "openclaw-gateway.service", "-f", "-n", "50", "-o", "cat"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    return proc;
  }
  // For "dashboard-logs", tail the dashboard service
  if (sessionId === "dashboard-logs") {
    const proc = spawn("journalctl", ["--user", "-u", "lodekeeper-dash.service", "-f", "-n", "50", "-o", "cat"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    return proc;
  }
  // For "system-logs", tail syslog
  if (sessionId === "system-logs") {
    const proc = spawn("journalctl", ["-f", "-n", "50", "-o", "cat"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    return proc;
  }
  return null;
}

function subscribeToStream(sessionId: string, ws: AuthenticatedSocket) {
  ws.streamSubscription = sessionId;

  let stream = activeStreams.get(sessionId);
  if (!stream) {
    const proc = startLogStream(sessionId);
    if (!proc) {
      ws.send(JSON.stringify({ type: "stream:error", message: "Unknown stream: " + sessionId }));
      return;
    }

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
  }
  stream.refCount++;
  ws.send(JSON.stringify({ type: "stream:subscribed", sessionId }));
}

function unsubscribeFromStream(ws: AuthenticatedSocket) {
  const sessionId = ws.streamSubscription;
  if (!sessionId) return;
  ws.streamSubscription = undefined;

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
