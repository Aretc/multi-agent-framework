/**
 * Session Manager for Multi-Agent Framework
 * 
 * Provides session isolation for agents to prevent memory pollution
 * between different tasks. Each session has its own memory space,
 * context, and state.
 */

const fs = require('fs');
const path = require('path');
const { AgentMemory } = require('./memory');
const { createLLMAdapter } = require('./llm/adapter');
const { ToolManager } = require('./tools');

const SESSION_STATUS = {
  CREATED: 'created',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

const DEFAULT_SESSION_CONFIG = {
  maxHistorySize: 100,
  autoSave: true,
  autoSaveInterval: 30000,
  timeout: 3600000,
  memory: {
    shortTerm: { maxSize: 100, maxAge: 3600000 },
    longTerm: { maxSize: 5000 },
    episodic: { maxEvents: 500, retentionDays: 7 }
  }
};

class Session {
  constructor(id, config) {
    config = config || {};
    this.id = id;
    this.config = { ...DEFAULT_SESSION_CONFIG, ...config };
    this.status = SESSION_STATUS.CREATED;
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    
    this.context = {
      userInput: null,
      taskPlan: null,
      currentTaskIndex: 0,
      tasks: [],
      results: [],
      messages: [],
      metadata: {}
    };
    
    this.agents = new Map();
    this.memory = null;
    this.llm = null;
    this.tools = null;
    this.history = [];
    this.snapshots = [];
    this.parentSessionId = null;
    this.childSessionIds = [];
    
    this._autoSaveTimer = null;
  }

  async initialize(options) {
    options = options || {};
    
    const sessionPath = this.config.storagePath;
    if (sessionPath) {
      const sessionDir = path.join(sessionPath, this.id);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      
      this.memory = new AgentMemory('session_' + this.id, {
        rootPath: path.join(sessionDir, 'memory'),
        config: this.config.memory
      });
      await this.memory.init();
    }
    
    if (options.llm) {
      this.llm = createLLMAdapter(options.llm);
    }
    
    if (options.tools !== false) {
      this.tools = new ToolManager();
    }
    
    this.status = SESSION_STATUS.ACTIVE;
    this.updatedAt = new Date().toISOString();
    
    if (this.config.autoSave) {
      this._startAutoSave();
    }
    
    return this;
  }

  setUserInput(input) {
    this.context.userInput = input;
    this.updatedAt = new Date().toISOString();
    this._addToHistory('user_input', { input: input });
    return this;
  }

  setTaskPlan(plan) {
    this.context.taskPlan = plan;
    this.context.tasks = plan.tasks || [];
    this.context.currentTaskIndex = 0;
    this.updatedAt = new Date().toISOString();
    this._addToHistory('task_plan', { plan: plan });
    return this;
  }

  getCurrentTask() {
    const tasks = this.context.tasks;
    const index = this.context.currentTaskIndex;
    if (index >= 0 && index < tasks.length) {
      return { ...tasks[index], index: index };
    }
    return null;
  }

  advanceTask() {
    if (this.context.currentTaskIndex < this.context.tasks.length - 1) {
      this.context.currentTaskIndex++;
      this.updatedAt = new Date().toISOString();
      this._addToHistory('task_advance', { 
        newIndex: this.context.currentTaskIndex 
      });
      return true;
    }
    return false;
  }

  addTaskResult(taskId, result) {
    this.context.results.push({
      taskId: taskId,
      result: result,
      timestamp: new Date().toISOString()
    });
    this.updatedAt = new Date().toISOString();
    this._addToHistory('task_result', { taskId: taskId, result: result });
    return this;
  }

  addMessage(message) {
    this.context.messages.push({
      ...message,
      timestamp: new Date().toISOString()
    });
    this.updatedAt = new Date().toISOString();
    return this;
  }

  registerAgent(agentId, agentConfig) {
    this.agents.set(agentId, {
      id: agentId,
      config: agentConfig,
      createdAt: new Date().toISOString(),
      taskCount: 0,
      rejectCount: 0
    });
    this._addToHistory('agent_registered', { agentId: agentId, config: agentConfig });
    return this.agents.get(agentId);
  }

  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  incrementAgentRejectCount(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.rejectCount++;
      this.updatedAt = new Date().toISOString();
    }
    return agent;
  }

  incrementAgentTaskCount(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.taskCount++;
      this.updatedAt = new Date().toISOString();
    }
    return agent;
  }

  createSnapshot(label) {
    const snapshot = {
      id: 'snap_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      label: label || 'Snapshot',
      timestamp: new Date().toISOString(),
      context: JSON.parse(JSON.stringify(this.context)),
      status: this.status,
      historyLength: this.history.length
    };
    
    this.snapshots.push(snapshot);
    this._addToHistory('snapshot_created', { snapshotId: snapshot.id, label: label });
    
    return snapshot;
  }

  restoreSnapshot(snapshotId) {
    const snapshot = this.snapshots.find(function(s) { return s.id === snapshotId; });
    if (!snapshot) {
      return { success: false, error: 'Snapshot not found' };
    }
    
    this.context = JSON.parse(JSON.stringify(snapshot.context));
    this.status = snapshot.status;
    this.history = this.history.slice(0, snapshot.historyLength);
    this.updatedAt = new Date().toISOString();
    
    this._addToHistory('snapshot_restored', { snapshotId: snapshotId });
    
    return { success: true, snapshot: snapshot };
  }

  pause() {
    this.status = SESSION_STATUS.PAUSED;
    this.updatedAt = new Date().toISOString();
    this._stopAutoSave();
    this._addToHistory('session_paused', {});
    return this;
  }

  resume() {
    if (this.status === SESSION_STATUS.PAUSED) {
      this.status = SESSION_STATUS.ACTIVE;
      this.updatedAt = new Date().toISOString();
      if (this.config.autoSave) {
        this._startAutoSave();
      }
      this._addToHistory('session_resumed', {});
    }
    return this;
  }

  complete(result) {
    this.status = SESSION_STATUS.COMPLETED;
    this.context.finalResult = result;
    this.updatedAt = new Date().toISOString();
    this._stopAutoSave();
    this._addToHistory('session_completed', { result: result });
    return this;
  }

  fail(error) {
    this.status = SESSION_STATUS.FAILED;
    this.context.error = error;
    this.updatedAt = new Date().toISOString();
    this._stopAutoSave();
    this._addToHistory('session_failed', { error: error });
    return this;
  }

  createChildSession(taskId, agentId) {
    const childId = this.id + '_child_' + Date.now();
    this.childSessionIds.push(childId);
    this._addToHistory('child_session_created', { childId: childId, taskId: taskId, agentId: agentId });
    return childId;
  }

  _addToHistory(type, data) {
    this.history.push({
      type: type,
      data: data,
      timestamp: new Date().toISOString()
    });
    
    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(-this.config.maxHistorySize);
    }
  }

  _startAutoSave() {
    if (this._autoSaveTimer) return;
    
    const self = this;
    this._autoSaveTimer = setInterval(function() {
      self.save();
    }, this.config.autoSaveInterval);
  }

  _stopAutoSave() {
    if (this._autoSaveTimer) {
      clearInterval(this._autoSaveTimer);
      this._autoSaveTimer = null;
    }
  }

  async save() {
    if (!this.config.storagePath) return;
    
    const sessionPath = path.join(this.config.storagePath, this.id);
    const filePath = path.join(sessionPath, 'session.json');
    
    const data = this.toJSON();
    
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    
    return { success: true, path: filePath };
  }

  toJSON() {
    return {
      id: this.id,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      context: this.context,
      agents: Array.from(this.agents.entries()).map(function(entry) {
        return { id: entry[0], ...entry[1] };
      }),
      history: this.history,
      snapshots: this.snapshots,
      parentSessionId: this.parentSessionId,
      childSessionIds: this.childSessionIds
    };
  }

  static fromJSON(data, config) {
    const session = new Session(data.id, config || DEFAULT_SESSION_CONFIG);
    session.status = data.status;
    session.createdAt = data.createdAt;
    session.updatedAt = data.updatedAt;
    session.context = data.context;
    session.history = data.history || [];
    session.snapshots = data.snapshots || [];
    session.parentSessionId = data.parentSessionId || null;
    session.childSessionIds = data.childSessionIds || [];
    
    if (data.agents) {
      data.agents.forEach(function(agentData) {
        const id = agentData.id;
        delete agentData.id;
        session.agents.set(id, agentData);
      });
    }
    
    return session;
  }

  getStats() {
    return {
      id: this.id,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      taskCount: this.context.tasks.length,
      completedTasks: this.context.results.length,
      currentTaskIndex: this.context.currentTaskIndex,
      messageCount: this.context.messages.length,
      agentCount: this.agents.size,
      historySize: this.history.length,
      snapshotCount: this.snapshots.length
    };
  }
}

