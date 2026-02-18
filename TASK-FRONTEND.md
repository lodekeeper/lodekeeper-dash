# Task: Build the React Frontend for Lodekeeper Dashboard

Read the spec at `~/.openclaw/workspace/notes/lodekeeper-dash/SPEC.md` for full context.

## Overview
Build a dark-themed React SPA dashboard for monitoring an AI agent (Lodekeeper). The backend is already built in `server/`. You need to create all files under `src/`.

## Tech Stack (already installed)
- React 19 + TypeScript
- Vite (config at `vite.config.ts`)
- Tailwind CSS (config at `tailwind.config.js`) — dark theme with custom colors defined
- React Router v7 for navigation
- Zustand for state management
- @dnd-kit for kanban drag-and-drop
- Recharts for charts
- Lucide React for icons
- @xterm/xterm + @xterm/addon-fit for terminal
- WebSocket for real-time updates

## Custom Color Palette (from tailwind.config.js)
- Backgrounds: `surface-0` (#0a0a0f), `surface-1` (#12121a), `surface-2` (#1a1a25), `surface-3` (#222230)
- Accent: `accent` (#6366f1), `accent-hover` (#818cf8), `accent-dim` (#4f46e5)
- Status: `status-idle` (green), `status-working` (yellow), `status-busy` (red)
- Priority: `priority-urgent` (red), `priority-normal` (yellow), `priority-low` (green)
- Text: gray-100 (primary), gray-400 (secondary), gray-500 (muted)

## Pages to Build

### 1. Auth Pages
- `src/pages/LoginPage.tsx` — Clean login form (username + password), centered on page
- `src/pages/SetupPage.tsx` — First-run setup wizard for creating admin account
- `src/pages/InvitePage.tsx` — Accept invite form (from URL param)

### 2. Dashboard (Home) — `/`
- Status card: agent status badge (🟢 Idle / 🟡 Working / 🔴 Busy), current task, model name, uptime
- Task summary: count per column with colored badges
- Active agents: cards showing running sub-agents
- Activity feed: scrollable list of recent events
- Quick stats: tokens today, messages count

### 3. Task Board — `/tasks`
- Kanban board with 5 columns: Backlog, Todo, In Progress, Review, Done
- Task cards with: title, priority badge, source tag, timestamp
- Drag and drop between columns using @dnd-kit
- Click card → modal with full details + edit form
- "Add Task" button → create form
- "Sync from BACKLOG.md" button

### 4. Tracking — `/tracking`
- Tab view: Discord | GitHub
- **Discord tab**: Table of threads with name, channel, status badge, link button
- **GitHub tab**: Table of PRs with #, title, author, CI status badge, review status, link
- Each row expandable for more details

### 5. Agents — `/agents`
- Session cards in a grid: key, model, tokens, last activity, channel
- Process cards: running CLI agents with command, workdir, uptime
- "View Stream" button on process cards → navigates to Stream page

### 6. Jobs — `/jobs`
- Cron jobs table: name, schedule, next/last run, enabled toggle, payload type
- Heartbeat section: current checks, interval

### 7. Stream — `/stream`
- Terminal view using xterm.js
- Session selector dropdown at top
- Tab bar for multiple streams
- Auto-scroll with manual pause on scroll up

## Required Files

### Entry & App Shell
- `src/main.tsx` — React root with BrowserRouter
- `src/App.tsx` — Route definitions, auth guard, layout wrapper
- `src/styles/index.css` — Tailwind imports (@tailwind base/components/utilities)
- `src/vite-env.d.ts` — Vite types

### API & WebSocket
- `src/api/client.ts` — fetch wrapper with auth error handling (redirects to /login on 401)
- `src/api/ws.ts` — WebSocket client: connect, auth, reconnect, message handlers

### Stores (Zustand)
- `src/stores/authStore.ts` — user state, login/logout actions, auth check
- `src/stores/taskStore.ts` — tasks state, CRUD actions, reorder
- `src/stores/dataStore.ts` — github, discord, agents, jobs, status data

### Layout
- `src/components/Layout.tsx` — Sidebar + header + main content area
- Sidebar: nav links with icons (lucide-react), collapsible
- Header: Lodekeeper logo/name, status badge, connected users count

### Components (organize by feature)
Create clean, well-typed components. Each should be in its own file.

## Design Guidelines
- **Dark theme only** — no light mode needed
- **Compact and information-dense** — this is a monitoring dashboard, not a consumer app
- **Consistent spacing**: Use Tailwind's p-3, p-4, gap-3, gap-4
- **Cards**: `bg-surface-1 rounded-lg border border-surface-3 p-4`
- **Tables**: Compact rows with `hover:bg-surface-2` 
- **Badges**: Small rounded pills with colored backgrounds
- **Transitions**: `transition-colors duration-150` on interactive elements
- **No loading spinners for cached data** — show stale data immediately, update when fresh
- **Responsive**: Works on desktop (primary) and tablet

## API Endpoints (already built)
```
POST /api/auth/setup    — {username, password} → setup admin
POST /api/auth/login    — {username, password} → login
POST /api/auth/logout   — logout
GET  /api/auth/me       — current user
GET  /api/auth/status   — {setupComplete, hasUsers}

GET    /api/tasks       — {tasks: Task[]}
POST   /api/tasks       — create task
PATCH  /api/tasks/:id   — update task
DELETE /api/tasks/:id   — delete task
POST   /api/tasks/sync  — re-sync from BACKLOG.md
POST   /api/tasks/reorder — bulk update statuses

GET /api/tracking         — combined github + discord
GET /api/tracking/github  — {prs, notifications}
GET /api/tracking/discord — {threads}

GET /api/agents           — {sessions, processes}

GET /api/jobs             — {cronJobs, heartbeat}

GET  /api/status          — agent status
GET  /api/status/usage    — historical usage
```

## WebSocket Protocol
Connect to `/ws`, then send auth message:
```json
{"type": "auth", "token": "<jwt>"}
```
Server broadcasts:
```json
{"type": "tasks", "data": [...]}
{"type": "github", "data": {...}}
{"type": "discord", "data": [...]}
{"type": "agents", "data": {...}}
{"type": "cron", "data": [...]}
{"type": "stream:data", "sessionId": "...", "data": "...", "timestamp": 123}
```

## Important Notes
- Cookie-based auth: credentials: "include" in all fetch calls
- JWT token is in httpOnly cookie, BUT for WebSocket auth you need to read it. 
  Add a `/api/auth/ws-token` endpoint on the server if needed, or extract from cookie on the client side.
  Actually, since httpOnly cookies can't be read from JS, the WS auth should use a different mechanism.
  → Use the GET /api/auth/me endpoint to verify auth, and pass a short-lived WS token:
  Add to server auth: `GET /api/auth/ws-token` returns `{token}` for WS auth (short-lived, 60s)
- @xterm/xterm needs CSS imported: `import '@xterm/xterm/css/xterm.css'`
- For the kanban board, use @dnd-kit/core DndContext + @dnd-kit/sortable for within-column sorting
- Recharts: Use AreaChart with gradient fill for token usage

## Quality
- All components should be properly typed (no `any`)
- Use `React.memo` for expensive renders (task cards, table rows)
- Clean code, consistent naming
- No console.log left behind
