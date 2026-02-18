/**
 * WebSocket hub — manages connections, auth, broadcasting, and terminal streams.
 */
import type { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  username?: string;
  authenticated?: boolean;
  streamSubscription?: string;
}

const clients = new Set<AuthenticatedSocket>();

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
          ws.streamSubscription = msg.sessionId;
          ws.send(JSON.stringify({ type: "stream:subscribed", sessionId: msg.sessionId }));
          return;
        }

        // Unsubscribe from stream
        if (msg.type === "stream:unsubscribe") {
          ws.streamSubscription = undefined;
          return;
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      clearTimeout(authTimeout);
      clients.delete(ws);
    });

    ws.on("error", () => {
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