class SessionManager {
  constructor(options) {
    options = options || {};
    this.rootPath = options.rootPath || './.maf/sessions';
    this.config = { ...DEFAULT_SESSION_CONFIG, ...options.config };
    this.sessions = new Map();
    this.activeSessions = new Set();
  }

  createSession(options) {
    options = options || {};
    const id = options.id || 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const sessionConfig = {
      ...this.config,
      storagePath: this.rootPath
    };
    
    const session = new Session(id, sessionConfig);
    this.sessions.set(id, session);
    
    return session;
  }

  async getSession(id) {
    if (this.sessions.has(id)) {
      return this.sessions.get(id);
    }
    
    const sessionPath = path.join(this.rootPath, id, 'session.json');
    if (fs.existsSync(sessionPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
        const session = Session.fromJSON(data, {
          ...this.config,
          storagePath: this.rootPath
        });
        this.sessions.set(id, session);
        return session;
      } catch (e) {
        return null;
      }
    }
    
    return null;
  }

  async initializeSession(id, options) {
    const session = await this.getSession(id);
    if (!session) {
      return { error: 'Session not found' };
    }
    
    await session.initialize(options);
    this.activeSessions.add(id);
    
    return session;
  }

  async closeSession(id) {
    const session = await this.getSession(id);
    if (!session) {
      return { error: 'Session not found' };
    }
    
    await session.save();
    this.activeSessions.delete(id);
    
    return { success: true };
  }

