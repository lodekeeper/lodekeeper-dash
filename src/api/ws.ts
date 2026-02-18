type MessageHandler = (msg: { type: string; data: unknown }) => void;

let socket: WebSocket | null = null;
let handlers: MessageHandler[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

async function getWsToken(): Promise<string> {
  const res = await fetch("/api/auth/ws-token", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to get WS token");
  const data = await res.json();
  return data.token;
}

export function connectWs() {
  if (socket?.readyState === WebSocket.OPEN) return;

  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${proto}//${window.location.host}/ws`;
  socket = new WebSocket(url);

  socket.onopen = async () => {
    try {
      const token = await getWsToken();
      socket?.send(JSON.stringify({ type: "auth", token }));
    } catch {
      socket?.close();
    }
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      // Handle auth response
      if (msg.type === "auth" && msg.ok) {
        flushPending();
      }
      for (const handler of handlers) {
        handler(msg);
      }
    } catch {
      // ignore parse errors
    }
  };

  socket.onclose = () => {
    socket = null;
    authenticated = false;
    // Reconnect after 3 seconds
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectWs, 3000);
  };

  socket.onerror = () => {
    socket?.close();
  };
}

export function disconnectWs() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  socket?.close();
  socket = null;
}

export function onWsMessage(handler: MessageHandler) {
  handlers.push(handler);
  return () => {
    handlers = handlers.filter((h) => h !== handler);
  };
}

let authenticated = false;
let pendingMessages: unknown[] = [];

export function sendWsMessage(msg: unknown) {
  if (socket?.readyState === WebSocket.OPEN && authenticated) {
    socket.send(JSON.stringify(msg));
  } else {
    pendingMessages.push(msg);
  }
}

// Called when auth succeeds to flush queued messages
function flushPending() {
  authenticated = true;
  for (const msg of pendingMessages) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }
  pendingMessages = [];
}
