const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

const OPENCLAW_ROOT = '__OPENCLAW_ROOT__';
const PORT = 3100;
const START_TIME = Date.now();

// Paths
const OPENCLAW_PKG = '/usr/lib/node_modules/openclaw/package.json';
const SYSTEM_SKILLS_DIR = '/usr/lib/node_modules/openclaw/skills';
const CUSTOM_SKILLS_DIR = path.join(OPENCLAW_ROOT, 'skills');
const CRON_CACHE_PATH = path.join(__dirname, 'cron-cache.json');

// ── Helpers ──

function readFile(f) { try { return fs.readFileSync(path.join(OPENCLAW_ROOT, f), 'utf-8'); } catch { return ''; } }
function fileExists(f) { try { return fs.existsSync(path.join(OPENCLAW_ROOT, f)); } catch { return false; } }

function getDirSize(d) {
  try {
    const fp = path.isAbsolute(d) ? d : path.join(OPENCLAW_ROOT, d);
    if (!fs.existsSync(fp)) return 0;
    return parseInt(execSync(`du -sb "${fp}" 2>/dev/null | cut -f1`).toString().trim()) || 0;
  } catch { return 0; }
}

function formatBytes(b) {
  if (!b) return '0 B';
  const k = 1024, s = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 86400)}д ${Math.floor((s % 86400) / 3600)}ч ${Math.floor((s % 3600) / 60)}м`;
}

// ── Get OpenClaw version ──

function getVersion() {
  // 1. Try package.json
  try {
    if (fs.existsSync(OPENCLAW_PKG)) {
      const pkg = JSON.parse(fs.readFileSync(OPENCLAW_PKG, 'utf-8'));
      if (pkg.version) return pkg.version;
    }
  } catch {}

  // 2. Try CLI
  try {
    const ver = execSync('openclaw --version 2>/dev/null').toString().trim();
    if (ver) return ver;
  } catch {}

  // 3. Try AGENTS.md
  const agents = readFile('AGENTS.md');
  const m = agents.match(/version[:\s]+([\d.]+)/i);
  if (m) return m[1];

  return '1.0.0';
}

// ── Parse tasks ──

function parseTasks() {
  const tasks = [];
  for (const f of ['notes/tasks.md', 'tasks.md', 'TASKS.md', 'notes/todo.md']) {
    const c = readFile(f);
    if (!c) continue;
    let date = new Date().toISOString().split('T')[0], id = 0;
    for (const line of c.split('\n')) {
      const dm = line.match(/^##\s+(\d{4}-\d{2}-\d{2})/);
      if (dm) { date = dm[1]; continue; }
      const tm = line.match(/^\s*-\s*\[([ x\-])\]\s*(.*)/);
      if (tm) {
        id++;
        const status = tm[1] === 'x' ? 'done' : tm[1] === '-' ? 'in_progress' : 'open';
        let text = tm[2], priority = 'medium', category = 'general';
        const pm = text.match(/\[(high|medium|low)\]/);
        if (pm) { priority = pm[1]; text = text.replace(pm[0], ''); }
        const cm = text.match(/\[([^\]]+)\]/);
        if (cm) { category = cm[1]; text = text.replace(cm[0], ''); }
        let tid = `task_${String(id).padStart(3, '0')}`;
        const im = text.match(/\|\s*id:(\S+)/);
        if (im) { tid = im[1]; text = text.replace(im[0], ''); }
        tasks.push({ id: tid, title: text.trim(), status, date, priority, category });
      }
    }
    break;
  }
  return tasks;
}

// ── Parse skills ──

function readSkillsFromDir(dirPath, type) {
  const skills = [];
  if (!fs.existsSync(dirPath)) return skills;
  let dirs;
  try {
    dirs = fs.readdirSync(dirPath, { withFileTypes: true }).filter(d => d.isDirectory());
  } catch { return skills; }

  for (const d of dirs) {
    const skillMdPath = path.join(dirPath, d.name, 'SKILL.md');
    let description = '';

    if (fs.existsSync(skillMdPath)) {
      const content = fs.readFileSync(skillMdPath, 'utf-8');
      // Extract description from YAML frontmatter
      const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
      if (fmMatch) {
        const descMatch = fmMatch[1].match(/description:\s*["']?(.+?)["']?\s*$/m);
        if (descMatch) description = descMatch[1];
      }
      // Fallback: first non-empty, non-header line
      if (!description) {
        const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('---'));
        description = lines[0] || '';
      }
    }

    let addedDate = null;
    try {
      addedDate = fs.statSync(path.join(dirPath, d.name)).birthtime.toISOString().split('T')[0];
    } catch {}

    skills.push({
      id: `skill_${type}_${d.name}`,
      name: d.name,
      type,
      active: true,
      description,
      addedDate,
      usageCount: null,
    });
  }
  return skills;
}

function parseAllSkills() {
  const system = readSkillsFromDir(SYSTEM_SKILLS_DIR, 'system');
  const custom = readSkillsFromDir(CUSTOM_SKILLS_DIR, 'custom');
  return [...custom, ...system].sort((a, b) => a.name.localeCompare(b.name));
}

// ── Parse processes ──
// Reads from cron-cache.json written by the agent.
// Format: array of {id, name, type, schedule, status, lastRun, nextRun, description}
// Agent should update this file periodically (e.g. every 15 min).
// To set up: have your agent run `cron list` and write results to ~/clawdia-api/cron-cache.json

function parseProcesses() {
  if (fs.existsSync(CRON_CACHE_PATH)) {
    try {
      const raw = fs.readFileSync(CRON_CACHE_PATH, 'utf-8');
      const data = JSON.parse(raw);
      const list = Array.isArray(data) ? data : (data.processes || []);
      return list.map((p, i) => ({
        id: p.id || `proc_${i + 1}`,
        name: p.name || `process-${i + 1}`,
        type: p.type || 'cron',
        schedule: p.schedule || '—',
        status: (p.status === 'idle' || p.status === 'disabled' || p.status === false) ? 'idle' : 'running',
        lastRun: p.lastRun || null,
        nextRun: p.nextRun || null,
        description: p.description || p.name || '',
      }));
    } catch (err) {
      console.error('cron-cache.json error:', err.message);
    }
  }

  // Fallback: parse cron patterns from AGENTS.md
  const content = readFile('AGENTS.md'), procs = [];
  let i = 0;
  for (const line of content.split('\n')) {
    const m = line.match(/([\d\*\/]+\s+[\d\*\/]+\s+[\d\*\/]+\s+[\d\*\/]+\s+[\d\*\/]+)\s*[—-]?\s*(.*)/);
    if (m) {
      i++;
      procs.push({
        id: `proc_${i}`,
        name: m[2].trim().split(' ').slice(0, 3).join('-').toLowerCase() || 'process-' + i,
        type: 'cron', schedule: m[1], status: 'running',
        lastRun: null, nextRun: null, description: m[2].trim(),
      });
    }
  }
  return procs;
}

// ── API Endpoints ──

app.get('/api/status', (req, res) => {
  const tasks = parseTasks();
  const cur = tasks.find(t => t.status === 'in_progress');
  const memSize = getDirSize('memory') + getDirSize('MEMORY.md');

  res.json({
    name: 'Clawdia',
    version: getVersion(),
    uptime: formatUptime(Date.now() - START_TIME),
    currentTask: cur ? cur.title : null,
    memorySize: formatBytes(memSize),
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === 'done').length,
  });
});

app.get('/api/tasks', (req, res) => {
  let t = parseTasks();
  if (req.query.status) t = t.filter(x => x.status === req.query.status);
  if (req.query.date) t = t.filter(x => x.date === req.query.date);
  if (req.query.from) t = t.filter(x => x.date >= req.query.from);
  if (req.query.to) t = t.filter(x => x.date <= req.query.to);
  res.json({ tasks: t });
});

app.patch('/api/tasks/:id', (req, res) => {
  for (const f of ['notes/tasks.md', 'tasks.md', 'TASKS.md', 'notes/todo.md']) {
    if (!fileExists(f)) continue;
    const fp = path.join(OPENCLAW_ROOT, f);
    const lines = fs.readFileSync(fp, 'utf-8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`id:${req.params.id}`)) {
        if (req.body.status) {
          const m = req.body.status === 'done' ? 'x' : req.body.status === 'in_progress' ? '-' : ' ';
          lines[i] = lines[i].replace(/\[([ x\-])\]/, `[${m}]`);
        }
        fs.writeFileSync(fp, lines.join('\n'));
        return res.json({ success: true, id: req.params.id });
      }
    }
  }
  res.status(404).json({ error: 'Task not found' });
});

app.post('/api/tasks', (req, res) => {
  let tf = '';
  for (const f of ['notes/tasks.md', 'tasks.md', 'TASKS.md']) { if (fileExists(f)) { tf = f; break; } }
  if (!tf) {
    tf = 'notes/tasks.md';
    const d = path.join(OPENCLAW_ROOT, 'notes');
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(OPENCLAW_ROOT, tf), '# Tasks\n\n');
  }
  const id = `task_${Date.now()}`, date = req.body.date || new Date().toISOString().split('T')[0];
  const line = `- [ ] [${req.body.priority || 'medium'}] [${req.body.category || 'general'}] ${req.body.title} | id:${id}`;
  const fp = path.join(OPENCLAW_ROOT, tf);
  let c = fs.readFileSync(fp, 'utf-8');
  if (c.includes(`## ${date}`)) { c = c.replace(`## ${date}`, `## ${date}\n${line}`); }
  else { c += `\n## ${date}\n${line}\n`; }
  fs.writeFileSync(fp, c);
  res.json({ id, title: req.body.title, status: 'open', date, priority: req.body.priority || 'medium', category: req.body.category || 'general' });
});

app.get('/api/processes', (req, res) => {
  res.json({ processes: parseProcesses() });
});

app.get('/api/skills', (req, res) => {
  res.json({ skills: parseAllSkills() });
});

app.get('/api/skills/:name/content', (req, res) => {
  for (const dir of [CUSTOM_SKILLS_DIR, SYSTEM_SKILLS_DIR]) {
    const sp = path.join(dir, req.params.name, 'SKILL.md');
    if (fs.existsSync(sp)) {
      return res.json({ name: req.params.name, content: fs.readFileSync(sp, 'utf-8') });
    }
  }
  res.status(404).json({ error: 'Skill not found' });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Clawdia API v1.1 on http://127.0.0.1:${PORT}`);
  console.log(`OpenClaw: ${OPENCLAW_ROOT}`);
  console.log(`Version: ${getVersion()}`);
  console.log(`System skills: ${SYSTEM_SKILLS_DIR}`);
  console.log(`Custom skills: ${CUSTOM_SKILLS_DIR}`);
  console.log(`Cron cache: ${CRON_CACHE_PATH}`);
});
