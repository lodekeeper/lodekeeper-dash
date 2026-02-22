# Task: Add Chat Page to Lodekeeper Dashboard

## Context
Read `~/.openclaw/workspace/CODING_CONTEXT.md` for project conventions.

This is a React + TypeScript dashboard (Vite, Tailwind CSS, Express backend) at `~/lodekeeper-dash`.
The OpenClaw gateway runs on `localhost:18789` with token auth and has the OpenAI-compatible
`/v1/chat/completions` endpoint enabled.

## Requirements

Add a **Chat** page to the dashboard that works like the OpenClaw TUI — you can send messages
and run slash commands (`/compact`, `/status`, `/model`, etc.). Messages stream in real-time via SSE.

## Architecture

### Backend: `/api/chat` proxy

Create `server/api/chat.ts`:

1. **POST /api/chat** — proxies to `http://127.0.0.1:18789/v1/chat/completions`
   - Reads gateway token from `~/.openclaw/openclaw.json` (field: `gateway.auth.token`)
   - Adds `Authorization: Bearer <token>` header
   - Adds `x-openclaw-agent-id: main` header
   - Forwards the request body as-is (client sends `{ messages, stream, user }`)
   - For `stream: true`: pipes the SSE response directly back to the client
   - For `stream: false`: returns the JSON response
   - Use `user: "dashboard-chat"` as default so all requests share one session
   - Handle errors gracefully (gateway down, auth failure, etc.)

2. Read token: Parse `~/.openclaw/openclaw.json`, extract `gateway.auth.token` value.
   If the file doesn't exist or token is missing, return 503 with helpful error.

### Frontend: ChatPage

Create `src/pages/ChatPage.tsx`:

1. **Message list** — scrollable container showing user and assistant messages
   - User messages: right-aligned, accent-colored background
   - Assistant messages: left-aligned, surface-2 background
   - Support markdown rendering (use a simple approach — just render code blocks with `<pre>` tags, bold with `<strong>`, etc. Don't add a markdown library dependency)
   - Auto-scroll to bottom on new messages
   - Show a typing indicator while streaming

2. **Input area** — fixed at bottom
   - Text input (or textarea for multiline) with send button
   - Send on Enter (Shift+Enter for newline if textarea)
   - Disable input while waiting for response
   - Placeholder: "Send a message or /command..."
   - Show a small hint below: "Try /status, /compact, /model, /help"

3. **Streaming** — use `fetch` with `ReadableStream` to consume SSE
   - Parse `data: {...}` lines from the SSE stream
   - Extract `choices[0].delta.content` from each chunk
   - Append to the current assistant message as chunks arrive
   - Handle `data: [DONE]` to finish the stream
   - Handle errors (show error message in chat)

4. **Session behavior**
   - Always send `user: "dashboard-chat"` so messages share one persistent session
   - Keep a local message history in React state (not persisted — clears on page reload)
   - Send full conversation history in each request (last 20 messages max)

5. **Slash commands** — no special handling needed. Just send them as regular messages.
   The gateway handles `/compact`, `/status`, etc. natively.

6. **Styling** — match existing dashboard theme:
   - Background: `bg-surface-0`
   - Cards: `bg-surface-1` with `border-surface-3`
   - Text: `text-gray-200` (light on dark)
   - Accent: `text-accent` for highlights
   - Use existing Tailwind config (surface-0, surface-1, surface-2, surface-3, accent colors)

### Layout integration

1. In `src/components/Layout.tsx`:
   - Add nav item: `{ to: "/chat", icon: MessageSquare, label: "Chat" }` (import `MessageSquare` from lucide-react)
   - Place it after "Stream" in the nav order

2. In `src/App.tsx`:
   - Import `ChatPage` from `./pages/ChatPage`
   - Add route: `<Route path="/chat" element={<ChatPage />} />`

3. In `server/index.ts`:
   - Import `chatRouter` from `./api/chat.js`
   - Add: `app.use("/api/chat", verifyToken, csrfProtect, chatRouter);` (no rate limit — streaming needs it)

## Constraints

- Do NOT add new npm dependencies. Use built-in fetch API for SSE streaming.
- Keep the code clean and TypeScript-strict.
- Match the existing code style (see other pages like `StreamPage.tsx` for reference).
- The gateway port is always `18789` and bind is `loopback` — hardcode `http://127.0.0.1:18789`.
- Gateway token path: `~/.openclaw/openclaw.json` → `gateway.auth.token`

## Files to create/modify

**Create:**
- `server/api/chat.ts` — proxy endpoint
- `src/pages/ChatPage.tsx` — chat UI

**Modify:**
- `server/index.ts` — add chat router
- `src/App.tsx` — add chat route
- `src/components/Layout.tsx` — add chat nav item

## Testing

After implementation:
1. Build: `cd ~/lodekeeper-dash && pnpm build`
2. The build should succeed with zero TypeScript errors
