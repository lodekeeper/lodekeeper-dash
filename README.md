# 🌟 Lodekeeper Dashboard

Self-hosted monitoring dashboard for [Lodekeeper](https://github.com/lodekeeper) — an AI assistant contributing to [Lodestar](https://github.com/ChainSafe/lodestar) (Ethereum consensus client).

![Dashboard](https://img.shields.io/badge/status-live-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Task Board** — Kanban board with drag-and-drop, bidirectional sync with `BACKLOG.md`, priority filtering, image attachments
- **GitHub Tracking** — Open PRs with CI status, review state, expandable comment previews, notifications
- **Discord Tracking** — Monitored threads with status indicators, expandable notes
- **Agent Sessions** — Live session data from OpenClaw with token counts, Discord channel links
- **Periodic Jobs** — Cron job schedules with expandable run history, heartbeat checks
- **Token Usage** — Pie/bar charts for token distribution by session type, full session breakdown
- **Live Stream** — xterm.js terminal for tailing gateway/dashboard logs and viewing session history
- **Status Indicator** — Real-time idle/working/busy status with auto-idle fallback

## Tech Stack

- **Frontend:** React 19, Vite 6, Tailwind CSS 3, TypeScript
- **Backend:** Express 5, TypeScript, WebSocket (ws)
- **Auth:** JWT (httpOnly cookies) + bcrypt, setup wizard, invite system
- **Charts:** Recharts (lazy-loaded)
- **Terminal:** xterm.js + addon-fit
- **Drag & Drop:** @dnd-kit
- **State:** Zustand
- **Storage:** JSON files (no database)

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm
- [OpenClaw](https://github.com/openclaw/openclaw) running (for agent/session data)
- [GitHub CLI](https://cli.github.com/) (`gh`) authenticated (for PR/notification data)

### Setup

```bash
git clone https://github.com/lodekeeper/lodekeeper-dash.git
cd lodekeeper-dash
pnpm install
```

### Configuration

Copy the example env file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=7777
JWT_SECRET=<generate-a-random-secret>
NODE_ENV=production
```

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### First Run

```bash
pnpm build
pnpm start
```

Visit `http://localhost:7777` — the setup wizard will prompt you to create an admin account.

### Development

```bash
pnpm dev
```

Runs Vite dev server with HMR + Express backend.

## Deployment

### Systemd (Recommended)

Create `~/.config/systemd/user/lodekeeper-dash.service`:

```ini
[Unit]
Description=Lodekeeper Dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/lodekeeper-dash
Environment=PATH=/home/user/.nvm/versions/node/v22.22.0/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/home/user/.nvm/versions/node/v22.22.0/bin/npx tsx server/index.ts
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now lodekeeper-dash.service
```

### Reverse Proxy (Caddy)

```
dash.example.com {
    reverse_proxy localhost:7777
}
```

### Reverse Proxy (nginx)

```nginx
server {
    listen 443 ssl;
    server_name dash.example.com;

    location / {
        proxy_pass http://localhost:7777;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

> **Note:** WebSocket upgrade headers are required for live streaming features.

## Project Structure

```
lodekeeper-dash/
├── server/             # Express backend
│   ├── index.ts        # Entry point
│   ├── auth/           # JWT + bcrypt + invite system
│   ├── api/            # REST routes (tasks, tracking, agents, jobs, status, stream)
│   ├── collectors/     # Data fetchers (GitHub, Discord, cron, agents, workspace)
│   ├── ws/             # WebSocket hub + stream relay
│   └── storage/        # JSON file storage
├── src/                # React frontend
│   ├── pages/          # Dashboard, Tasks, Tracking, Agents, Jobs, Stream, Usage
│   ├── stores/         # Zustand stores (auth, data)
│   ├── api/            # API client + WebSocket client
│   └── components/     # Layout, StatusBadge
├── data/               # Runtime data (gitignored)
│   ├── config.json     # Users + hashed passwords
│   ├── tasks.json      # Task board state
│   └── uploads/        # Task image attachments
├── scripts/
│   ├── deploy.sh       # Build + restart service
│   └── update-status.sh # Update agent status
└── .env                # Secrets (gitignored)
```

## Data Sources

| Source | Method | Interval |
|--------|--------|----------|
| Tasks | `BACKLOG.md` parser + JSON store | On demand |
| GitHub PRs | `gh pr list` | 60s |
| GitHub Notifications | `gh api notifications` | 60s |
| Discord Threads | `discord-threads.json` | 120s |
| Agent Sessions | `openclaw sessions --json` | 15s |
| Cron Jobs | `openclaw cron list` | 120s |
| Agent Status | `agent-status.json` | 10s |

## Security

- Passwords hashed with bcrypt (cost 12)
- JWT in httpOnly cookies (SameSite=Strict)
- Helmet.js security headers
- Rate limiting on auth endpoints
- WebSocket authentication (JWT token handshake)
- No credentials in repository

## License

MIT
