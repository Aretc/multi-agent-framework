import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import io from 'socket.io-client';

const API_BASE = '/api';
const socket = io();

const translations = {
  en: {
    dashboard: 'Dashboard', agents: 'Agents', tasks: 'Tasks', sessions: 'Sessions',
    tools: 'Tools', skills: 'Skills', rules: 'Rules', mcp: 'MCP',
    sessionsTitle: 'Sessions', agentsTitle: 'Agents', totalTasks: 'Tasks', completed: 'Completed',
    quickCommand: 'Quick Command', activityLog: 'Activity Log',
    agentsPanel: 'Agents', tasksPanel: 'Tasks', sessionsPanel: 'Sessions',
    toolsPanel: 'Tools', skillsPanel: 'Skills', rulesPanel: 'Rules', mcpPanel: 'MCP Clients',
    name: 'Name', type: 'Type', status: 'Status', tasksCount: 'Tasks', rejects: 'Rejects', actions: 'Actions',
    id: 'ID', title: 'Title', agent: 'Agent', priority: 'Priority', created: 'Created', updated: 'Updated',
    pause: 'Pause', resume: 'Resume', cancel: 'Cancel', remove: 'Remove', execute: 'Execute',
    processing: 'Processing...', submitting: 'Submitting...', add: 'Add', edit: 'Edit', save: 'Save',
    close: 'Close', confirm: 'Confirm', cancelBtn: 'Cancel', create: 'Create', install: 'Install',
    all: 'All', info: 'Info', warning: 'Warning', error: 'Error', filter: 'Filter', clearLog: 'Clear',
    enterInstruction: 'Enter your instruction...', enterResponses: 'Enter responses...',
    understanding: 'Understanding', questions: 'Questions', submitClarification: 'Submit',
    noActivity: 'No activity yet', noAgents: 'No agents found', noTasks: 'No tasks found',
    noSessions: 'No sessions found', noTools: 'No tools available', noSkills: 'No skills installed',
    noRules: 'No rules defined', noMCPClients: 'No MCP clients configured',
    connected: 'Connected', taskCreated: 'Task created', taskAssigned: 'Task assigned',
    taskCompleted: 'Task completed', taskRejected: 'Task rejected', agentCreated: 'Agent created',
    clarificationNeeded: 'Clarification needed', orchestratorPaused: 'Paused',
    orchestratorResumed: 'Resumed', agentRemoved: 'Agent removed',
    instructionProcessed: 'Success', clarificationSubmitted: 'Submitted',
    active: 'active', idle: 'idle', busy: 'busy', ready: 'ready', pending: 'pending',
    completed_status: 'completed', failed: 'failed',
    language: 'Language', english: 'English', chinese: '中文',
    toolName: 'Name', toolCategory: 'Category', toolStatus: 'Status', toolExecutions: 'Executions',
    enable: 'Enable', disable: 'Disable', executeTool: 'Execute Tool', toolParams: 'Parameters (JSON)',
    skillVersion: 'Version', skillAuthor: 'Author', installSkill: 'Install Skill',
    skillTemplates: 'Templates', basic: 'Basic', code: 'Code', analysis: 'Analysis', automation: 'Automation',
    ruleType: 'Type', rulePriority: 'Priority', addRule: 'Add Rule', ruleCondition: 'Condition',
    validation: 'Validation', constraint: 'Constraint', trigger: 'Trigger', guard: 'Guard',
    mcpConnected: 'Connected', mcpDisconnected: 'Disconnected', addClient: 'Add Client',
    mcpCommand: 'Command', mcpArgs: 'Arguments',
    addAgent: 'Add Agent', agentType: 'Agent Type', agentTypes: 'Types',
    general: 'General', coder: 'Coder', researcher: 'Researcher', writer: 'Writer',
    analyzer: 'Analyzer', tester: 'Tester', reviewer: 'Reviewer', designer: 'Designer',
    planner: 'Planner', coordinator: 'Coordinator',
    description: 'Description', config: 'Configuration', run: 'Run', test: 'Test',
    success: 'Success', operationSuccess: 'Operation successful', operationFailed: 'Operation failed',
    confirmDelete: 'Are you sure you want to delete?', yes: 'Yes', no: 'No',
  },
  zh: {
    dashboard: '仪表盘', agents: '智能体', tasks: '任务', sessions: '会话',
    tools: '工具', skills: '技能', rules: '规则', mcp: 'MCP',
    sessionsTitle: '会话数', agentsTitle: '智能体数', totalTasks: '任务数', completed: '已完成',
    quickCommand: '快速命令', activityLog: '活动日志',
    agentsPanel: '智能体', tasksPanel: '任务', sessionsPanel: '会话',
    toolsPanel: '工具', skillsPanel: '技能', rulesPanel: '规则', mcpPanel: 'MCP 客户端',
    name: '名称', type: '类型', status: '状态', tasksCount: '任务数', rejects: '打回次数', actions: '操作',
    id: 'ID', title: '标题', agent: '智能体', priority: '优先级', created: '创建时间', updated: '更新时间',
    pause: '暂停', resume: '继续', cancel: '取消', remove: '删除', execute: '执行',
    processing: '处理中...', submitting: '提交中...', add: '添加', edit: '编辑', save: '保存',
    close: '关闭', confirm: '确认', cancelBtn: '取消', create: '创建', install: '安装',
    all: '全部', info: '信息', warning: '警告', error: '错误', filter: '筛选', clearLog: '清空',
    enterInstruction: '输入您的指令...', enterResponses: '输入回答...',
    understanding: '理解', questions: '问题', submitClarification: '提交',
    noActivity: '暂无活动', noAgents: '暂无智能体', noTasks: '暂无任务',
    noSessions: '暂无会话', noTools: '暂无工具', noSkills: '暂无已安装的技能',
    noRules: '暂无定义的规则', noMCPClients: '暂无配置的 MCP 客户端',
    connected: '已连接', taskCreated: '任务已创建', taskAssigned: '任务已分配',
    taskCompleted: '任务已完成', taskRejected: '任务被打回', agentCreated: '智能体已创建',
    clarificationNeeded: '需要澄清', orchestratorPaused: '已暂停',
    orchestratorResumed: '已恢复', agentRemoved: '智能体已删除',
    instructionProcessed: '成功', clarificationSubmitted: '已提交',
    active: '活跃', idle: '空闲', busy: '忙碌', ready: '就绪', pending: '待处理',
    completed_status: '已完成', failed: '失败',
    language: '语言', english: 'English', chinese: '中文',
    toolName: '名称', toolCategory: '分类', toolStatus: '状态', toolExecutions: '执行次数',
    enable: '启用', disable: '禁用', executeTool: '执行工具', toolParams: '参数 (JSON)',
    skillVersion: '版本', skillAuthor: '作者', installSkill: '安装技能',
    skillTemplates: '模板', basic: '基础', code: '代码', analysis: '分析', automation: '自动化',
    ruleType: '类型', rulePriority: '优先级', addRule: '添加规则', ruleCondition: '条件',
    validation: '验证', constraint: '约束', trigger: '触发', guard: '守卫',
    mcpConnected: '已连接', mcpDisconnected: '已断开', addClient: '添加客户端',
    mcpCommand: '命令', mcpArgs: '参数',
    addAgent: '添加智能体', agentType: '智能体类型', agentTypes: '类型',
    general: '通用', coder: '程序员', researcher: '研究员', writer: '作者',
    analyzer: '分析师', tester: '测试员', reviewer: '审核员', designer: '设计师',
    planner: '规划师', coordinator: '协调员',
    description: '描述', config: '配置', run: '运行', test: '测试',
    success: '成功', operationSuccess: '操作成功', operationFailed: '操作失败',
    confirmDelete: '确定要删除吗？', yes: '是', no: '否',
  }
};

