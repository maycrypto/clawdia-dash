#!/bin/bash

# ╔══════════════════════════════════════════════╗
# ║   Clawdia Dashboard — Installer v2.0        ║
# ║   Dashboard for OpenClaw AI Agent            ║
# ║   github.com/maycrypto/clawdia-dash          ║
# ╚══════════════════════════════════════════════╝

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

REPO_URL="https://raw.githubusercontent.com/maycrypto/clawdia-dash/main"
DASH_DIR="$HOME/clawdia-dashboard"
API_PORT=3100

log() { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; exit 1; }
step() { echo ""; echo -e "  ${BOLD}${CYAN}[$1/5]${NC} ${BOLD}$2${NC}"; }

echo ""
echo -e "${GREEN}"
echo "   ██████╗██╗      █████╗ ██╗    ██╗██████╗ ██╗ █████╗ "
echo "  ██╔════╝██║     ██╔══██╗██║    ██║██╔══██╗██║██╔══██╗"
echo "  ██║     ██║     ███████║██║ █╗ ██║██║  ██║██║███████║"
echo "  ██║     ██║     ██╔══██║██║███╗██║██║  ██║██║██╔══██║"
echo "  ╚██████╗███████╗██║  ██║╚███╔███╔╝██████╔╝██║██║  ██║"
echo "   ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚═════╝ ╚═╝╚═╝  ╚═╝"
echo -e "${NC}"
echo -e "  ${CYAN}Dashboard for OpenClaw AI Agent${NC}"
echo -e "  Установка займёт ~2 минуты"
echo ""

# Pre-flight
if [ "$EUID" -eq 0 ]; then
  fail "Не запускай от root! Запусти от обычного юзера."
fi
if ! sudo -n true 2>/dev/null; then
  echo -e "  Для установки понадобится sudo:"
  sudo true || fail "Нужен sudo"
fi

# ── Step 1: Detect IP ─────────────────────────────

step "1" "Определяю IP сервера..."

SERVER_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 icanhazip.com 2>/dev/null || echo "")
[ -z "$SERVER_IP" ] && fail "Не могу определить внешний IP"
log "IP: ${BOLD}$SERVER_IP${NC}"

# ── Step 2: Dependencies ─────────────────────────

step "2" "Устанавливаю зависимости..."

if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
  sudo apt-get install -y nodejs > /dev/null 2>&1
fi
log "Node.js: $(node -v)"

if ! command -v nginx &> /dev/null; then
  sudo apt-get update -qq > /dev/null 2>&1
  sudo apt-get install -y nginx > /dev/null 2>&1
fi
log "nginx: ok"

if ! command -v pm2 &> /dev/null; then
  sudo npm install -g pm2 > /dev/null 2>&1
fi
log "pm2: ok"

# ── Step 3: Dashboard ────────────────────────────

step "3" "Создаю дашборд..."

mkdir -p "$DASH_DIR/src"
cd "$DASH_DIR"

cat > package.json << 'EOF'
{"name":"clawdia-dashboard","private":true,"version":"2.0.0","type":"module","scripts":{"dev":"vite","build":"vite build","preview":"vite preview"},"dependencies":{"react":"^18.2.0","react-dom":"^18.2.0"},"devDependencies":{"@types/react":"^18.2.0","@vitejs/plugin-react":"^4.2.0","vite":"^5.0.0"}}
EOF

cat > vite.config.js << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()] })
EOF

cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Clawdia Dashboard</title><style>body{margin:0;background:#0a0a0f}</style></head>
<body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>
EOF

cat > src/main.jsx << 'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
EOF

# Download App.jsx
curl -fsSL "$REPO_URL/App.jsx" -o src/App.jsx 2>/dev/null
[ ! -s src/App.jsx ] && fail "Не удалось скачать App.jsx"

log "Файлы готовы"

# ── Step 4: Build ─────────────────────────────────

step "4" "Собираю (npm install + build)..."

npm install --silent > /dev/null 2>&1
npm run build > /dev/null 2>&1
[ ! -d "$DASH_DIR/dist" ] && fail "Сборка не удалась"
log "Сборка готова"

# ── Step 5: nginx ─────────────────────────────────

step "5" "Настраиваю nginx..."

sudo tee /etc/nginx/sites-available/clawdia > /dev/null << NGINXEOF
server {
    listen 80;
    server_name $SERVER_IP;
    root $DASH_DIR/dist;
    index index.html;
    location / { try_files \$uri \$uri/ /index.html; }
    location /api/ { proxy_pass http://127.0.0.1:$API_PORT/api/; proxy_http_version 1.1; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; proxy_read_timeout 30s; }
}
NGINXEOF

sudo ln -sf /etc/nginx/sites-available/clawdia /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t > /dev/null 2>&1 || fail "nginx config error"
sudo systemctl restart nginx
log "nginx настроен"

# Firewall
command -v ufw &>/dev/null && sudo ufw allow 80/tcp > /dev/null 2>&1

# ── Download API spec ─────────────────────────────

mkdir -p "$HOME/clawdia-api"
curl -fsSL "$REPO_URL/API-SPEC.md" -o "$HOME/clawdia-api/API-SPEC.md" 2>/dev/null

# ── Done ──────────────────────────────────────────

echo ""
echo -e "  ${GREEN}${BOLD}════════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}${BOLD}  ✓ Дашборд установлен!${NC}"
echo -e "  ${GREEN}${BOLD}════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Осталось подключить API.${NC}"
echo -e "  Скинь своему OpenClaw-агенту эту команду:"
echo ""
echo -e "  ${CYAN}${BOLD}  cat ~/clawdia-api/API-SPEC.md${NC}"
echo ""
echo -e "  Или скопируй спецификацию отсюда:"
echo -e "  ${CYAN}  https://github.com/maycrypto/clawdia-dash/blob/main/API-SPEC.md${NC}"
echo ""
echo -e "  Агент прочитает спецификацию, сама найдёт где лежат"
echo -e "  данные и поднимет API. После этого открой:"
echo ""
echo -e "  ${GREEN}${BOLD}  http://$SERVER_IP${NC}"
echo ""
