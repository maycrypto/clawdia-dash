import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

const API_BASE = "/api";

// ===== API HOOKS =====
function useApi(endpoint) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}${endpoint}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// ===== MATRIX RAIN =====
function MatrixRain() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789CLAWDIA";
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops = Array(Math.floor(columns)).fill(1);
    function draw() {
      ctx.fillStyle = "rgba(10, 10, 15, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0f3";
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.globalAlpha = Math.random() * 0.3 + 0.05;
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      ctx.globalAlpha = 1;
    }
    const interval = setInterval(draw, 50);
    const handleResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener("resize", handleResize);
    return () => { clearInterval(interval); window.removeEventListener("resize", handleResize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0, opacity: 0.35, pointerEvents: "none" }} />;
}

// ===== GLITCH TEXT =====
function GlitchText({ text }) {
  return (
    <span style={{ position: "relative", display: "inline-block", animation: "glitch 3s infinite", textShadow: "0 0 10px rgba(0,255,100,0.7), 0 0 20px rgba(0,255,100,0.3)" }}>
      {text}
    </span>
  );
}

// ===== TYPING DOTS =====
function TypingDots() {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const interval = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 500);
    return () => clearInterval(interval);
  }, []);
  return <span style={{ color: "#0f3", fontFamily: "monospace" }}>{dots || "\u00A0"}</span>;
}

// ===== STATUS BADGE =====
function StatusBadge({ status }) {
  const config = {
    running: { label: "RUNNING", color: "#0f3", bg: "rgba(0,255,50,0.1)", shadow: "0 0 8px rgba(0,255,50,0.3)" },
    idle: { label: "IDLE", color: "#888", bg: "rgba(136,136,136,0.1)", shadow: "none" },
    open: { label: "OPEN", color: "#ff9f1c", bg: "rgba(255,159,28,0.1)", shadow: "0 0 8px rgba(255,159,28,0.2)" },
    in_progress: { label: "IN PROGRESS", color: "#0af", bg: "rgba(0,170,255,0.1)", shadow: "0 0 8px rgba(0,170,255,0.3)" },
    done: { label: "DONE", color: "#0f3", bg: "rgba(0,255,50,0.08)", shadow: "none" },
  };
  const c = config[status] || config.idle;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 10px", borderRadius: 4,
      fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, letterSpacing: "0.05em",
      color: c.color, background: c.bg, boxShadow: c.shadow, border: `1px solid ${c.color}22`, whiteSpace: "nowrap",
    }}>
      {(status === "running" || status === "in_progress") && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color, animation: "pulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
      )}
      {c.label}
    </span>
  );
}

// ===== PRIORITY DOT =====
function PriorityDot({ priority }) {
  const colors = { high: "#ff3366", medium: "#ff9f1c", low: "#555" };
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: colors[priority] || colors.low, boxShadow: priority === "high" ? "0 0 6px rgba(255,51,102,0.5)" : "none", flexShrink: 0 }} />;
}

// ===== CARD =====
function Card({ children, style = {}, onClick, onMouseEnter, onMouseLeave }) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ background: "rgba(15, 20, 25, 0.85)", border: "1px solid rgba(0,255,50,0.08)", borderRadius: 10, padding: 20, backdropFilter: "blur(10px)", ...style }}
    >
      {children}
    </div>
  );
}

// ===== LOADING =====
function LoadingState({ text = "Loading..." }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 20, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "#555" }}>
      <span style={{ color: "#0f3" }}>⟩</span> {text} <TypingDots />
    </div>
  );
}

// ===== ERROR =====
function ErrorState({ message, onRetry }) {
  return (
    <Card style={{ borderColor: "rgba(255,51,102,0.2)" }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "#ff3366", marginBottom: 10 }}>
        ⚠ Connection error: {message}
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#666", marginBottom: 14 }}>
        Убедись, что API запущен на сервере и порт 3100 открыт.
      </div>
      <button onClick={onRetry} style={{
        padding: "6px 16px", borderRadius: 5, border: "1px solid rgba(255,51,102,0.3)",
        background: "rgba(255,51,102,0.08)", color: "#ff3366", fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 12, cursor: "pointer",
      }}>Retry</button>
    </Card>
  );
}