const styles = {
  container: { minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)', color: '#e0e0e0', fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  header: { background: 'rgba(0,0,0,0.4)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' },
  logo: { fontSize: '18px', fontWeight: '700', color: '#00d9ff', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.5px' },
  nav: { display: 'flex', gap: '4px', alignItems: 'center' },
  navBtn: { padding: '8px 14px', background: 'transparent', border: 'none', borderRadius: '8px', color: '#888', cursor: 'pointer', fontSize: '13px', fontWeight: '500', transition: 'all 0.2s' },
  navBtnActive: { background: 'rgba(0,217,255,0.15)', color: '#00d9ff' },
  langBtn: { padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#888', cursor: 'pointer', fontSize: '12px', marginLeft: '8px' },
  main: { padding: '24px', maxWidth: '1400px', margin: '0 auto' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' },
  card: { background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.3s' },
  cardTitle: { fontSize: '12px', color: '#666', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' },
  cardValue: { fontSize: '36px', fontWeight: '700', color: '#fff', letterSpacing: '-1px' },
  panel: { background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '24px', overflow: 'hidden' },
  panelHeader: { padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)' },
  panelTitle: { fontSize: '14px', fontWeight: '600', color: '#fff' },
  panelBody: { padding: '16px 20px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '12px 16px', fontSize: '11px', color: '#666', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  td: { padding: '14px 16px', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.03)' },
  badge: { padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  btn: { padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  btnPrimary: { background: 'linear-gradient(135deg, #00d9ff 0%, #00b4d8 100%)', color: '#0f0f1a' },
  btnSecondary: { background: 'rgba(255,255,255,0.08)', color: '#fff' },
  btnDanger: { background: 'rgba(255,71,87,0.2)', color: '#ff4757' },
  btnSuccess: { background: 'rgba(46,213,115,0.2)', color: '#2ed573' },
  btnSmall: { padding: '5px 10px', fontSize: '11px' },
  input: { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '14px', marginBottom: '12px', transition: 'all 0.2s' },
  textarea: { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '14px', minHeight: '100px', resize: 'vertical', marginBottom: '12px' },
  select: { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '14px', marginBottom: '12px', cursor: 'pointer' },
  label: { display: 'block', fontSize: '12px', color: '#888', marginBottom: '6px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' },
  formGroup: { marginBottom: '16px' },
  modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' },
  modalContent: { background: '#1a1a2e', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' },
  modalTitle: { fontSize: '18px', fontWeight: '700', color: '#fff' },
  modalFooter: { display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' },
  statusDot: { width: '6px', height: '6px', borderRadius: '50%' },
  logContainer: { background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '12px', maxHeight: '280px', overflowY: 'auto', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px' },
  logLine: { padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', alignItems: 'flex-start', gap: '8px' },
  logTime: { color: '#555', minWidth: '70px' },
  logType: { padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', minWidth: '50px', textAlign: 'center' },
  empty: { textAlign: 'center', padding: '48px', color: '#555' },
  flex: { display: 'flex', gap: '12px', alignItems: 'center' },
  flexBetween: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  filterBtn: { padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '11px', fontWeight: '500', transition: 'all 0.2s' },
  filterBtnActive: { background: 'rgba(0,217,255,0.15)', borderColor: '#00d9ff', color: '#00d9ff' },
  iconBtn: { padding: '6px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', borderRadius: '6px', transition: 'all 0.2s' },
  toolBar: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
  toast: { position: 'fixed', bottom: '24px', right: '24px', padding: '12px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '500', zIndex: 2000, animation: 'slideIn 0.3s ease' },
  toastSuccess: { background: 'rgba(46,213,115,0.9)', color: '#fff' },
  toastError: { background: 'rgba(255,71,87,0.9)', color: '#fff' },
};

const statusColors = { active: '#2ed573', completed: '#00d9ff', pending: '#ffa502', failed: '#ff4757', idle: '#666', busy: '#ffa502', ready: '#2ed573', registered: '#2ed573', disabled: '#666' };
const logTypeColors = { info: { bg: 'rgba(0,217,255,0.15)', color: '#00d9ff' }, warning: { bg: 'rgba(255,165,2,0.15)', color: '#ffa502' }, error: { bg: 'rgba(255,71,87,0.15)', color: '#ff4757' } };

function StatusBadge({ status, t }) {
  const color = statusColors[status] || '#666';
  const text = t[status] || status;
  return <span style={{ ...styles.badge, background: color + '20', color }}><span style={{ ...styles.statusDot, background: color }}></span>{text}</span>;
}

function StatCard({ title, value, icon }) {
  return <div style={styles.card}><div style={{ ...styles.flexBetween, marginBottom: '8px' }}><span style={styles.cardTitle}>{title}</span><span style={{ fontSize: '20px' }}>{icon}</span></div><div style={styles.cardValue}>{value}</div></div>;
}

function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}><span style={styles.modalTitle}>{title}</span><button style={{ ...styles.iconBtn, color: '#fff' }} onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  );
}

function Toast({ message, type, onClose }) {
  useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
  return <div style={{ ...styles.toast, ...(type === 'success' ? styles.toastSuccess : styles.toastError) }}>{message}</div>;
}

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
  const [toast, setToast] = useState(null);
  
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [showAddMCP, setShowAddMCP] = useState(false);
  const [showToolExec, setShowToolExec] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  
  const [agentForm, setAgentForm] = useState({ name: '', type: 'general', description: '' });
  const [skillForm, setSkillForm] = useState({ name: '', template: 'basic' });
  const [ruleForm, setRuleForm] = useState({ name: '', type: 'validation', priority: 50, description: '', condition: '' });
  const [mcpForm, setMcpForm] = useState({ name: '', command: '', args: '' });
  const [toolParams, setToolParams] = useState('{}');

  const t = translations[lang];
  const showToast = (message, type = 'success') => setToast({ message, type });

  const addLog = useCallback((type, message) => {
    setLogs(prev => [{ type, message, timestamp: new Date().toISOString() }, ...prev].slice(0, 200));
  }, []);

  const fetchData = useCallback(() => {
    fetch(`${API_BASE}/system/stats`).then(res => res.json()).then(d => d.success && setStats(d.data)).catch(e => addLog('error', e.message));
    fetch(`${API_BASE}/agents`).then(res => res.json()).then(d => d.success && setAgents([...(d.data.static || []), ...(d.data.dynamic || [])])).catch(e => addLog('error', e.message));
    fetch(`${API_BASE}/tasks/orchestrator`).then(res => res.json()).then(d => d.success && setTasks(d.data)).catch(e => addLog('error', e.message));
    fetch(`${API_BASE}/sessions`).then(res => res.json()).then(d => d.success && setSessions(d.data)).catch(e => addLog('error', e.message));
    fetch(`${API_BASE}/orchestrator/status`).then(res => res.json()).then(d => d.success && setOrchestratorStatus(d.data || {})).catch(e => addLog('error', e.message));
    fetch(`${API_BASE}/tools`).then(res => res.json()).then(d => d.success && setTools(d.data || [])).catch(e => addLog('error', e.message));
    fetch(`${API_BASE}/skills`).then(res => res.json()).then(d => d.success && setSkills(d.data || [])).catch(e => addLog('error', e.message));
    fetch(`${API_BASE}/rules`).then(res => res.json()).then(d => d.success && setRules(d.data || [])).catch(e => addLog('error', e.message));
    fetch(`${API_BASE}/mcp/clients`).then(res => res.json()).then(d => d.success && setMcpClients(d.data || [])).catch(e => addLog('error', e.message));
  }, [addLog]);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 5000); return () => clearInterval(i); }, [fetchData]);
  useEffect(() => {
    socket.on('connected', () => addLog('info', t.connected));
    socket.on('task:created', task => { addLog('info', `${t.taskCreated}: ${task.title}`); fetchData(); });
    socket.on('task:assigned', task => { addLog('info', `${t.taskAssigned}`); fetchData(); });
    socket.on('task:completed', task => { addLog('info', `${t.taskCompleted}`); fetchData(); });
    socket.on('task:rejected', task => { addLog('error', `${t.taskRejected}`); fetchData(); });
    socket.on('agent:created', agent => { addLog('info', `${t.agentCreated}: ${agent.name}`); fetchData(); });
    socket.on('clarification:needed', data => { setClarification(data); addLog('warning', t.clarificationNeeded); });
    return () => { socket.off(); };
  }, [fetchData, addLog, t]);

  const handleSubmit = () => {
    if (!userInput.trim()) return;
    setLoading(true);
    fetch(`${API_BASE}/orchestrator/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: userInput }) })
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data.success) {
          if (data.data.needsClarification) { setClarification(data.data); }
          else { showToast(t.instructionProcessed); setUserInput(''); }
        } else showToast(data.error || t.operationFailed, 'error');
        fetchData();
      }).catch(e => { setLoading(false); showToast(e.message, 'error'); });
  };

  const handleClarification = () => {
    if (!clarification) return;
    setLoading(true);
    fetch(`${API_BASE}/orchestrator/clarify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: clarification.sessionId, responses: clarificationInput.split(';').map(r => r.trim()) }) })
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data.success) { setClarification(null); setClarificationInput(''); showToast(t.clarificationSubmitted); }
        else showToast(data.error || t.operationFailed, 'error');
        fetchData();
      }).catch(e => { setLoading(false); showToast(e.message, 'error'); });
  };

  const handleAddAgent = () => {
    if (!agentForm.name) return;
    fetch(`${API_BASE}/agents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(agentForm) })
      .then(res => res.json())
      .then(data => {
        if (data.success) { setShowAddAgent(false); setAgentForm({ name: '', type: 'general', description: '' }); showToast(t.agentCreated); fetchData(); }
        else showToast(data.error || t.operationFailed, 'error');
      }).catch(e => showToast(e.message, 'error'));
  };

  const handleRemoveAgent = (id) => {
    fetch(`${API_BASE}/agents/${id}`, { method: 'DELETE' })
      .then(() => { setConfirmDelete(null); showToast(t.agentRemoved); fetchData(); });
  };

  const handleAddSkill = () => {
    if (!skillForm.name) return;
    fetch(`${API_BASE}/skills/install`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: skillForm.name, template: skillForm.template }) })
      .then(res => res.json())
      .then(data => {
        if (data.success) { setShowAddSkill(false); setSkillForm({ name: '', template: 'basic' }); showToast(t.installSkill); fetchData(); }
        else showToast(data.error || t.operationFailed, 'error');
      }).catch(e => showToast(e.message, 'error'));
  };

  const handleAddRule = () => {
    if (!ruleForm.name) return;
    fetch(`${API_BASE}/rules`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ruleForm) })
      .then(res => res.json())
      .then(data => {
        if (data.success) { setShowAddRule(false); setRuleForm({ name: '', type: 'validation', priority: 50, description: '', condition: '' }); showToast(t.addRule); fetchData(); }
        else showToast(data.error || t.operationFailed, 'error');
      }).catch(e => showToast(e.message, 'error'));
  };

  const handleAddMCP = () => {
    if (!mcpForm.name || !mcpForm.command) return;
    fetch(`${API_BASE}/mcp/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: mcpForm.name, config: { command: mcpForm.command, args: mcpForm.args.split(' ') } }) })
      .then(res => res.json())
      .then(data => {
        if (data.success) { setShowAddMCP(false); setMcpForm({ name: '', command: '', args: '' }); showToast(t.addClient); fetchData(); }
        else showToast(data.error || t.operationFailed, 'error');
      }).catch(e => showToast(e.message, 'error'));
  };

  const handleExecuteTool = () => {
    if (!selectedTool) return;
    let params = {};
    try { params = JSON.parse(toolParams); } catch (e) { showToast('Invalid JSON', 'error'); return; }
    fetch(`${API_BASE}/tools/${selectedTool.name}/execute`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ params }) })
      .then(res => res.json())
      .then(data => {
        if (data.success) { setShowToolExec(false); setSelectedTool(null); setToolParams('{}'); showToast(t.executeTool); fetchData(); }
        else showToast(data.error || t.operationFailed, 'error');
      }).catch(e => showToast(e.message, 'error'));
  };

  const filteredLogs = logs.filter(log => logFilter === 'all' || log.type === logFilter);

  const renderDashboard = () => (
    <div>
      <div style={styles.grid}>
        <StatCard title={t.sessionsTitle} value={stats.sessions} icon="📁" />
        <StatCard title={t.agentsTitle} value={stats.agents} icon="🤖" />
        <StatCard title={t.totalTasks} value={stats.tasks} icon="📋" />
        <StatCard title={t.completed} value={stats.completedTasks} icon="✅" />
      </div>
      <div style={styles.panel}>
        <div style={styles.panelHeader}><span style={styles.panelTitle}>{t.quickCommand}</span>
          {orchestratorStatus.status && <StatusBadge status={orchestratorStatus.status} t={t} />}</div>
        <div style={styles.panelBody}>
          {clarification ? (
            <div>
              <p style={{ marginBottom: '12px' }}>{t.understanding}: {clarification.understanding}</p>
              {clarification.questions?.map((q, i) => <p key={i} style={{ marginBottom: '8px' }}>{i + 1}. {q}</p>)}
              <textarea style={styles.textarea} placeholder={t.enterResponses} value={clarificationInput} onChange={e => setClarificationInput(e.target.value)} />
              <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleClarification} disabled={loading}>{loading ? t.submitting : t.submitClarification}</button>
            </div>
          ) : (
            <div>
              <textarea style={styles.textarea} placeholder={t.enterInstruction} value={userInput} onChange={e => setUserInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleSubmit()} />
              <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleSubmit} disabled={loading || !userInput.trim()}>{loading ? t.processing : t.execute}</button>
            </div>
          )}
        </div>
      </div>
      <div style={styles.panel}>
        <div style={styles.panelHeader}><span style={styles.panelTitle}>{t.activityLog}</span>
          <div style={styles.flex}>
            {['all', 'info', 'warning', 'error'].map(f => (
              <button key={f} style={{ ...styles.filterBtn, ...(logFilter === f ? styles.filterBtnActive : {}) }} onClick={() => setLogFilter(f)}>{t[f]}</button>
            ))}
            <button style={{ ...styles.btn, ...styles.btnDanger, ...styles.btnSmall }} onClick={() => setLogs([])}>{t.clearLog}</button>
          </div>
        </div>
        <div style={styles.panelBody}>
          <div style={styles.logContainer}>
            {filteredLogs.length === 0 ? <div style={styles.empty}>{t.noActivity}</div> : filteredLogs.map((log, i) => (
              <div key={i} style={styles.logLine}>
                <span style={styles.logTime}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span style={{ ...styles.logType, ...logTypeColors[log.type] }}>{log.type}</span>
                <span>{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderAgents = () => (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>{t.agentsPanel} ({agents.length})</span>
        <button style={{ ...styles.btn, ...styles.btnPrimary, ...styles.btnSmall }} onClick={() => setShowAddAgent(true)}>+ {t.addAgent}</button>
      </div>
      <div style={styles.panelBody}>
        {agents.length === 0 ? <div style={styles.empty}>{t.noAgents}</div> : (
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>{t.name}</th><th style={styles.th}>{t.type}</th><th style={styles.th}>{t.status}</th><th style={styles.th}>{t.tasksCount}</th><th style={styles.th}>{t.actions}</th></tr></thead>
            <tbody>{agents.map(agent => (
              <tr key={agent.id || agent.name}>
                <td style={styles.td}><strong>{agent.name || agent.id}</strong></td>
                <td style={styles.td}>{agent.type || 'static'}</td>
                <td style={styles.td}><StatusBadge status={agent.status || 'idle'} t={t} /></td>
                <td style={styles.td}>{agent.taskCount || 0}</td>
                <td style={styles.td}><button style={{ ...styles.btn, ...styles.btnDanger, ...styles.btnSmall }} onClick={() => setConfirmDelete({ type: 'agent', id: agent.id })}>{t.remove}</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderTasks = () => (
    <div style={styles.panel}>
      <div style={styles.panelHeader}><span style={styles.panelTitle}>{t.tasksPanel} ({tasks.length})</span></div>
      <div style={styles.panelBody}>
        {tasks.length === 0 ? <div style={styles.empty}>{t.noTasks}</div> : (
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>{t.id}</th><th style={styles.th}>{t.title}</th><th style={styles.th}>{t.status}</th><th style={styles.th}>{t.agent}</th><th style={styles.th}>{t.priority}</th></tr></thead>
            <tbody>{tasks.map(task => (
              <tr key={task.id}>
                <td style={styles.td}><code style={{ fontSize: '11px' }}>{task.id?.substring(0, 8)}</code></td>
                <td style={styles.td}>{task.title}</td>
                <td style={styles.td}><StatusBadge status={task.status} t={t} /></td>
                <td style={styles.td}>{task.assignedAgentName || '-'}</td>
                <td style={styles.td}>{task.priority || 'medium'}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderSessions = () => (
    <div style={styles.panel}>
      <div style={styles.panelHeader}><span style={styles.panelTitle}>{t.sessionsPanel} ({sessions.length})</span></div>
      <div style={styles.panelBody}>
        {sessions.length === 0 ? <div style={styles.empty}>{t.noSessions}</div> : (
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>{t.id}</th><th style={styles.th}>{t.status}</th><th style={styles.th}>{t.created}</th></tr></thead>
            <tbody>{sessions.map(s => (
              <tr key={s.id}><td style={styles.td}><code style={{ fontSize: '11px' }}>{s.id?.substring(0, 20)}...</code></td><td style={styles.td}><StatusBadge status={s.status} t={t} /></td><td style={styles.td}>{new Date(s.createdAt).toLocaleString()}</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderTools = () => (
    <div style={styles.panel}>
      <div style={styles.panelHeader}><span style={styles.panelTitle}>{t.toolsPanel} ({tools.length})</span></div>
      <div style={styles.panelBody}>
        {tools.length === 0 ? <div style={styles.empty}>{t.noTools}</div> : (
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>{t.name}</th><th style={styles.th}>{t.toolCategory}</th><th style={styles.th}>{t.status}</th><th style={styles.th}>{t.toolExecutions}</th><th style={styles.th}>{t.actions}</th></tr></thead>
            <tbody>{tools.map(tool => (
              <tr key={tool.name}>
                <td style={styles.td}><strong>{tool.name}</strong><div style={{ fontSize: '11px', color: '#666' }}>{tool.description}</div></td>
                <td style={styles.td}>{tool.category}</td>
                <td style={styles.td}><StatusBadge status={tool.status} t={t} /></td>
                <td style={styles.td}>{tool.useCount || 0}</td>
                <td style={styles.td}>
                  <div style={styles.flex}>
                    <button style={{ ...styles.btn, ...styles.btnSuccess, ...styles.btnSmall }} onClick={() => { setSelectedTool(tool); setToolParams('{}'); setShowToolExec(true); }}>{t.run}</button>
                    {tool.status === 'disabled' ? <button style={{ ...styles.btn, ...styles.btnSecondary, ...styles.btnSmall }} onClick={() => fetch(`${API_BASE}/tools/${tool.name}/enable`, { method: 'POST' }).then(fetchData)}>{t.enable}</button> : <button style={{ ...styles.btn, ...styles.btnDanger, ...styles.btnSmall }} onClick={() => fetch(`${API_BASE}/tools/${tool.name}/disable`, { method: 'POST' }).then(fetchData)}>{t.disable}</button>}
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderSkills = () => (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>{t.skillsPanel} ({skills.length})</span>
        <button style={{ ...styles.btn, ...styles.btnPrimary, ...styles.btnSmall }} onClick={() => setShowAddSkill(true)}>+ {t.installSkill}</button>
      </div>
      <div style={styles.panelBody}>
        {skills.length === 0 ? <div style={styles.empty}>{t.noSkills}</div> : (
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>{t.name}</th><th style={styles.th}>{t.skillVersion}</th><th style={styles.th}>{t.type}</th><th style={styles.th}>{t.status}</th><th style={styles.th}>{t.actions}</th></tr></thead>
            <tbody>{skills.map(skill => (
              <tr key={skill.name}>
                <td style={styles.td}><strong>{skill.name}</strong><div style={{ fontSize: '11px', color: '#666' }}>{skill.description}</div></td>
                <td style={styles.td}>v{skill.version}</td>
                <td style={styles.td}>{skill.category}</td>
                <td style={styles.td}><StatusBadge status={skill.enabled ? 'active' : 'disabled'} t={t} /></td>
                <td style={styles.td}>{skill.enabled ? <button style={{ ...styles.btn, ...styles.btnDanger, ...styles.btnSmall }} onClick={() => fetch(`${API_BASE}/skills/${skill.name}/disable`, { method: 'POST' }).then(fetchData)}>{t.disable}</button> : <button style={{ ...styles.btn, ...styles.btnSecondary, ...styles.btnSmall }} onClick={() => fetch(`${API_BASE}/skills/${skill.name}/enable`, { method: 'POST' }).then(fetchData)}>{t.enable}</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderRules = () => (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>{t.rulesPanel} ({rules.length})</span>
        <button style={{ ...styles.btn, ...styles.btnPrimary, ...styles.btnSmall }} onClick={() => setShowAddRule(true)}>+ {t.addRule}</button>
      </div>
      <div style={styles.panelBody}>
        {rules.length === 0 ? <div style={styles.empty}>{t.noRules}</div> : (
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>{t.name}</th><th style={styles.th}>{t.ruleType}</th><th style={styles.th}>{t.rulePriority}</th><th style={styles.th}>{t.status}</th><th style={styles.th}>{t.actions}</th></tr></thead>
            <tbody>{rules.map(rule => (
              <tr key={rule.name}>
                <td style={styles.td}><strong>{rule.name}</strong><div style={{ fontSize: '11px', color: '#666' }}>{rule.description}</div></td>
                <td style={styles.td}>{rule.type}</td>
                <td style={styles.td}>{rule.priority}</td>
                <td style={styles.td}><StatusBadge status={rule.enabled ? 'active' : 'disabled'} t={t} /></td>
                <td style={styles.td}>{rule.enabled ? <button style={{ ...styles.btn, ...styles.btnDanger, ...styles.btnSmall }} onClick={() => fetch(`${API_BASE}/rules/${rule.name}/disable`, { method: 'POST' }).then(fetchData)}>{t.disable}</button> : <button style={{ ...styles.btn, ...styles.btnSecondary, ...styles.btnSmall }} onClick={() => fetch(`${API_BASE}/rules/${rule.name}/enable`, { method: 'POST' }).then(fetchData)}>{t.enable}</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderMCP = () => (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>{t.mcpPanel} ({mcpClients.length})</span>
        <button style={{ ...styles.btn, ...styles.btnPrimary, ...styles.btnSmall }} onClick={() => setShowAddMCP(true)}>+ {t.addClient}</button>
      </div>
      <div style={styles.panelBody}>
        {mcpClients.length === 0 ? <div style={styles.empty}>{t.noMCPClients}</div> : (
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>{t.name}</th><th style={styles.th}>{t.status}</th><th style={styles.th}>Tools</th><th style={styles.th}>Resources</th><th style={styles.th}>Prompts</th><th style={styles.th}>{t.actions}</th></tr></thead>
            <tbody>{mcpClients.map(client => (
              <tr key={client.name}>
                <td style={styles.td}><strong>{client.name}</strong></td>
                <td style={styles.td}><StatusBadge status={client.status} t={t} /></td>
                <td style={styles.td}>{client.toolsCount}</td>
                <td style={styles.td}>{client.resourcesCount}</td>
                <td style={styles.td}>{client.promptsCount}</td>
                <td style={styles.td}><button style={{ ...styles.btn, ...styles.btnDanger, ...styles.btnSmall }} onClick={() => fetch(`${API_BASE}/mcp/clients/${client.name}`, { method: 'DELETE' }).then(fetchData)}>{t.remove}</button></td>
              </tr>
            ))}</tbody>
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
            <button key={v} style={{ ...styles.navBtn, ...(view === v ? styles.navBtnActive : {}) }} onClick={() => setView(v)}>{t[v]}</button>
          ))}
          <button style={styles.langBtn} onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}>{lang === 'en' ? '中文' : 'EN'}</button>
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

      <Modal isOpen={showAddAgent} onClose={() => setShowAddAgent(false)} title={t.addAgent}>
        <div style={styles.formGroup}><label style={styles.label}>{t.name}</label><input style={styles.input} value={agentForm.name} onChange={e => setAgentForm({ ...agentForm, name: e.target.value })} placeholder="my-agent" /></div>
        <div style={styles.formGroup}><label style={styles.label}>{t.agentType}</label>
          <select style={styles.select} value={agentForm.type} onChange={e => setAgentForm({ ...agentForm, type: e.target.value })}>
            {['general', 'coder', 'researcher', 'writer', 'analyzer', 'tester', 'reviewer', 'designer', 'planner', 'coordinator'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={styles.formGroup}><label style={styles.label}>{t.description}</label><textarea style={styles.textarea} value={agentForm.description} onChange={e => setAgentForm({ ...agentForm, description: e.target.value })} /></div>
        <div style={styles.modalFooter}><button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setShowAddAgent(false)}>{t.cancelBtn}</button><button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleAddAgent}>{t.create}</button></div>
      </Modal>

      <Modal isOpen={showAddSkill} onClose={() => setShowAddSkill(false)} title={t.installSkill}>
        <div style={styles.formGroup}><label style={styles.label}>{t.name}</label><input style={styles.input} value={skillForm.name} onChange={e => setSkillForm({ ...skillForm, name: e.target.value })} placeholder="my-skill" /></div>
        <div style={styles.formGroup}><label style={styles.label}>{t.skillTemplates}</label>
          <select style={styles.select} value={skillForm.template} onChange={e => setSkillForm({ ...skillForm, template: e.target.value })}>
            <option value="basic">{t.basic}</option><option value="code">{t.code}</option><option value="analysis">{t.analysis}</option><option value="automation">{t.automation}</option>
          </select>
        </div>
        <div style={styles.modalFooter}><button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setShowAddSkill(false)}>{t.cancelBtn}</button><button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleAddSkill}>{t.install}</button></div>
      </Modal>

      <Modal isOpen={showAddRule} onClose={() => setShowAddRule(false)} title={t.addRule}>
        <div style={styles.formGroup}><label style={styles.label}>{t.name}</label><input style={styles.input} value={ruleForm.name} onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })} placeholder="my-rule" /></div>
        <div style={styles.formGroup}><label style={styles.label}>{t.ruleType}</label>
          <select style={styles.select} value={ruleForm.type} onChange={e => setRuleForm({ ...ruleForm, type: e.target.value })}>
            <option value="validation">{t.validation}</option><option value="constraint">{t.constraint}</option><option value="trigger">{t.trigger}</option><option value="guard">{t.guard}</option>
          </select>
        </div>
        <div style={styles.formGroup}><label style={styles.label}>{t.rulePriority}</label><input style={styles.input} type="number" value={ruleForm.priority} onChange={e => setRuleForm({ ...ruleForm, priority: parseInt(e.target.value) })} /></div>
        <div style={styles.formGroup}><label style={styles.label}>{t.description}</label><input style={styles.input} value={ruleForm.description} onChange={e => setRuleForm({ ...ruleForm, description: e.target.value })} /></div>
        <div style={styles.formGroup}><label style={styles.label}>{t.ruleCondition}</label><textarea style={styles.textarea} value={ruleForm.condition} onChange={e => setRuleForm({ ...ruleForm, condition: e.target.value })} placeholder='{ "field": { "$eq": "value" } }' /></div>
        <div style={styles.modalFooter}><button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setShowAddRule(false)}>{t.cancelBtn}</button><button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleAddRule}>{t.create}</button></div>
      </Modal>

      <Modal isOpen={showAddMCP} onClose={() => setShowAddMCP(false)} title={t.addClient}>
        <div style={styles.formGroup}><label style={styles.label}>{t.name}</label><input style={styles.input} value={mcpForm.name} onChange={e => setMcpForm({ ...mcpForm, name: e.target.value })} placeholder="filesystem" /></div>
        <div style={styles.formGroup}><label style={styles.label}>{t.mcpCommand}</label><input style={styles.input} value={mcpForm.command} onChange={e => setMcpForm({ ...mcpForm, command: e.target.value })} placeholder="npx @modelcontextprotocol/server-filesystem" /></div>
        <div style={styles.formGroup}><label style={styles.label}>{t.mcpArgs}</label><input style={styles.input} value={mcpForm.args} onChange={e => setMcpForm({ ...mcpForm, args: e.target.value })} placeholder="/path/to/dir" /></div>
        <div style={styles.modalFooter}><button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setShowAddMCP(false)}>{t.cancelBtn}</button><button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleAddMCP}>{t.add}</button></div>
      </Modal>

      <Modal isOpen={showToolExec} onClose={() => setShowToolExec(false)} title={`${t.executeTool}: ${selectedTool?.name}`}>
        <div style={styles.formGroup}><label style={styles.label}>{t.toolParams}</label><textarea style={{ ...styles.textarea, minHeight: '150px', fontFamily: 'monospace' }} value={toolParams} onChange={e => setToolParams(e.target.value)} /></div>
        <div style={styles.modalFooter}><button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setShowToolExec(false)}>{t.cancelBtn}</button><button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleExecuteTool}>{t.run}</button></div>
      </Modal>

      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title={t.confirmDelete}>
        <p style={{ marginBottom: '20px' }}>{t.confirmDelete}</p>
        <div style={styles.modalFooter}>
          <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setConfirmDelete(null)}>{t.no}</button>
          <button style={{ ...styles.btn, ...styles.btnDanger }} onClick={() => { if (confirmDelete.type === 'agent') handleRemoveAgent(confirmDelete.id); }}>{t.yes}</button>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
