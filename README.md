# Gym PWA

**Live:** https://ifu5d87t.insforge.site

Personal gym tracking Progressive Web App — built to install on your phone's home screen and run offline.

## Features

- **Push / Pull / Legs templates** — or create your own with custom exercises
- **Active workout logging** — log sets with weight (lbs) and reps as you go
- **Last weight & PR chips** — every exercise shows your last recorded weight and all-time PR
- **Weekly schedule** — assign templates to days; Today view shows what's up next
- **Template editor** — create, rename, reorder exercises, and edit default sets/reps/weight
- **Exercise library** — add, edit, and delete exercises
- **Workout history** — full log of past sessions
- **PWA** — installable, works offline via service worker cache

## Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js + Express (static file serving only) |
| Database | [InsForge](https://insforge.io) cloud Postgres (`@insforge/sdk`) |
| Frontend | Vanilla JS ES modules — no framework, no build step |
| PWA | Service worker + Web App Manifest |

## Setup

```bash
npm install
npm start          # http://localhost:3000
```

Open `http://localhost:3000` in Chrome → DevTools → **Toggle device toolbar** (`Ctrl+Shift+M`) to preview the phone layout.

## Phone access (WSL2 + WiFi)

```bash
bash start.sh
```

The script prints your WSL2 IP and the Windows `netsh` portproxy command needed to expose the server to your phone over WiFi. For HTTPS (required for PWA install), follow the `mkcert` instructions printed by the script.

## Project structure

```
gym-pwa/
├── server.js                  # Express — static serving + SPA fallback
├── public/
│   ├── index.html             # App shell, PWA meta tags, bottom nav
│   ├── style.css              # Mobile-first dark theme
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker (cache-first shell, network-first API)
│   └── js/
│       ├── insforge.js        # InsForge SDK client
│       ├── api.js             # All database calls via @insforge/sdk
│       ├── app.js             # Hash-based SPA router
│       └── views/
│           ├── today.js       # Dashboard — today's template + recent sessions
│           ├── workout.js     # Active workout — sets, weights, finish
│           ├── schedule.js    # Weekly planner
│           ├── templates.js   # Template create/edit/reorder
│           ├── exercises.js   # Exercise library
│           └── history.js     # Past sessions
└── start.sh                   # Phone access helper (WSL2)
```

## Database (InsForge cloud Postgres)

Schema managed via `npx @insforge/cli`. Tables:

| Table | Purpose |
|-------|---------|
| `exercises` | Exercise library (name, muscle group) |
| `templates` | Workout templates (Push, Pull, Legs, …) |
| `template_exercises` | Exercises in a template with default sets/reps/weight |
| `schedule` | Day-of-week → template mapping (0 = Monday) |
| `sessions` | Workout sessions with start/finish timestamps |
| `session_exercises` | Exercises performed in a session |
| `sets` | Individual sets — weight, reps, completed flag |

Seed data (24 exercises + Push/Pull/Legs templates) was loaded via `npx @insforge/cli db query`.
