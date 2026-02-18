# Lodekeeper Dashboard 🌟

A self-hosted monitoring dashboard for the Lodekeeper AI agent — providing real-time visibility into tasks, GitHub PRs, Discord threads, running agents, cron jobs, and live work streams.

## Features

- **📋 Kanban Task Board** — Drag-and-drop task management, syncs with BACKLOG.md
- **🔗 GitHub & Discord Tracking** — Open PRs, notifications, tracked Discord threads
- **🤖 Agent Monitoring** — Running sessions, sub-agents, token usage
- **⏰ Periodic Jobs** — Cron jobs and heartbeat checks overview
- **📺 Live Stream** — Real-time terminal output from background processes
- **🟢 Status Indicator** — Agent busy/idle/working state at a glance
- **🔒 Secure Auth** — JWT + bcrypt, invite system, rate limiting, security headers

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy and configure environment
cp .env.example .env
# Edit .env: set JWT_SECRET (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

# Development (frontend + backend hot reload)
pnpm dev

# Production build
pnpm build
pnpm start
```

Open `http://localhost:7777` — first visit triggers admin account setup.

## Architecture

```
Browser (React SPA)  ←→  Express Server (port 7777)  ←→  Data Sources
     ↕ WebSocket              ↕ REST API
  Real-time updates      BACKLOG.md, gh CLI, Discord, OpenClaw
```

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React 19 + Vite + Tailwind CSS
- **Real-time**: WebSocket for live updates and terminal streaming
- **Auth**: JWT (httpOnly cookies) + bcrypt password hashing
- **Storage**: JSON files (no database required)

## Security

- No default credentials — first-run setup wizard
- Passwords hashed with bcrypt (cost factor 12)
- JWT tokens in httpOnly, Secure, SameSite=Strict cookies
- Helmet.js security headers (CSP, HSTS, X-Frame-Options)
- Rate limiting on auth (10/min) and API (200/min) endpoints
- Invite system for sharing with trusted users
- All secrets via environment variables (never committed)

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 7777 | Server port |
| `HOST` | 0.0.0.0 | Bind address |
| `JWT_SECRET` | *(required)* | 64-byte hex secret for JWT signing |
| `JWT_EXPIRY` | 604800 | Token expiry in seconds (7 days) |
| `WORKSPACE_PATH` | /home/openclaw/.openclaw/workspace | OpenClaw workspace path |

## Data Sources

The dashboard polls and aggregates data from:
- **BACKLOG.md** — Parsed into structured tasks
- **GitHub** — PRs and notifications via `gh` CLI
- **Discord** — Tracked threads from `memory/discord-threads.json`
- **OpenClaw** — Sessions, cron jobs, processes
- **Agent status** — Written by the agent to `memory/agent-status.json`

## License

MIT
