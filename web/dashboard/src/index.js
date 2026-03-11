import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import io from 'socket.io-client';

const API_BASE = '/api';
const socket = io();

// ============ i18n Translations ============
const translations = {
  en: {
    // Navigation
    dashboard: 'Dashboard',
    agents: 'Agents',
    tasks: 'Tasks',
    sessions: 'Sessions',
    
    // Stats
    sessionsTitle: 'Sessions',
    agentsTitle: 'Agents',
    totalTasks: 'Total Tasks',
    completed: 'Completed',
    
    // Panels
    quickCommand: 'Quick Command',
    activityLog: 'Activity Log',
    agentsPanel: 'Agents',
    tasksPanel: 'Tasks',
    sessionsPanel: 'Sessions',
    
    // Table Headers
    name: 'Name',
    type: 'Type',
    status: 'Status',
    tasksCount: 'Tasks',
    rejects: 'Rejects',
    actions: 'Actions',
    id: 'ID',
    title: 'Title',
    agent: 'Agent',
    priority: 'Priority',
    created: 'Created',
    updated: 'Updated',
    
    // Buttons
    pause: 'Pause',
    resume: 'Resume',
    cancel: 'Cancel',
    remove: 'Remove',
    execute: 'Execute',
    processing: 'Processing...',
    submitting: 'Submitting...',
    
    // Log Filter
    all: 'All',
    info: 'Info',
    warning: 'Warning',
    error: 'Error',
    filter: 'Filter',
    clearLog: 'Clear',
    
    // Placeholders
    enterInstruction: 'Enter your instruction... (e.g., "Create a REST API for user management")',
    enterResponses: 'Enter responses separated by semicolons...',
    
    // Messages
    understanding: 'Understanding',
    questions: 'Questions',
    submitClarification: 'Submit Clarification',
    noActivity: 'No activity yet',
    noAgents: 'No agents found',
    noTasks: 'No tasks found',
    noSessions: 'No sessions found',
    connected: 'Connected to server',
    taskCreated: 'Task created',
    taskAssigned: 'Task assigned',
    taskCompleted: 'Task completed',
    taskRejected: 'Task rejected',
    agentCreated: 'Agent created',
    clarificationNeeded: 'Clarification needed',
    orchestratorPaused: 'Orchestrator paused',
    orchestratorResumed: 'Orchestrator resumed',
    agentRemoved: 'Agent removed',
    instructionProcessed: 'Instruction processed successfully',
    clarificationSubmitted: 'Clarification submitted',
    
    // Status
    active: 'active',
    idle: 'idle',
    busy: 'busy',
    ready: 'ready',
    pending: 'pending',
    completed_status: 'completed',
    failed: 'failed',
    
    // Language
    language: 'Language',
    english: 'English',
    chinese: '中文',
    
    // Tools
    tools: 'Tools',
    toolsPanel: 'Tools',
    toolName: 'Name',
    toolCategory: 'Category',
    toolStatus: 'Status',
    toolExecutions: 'Executions',
    enable: 'Enable',
    disable: 'Disable',
    noTools: 'No tools available',
    
    // Skills
    skills: 'Skills',
    skillsPanel: 'Skills',
    skillVersion: 'Version',
    skillAuthor: 'Author',
    noSkills: 'No skills installed',
    installSkill: 'Install Skill',
    
    // Rules
    rules: 'Rules',
    rulesPanel: 'Rules',
    ruleType: 'Type',
    rulePriority: 'Priority',
    noRules: 'No rules defined',
    
    // MCP
    mcp: 'MCP',
    mcpPanel: 'MCP Clients',
    mcpConnected: 'Connected',
    mcpDisconnected: 'Disconnected',
    noMCPClients: 'No MCP clients configured',
    addClient: 'Add Client',
  },
  zh: {
    // Navigation
    dashboard: '仪表盘',
    agents: '智能体',
    tasks: '任务',
    sessions: '会话',
    
    // Stats
    sessionsTitle: '会话数',
    agentsTitle: '智能体数',
    totalTasks: '总任务数',
    completed: '已完成',
    
    // Panels
    quickCommand: '快速命令',
    activityLog: '活动日志',
    agentsPanel: '智能体',
    tasksPanel: '任务',
    sessionsPanel: '会话',
    
    // Table Headers
    name: '名称',
    type: '类型',
    status: '状态',
    tasksCount: '任务数',
    rejects: '打回次数',
    actions: '操作',
    id: 'ID',
    title: '标题',
    agent: '智能体',
    priority: '优先级',
    created: '创建时间',
    updated: '更新时间',
    
    // Buttons
    pause: '暂停',
    resume: '继续',
    cancel: '取消',
    remove: '删除',
    execute: '执行',
    processing: '处理中...',
    submitting: '提交中...',
    
    // Log Filter
    all: '全部',
    info: '信息',
    warning: '警告',
    error: '错误',
    filter: '筛选',
    clearLog: '清空',
    
    // Placeholders
    enterInstruction: '输入您的指令...（例如："创建一个用户管理的 REST API"）',
    enterResponses: '输入回答，用分号分隔...',
    
    // Messages
    understanding: '理解',
    questions: '问题',
    submitClarification: '提交澄清',
    noActivity: '暂无活动',
    noAgents: '暂无智能体',
    noTasks: '暂无任务',
    noSessions: '暂无会话',
    connected: '已连接到服务器',
    taskCreated: '任务已创建',
    taskAssigned: '任务已分配',
    taskCompleted: '任务已完成',
    taskRejected: '任务被打回',
    agentCreated: '智能体已创建',
    clarificationNeeded: '需要澄清',
    orchestratorPaused: '编排器已暂停',
    orchestratorResumed: '编排器已恢复',
    agentRemoved: '智能体已删除',
    instructionProcessed: '指令处理成功',
    clarificationSubmitted: '澄清已提交',
    
    // Status
    active: '活跃',
    idle: '空闲',
    busy: '忙碌',
    ready: '就绪',
    pending: '待处理',
    completed_status: '已完成',
    failed: '失败',
    
    // Language
    language: '语言',
    english: 'English',
    chinese: '中文',
    
    // Tools
    tools: '工具',
    toolsPanel: '工具',
    toolName: '名称',
    toolCategory: '分类',
    toolStatus: '状态',
    toolExecutions: '执行次数',
    enable: '启用',
    disable: '禁用',
    noTools: '暂无工具',
    
    // Skills
    skills: '技能',
    skillsPanel: '技能',
    skillVersion: '版本',
    skillAuthor: '作者',
    noSkills: '暂无已安装的技能',
    installSkill: '安装技能',
    
    // Rules
    rules: '规则',
    rulesPanel: '规则',
    ruleType: '类型',
    rulePriority: '优先级',
    noRules: '暂无定义的规则',
    
    // MCP
    mcp: 'MCP',
    mcpPanel: 'MCP 客户端',
    mcpConnected: '已连接',
    mcpDisconnected: '已断开',
    noMCPClients: '暂无配置的 MCP 客户端',
    addClient: '添加客户端',
  }
};

