# 🌟 Lodekeeper Dashboard

Self-hosted monitoring dashboard for [Lodekeeper](https://github.com/lodekeeper) — an AI contributor to [Lodestar](https://github.com/ChainSafe/lodestar).

## Features

- **Task Board** — Kanban board with drag-and-drop, synced with BACKLOG.md
- **GitHub Tracking** — Open PRs, CI status, notifications
- **Discord Tracking** — Monitored threads with status indicators
- **Agent Monitor** — Active sessions, running sub-agents
- **Periodic Jobs** — Cron jobs and heartbeat overview
- **Status Indicator** — Live idle/working/busy status with context usage bar
- **Live Terminal** — Stream output from background processes (WIP)

## Quick Start

```bash
# Clone
git clone https://github.com/lodekeeper/lodekeeper-dash.git
cd lodekeeper-dash

# Install
pnpm install

# Configure
cp .env.example .env
# Edit .env — set JWT_SECRET (generate with: openssl rand -hex 64)

# Build frontend
pnpm build

# Start
pnpm start
# → http://localhost:7777
```

First visit opens a setup wizard to create your admin account.

## Development

```bash
# Run with hot reload
pnpm dev
```

## Systemd Service

```bash
# Create service file
cat > ~/.config/systemd/user/lodekeeper-dash.service << 'EOF'
[Unit]
Description=Lodekeeper Dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/lodekeeper-dash
Environment=PATH=/path/to/.nvm/versions/node/v22/bin:/usr/bin
ExecStart=/path/to/.nvm/versions/node/v22/bin/npx tsx server/index.ts
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

# Enable + start
systemctl --user daemon-reload
systemctl --user enable --now lodekeeper-dash.service
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `7777` | Server port |
| `HOST` | No | `0.0.0.0` | Bind address |
| `JWT_SECRET` | **Yes** | — | Secret for JWT signing (64+ hex chars) |
| `WORKSPACE_PATH` | No | `~/.openclaw/workspace` | Path to OpenClaw workspace |

## Architecture

```
Browser (React SPA)
    ↕ REST + WebSocket
Express Server (port 7777)
    ├─ Auth (JWT + bcrypt, httpOnly cookies)
    ├─ REST API (/api/tasks, /api/tracking, /api/agents, /api/jobs, /api/status)
    ├─ WebSocket (real-time task sync, terminal streams)
    ├─ Data Collectors (GitHub via gh CLI, Discord threads, OpenClaw sessions, cron jobs)
    └─ Storage (JSON files in data/, reads workspace markdown)
```

## Tech Stack

- **Frontend:** React 19, Vite 6, Tailwind CSS, @dnd-kit, Recharts, Zustand
- **Backend:** Express 5, TypeScript, ws, bcryptjs, jsonwebtoken, helmet
- **Auth:** JWT in httpOnly cookies, bcrypt passwords, setup wizard, invite system

## Security

- No default credentials — setup wizard required
- bcrypt-hashed passwords (cost 12)
- JWT in httpOnly/SameSite=Strict cookies
- Helmet.js security headers
- Rate limiting on auth endpoints
- No private data in repo (secrets in .env, data/ gitignored)

## License

MIT
