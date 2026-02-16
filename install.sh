#!/bin/bash

# ╔══════════════════════════════════════════════╗
# ║   Clawdia Dashboard — Installer v1.1        ║
# ║   Dashboard for OpenClaw AI Agent            ║
# ╚══════════════════════════════════════════════╝

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# ── CHANGE THIS to your GitHub repo ──
REPO_URL="https://raw.githubusercontent.com/maycrypto/clawdia-dash/main"

DASH_DIR="$HOME/clawdia-dashboard"
API_DIR="$HOME/clawdia-api"
API_PORT=3100

log() { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; exit 1; }
step() { echo ""; echo -e "  ${BOLD}${CYAN}[$1/6]${NC} ${BOLD}$2${NC}"; }

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
echo -e "  Установка займёт ~2-3 минуты"
echo ""

# Pre-flight
if [ "$EUID" -eq 0 ]; then
  fail "Не запускай от root! Запусти от обычного юзера."
fi

if ! sudo -n true 2>/dev/null; then
  echo -e "  Для установки понадобится sudo. Введи пароль:"
  sudo true || fail "Нужен sudo"
fi

# ── Step 1: Detect IP & OpenClaw ──────────────────

step "1" "Определяю IP и OpenClaw..."

SERVER_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 icanhazip.com 2>/dev/null || echo "")
[ -z "$SERVER_IP" ] && fail "Не могу определить внешний IP"
log "IP: ${BOLD}$SERVER_IP${NC}"

OPENCLAW_ROOT=""
for p in "$HOME/openclaw" "$HOME/OpenClaw" "$HOME/open-claw" "$HOME/.openclaw" "$HOME"; do
  if [ -f "$p/AGENTS.md" ] || [ -f "$p/MEMORY.md" ]; then
    OPENCLAW_ROOT="$p"
    break
  fi
done

if [ -z "$OPENCLAW_ROOT" ]; then
  warn "Не нашёл OpenClaw автоматически."
  echo -e "  Введи путь к папке OpenClaw (где лежит AGENTS.md):"
  read -r OPENCLAW_ROOT
  [ ! -d "$OPENCLAW_ROOT" ] && fail "Директория $OPENCLAW_ROOT не существует"
fi
log "OpenClaw: $OPENCLAW_ROOT"

# ── Step 2: Dependencies ──────────────────────────

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

# ── Step 3: API Server ───────────────────────────

step "3" "Создаю API..."

mkdir -p "$API_DIR"
cd "$API_DIR"

cat > package.json << 'EOF'
{"name":"clawdia-api","version":"1.0.0","private":true,"dependencies":{"express":"^4.18.0","cors":"^2.8.0"}}
EOF

npm install --silent > /dev/null 2>&1

# Download server.js from GitHub
curl -fsSL "$REPO_URL/server.js" -o server.js.tmp 2>/dev/null

if [ -s server.js.tmp ]; then
  # Replace OPENCLAW_ROOT placeholder
  sed -i "s|__OPENCLAW_ROOT__|${OPENCLAW_ROOT}|g" server.js.tmp
  mv server.js.tmp server.js
  log "API скачан с GitHub"
else
  rm -f server.js.tmp
  warn "Не удалось скачать с GitHub, создаю локально..."
  
  cat > server.js << SERVEREOF
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

const OPENCLAW_ROOT = '${OPENCLAW_ROOT}';
const PORT = ${API_PORT};
const START_TIME = Date.now();

function readFile(f) { try { return fs.readFileSync(path.join(OPENCLAW_ROOT, f), 'utf-8'); } catch { return ''; } }
function fileExists(f) { try { return fs.existsSync(path.join(OPENCLAW_ROOT, f)); } catch { return false; } }