// ============ Styles ============
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    color: '#e0e0e0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    background: 'rgba(0,0,0,0.3)',
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  logo: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#00d9ff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  nav: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  navBtn: {
    padding: '8px 16px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    color: '#e0e0e0',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  navBtnActive: {
    background: 'rgba(0,217,255,0.2)',
    borderColor: '#00d9ff',
    color: '#00d9ff',
  },
  langBtn: {
    padding: '6px 12px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    color: '#e0e0e0',
    cursor: 'pointer',
    fontSize: '12px',
    marginLeft: '12px',
  },
  main: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
    marginBottom: '24px',
  },
  card: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  cardTitle: {
    fontSize: '14px',
    color: '#888',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  cardValue: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#fff',
  },
  cardChange: {
    fontSize: '12px',
    marginTop: '4px',
  },
  panel: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    marginBottom: '24px',
  },
  panelHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
  },
  panelBody: {
    padding: '20px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '12px',
    fontSize: '12px',
    color: '#888',
    textTransform: 'uppercase',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  td: {
    padding: '12px',
    fontSize: '14px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  badge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  },
  btn: {
    padding: '10px 20px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  btnPrimary: {
    background: '#00d9ff',
    color: '#1a1a2e',
  },
  btnSecondary: {
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
  },
  btnDanger: {
    background: '#ff4757',
    color: '#fff',
  },
  input: {
    width: '100%',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(0,0,0,0.2)',
    color: '#fff',
    fontSize: '14px',
    marginBottom: '12px',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(0,0,0,0.2)',
    color: '#fff',
    fontSize: '14px',
    minHeight: '100px',
    resize: 'vertical',
    marginBottom: '12px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
    marginRight: '8px',
  },
  logContainer: {
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '6px',
    padding: '12px',
    maxHeight: '300px',
    overflowY: 'auto',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  logLine: {
    padding: '4px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  logTime: {
    color: '#666',
    marginRight: '8px',
  },
  logType: {
    padding: '2px 6px',
    borderRadius: '3px',
    marginRight: '8px',
    fontSize: '10px',
    textTransform: 'uppercase',
  },
  empty: {
    textAlign: 'center',
    padding: '40px',
    color: '#666',
  },
  flex: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  flexBetween: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterBtn: {
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent',
    color: '#e0e0e0',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s',
  },
  filterBtnActive: {
    background: 'rgba(0,217,255,0.2)',
    borderColor: '#00d9ff',
    color: '#00d9ff',
  },
  filterBtnInfo: {
    borderColor: '#00d9ff',
  },
  filterBtnInfoActive: {
    background: 'rgba(0,217,255,0.3)',
    color: '#00d9ff',
  },
  filterBtnWarning: {
    borderColor: '#ffa502',
  },
  filterBtnWarningActive: {
    background: 'rgba(255,165,2,0.3)',
    color: '#ffa502',
  },
  filterBtnError: {
    borderColor: '#ff4757',
  },
  filterBtnErrorActive: {
    background: 'rgba(255,71,87,0.3)',
    color: '#ff4757',
  },
  clearBtn: {
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid rgba(255,71,87,0.3)',
    background: 'transparent',
    color: '#ff4757',
    cursor: 'pointer',
    fontSize: '12px',
    marginLeft: '8px',
  },
};

const statusColors = {
  active: '#2ed573',
  completed: '#00d9ff',
  pending: '#ffa502',
  failed: '#ff4757',
  idle: '#888',
  busy: '#ffa502',
  ready: '#2ed573',
};

const logTypeColors = {
  info: { bg: 'rgba(0,217,255,0.2)', color: '#00d9ff' },
  warning: { bg: 'rgba(255,165,2,0.2)', color: '#ffa502' },
  error: { bg: 'rgba(255,71,87,0.2)', color: '#ff4757' },
  task_created: { bg: 'rgba(0,217,255,0.2)', color: '#00d9ff' },
  task_completed: { bg: 'rgba(46,213,115,0.2)', color: '#2ed573' },
  task_rejected: { bg: 'rgba(255,71,87,0.2)', color: '#ff4757' },
  agent_created: { bg: 'rgba(255,165,2,0.2)', color: '#ffa502' },
};

// ============ Components ============

function StatusBadge({ status, t }) {
  const color = statusColors[status] || '#888';
  const statusText = t[status] || status;
  return (
    <span style={{ ...styles.badge, background: color + '20', color: color }}>
      <span style={{ ...styles.statusDot, background: color }}></span>
      {statusText}
    </span>
  );
}

function StatCard({ title, value, change, icon }) {
  return (
    <div style={styles.card}>
      <div style={{ ...styles.flexBetween, marginBottom: '8px' }}>
        <span style={styles.cardTitle}>{title}</span>
        <span style={{ fontSize: '24px' }}>{icon}</span>
      </div>
      <div style={styles.cardValue}>{value}</div>
      {change && (
        <div style={{ ...styles.cardChange, color: change > 0 ? '#2ed573' : '#ff4757' }}>
          {change > 0 ? '+' : ''}{change}
        </div>
      )}
    </div>
  );
}

function AgentRow({ agent, onRemove, t }) {
  return (
    <tr>
      <td style={styles.td}><strong>{agent.name || agent.id}</strong></td>
      <td style={styles.td}>{agent.type || 'static'}</td>
      <td style={styles.td}><StatusBadge status={agent.status || 'idle'} t={t} /></td>
      <td style={styles.td}>{agent.taskCount || 0}</td>
      <td style={styles.td}>{agent.rejectCount || 0}</td>
      <td style={styles.td}>
        <button 
          style={{ ...styles.btn, ...styles.btnDanger, padding: '4px 8px', fontSize: '12px' }}
          onClick={() => onRemove(agent.id)}
        >
          {t.remove}
        </button>
      </td>
    </tr>
  );
}

function TaskRow({ task, t }) {
  return (
    <tr>
      <td style={styles.td}><strong>{task.id}</strong></td>
      <td style={styles.td}>{task.title}</td>
      <td style={styles.td}><StatusBadge status={task.status} t={t} /></td>
      <td style={styles.td}>{task.assignedAgentName || '-'}</td>
      <td style={styles.td}>{task.priority || 'medium'}</td>
      <td style={styles.td}>{task.rejectCount || 0}</td>
    </tr>
  );
}

function SessionRow({ session, t }) {
  return (
    <tr>
      <td style={styles.td}><code style={{ fontSize: '12px' }}>{session.id.substring(0, 20)}...</code></td>
      <td style={styles.td}><StatusBadge status={session.status} t={t} /></td>
      <td style={styles.td}>{new Date(session.createdAt).toLocaleString()}</td>
      <td style={styles.td}>{new Date(session.updatedAt).toLocaleString()}</td>
    </tr>
  );
}

function LogLine({ log, t }) {
  const typeStyle = logTypeColors[log.type] || logTypeColors.info;
  return (
    <div style={styles.logLine}>
      <span style={styles.logTime}>{new Date(log.timestamp).toLocaleTimeString()}</span>
      <span style={{ ...styles.logType, background: typeStyle.bg, color: typeStyle.color }}>
        {log.type}
      </span>
      <span>{log.message}</span>
    </div>
  );
}

// ============ Main App ============

function App() {
  const [view, setView] = useState('dashboard');
  const [lang, setLang] = useState('en');
  const [stats, setStats] = useState({ sessions: 0, agents: 0, tasks: 0, completedTasks: 0 });
  const [agents, setAgents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('all');
  const [userInput, setUserInput] = useState('');
  const [clarification, setClarification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [orchestratorStatus, setOrchestratorStatus] = useState({});
  const [clarificationInput, setClarificationInput] = useState('');
  
  const [tools, setTools] = useState([]);
  const [skills, setSkills] = useState([]);
  const [rules, setRules] = useState([]);
  const [mcpClients, setMcpClients] = useState([]);

  const t = translations[lang];

  const toggleLanguage = () => {
    setLang(lang === 'en' ? 'zh' : 'en');
  };

  const getLogType = (type) => {
    if (type === 'error' || type === 'task_rejected') return 'error';
    if (type === 'warning') return 'warning';
    return 'info';
  };

  const addLog = useCallback((type, message) => {
    const logType = getLogType(type);
    setLogs(prev => [{
      type: logType,
      originalType: type,
      message,
      timestamp: new Date().toISOString()
    }, ...prev].slice(0, 200));
  }, []);

  const clearLogs = () => {
    setLogs([]);
  };

  const filteredLogs = logs.filter(log => {
    if (logFilter === 'all') return true;
    return log.type === logFilter;
  });

  const fetchData = useCallback(() => {
    fetch(`${API_BASE}/system/stats`)
      .then(res => res.json())
      .then(data => { if (data.success) setStats(data.data); })
      .catch(e => addLog('error', `Failed to fetch stats: ${e.message}`));

    fetch(`${API_BASE}/agents`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const all = [...(data.data.static || []), ...(data.data.dynamic || [])];
          setAgents(all);
        }
      })
      .catch(e => addLog('error', `Failed to fetch agents: ${e.message}`));

    fetch(`${API_BASE}/tasks/orchestrator`)
      .then(res => res.json())
      .then(data => { if (data.success) setTasks(data.data); })
      .catch(e => addLog('error', `Failed to fetch tasks: ${e.message}`));

    fetch(`${API_BASE}/sessions`)
      .then(res => res.json())
      .then(data => { if (data.success) setSessions(data.data); })
      .catch(e => addLog('error', `Failed to fetch sessions: ${e.message}`));

    fetch(`${API_BASE}/orchestrator/status`)
      .then(res => res.json())
      .then(data => { if (data.success) setOrchestratorStatus(data.data || {}); })
      .catch(e => addLog('error', `Failed to fetch orchestrator status: ${e.message}`));
    
    fetch(`${API_BASE}/tools`)
      .then(res => res.json())
      .then(data => { if (data.success) setTools(data.data || []); })
      .catch(e => addLog('error', `Failed to fetch tools: ${e.message}`));
    
    fetch(`${API_BASE}/skills`)
      .then(res => res.json())
      .then(data => { if (data.success) setSkills(data.data || []); })
      .catch(e => addLog('error', `Failed to fetch skills: ${e.message}`));
    
    fetch(`${API_BASE}/rules`)
      .then(res => res.json())
      .then(data => { if (data.success) setRules(data.data || []); })
      .catch(e => addLog('error', `Failed to fetch rules: ${e.message}`));
    
    fetch(`${API_BASE}/mcp/clients`)
      .then(res => res.json())
      .then(data => { if (data.success) setMcpClients(data.data || []); })
      .catch(e => addLog('error', `Failed to fetch MCP clients: ${e.message}`));
  }, [addLog]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    socket.on('connected', () => addLog('info', t.connected));
    socket.on('task:created', (task) => { addLog('info', `${t.taskCreated}: ${task.title}`); fetchData(); });
    socket.on('task:assigned', (task) => { addLog('info', `${t.taskAssigned}: ${task.id} -> ${task.assignedAgentName}`); fetchData(); });
    socket.on('task:completed', (task) => { addLog('info', `${t.taskCompleted}: ${task.id}`); fetchData(); });
    socket.on('task:rejected', (task) => { addLog('error', `${t.taskRejected}: ${task.id} (count: ${task.rejectCount})`); fetchData(); });
    socket.on('agent:created', (agent) => { addLog('info', `${t.agentCreated}: ${agent.name}`); fetchData(); });
    socket.on('clarification:needed', (data) => { setClarification(data); addLog('warning', t.clarificationNeeded); });
    socket.on('orchestrator:paused', () => { addLog('warning', t.orchestratorPaused); fetchData(); });
    socket.on('orchestrator:resumed', () => { addLog('info', t.orchestratorResumed); fetchData(); });

    return () => {
      socket.off('connected');
      socket.off('task:created');
      socket.off('task:assigned');
      socket.off('task:completed');
      socket.off('task:rejected');
      socket.off('agent:created');
      socket.off('clarification:needed');
      socket.off('orchestrator:paused');
      socket.off('orchestrator:resumed');
    };
  }, [fetchData, addLog, t]);

  const handleSubmit = () => {
    if (!userInput.trim()) return;
    setLoading(true);
    addLog('info', `Processing: ${userInput.substring(0, 50)}...`);

    fetch(`${API_BASE}/orchestrator/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: userInput })
    })
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data.success) {
          if (data.data.needsClarification) {
            setClarification(data.data);
            addLog('warning', t.clarificationNeeded);
          } else {
            addLog('info', t.instructionProcessed);
            setUserInput('');
          }
        } else {
          addLog('error', `Error: ${data.error || 'Unknown error'}`);
        }
        fetchData();
      })
      .catch(e => {
        setLoading(false);
        addLog('error', `Request failed: ${e.message}`);
      });
  };

  const handleClarification = (responses) => {
    if (!clarification) return;
    setLoading(true);

    fetch(`${API_BASE}/orchestrator/clarify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: clarification.sessionId, responses })
    })
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data.success) {
          setClarification(null);
          setClarificationInput('');
          addLog('info', t.clarificationSubmitted);
        } else {
          addLog('error', `Error: ${data.error || 'Unknown error'}`);
        }
        fetchData();
      })
      .catch(e => {
        setLoading(false);
        addLog('error', `Request failed: ${e.message}`);
      });
  };

  const handlePause = () => fetch(`${API_BASE}/orchestrator/pause`, { method: 'POST' });
  const handleResume = () => fetch(`${API_BASE}/orchestrator/resume`, { method: 'POST' });
  const handleCancel = () => fetch(`${API_BASE}/orchestrator/cancel`, { method: 'POST' });

  const handleRemoveAgent = (id) => {
    fetch(`${API_BASE}/agents/${id}`, { method: 'DELETE' })
      .then(() => { addLog('info', `${t.agentRemoved}: ${id}`); fetchData(); });
  };

  const renderDashboard = () => (
    <div>
      <div style={styles.grid}>
        <StatCard title={t.sessionsTitle} value={stats.sessions} icon="📁" />
        <StatCard title={t.agentsTitle} value={stats.agents} icon="🤖" />
        <StatCard title={t.totalTasks} value={stats.tasks} icon="📋" />
        <StatCard title={t.completed} value={stats.completedTasks} icon="✅" />
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <span style={styles.panelTitle}>{t.quickCommand}</span>
          {orchestratorStatus && (
            <div style={styles.flex}>
              <StatusBadge status={orchestratorStatus.status} t={t} />
              {orchestratorStatus.status === 'executing' && (
                <button style={{ ...styles.btn, ...styles.btnSecondary, padding: '6px 12px' }} onClick={handlePause}>{t.pause}</button>
              )}
              {orchestratorStatus.status === 'idle' && (
                <button style={{ ...styles.btn, ...styles.btnSecondary, padding: '6px 12px' }} onClick={handleResume}>{t.resume}</button>
              )}
              <button style={{ ...styles.btn, ...styles.btnDanger, padding: '6px 12px' }} onClick={handleCancel}>{t.cancel}</button>
            </div>
          )}
        </div>
        <div style={styles.panelBody}>
          {clarification ? (
            <div>
              <p style={{ marginBottom: '12px' }}>{t.understanding}: {clarification.understanding}</p>
              <p style={{ marginBottom: '12px', fontWeight: 'bold' }}>{t.questions}:</p>
              {clarification.questions && clarification.questions.map((q, i) => (
                <p key={i} style={{ marginBottom: '8px' }}>{i + 1}. {q}</p>
              ))}
              <textarea
                style={styles.textarea}
                placeholder={t.enterResponses}
                value={clarificationInput}
                onChange={(e) => setClarificationInput(e.target.value)}
              />
              <button
                style={{ ...styles.btn, ...styles.btnPrimary }}
                onClick={() => handleClarification(clarificationInput.split(';').map(r => r.trim()))}
                disabled={loading}
              >
                {loading ? t.submitting : t.submitClarification}
              </button>
            </div>
          ) : (
            <div>
              <textarea
                style={styles.textarea}
                placeholder={t.enterInstruction}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
              />
              <button
                style={{ ...styles.btn, ...styles.btnPrimary }}
                onClick={handleSubmit}
                disabled={loading || !userInput.trim()}
              >
                {loading ? t.processing : t.execute}
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <span style={styles.panelTitle}>{t.activityLog}</span>
          <div style={styles.flex}>
            <button
              style={{ ...styles.filterBtn, ...(logFilter === 'all' ? styles.filterBtnActive : {}) }}
              onClick={() => setLogFilter('all')}
            >
              {t.all}
            </button>
            <button
              style={{ ...styles.filterBtn, ...styles.filterBtnInfo, ...(logFilter === 'info' ? styles.filterBtnInfoActive : {}) }}
              onClick={() => setLogFilter('info')}
            >
              {t.info}
            </button>
            <button
              style={{ ...styles.filterBtn, ...styles.filterBtnWarning, ...(logFilter === 'warning' ? styles.filterBtnWarningActive : {}) }}
              onClick={() => setLogFilter('warning')}
            >
              {t.warning}
            </button>
            <button
              style={{ ...styles.filterBtn, ...styles.filterBtnError, ...(logFilter === 'error' ? styles.filterBtnErrorActive : {}) }}
              onClick={() => setLogFilter('error')}
            >
              {t.error}
            </button>
            <button
              style={styles.clearBtn}
              onClick={clearLogs}
            >
              {t.clearLog}
            </button>
          </div>
        </div>
        <div style={styles.panelBody}>
          <div style={styles.logContainer}>
            {filteredLogs.length === 0 ? (
              <div style={styles.empty}>{t.noActivity}</div>
            ) : (
              filteredLogs.map((log, i) => <LogLine key={i} log={log} t={t} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderAgents = () => (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>{t.agentsPanel} ({agents.length})</span>
      </div>
      <div style={styles.panelBody}>
        {agents.length === 0 ? (
          <div style={styles.empty}>{t.noAgents}</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{t.name}</th>
                <th style={styles.th}>{t.type}</th>
                <th style={styles.th}>{t.status}</th>
                <th style={styles.th}>{t.tasksCount}</th>
                <th style={styles.th}>{t.rejects}</th>
                <th style={styles.th}>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => (
                <AgentRow key={agent.id || agent.name} agent={agent} onRemove={handleRemoveAgent} t={t} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderTasks = () => (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>{t.tasksPanel} ({tasks.length})</span>
      </div>
      <div style={styles.panelBody}>
        {tasks.length === 0 ? (
          <div style={styles.empty}>{t.noTasks}</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{t.id}</th>
                <th style={styles.th}>{t.title}</th>
                <th style={styles.th}>{t.status}</th>
                <th style={styles.th}>{t.agent}</th>
                <th style={styles.th}>{t.priority}</th>
                <th style={styles.th}>{t.rejects}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <TaskRow key={task.id} task={task} t={t} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderSessions = () => (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>{t.sessionsPanel} ({sessions.length})</span>
      </div>
      <div style={styles.panelBody}>
        {sessions.length === 0 ? (
          <div style={styles.empty}>{t.noSessions}</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{t.id}</th>
                <th style={styles.th}>{t.status}</th>
                <th style={styles.th}>{t.created}</th>
                <th style={styles.th}>{t.updated}</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(session => (
                <SessionRow key={session.id} session={session} t={t} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderTools = () => (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>{t.toolsPanel} ({tools.length})</span>
      </div>
      <div style={styles.panelBody}>
        {tools.length === 0 ? (
          <div style={styles.empty}>{t.noTools}</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{t.toolName}</th>
                <th style={styles.th}>{t.toolCategory}</th>
                <th style={styles.th}>{t.toolStatus}</th>
                <th style={styles.th}>{t.toolExecutions}</th>
                <th style={styles.th}>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {tools.map(tool => (
                <tr key={tool.name}>
                  <td style={styles.td}>
                    <strong>{tool.name}</strong>
                    <div style={{ fontSize: '11px', color: '#888' }}>{tool.description}</div>
                  </td>
                  <td style={styles.td}>{tool.category}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, background: tool.status === 'registered' ? 'rgba(46,213,115,0.2)' : tool.status === 'disabled' ? 'rgba(136,136,136,0.2)' : 'rgba(255,165,2,0.2)', color: tool.status === 'registered' ? '#2ed573' : tool.status === 'disabled' ? '#888' : '#ffa502' }}>
                      {tool.status}
                    </span>
                  </td>
                  <td style={styles.td}>{tool.useCount || 0}</td>
                  <td style={styles.td}>
                    {tool.status === 'disabled' ? (
                      <button style={{ ...styles.btn, ...styles.btnSecondary, padding: '4px 8px', fontSize: '12px' }} onClick={() => fetch(`${API_BASE}/tools/${tool.name}/enable`, { method: 'POST' }).then(() => fetchData())}>{t.enable}</button>
                    ) : (
                      <button style={{ ...styles.btn, ...styles.btnDanger, padding: '4px 8px', fontSize: '12px' }} onClick={() => fetch(`${API_BASE}/tools/${tool.name}/disable`, { method: 'POST' }).then(() => fetchData())}>{t.disable}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderSkills = () => (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>{t.skillsPanel} ({skills.length})</span>
      </div>
      <div style={styles.panelBody}>
        {skills.length === 0 ? (
          <div style={styles.empty}>{t.noSkills}</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{t.name}</th>
                <th style={styles.th}>{t.skillVersion}</th>
                <th style={styles.th}>{t.type}</th>
                <th style={styles.th}>{t.status}</th>
                <th style={styles.th}>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {skills.map(skill => (
                <tr key={skill.name}>
                  <td style={styles.td}>
                    <strong>{skill.name}</strong>
                    <div style={{ fontSize: '11px', color: '#888' }}>{skill.description}</div>
                  </td>
                  <td style={styles.td}>v{skill.version}</td>
                  <td style={styles.td}>{skill.category}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, background: skill.enabled ? 'rgba(46,213,115,0.2)' : 'rgba(136,136,136,0.2)', color: skill.enabled ? '#2ed573' : '#888' }}>
                      {skill.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {skill.enabled ? (
                      <button style={{ ...styles.btn, ...styles.btnDanger, padding: '4px 8px', fontSize: '12px' }} onClick={() => fetch(`${API_BASE}/skills/${skill.name}/disable`, { method: 'POST' }).then(() => fetchData())}>{t.disable}</button>
                    ) : (
                      <button style={{ ...styles.btn, ...styles.btnSecondary, padding: '4px 8px', fontSize: '12px' }} onClick={() => fetch(`${API_BASE}/skills/${skill.name}/enable`, { method: 'POST' }).then(() => fetchData())}>{t.enable}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderRules = () => (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>{t.rulesPanel} ({rules.length})</span>
      </div>
      <div style={styles.panelBody}>
        {rules.length === 0 ? (
          <div style={styles.empty}>{t.noRules}</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{t.name}</th>
                <th style={styles.th}>{t.ruleType}</th>
                <th style={styles.th}>{t.rulePriority}</th>
                <th style={styles.th}>{t.status}</th>
                <th style={styles.th}>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.name}>
                  <td style={styles.td}>
                    <strong>{rule.name}</strong>
                    <div style={{ fontSize: '11px', color: '#888' }}>{rule.description}</div>
                  </td>
                  <td style={styles.td}>{rule.type}</td>
                  <td style={styles.td}>{rule.priority}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, background: rule.enabled ? 'rgba(46,213,115,0.2)' : 'rgba(136,136,136,0.2)', color: rule.enabled ? '#2ed573' : '#888' }}>
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {rule.enabled ? (
                      <button style={{ ...styles.btn, ...styles.btnDanger, padding: '4px 8px', fontSize: '12px' }} onClick={() => fetch(`${API_BASE}/rules/${rule.name}/disable`, { method: 'POST' }).then(() => fetchData())}>{t.disable}</button>
                    ) : (
                      <button style={{ ...styles.btn, ...styles.btnSecondary, padding: '4px 8px', fontSize: '12px' }} onClick={() => fetch(`${API_BASE}/rules/${rule.name}/enable`, { method: 'POST' }).then(() => fetchData())}>{t.enable}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderMCP = () => (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>{t.mcpPanel} ({mcpClients.length})</span>
      </div>
      <div style={styles.panelBody}>
        {mcpClients.length === 0 ? (
          <div style={styles.empty}>{t.noMCPClients}</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{t.name}</th>
                <th style={styles.th}>{t.status}</th>
                <th style={styles.th}>Tools</th>
                <th style={styles.th}>Resources</th>
                <th style={styles.th}>Prompts</th>
              </tr>
            </thead>
            <tbody>
              {mcpClients.map(client => (
                <tr key={client.name}>
                  <td style={styles.td}><strong>{client.name}</strong></td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, background: client.status === 'connected' ? 'rgba(46,213,115,0.2)' : 'rgba(255,71,87,0.2)', color: client.status === 'connected' ? '#2ed573' : '#ff4757' }}>
                      {client.status === 'connected' ? t.mcpConnected : t.mcpDisconnected}
                    </span>
                  </td>
                  <td style={styles.td}>{client.toolsCount}</td>
                  <td style={styles.td}>{client.resourcesCount}</td>
                  <td style={styles.td}>{client.promptsCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.logo}>🤖 MAF Dashboard</div>
        <nav style={styles.nav}>
          {['dashboard', 'agents', 'tasks', 'sessions', 'tools', 'skills', 'rules', 'mcp'].map(v => (
            <button
              key={v}
              style={{ ...styles.navBtn, ...(view === v ? styles.navBtnActive : {}) }}
              onClick={() => setView(v)}
            >
              {t[v] || v}
            </button>
          ))}
          <button
            style={styles.langBtn}
            onClick={toggleLanguage}
            title={t.language}
          >
            {lang === 'en' ? '中文' : 'EN'}
          </button>
        </nav>
      </header>
      <main style={styles.main}>
        {view === 'dashboard' && renderDashboard()}
        {view === 'agents' && renderAgents()}
        {view === 'tasks' && renderTasks()}
        {view === 'sessions' && renderSessions()}
        {view === 'tools' && renderTools()}
        {view === 'skills' && renderSkills()}
        {view === 'rules' && renderRules()}
        {view === 'mcp' && renderMCP()}
      </main>
    </div>
  );
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
