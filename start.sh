#!/usr/bin/env bash
set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║          Gym PWA Startup             ║"
echo "╚══════════════════════════════════════╝"
echo ""

WSL_IP=$(ip addr show eth0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1 || true)
if [ -z "$WSL_IP" ]; then
  WSL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
fi
WIN_IP=$(grep nameserver /etc/resolv.conf 2>/dev/null | awk '{print $2}' | head -1 || true)

PORT=${PORT:-3443}
HTTP_PORT=${HTTP_PORT:-3000}

echo "PC access (open in browser now):"
if [ -f "certs/cert.pem" ]; then
  echo "  https://localhost:${PORT}"
else
  echo "  http://localhost:${HTTP_PORT}"
  echo "  (no HTTPS certs found — HTTPS required for full PWA offline support)"
fi
echo ""

if [ -n "$WIN_IP" ]; then
  echo "Phone access (same WiFi):"
  echo "  1. Run in Windows PowerShell (Admin):"
  echo "     netsh interface portproxy add v4tov4 listenport=${PORT} listenaddress=0.0.0.0 connectport=${PORT} connectaddress=${WSL_IP:-<WSL_IP>}"
  echo "     netsh advfirewall firewall add rule name=\"GymPWA\" dir=in action=allow protocol=TCP localport=${PORT}"
  echo ""
  echo "  2. Open on phone: https://${WIN_IP}:${PORT}"
  echo "  3. iOS: Share → Add to Home Screen"
  echo "     Android: Browser menu → Add to Home Screen / Install App"
  echo ""
fi

echo "HTTPS setup (one-time, for full PWA):"
echo "  sudo apt install libnss3-tools"
echo "  wget -qO mkcert 'https://dl.filippo.io/mkcert/latest?for=linux/amd64'"
echo "  chmod +x mkcert && sudo mv mkcert /usr/local/bin/"
echo "  mkcert -install"
echo "  mkdir -p certs && cd certs"
echo "  mkcert ${WIN_IP:-192.168.x.x} localhost 127.0.0.1"
echo "  mv *-key.pem key.pem && mv *.pem cert.pem && cd .."
echo "  Then install the rootCA on your phone (mkcert -CAROOT to find it)"
echo ""
echo "Starting server..."
echo ""

node server.js