  async deleteSession(id) {
    const session = await this.getSession(id);
    if (!session) {
      return { error: 'Session not found' };
    }
    
    const sessionPath = path.join(this.rootPath, id);
    if (fs.existsSync(sessionPath)) {
      const files = fs.readdirSync(sessionPath);
      files.forEach(function(file) {
        fs.unlinkSync(path.join(sessionPath, file));
      });
      fs.rmdirSync(sessionPath);
    }
    
    this.sessions.delete(id);
    this.activeSessions.delete(id);
    
    return { success: true };
  }

  listSessions() {
    const results = [];
    
    if (fs.existsSync(this.rootPath)) {
      const dirs = fs.readdirSync(this.rootPath);
      dirs.forEach(function(dir) {
        const sessionPath = path.join(this.rootPath, dir, 'session.json');
        if (fs.existsSync(sessionPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
            results.push({
              id: data.id,
              status: data.status,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt
            });
          } catch (e) {
            // Skip invalid sessions
          }
        }
      }.bind(this));
    }
    
    return results;
  }

  getActiveSessions() {
    const results = [];
    this.activeSessions.forEach(function(id) {
      const session = this.sessions.get(id);
      if (session) {
        results.push(session.getStats());
      }
    }.bind(this));
    return results;
  }

  async cleanup() {
    const promises = [];
    this.sessions.forEach(function(session) {
      promises.push(session.save());
    });
    await Promise.all(promises);
  }
}

module.exports = {
  Session,
  SessionManager,
  SESSION_STATUS,
  DEFAULT_SESSION_CONFIG
};