function getDirSize(d) {
  try {
    const fp = path.join(OPENCLAW_ROOT, d);
    if (!fs.existsSync(fp)) return 0;
    return parseInt(execSync(\`du -sb "\${fp}" 2>/dev/null | cut -f1\`).toString().trim()) || 0;
  } catch { return 0; }
}

function formatBytes(b) { if (!b) return '0 B'; const k=1024; const s=['B','KB','MB','GB']; const i=Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(1))+' '+s[i]; }
function formatUptime(ms) { const s=Math.floor(ms/1000); return \`\${Math.floor(s/86400)}д \${Math.floor((s%86400)/3600)}ч \${Math.floor((s%3600)/60)}м\`; }

function parseTasks() {
  const tasks = [];
  for (const f of ['notes/tasks.md','tasks.md','TASKS.md','notes/todo.md']) {
    const c = readFile(f); if (!c) continue;
    let date = new Date().toISOString().split('T')[0], id = 0;
    for (const line of c.split('\\n')) {
      const dm = line.match(/^##\\s+(\\d{4}-\\d{2}-\\d{2})/);
      if (dm) { date = dm[1]; continue; }
      const tm = line.match(/^\\s*-\\s*\\[([ x\\-])\\]\\s*(.*)/);
      if (tm) {
        id++;
        const status = tm[1]==='x'?'done':tm[1]==='-'?'in_progress':'open';
        let text = tm[2], priority='medium', category='general';
        const pm = text.match(/\\[(high|medium|low)\\]/); if(pm){priority=pm[1];text=text.replace(pm[0],'');}
        const cm = text.match(/\\[([^\\]]+)\\]/); if(cm){category=cm[1];text=text.replace(cm[0],'');}
        let tid = \`task_\${String(id).padStart(3,'0')}\`;
        const im = text.match(/\\|\\s*id:(\\S+)/); if(im){tid=im[1];text=text.replace(im[0],'');}
        tasks.push({ id:tid, title:text.trim(), status, date, priority, category });
      }
    }
    break;
  }
  return tasks;
}

function parseSkills() {
  const skills = [], dir = path.join(OPENCLAW_ROOT, 'skills');
  if (!fs.existsSync(dir)) return skills;
  let i = 0;
  for (const d of fs.readdirSync(dir, {withFileTypes:true}).filter(x=>x.isDirectory())) {
    i++;
    const sp = path.join(dir, d.name, 'SKILL.md');
    let desc='', type='system';
    if (fs.existsSync(sp)) {
      const c = fs.readFileSync(sp, 'utf-8');
      const lines = c.split('\\n').filter(l=>l.trim()&&!l.startsWith('#')&&!l.startsWith('---'));
      desc = lines[0] || '';
      if (c.includes('type: custom')) type = 'custom';
    }
    const stat = fs.statSync(path.join(dir, d.name));
    skills.push({ id:\`skill_\${String(i).padStart(3,'0')}\`, name:d.name, type, active:true, description:desc, addedDate:stat.birthtime.toISOString().split('T')[0], usageCount:null });
  }
  return skills;
}

function parseProcesses() {
  const content = readFile('AGENTS.md'), procs = [];
  let i = 0;
  for (const line of content.split('\\n')) {
    const m = line.match(/([\\d\\*\\/]+\\s+[\\d\\*\\/]+\\s+[\\d\\*\\/]+\\s+[\\d\\*\\/]+\\s+[\\d\\*\\/]+)\\s*[—-]?\\s*(.*)/);
    if (m) { i++; procs.push({ id:\`proc_\${i}\`, name:m[2].trim().split(' ').slice(0,3).join('-').toLowerCase()||'process-'+i, type:'cron', schedule:m[1], status:'running', lastRun:null, nextRun:null, description:m[2].trim() }); }
  }
  return procs;
}

app.get('/api/status', (req, res) => {
  const tasks = parseTasks();
  const cur = tasks.find(t=>t.status==='in_progress');
  let ver = '1.0.0'; const vm = readFile('AGENTS.md').match(/version[:\\s]+([\\d.]+)/i); if(vm) ver=vm[1];
  res.json({ name:'Clawdia', version:ver, uptime:formatUptime(Date.now()-START_TIME), currentTask:cur?cur.title:null, memorySize:formatBytes(getDirSize('memory')), totalTasks:tasks.length, completedTasks:tasks.filter(t=>t.status==='done').length });
});

app.get('/api/tasks', (req, res) => {
  let t = parseTasks();
  if (req.query.status) t=t.filter(x=>x.status===req.query.status);
  if (req.query.date) t=t.filter(x=>x.date===req.query.date);
  res.json({ tasks: t });
});

app.patch('/api/tasks/:id', (req, res) => {
  for (const f of ['notes/tasks.md','tasks.md','TASKS.md','notes/todo.md']) {
    if (!fileExists(f)) continue;
    const fp = path.join(OPENCLAW_ROOT, f);
    const lines = fs.readFileSync(fp,'utf-8').split('\\n');
    for (let i=0;i<lines.length;i++) {
      if (lines[i].includes(\`id:\${req.params.id}\`)) {
        if (req.body.status) { const m=req.body.status==='done'?'x':req.body.status==='in_progress'?'-':' '; lines[i]=lines[i].replace(/\\[([ x\\-])\\]/,\`[\${m}]\`); }
        fs.writeFileSync(fp, lines.join('\\n'));
        return res.json({ success:true, id:req.params.id });
      }
    }
  }
  res.status(404).json({ error:'Task not found' });
});

app.post('/api/tasks', (req, res) => {
  let tf='';
  for (const f of ['notes/tasks.md','tasks.md','TASKS.md']) { if(fileExists(f)){tf=f;break;} }
  if (!tf) { tf='notes/tasks.md'; const d=path.join(OPENCLAW_ROOT,'notes'); if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true}); fs.writeFileSync(path.join(OPENCLAW_ROOT,tf),'# Tasks\\n\\n'); }
  const id=\`task_\${Date.now()}\`, date=req.body.date||new Date().toISOString().split('T')[0];
  const line=\`- [ ] [\${req.body.priority||'medium'}] [\${req.body.category||'general'}] \${req.body.title} | id:\${id}\`;
  const fp=path.join(OPENCLAW_ROOT,tf); let c=fs.readFileSync(fp,'utf-8');
  if(c.includes(\`## \${date}\`)){c=c.replace(\`## \${date}\`,\`## \${date}\\n\${line}\`);}else{c+=\`\\n## \${date}\\n\${line}\\n\`;}
  fs.writeFileSync(fp,c);
  res.json({ id, title:req.body.title, status:'open', date, priority:req.body.priority||'medium', category:req.body.category||'general' });
});

app.get('/api/processes', (req, res) => { res.json({ processes: parseProcesses() }); });
app.get('/api/skills', (req, res) => { res.json({ skills: parseSkills() }); });

app.get('/api/skills/:name/content', (req, res) => {
  const sp = path.join(OPENCLAW_ROOT, 'skills', req.params.name, 'SKILL.md');
  if (!fs.existsSync(sp)) return res.status(404).json({ error: 'Skill not found' });
  res.json({ name: req.params.name, content: fs.readFileSync(sp, 'utf-8') });
});

app.get('/api/health', (req, res) => { res.json({ ok:true }); });

app.listen(PORT, '127.0.0.1', () => console.log(\`Clawdia API on http://127.0.0.1:\${PORT}\`));
SERVEREOF

  log "API создан локально"
fi

# ── Step 4: Dashboard ─────────────────────────────

step "4" "Создаю дашборд..."

mkdir -p "$DASH_DIR/src"
cd "$DASH_DIR"

cat > package.json << 'EOF'
{"name":"clawdia-dashboard","private":true,"version":"1.0.0","type":"module","scripts":{"dev":"vite","build":"vite build","preview":"vite preview"},"dependencies":{"react":"^18.2.0","react-dom":"^18.2.0"},"devDependencies":{"@types/react":"^18.2.0","@vitejs/plugin-react":"^4.2.0","vite":"^5.0.0"}}
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

# Download App.jsx from GitHub
curl -fsSL "$REPO_URL/App.jsx" -o src/App.jsx 2>/dev/null

if [ ! -s src/App.jsx ]; then
  fail "Не удалось скачать App.jsx с GitHub. Проверь REPO_URL в скрипте."
fi

log "Файлы дашборда готовы"

# ── Step 5: Build ─────────────────────────────────

step "5" "Собираю (npm install + build)..."

npm install --silent > /dev/null 2>&1
npm run build > /dev/null 2>&1
[ ! -d "$DASH_DIR/dist" ] && fail "Сборка не удалась"
log "Сборка готова"

# ── Step 6: nginx + pm2 ──────────────────────────

step "6" "Настраиваю nginx и запускаю..."

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
log "nginx: ok"

cd "$API_DIR"
pm2 delete clawdia-api > /dev/null 2>&1 || true
pm2 start server.js --name clawdia-api > /dev/null 2>&1
pm2 save > /dev/null 2>&1
PM2_STARTUP=$(pm2 startup 2>&1 | grep "sudo" | head -1)
[ -n "$PM2_STARTUP" ] && eval "$PM2_STARTUP" > /dev/null 2>&1 || true
log "API запущен"

# Firewall
command -v ufw &>/dev/null && sudo ufw allow 80/tcp > /dev/null 2>&1

# ── Done ──────────────────────────────────────────

echo ""
echo -e "  ${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo -e "  ${GREEN}${BOLD}  ✓ Clawdia Dashboard установлен!${NC}"
echo -e "  ${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo ""
echo -e "  Открой: ${CYAN}${BOLD}http://$SERVER_IP${NC}"
echo ""
echo -e "  Команды:"
echo -e "  ${CYAN}pm2 status${NC}              — статус"
echo -e "  ${CYAN}pm2 logs clawdia-api${NC}    — логи"
echo -e "  ${CYAN}pm2 restart clawdia-api${NC} — перезапуск"
echo ""