// ===== NAV TAB =====
function NavTab({ label, icon, active, onClick, count }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
      background: active ? "rgba(0,255,50,0.08)" : "transparent",
      border: active ? "1px solid rgba(0,255,50,0.2)" : "1px solid transparent",
      borderRadius: 6, color: active ? "#0f3" : "#666",
      fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: active ? 600 : 400,
      cursor: "pointer", transition: "all 0.2s ease", letterSpacing: "0.02em",
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
      {count !== undefined && (
        <span style={{
          fontSize: 11, padding: "1px 7px", borderRadius: 10,
          background: active ? "rgba(0,255,50,0.15)" : "rgba(255,255,255,0.05)",
          color: active ? "#0f3" : "#555",
        }}>{count}</span>
      )}
    </button>
  );
}

// ===== OVERVIEW TAB =====
function OverviewTab() {
  const { data: statusData, loading: sLoading, error: sError, refetch: sRefetch } = useApi("/status");
  const { data: tasksData, loading: tLoading } = useApi("/tasks");
  const { data: processesData, loading: pLoading } = useApi("/processes");

  if (sLoading && !statusData) return <LoadingState text="Connecting to Clawdia" />;
  if (sError) return <ErrorState message={sError} onRetry={sRefetch} />;

  const agent = statusData;
  const todayTasks = (tasksData?.tasks || []).filter(t => {
    const today = new Date().toISOString().split("T")[0];
    return t.date === today;
  });
  const runningProcesses = (processesData?.processes || []).filter(p => p.status === "running");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "#555", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 4, letterSpacing: "0.1em" }}>AGENT STATUS</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StatusBadge status="running" />
              <span style={{ color: "#aaa", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>uptime: {agent?.uptime || "—"}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[
              { label: "TASKS", value: `${agent?.completedTasks || 0}/${agent?.totalTasks || 0}` },
              { label: "MEMORY", value: agent?.memorySize || "—" },
              { label: "VERSION", value: `v${agent?.version || "?"}` },
            ].map(item => (
              <div key={item.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#555", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.1em", marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 18, color: "#0f3", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {agent?.currentTask && (
        <Card>
          <div style={{ fontSize: 11, color: "#555", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 12, letterSpacing: "0.1em" }}>{'>'} CURRENT ACTIVITY</div>
          <div style={{
            padding: "12px 16px", background: "rgba(0,255,50,0.03)", border: "1px solid rgba(0,255,50,0.1)",
            borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: "#ddd",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ color: "#0f3" }}>⟩</span>
            {agent.currentTask}
            <TypingDots />
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ fontSize: 11, color: "#555", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 12, letterSpacing: "0.1em" }}>
            {'>'} TODAY'S TASKS ({tLoading ? "..." : todayTasks.length})
          </div>
          {tLoading ? <LoadingState text="Loading tasks" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {todayTasks.length === 0 && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#444" }}>Нет задач на сегодня</div>}
              {todayTasks.slice(0, 6).map(task => (
                <div key={task.id} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                  background: "rgba(255,255,255,0.02)", borderRadius: 6,
                  borderLeft: `2px solid ${task.status === "done" ? "#0f3" : task.status === "in_progress" ? "#0af" : "#333"}`,
                }}>
                  <PriorityDot priority={task.priority} />
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, flex: 1,
                    color: task.status === "done" ? "#555" : "#ccc",
                    textDecoration: task.status === "done" ? "line-through" : "none",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{task.title}</span>
                  <StatusBadge status={task.status} />
                </div>
              ))}
              {todayTasks.length > 6 && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#555", paddingLeft: 12 }}>+ ещё {todayTasks.length - 6}...</div>}
            </div>
          )}
        </Card>

        <Card>
          <div style={{ fontSize: 11, color: "#555", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 12, letterSpacing: "0.1em" }}>
            {'>'} ACTIVE PROCESSES ({pLoading ? "..." : runningProcesses.length})
          </div>
          {pLoading ? <LoadingState text="Loading processes" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {runningProcesses.map(proc => (
                <div key={proc.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px",
                  background: "rgba(255,255,255,0.02)", borderRadius: 6, borderLeft: "2px solid rgba(0,255,50,0.3)",
                }}>
                  <div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "#ccc" }}>{proc.name}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#555", marginTop: 2 }}>
                      next: {proc.nextRun ? new Date(proc.nextRun).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </div>
                  </div>
                  <StatusBadge status={proc.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ===== TASKS TAB =====
function TasksTab() {
  const { data, loading, error, refetch } = useApi("/tasks");
  const [filter, setFilter] = useState("all");
  const [saving, setSaving] = useState(false);

  const [assigneeFilter, setAssigneeFilter] = useState("all");

  if (loading && !data) return <LoadingState text="Loading tasks" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const tasks = data?.tasks || [];
  let filtered = filter === "all" ? tasks : tasks.filter(t => t.status === filter);
  if (assigneeFilter !== "all") filtered = filtered.filter(t => (t.assignee || "agent") === assigneeFilter);

  const grouped = {};
  filtered.forEach(task => {
    const date = task.date || "undated";
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(task);
  });
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const formatDate = (dateStr) => {
    if (dateStr === "undated") return "Без даты";
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    if (dateStr === today) return `Сегодня — ${new Date(dateStr).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`;
    if (dateStr === tomorrow) return `Завтра — ${new Date(dateStr).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`;
    return new Date(dateStr).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  };

  const toggleStatus = async (task) => {
    const nextStatus = task.status === "done" ? "open" : task.status === "open" ? "in_progress" : "done";
    setSaving(true);
    try {
      await fetch(`${API_BASE}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      await refetch();
    } catch (err) {
      console.error("Failed to update task:", err);
    } finally {
      setSaving(false);
    }
  };

  const statusCounts = {
    all: tasks.length,
    open: tasks.filter(t => t.status === "open").length,
    in_progress: tasks.filter(t => t.status === "in_progress").length,
    done: tasks.filter(t => t.status === "done").length,
  };

  const agentCount = tasks.filter(t => (t.assignee || "agent") === "agent").length;
  const meCount = tasks.filter(t => t.assignee === "me").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { key: "all", label: "Все" },
          { key: "open", label: "Открытые" },
          { key: "in_progress", label: "В работе" },
          { key: "done", label: "Выполнены" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: "6px 14px", borderRadius: 5,
            border: `1px solid ${filter === f.key ? "rgba(0,255,50,0.3)" : "rgba(255,255,255,0.06)"}`,
            background: filter === f.key ? "rgba(0,255,50,0.08)" : "rgba(255,255,255,0.02)",
            color: filter === f.key ? "#0f3" : "#666",
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, cursor: "pointer", transition: "all 0.2s",
          }}>
            {f.label} ({statusCounts[f.key]})
          </button>
        ))}
        <span style={{ width: 1, height: 20, background: "rgba(255,255,255,0.06)", margin: "0 4px" }} />
        {[
          { key: "all", label: "Все" },
          { key: "agent", label: "Агент" },
          { key: "me", label: "Мои" },
        ].map(f => (
          <button key={`a_${f.key}`} onClick={() => setAssigneeFilter(f.key)} style={{
            padding: "6px 14px", borderRadius: 5,
            border: `1px solid ${assigneeFilter === f.key ? "rgba(0,170,255,0.3)" : "rgba(255,255,255,0.06)"}`,
            background: assigneeFilter === f.key ? "rgba(0,170,255,0.08)" : "rgba(255,255,255,0.02)",
            color: assigneeFilter === f.key ? "#0af" : "#666",
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, cursor: "pointer", transition: "all 0.2s",
          }}>
            {f.label} ({f.key === "all" ? tasks.length : f.key === "agent" ? agentCount : meCount})
          </button>
        ))}
      </div>

      {sortedDates.map(date => (
        <Card key={date}>
          <div style={{
            fontSize: 12, color: "#0f3", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 12,
            paddingBottom: 8, borderBottom: "1px solid rgba(0,255,50,0.08)", letterSpacing: "0.05em",
          }}>{'>'} {formatDate(date)}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {grouped[date].map(task => (
              <div key={task.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                background: "rgba(255,255,255,0.015)", borderRadius: 6,
                borderLeft: `2px solid ${task.status === "done" ? "#0f3" : task.status === "in_progress" ? "#0af" : "#333"}`,
                transition: "background 0.2s", cursor: "pointer", opacity: saving ? 0.6 : 1,
              }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(0,255,50,0.03)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.015)"}
              >
                <div onClick={() => toggleStatus(task)} style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: task.status === "done" ? "1px solid #0f3" : "1px solid #333",
                  background: task.status === "done" ? "rgba(0,255,50,0.15)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, color: "#0f3", flexShrink: 0, cursor: "pointer",
                }}>
                  {task.status === "done" ? "✓" : task.status === "in_progress" ? "—" : ""}
                </div>
                <PriorityDot priority={task.priority} />
                {task.assignee && (
                  <span style={{
                    fontSize: 9, padding: "1px 6px", borderRadius: 3, flexShrink: 0,
                    background: task.assignee === "me" ? "rgba(255,159,28,0.1)" : "rgba(0,170,255,0.1)",
                    color: task.assignee === "me" ? "#ff9f1c" : "#0af",
                    fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, letterSpacing: "0.05em",
                  }}>{task.assignee === "me" ? "ME" : "BOT"}</span>
                )}
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, flex: 1,
                  color: task.status === "done" ? "#444" : "#ccc",
                  textDecoration: task.status === "done" ? "line-through" : "none",
                }}>
                  {task.title}
                  {task.deadline && task.status !== "done" && (
                    <span style={{ fontSize: 11, color: "#666", marginLeft: 8 }}>
                      {new Date(task.deadline).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </span>
                {task.category && (
                  <span style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 3,
                    background: "rgba(255,255,255,0.04)", color: "#555",
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}>{task.category}</span>
                )}
                <StatusBadge status={task.status} />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ===== PROCESSES TAB =====
function ProcessesTab() {
  const { data, loading, error, refetch } = useApi("/processes");
  if (loading && !data) return <LoadingState text="Loading processes" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const processes = data?.processes || [];
  const formatTime = (iso) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch { return iso; }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {processes.map(proc => (
        <Card key={proc.id}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, color: "#eee", fontWeight: 600 }}>{proc.name}</span>
              <StatusBadge status={proc.status} />
              <span style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 3,
                background: "rgba(0,170,255,0.1)", color: "#0af",
                fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, letterSpacing: "0.05em",
              }}>CRON</span>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#777", marginBottom: 10, lineHeight: 1.4 }}>{proc.description}</div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {[
                { label: "schedule", value: proc.schedule || "—" },
                { label: "last run", value: formatTime(proc.lastRun) },
                { label: "next run", value: formatTime(proc.nextRun) },
              ].map(item => (
                <div key={item.label} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                  <span style={{ color: "#444" }}>{item.label}: </span>
                  <span style={{ color: "#0f3" }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ===== SIMPLE MARKDOWN RENDERER =====
function MarkdownView({ text }) {
  // Strip YAML frontmatter (---...---)
  let cleaned = text;
  if (cleaned.startsWith("---")) {
    const endIndex = cleaned.indexOf("---", 3);
    if (endIndex !== -1) {
      cleaned = cleaned.slice(endIndex + 3).trim();
    }
  }

  const lines = cleaned.split("\n");
  const elements = [];
  let inCodeBlock = false;
  let codeLines = [];
  let codeLang = "";
  let lastWasEmpty = false;

  const renderInline = (str) => {
    // Bold
    str = str.replace(/\*\*(.+?)\*\*/g, '⟨b⟩$1⟨/b⟩');
    // Inline code
    str = str.replace(/`([^`]+)`/g, '⟨code⟩$1⟨/code⟩');
    // Links
    str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '⟨a⟩$1⟨/a⟩');

    const parts = str.split(/(⟨\/?[a-z]+⟩)/);
    const result = [];
    let bold = false, code = false;

    for (const part of parts) {
      if (part === "⟨b⟩") { bold = true; continue; }
      if (part === "⟨/b⟩") { bold = false; continue; }
      if (part === "⟨code⟩") { code = true; continue; }
      if (part === "⟨/code⟩") { code = false; continue; }
      if (part === "⟨a⟩") { continue; }
      if (part === "⟨/a⟩") { continue; }
      if (!part) continue;

      if (code) {
        result.push(<span key={result.length} style={{ background: "rgba(0,255,50,0.08)", padding: "1px 6px", borderRadius: 3, fontSize: 12, color: "#0f3" }}>{part}</span>);
      } else if (bold) {
        result.push(<strong key={result.length} style={{ color: "#eee", fontWeight: 600 }}>{part}</strong>);
      } else {
        result.push(part);
      }
    }
    return result;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <div key={i} style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(0,255,50,0.1)", borderRadius: 6, padding: "12px 16px", marginBottom: 12, overflowX: "auto" }}>
            {codeLang && <div style={{ fontSize: 10, color: "#555", marginBottom: 6, letterSpacing: "0.05em" }}>{codeLang.toUpperCase()}</div>}
            <pre style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#aaa", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{codeLines.join("\n")}</pre>
          </div>
        );
        codeLines = [];
        codeLang = "";
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = line.replace("```", "").trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Empty line — collapse consecutive empties
    if (!line.trim()) {
      if (!lastWasEmpty) {
        elements.push(<div key={i} style={{ height: 6 }} />);
        lastWasEmpty = true;
      }
      continue;
    }
    lastWasEmpty = false;

    // Headers
    if (line.startsWith("# ")) {
      elements.push(<div key={i} style={{ fontSize: 20, fontWeight: 700, color: "#0f3", marginBottom: 8, marginTop: 16, fontFamily: "'IBM Plex Mono', monospace" }}>{line.slice(2)}</div>);
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(<div key={i} style={{ fontSize: 16, fontWeight: 600, color: "#eee", marginBottom: 6, marginTop: 14, fontFamily: "'IBM Plex Mono', monospace" }}>{line.slice(3)}</div>);
      continue;
    }
    if (line.startsWith("### ")) {
      elements.push(<div key={i} style={{ fontSize: 14, fontWeight: 600, color: "#ccc", marginBottom: 4, marginTop: 12, fontFamily: "'IBM Plex Mono', monospace" }}>{line.slice(4)}</div>);
      continue;
    }

    // Horizontal rule
    if (line.match(/^-{3,}$/) || line.match(/^\*{3,}$/)) {
      elements.push(<div key={i} style={{ height: 1, background: "rgba(0,255,50,0.1)", margin: "12px 0" }} />);
      continue;
    }

    // List items
    if (line.match(/^\s*[-*]\s/)) {
      const indent = line.match(/^(\s*)/)[1].length;
      const text = line.replace(/^\s*[-*]\s/, "");
      elements.push(
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4, paddingLeft: indent * 8, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "#aaa", lineHeight: 1.5 }}>
          <span style={{ color: "#0f3", flexShrink: 0 }}>•</span>
          <span>{renderInline(text)}</span>
        </div>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <div key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "#aaa", lineHeight: 1.6, marginBottom: 4 }}>
        {renderInline(line)}
      </div>
    );
  }

  return <div>{elements}</div>;
}

// ===== SKILL MODAL =====
function SkillModal({ skill, onClose }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/skills/${skill.name}/content`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => { setContent(data.content); setError(null); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [skill.name]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#0d1117", border: "1px solid rgba(0,255,50,0.15)",
          borderRadius: 12, width: "100%", maxWidth: 750, maxHeight: "85vh",
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 0 40px rgba(0,255,50,0.05), 0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: "1px solid rgba(0,255,50,0.08)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: "#eee", fontWeight: 600 }}>
              {skill.name}
            </span>
            <span style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 3,
              background: skill.type === "system" ? "rgba(0,170,255,0.1)" : "rgba(255,159,28,0.1)",
              color: skill.type === "system" ? "#0af" : "#ff9f1c",
              fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
            }}>{(skill.type || "system").toUpperCase()}</span>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: skill.active ? "#0f3" : "#333",
              boxShadow: skill.active ? "0 0 6px rgba(0,255,50,0.4)" : "none",
            }} />
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)", color: "#666", fontSize: 18,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "monospace", transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#ff3366"; e.currentTarget.style.borderColor = "rgba(255,51,102,0.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#666"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          {loading && <LoadingState text={`Loading ${skill.name}/SKILL.md`} />}
          {error && (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "#ff3366" }}>
              ⚠ Не удалось загрузить: {error}
              <div style={{ color: "#555", fontSize: 12, marginTop: 8 }}>
                Возможно, нужно добавить эндпоинт GET /api/skills/:name/content
              </div>
            </div>
          )}
          {content && <MarkdownView text={content} />}
        </div>

        {/* Footer */}
        <div style={{
          padding: "10px 20px", borderTop: "1px solid rgba(0,255,50,0.05)",
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#333",
          display: "flex", gap: 16, flexShrink: 0,
        }}>
          <span>skills/{skill.name}/SKILL.md</span>
          {skill.addedDate && <span>added: {skill.addedDate}</span>}
          {skill.usageCount != null && <span>uses: {skill.usageCount}</span>}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ===== SKILLS TAB =====
function SkillsTab() {
  const { data, loading, error, refetch } = useApi("/skills");
  const [showType, setShowType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState(null);

  if (loading && !data) return <LoadingState text="Loading skills" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const skills = data?.skills || [];
  let filtered = showType === "all" ? skills : skills.filter(s => s.type === showType);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(s => s.name?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q));
  }

  const systemCount = skills.filter(s => s.type === "system").length;
  const customCount = skills.filter(s => s.type === "custom").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {selectedSkill && <SkillModal skill={selectedSkill} onClose={() => setSelectedSkill(null)} />}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { key: "all", label: `Все (${skills.length})` },
            { key: "system", label: `Системные (${systemCount})` },
            { key: "custom", label: `Мои (${customCount})` },
          ].map(f => (
            <button key={f.key} onClick={() => setShowType(f.key)} style={{
              padding: "6px 14px", borderRadius: 5,
              border: `1px solid ${showType === f.key ? "rgba(0,255,50,0.3)" : "rgba(255,255,255,0.06)"}`,
              background: showType === f.key ? "rgba(0,255,50,0.08)" : "rgba(255,255,255,0.02)",
              color: showType === f.key ? "#0f3" : "#666",
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, cursor: "pointer", transition: "all 0.2s",
            }}>{f.label}</button>
          ))}
        </div>
        <input
          type="text" placeholder="Поиск скиллов..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            padding: "6px 14px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)", color: "#ccc",
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, outline: "none", flex: 1, minWidth: 180,
          }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {filtered.map(skill => (
          <Card key={skill.id} style={{
            borderLeft: `2px solid ${skill.active ? (skill.type === "system" ? "rgba(0,170,255,0.4)" : "rgba(0,255,50,0.4)") : "rgba(255,255,255,0.05)"}`,
            opacity: skill.active ? 1 : 0.5,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
            onClick={() => setSelectedSkill(skill)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,255,50,0.3)"; e.currentTarget.style.background = "rgba(15,25,30,0.95)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,255,50,0.08)"; e.currentTarget.style.background = "rgba(15,20,25,0.85)"; }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: "#eee", fontWeight: 600 }}>{skill.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 3,
                  background: skill.type === "system" ? "rgba(0,170,255,0.1)" : "rgba(255,159,28,0.1)",
                  color: skill.type === "system" ? "#0af" : "#ff9f1c",
                  fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
                }}>{(skill.type || "system").toUpperCase()}</span>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: skill.active ? "#0f3" : "#333",
                  boxShadow: skill.active ? "0 0 6px rgba(0,255,50,0.4)" : "none",
                }} />
              </div>
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#666", marginBottom: 10,
              lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>{skill.description || "—"}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 16 }}>
                {skill.usageCount != null && (
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>
                    <span style={{ color: "#444" }}>uses: </span><span style={{ color: "#0f3" }}>{skill.usageCount}</span>
                  </div>
                )}
                {skill.addedDate && (
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>
                    <span style={{ color: "#444" }}>added: </span><span style={{ color: "#888" }}>{skill.addedDate}</span>
                  </div>
                )}
              </div>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#333" }}>click to open →</span>
            </div>
          </Card>
        ))}
      </div>
      {filtered.length === 0 && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "#444", textAlign: "center", padding: 30 }}>Ничего не найдено</div>
      )}
    </div>
  );
}

// ===== MAIN =====
export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loaded, setLoaded] = useState(false);
  const [connectionOk, setConnectionOk] = useState(null);

  useEffect(() => {
    setTimeout(() => setLoaded(true), 100);
    fetch(`${API_BASE}/status`).then(res => setConnectionOk(res.ok)).catch(() => setConnectionOk(false));
  }, []);

  const { data: statusData } = useApi("/status");
  const { data: tasksData } = useApi("/tasks");
  const { data: skillsData } = useApi("/skills");
  const { data: processesData } = useApi("/processes");

  const taskCount = (tasksData?.tasks || []).filter(t => t.status !== "done").length;
  const processCount = (processesData?.processes || []).filter(p => p.status === "running").length;
  const skillCount = (skillsData?.skills || []).filter(s => s.active).length;

  const tabs = {
    overview: { label: "Overview", icon: "◈", component: <OverviewTab /> },
    tasks: { label: "Tasks", icon: "☰", count: taskCount || undefined, component: <TasksTab /> },
    processes: { label: "Processes", icon: "⟳", count: processCount || undefined, component: <ProcessesTab /> },
    skills: { label: "Skills", icon: "⚡", count: skillCount || undefined, component: <SkillsTab /> },
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#ccc", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Share+Tech+Mono&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glitch {
          0%, 100% { text-shadow: 0 0 10px rgba(0,255,100,0.7), 0 0 20px rgba(0,255,100,0.3); }
          92% { text-shadow: 0 0 10px rgba(0,255,100,0.7), 0 0 20px rgba(0,255,100,0.3); }
          93% { text-shadow: -2px 0 #f0f, 2px 0 #0ff; } 94% { text-shadow: 0 0 10px rgba(0,255,100,0.7); }
          95% { text-shadow: 2px 0 #f0f, -2px 0 #0ff; }
          96% { text-shadow: 0 0 10px rgba(0,255,100,0.7), 0 0 20px rgba(0,255,100,0.3); }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,50,0.2); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(0,255,50,0.4); }
      `}</style>

      <MatrixRain />
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,50,0.01) 2px, rgba(0,255,50,0.01) 4px)", pointerEvents: "none", zIndex: 1 }} />

      <div style={{
        position: "relative", zIndex: 2, maxWidth: 1100, margin: "0 auto", padding: "24px 20px",
        opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(20px)", transition: "all 0.6s ease",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32, padding: "20px 0" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 42, fontWeight: 700, color: "#0f3", letterSpacing: "0.15em", marginBottom: 4 }}>
            <GlitchText text="CLAWDIA" />
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#444", letterSpacing: "0.3em" }}>by May</div>
          <div style={{ width: 60, height: 1, background: "linear-gradient(90deg, transparent, #0f3, transparent)", margin: "12px auto 0" }} />
          <div style={{ marginTop: 8, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: connectionOk === true ? "#0f3" : connectionOk === false ? "#ff3366" : "#555", letterSpacing: "0.1em" }}>
            {connectionOk === true ? "● CONNECTED" : connectionOk === false ? "● OFFLINE — check API" : "● CONNECTING..."}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 24, padding: 4, background: "rgba(15, 20, 25, 0.6)", borderRadius: 8, border: "1px solid rgba(0,255,50,0.05)", flexWrap: "wrap" }}>
          {Object.entries(tabs).map(([key, tab]) => (
            <NavTab key={key} label={tab.label} icon={tab.icon} active={activeTab === key} onClick={() => setActiveTab(key)} count={tab.count} />
          ))}
        </div>

        <div style={{ animation: "fadeIn 0.3s ease" }} key={activeTab}>
          {tabs[activeTab].component}
        </div>

        <div style={{ textAlign: "center", marginTop: 40, padding: "16px 0", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#333", borderTop: "1px solid rgba(0,255,50,0.05)" }}>
          OpenClaw.ai — {statusData?.name || "Clawdia"} v{statusData?.version || "?"} — {connectionOk ? "connected" : "disconnected"}
        </div>
      </div>
    </div>
  );
}
