# Gym PWA

Personal gym tracking Progressive Web App.

## Stack
- Backend: Node.js + Express
- Database: SQLite (better-sqlite3)
- Frontend: Vanilla JS (no framework, no build step)
- PWA: Service worker + Web App Manifest

## Setup
```bash
npm install
node seed.js      # seed exercises and templates
node server.js    # start server on https://localhost:3443
```

## Phone Access (WSL2)
Run `bash start.sh` for instructions on exposing the app to your phone over WiFi.
