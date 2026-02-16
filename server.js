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

function readFile(f) { try { return fs.readFileSync(path.join(OPENCLAW_ROOT, f), 'utf-8'); } catch { return ''; } }
function fileExists(f) { try { return fs.existsSync(path.join(OPENCLAW_ROOT, f)); } catch { return false; } }

function getDirSize(d) {
  try {
    const fp = path.join(OPENCLAW_ROOT, d);
    if (!fs.existsSync(fp)) return 0;
    return parseInt(execSync(`du -sb "${fp}" 2>/dev/null | cut -f1`).toString().trim()) || 0;
  } catch { return 0; }
}

function formatBytes(b) { if (!b) return '0 B'; const k=1024; const s=['B','KB','MB','GB']; const i=Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(1))+' '+s[i]; }
function formatUptime(ms) { const s=Math.floor(ms/1000); return `${Math.floor(s/86400)}д ${Math.floor((s%86400)/3600)}ч ${Math.floor((s%3600)/60)}м`; }

function parseTasks() {
  const tasks = [];
  for (const f of ['notes/tasks.md','tasks.md','TASKS.md','notes/todo.md']) {
    const c = readFile(f); if (!c) continue;
    let date = new Date().toISOString().split('T')[0], id = 0;
    for (const line of c.split('\n')) {
      const dm = line.match(/^##\s+(\d{4}-\d{2}-\d{2})/);
      if (dm) { date = dm[1]; continue; }
      const tm = line.match(/^\s*-\s*\[([ x\-])\]\s*(.*)/);
      if (tm) {
        id++;
        const status = tm[1]==='x'?'done':tm[1]==='-'?'in_progress':'open';
        let text = tm[2], priority='medium', category='general';
        const pm = text.match(/\[(high|medium|low)\]/); if(pm){priority=pm[1];text=text.replace(pm[0],'');}
        const cm = text.match(/\[([^\]]+)\]/); if(cm){category=cm[1];text=text.replace(cm[0],'');}
        let tid = `task_${String(id).padStart(3,'0')}`;
        const im = text.match(/\|\s*id:(\S+)/); if(im){tid=im[1];text=text.replace(im[0],'');}
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
      const lines = c.split('\n').filter(l=>l.trim()&&!l.startsWith('#')&&!l.startsWith('---'));
      desc = lines[0] || '';
      if (c.includes('type: custom')) type = 'custom';
    }
    const stat = fs.statSync(path.join(dir, d.name));
    skills.push({ id:`skill_${String(i).padStart(3,'0')}`, name:d.name, type, active:true, description:desc, addedDate:stat.birthtime.toISOString().split('T')[0], usageCount:null });
  }
  return skills;
}

function parseProcesses() {
  const content = readFile('AGENTS.md'), procs = [];
  let i = 0;
  for (const line of content.split('\n')) {
    const m = line.match(/([\d\*\/]+\s+[\d\*\/]+\s+[\d\*\/]+\s+[\d\*\/]+\s+[\d\*\/]+)\s*[—-]?\s*(.*)/);
    if (m) { i++; procs.push({ id:`proc_${i}`, name:m[2].trim().split(' ').slice(0,3).join('-').toLowerCase()||'process-'+i, type:'cron', schedule:m[1], status:'running', lastRun:null, nextRun:null, description:m[2].trim() }); }
  }
  return procs;
}

// ── Endpoints ──

app.get('/api/status', (req, res) => {
  const tasks = parseTasks();
  const cur = tasks.find(t=>t.status==='in_progress');
  let ver = '1.0.0'; const vm = readFile('AGENTS.md').match(/version[:\s]+([\d.]+)/i); if(vm) ver=vm[1];
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
    const lines = fs.readFileSync(fp,'utf-8').split('\n');
    for (let i=0;i<lines.length;i++) {
      if (lines[i].includes(`id:${req.params.id}`)) {
        if (req.body.status) { const m=req.body.status==='done'?'x':req.body.status==='in_progress'?'-':' '; lines[i]=lines[i].replace(/\[([ x\-])\]/,`[${m}]`); }
        fs.writeFileSync(fp, lines.join('\n'));
        return res.json({ success:true, id:req.params.id });
      }
    }
  }
  res.status(404).json({ error:'Task not found' });
});

app.post('/api/tasks', (req, res) => {
  let tf='';
  for (const f of ['notes/tasks.md','tasks.md','TASKS.md']) { if(fileExists(f)){tf=f;break;} }
  if (!tf) { tf='notes/tasks.md'; const d=path.join(OPENCLAW_ROOT,'notes'); if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true}); fs.writeFileSync(path.join(OPENCLAW_ROOT,tf),'# Tasks\n\n'); }
  const id=`task_${Date.now()}`, date=req.body.date||new Date().toISOString().split('T')[0];
  const line=`- [ ] [${req.body.priority||'medium'}] [${req.body.category||'general'}] ${req.body.title} | id:${id}`;
  const fp=path.join(OPENCLAW_ROOT,tf); let c=fs.readFileSync(fp,'utf-8');
  if(c.includes(`## ${date}`)){c=c.replace(`## ${date}`,`## ${date}\n${line}`);}else{c+=`\n## ${date}\n${line}\n`;}
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

app.listen(PORT, '127.0.0.1', () => console.log(`Clawdia API on http://127.0.0.1:${PORT}`));
