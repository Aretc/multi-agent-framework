/**
 * Multi-Agent Framework Core
 * 
 * A flexible framework for AI agent collaboration
 */

const path = require('path');
const fs = require('fs');
const { MemoryManager, AgentMemory } = require('./memory');
const { createLLMAdapter } = require('./llm/adapter');
const { ToolManager } = require('./tools');
const { AgentRuntime } = require('./agent');

const DEFAULT_CONFIG = {
  agents: [],
  workflows: {},
  messages: {
    types: [
      'NOTIFICATION', 'REQUEST', 'RESPONSE', 'TASK_ASSIGN',
      'TASK_UPDATE', 'TASK_COMPLETE', 'REVIEW_REQUEST',
      'REVIEW_FEEDBACK', 'BUG_REPORT', 'DECISION', 'ESCALATION'
    ],
    priorities: ['P0', 'P1', 'P2', 'P3']
  },
  tasks: {
    statuses: ['pending', 'assigned', 'in-progress', 'review', 'testing', 'done', 'blocked'],
    priorities: ['P0', 'P1', 'P2', 'P3']
  },
  memory: {
    enabled: true,
    shortTerm: { maxSize: 100, maxAge: 3600000 },
    longTerm: { maxSize: 10000 },
    episodic: { maxEvents: 1000, retentionDays: 30 }
  },
  llm: {
    enabled: false,
    provider: 'mock',
    model: 'default',
    baseUrl: null,
    apiKey: null,
    temperature: 0.7,
    maxTokens: 4096
  },
  tools: {
    enabled: true,
    builtin: true,
    custom: []
  }
};

class MultiAgentFramework {
  constructor(options) {
    options = options || {};
    this.rootDir = options.rootDir || process.cwd();
    this.configPath = options.configPath || path.join(this.rootDir, 'maf.config.json');
    this.config = this.loadConfig();
    this.agents = new Map();
    this.tasks = new Map();
    this.messages = new Map();
    this.workflows = new Map();
    this.agentRuntimes = new Map();
    
    // Initialize memory system
    if (this.config.memory && this.config.memory.enabled) {
      this.memoryManager = new MemoryManager({
        rootPath: path.join(this.rootDir, '.maf', 'memory'),
        config: this.config.memory
      });
    }
    
    // Initialize LLM
    if (this.config.llm && this.config.llm.enabled) {
      this.llm = createLLMAdapter(this.config.llm);
    }
    
    // Initialize Tools
    if (this.config.tools && this.config.tools.enabled) {
      this.toolManager = new ToolManager();
    }
  }

  loadConfig() {
    if (fs.existsSync(this.configPath)) {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
    }
    return { ...DEFAULT_CONFIG };
  }

  saveConfig() {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  initProject(options) {
    options = options || {};
    const dirs = [
      'agents',
      'tasks/pending',
      'tasks/assigned',
      'tasks/in-progress',
      'tasks/review',
      'tasks/testing',
      'tasks/done',
      'tasks/blocked',
      'tasks/archive',
      'messages/broadcast',
      'messages/direct',
      'messages/archive',
      'docs',
      '.maf'
    ];

    dirs.forEach(function(dir) {
      const dirPath = path.join(this.rootDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }.bind(this));

    const preset = options.preset || 'default';
    if (preset !== 'none') {
      this.applyPreset(preset);
    }

    this.saveConfig();
    return { success: true, dirs: dirs };
  }

  applyPreset(presetName) {
    const presetPath = path.join(__dirname, '..', 'presets', presetName + '.json');
    if (fs.existsSync(presetPath)) {
      const preset = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));
      if (preset.agents) {
        this.config.agents = preset.agents;
        preset.agents.forEach(function(agent) {
          this.createAgentFile(agent);
        }.bind(this));
      }
      if (preset.workflows) {
        this.config.workflows = preset.workflows;
      }
    }
  }

  createAgentFile(agent) {
    const templatePath = path.join(__dirname, '..', 'templates', 'agent.md');
    let template = '# Agent: {name}\n\n## Role\n{description}\n\n## Responsibilities\n{responsibilities}\n\n## Outputs\n{outputs}\n';
    
    if (fs.existsSync(templatePath)) {
      template = fs.readFileSync(templatePath, 'utf-8');
    }

    const content = template
      .replace(/{name}/g, agent.name)
      .replace(/{description}/g, agent.description || '')
      .replace(/{responsibilities}/g, (agent.responsibilities || []).map(function(r) { return '- ' + r; }).join('\n'))
      .replace(/{outputs}/g, (agent.outputs || []).map(function(o) { return '- ' + o; }).join('\n'));

    const agentPath = path.join(this.rootDir, 'agents', agent.name + '.md');
    fs.writeFileSync(agentPath, content, 'utf-8');
    return agentPath;
  }

  registerAgent(agent) {
    this.agents.set(agent.name, agent);
    if (!this.config.agents.find(function(a) { return a.name === agent.name; })) {
      this.config.agents.push(agent);
      this.saveConfig();
    }
    return agent;
  }

  getAgent(name) {
    return this.agents.get(name) || this.config.agents.find(function(a) { return a.name === name; });
  }

  listAgents() {
    return Array.from(this.config.agents);
  }

  createTask(task) {
    const id = this.generateId('TASK');
    task.id = id;
    task.status = task.status || 'pending';
    task.createdAt = new Date().toISOString();
    
    const templatePath = path.join(__dirname, '..', 'templates', 'task.md');
    let template = '# Task: {title}\n\n## Basic Info\n| Field | Value |\n|-------|-------|\n| **ID** | {id} |\n| **Priority** | {priority} |\n| **Status** | {status} |\n| **Assignee** | {assignee} |\n\n## Description\n{description}\n\n## Acceptance Criteria\n{criteria}\n';

    if (fs.existsSync(templatePath)) {
      template = fs.readFileSync(templatePath, 'utf-8');
    }

    const content = template
      .replace(/{id}/g, id)
      .replace(/{title}/g, task.title || 'Untitled')
      .replace(/{priority}/g, task.priority || 'P2')
      .replace(/{status}/g, task.status)
      .replace(/{assignee}/g, task.assignee || 'Unassigned')
      .replace(/{description}/g, task.description || '')
      .replace(/{criteria}/g, (task.criteria || []).map(function(c) { return '- [ ] ' + c; }).join('\n'));

    const taskPath = path.join(this.rootDir, 'tasks', task.status, id + '.md');
    fs.writeFileSync(taskPath, content, 'utf-8');
    
    this.tasks.set(id, task);
    return { id: id, path: taskPath, task: task };
  }

  updateTask(taskId, updates) {
    const taskInfo = this.findTask(taskId);
    if (!taskInfo) {
      return { error: 'Task not found' };
    }

    const task = { ...taskInfo.task, ...updates };
    
    if (updates.status && updates.status !== taskInfo.status) {
      const oldPath = taskInfo.path;
      const newPath = path.join(this.rootDir, 'tasks', updates.status, taskId + '.md');
      
      let content = fs.readFileSync(oldPath, 'utf-8');
      content = content.replace(/(\*\*Status\*\*\s*\|\s*)\S+/, '$1' + updates.status);
      
      if (updates.assignee) {
        content = content.replace(/(\*\*Assignee\*\*\s*\|\s*)\S+/, '$1' + updates.assignee);
      }
      
      fs.writeFileSync(newPath, content, 'utf-8');
      if (oldPath !== newPath) {
        fs.unlinkSync(oldPath);
      }
      
      task.path = newPath;
    }

    this.tasks.set(taskId, task);
    return { success: true, task: task };
  }

  findTask(taskId) {
    const statuses = this.config.tasks.statuses;
    for (let i = 0; i < statuses.length; i++) {
      const status = statuses[i];
      const taskPath = path.join(this.rootDir, 'tasks', status, taskId + '.md');
      if (fs.existsSync(taskPath)) {
        return {
          path: taskPath,
          status: status,
          task: this.parseTaskFile(taskPath)
        };
      }
    }
    return null;
  }

  parseTaskFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const titleMatch = content.match(/# Task:\s*(.*)/);
    const assigneeMatch = content.match(/\*\*Assignee\*\*\s*\|\s*(\S+)/);
    const statusMatch = content.match(/\*\*Status\*\*\s*\|\s*(\S+)/);
    const priorityMatch = content.match(/\*\*Priority\*\*\s*\|\s*(\S+)/);

    return {
      id: path.basename(filePath, '.md'),
      title: titleMatch ? titleMatch[1].trim() : 'Untitled',
      assignee: assigneeMatch ? assigneeMatch[1] : '',
      status: statusMatch ? statusMatch[1] : 'pending',
      priority: priorityMatch ? priorityMatch[1] : 'P2',
      content: content
    };
  }

  listTasks(status) {
    const results = [];
    const statuses = status ? [status] : this.config.tasks.statuses;
    
    statuses.forEach(function(s) {
      const dirPath = path.join(this.rootDir, 'tasks', s);
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath).filter(function(f) { return f.endsWith('.md'); });
        files.forEach(function(file) {
          results.push(this.parseTaskFile(path.join(dirPath, file)));
        }.bind(this));
      }
    }.bind(this));
    
    return results;
  }

  createMessage(options) {
    const id = this.generateId('MSG');
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    const templatePath = path.join(__dirname, '..', 'templates', 'message.md');
    let template = '---\nid: {id}\ntype: {type}\npriority: {priority}\nfrom: {from}\nto: {to}\ntimestamp: {timestamp}\nrelatedTask: {taskId}\nstatus: PENDING\n---\n\n# {subject}\n\n## Summary\n{summary}\n\n## Details\n{details}\n\n## Action Items\n- [ ] {actionItem}\n';

    if (fs.existsSync(templatePath)) {
      template = fs.readFileSync(templatePath, 'utf-8');
    }

    const content = template
      .replace(/{id}/g, id)
      .replace(/{type}/g, options.type || 'NOTIFICATION')
      .replace(/{priority}/g, options.priority || 'P2')
      .replace(/{from}/g, options.from || 'System')
      .replace(/{to}/g, options.to || '*')
      .replace(/{timestamp}/g, timestamp)
      .replace(/{taskId}/g, options.taskId || '')
      .replace(/{subject}/g, options.subject || 'Notification')
      .replace(/{summary}/g, options.summary || '')
      .replace(/{details}/g, options.details || '')
      .replace(/{actionItem}/g, options.actionItem || 'Review');

    let saveDir;
    if (options.to === '*') {
      saveDir = path.join(this.rootDir, 'messages', 'broadcast');
    } else {
      saveDir = path.join(this.rootDir, 'messages', 'direct', 'to-' + options.to);
    }

    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }

    const filePath = path.join(saveDir, id + '.md');
    fs.writeFileSync(filePath, content, 'utf-8');
    
    this.messages.set(id, { id: id, path: filePath, ...options });
    return { id: id, path: filePath };
  }

  listMessages(type, agent) {
    const results = [];
    
    if (type === 'broadcast' || !type) {
      const broadcastDir = path.join(this.rootDir, 'messages', 'broadcast');
      if (fs.existsSync(broadcastDir)) {
        const files = fs.readdirSync(broadcastDir).filter(function(f) { return f.endsWith('.md'); });
        files.forEach(function(file) {
          results.push({
            id: file.replace('.md', ''),
            path: path.join(broadcastDir, file),
            type: 'broadcast'
          });
        });
      }
    }
    
    if (type === 'direct' || !type) {
      const directBase = path.join(this.rootDir, 'messages', 'direct');
      if (fs.existsSync(directBase)) {
        const dirs = agent ? ['to-' + agent] : fs.readdirSync(directBase);
        dirs.forEach(function(dir) {
          const dirPath = path.join(directBase, dir);
          if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
            const files = fs.readdirSync(dirPath).filter(function(f) { return f.endsWith('.md'); });
            files.forEach(function(file) {
              results.push({
                id: file.replace('.md', ''),
                path: path.join(dirPath, file),
                type: 'direct',
                to: dir.replace('to-', '')
              });
            });
          }
        });
      }
    }
    
    return results;
  }

  transferTask(taskId, fromAgent, toAgent, options) {
    options = options || {};
    const taskInfo = this.findTask(taskId);
    if (!taskInfo) {
      return { error: 'Task not found' };
    }

    const workflow = this.config.workflows[taskInfo.status];
    const newStatus = options.status || (workflow && workflow.next);
    
    if (!newStatus) {
      return { error: 'Cannot determine next status' };
    }

    const result = this.updateTask(taskId, {
      status: newStatus,
      assignee: toAgent
    });

    if (result.success) {
      this.createMessage({
        type: 'TASK_COMPLETE',
        from: fromAgent,
        to: toAgent,
        subject: 'Task Transfer: ' + taskInfo.task.title,
        taskId: taskId,
        summary: fromAgent + ' has completed the task',
        details: 'Task transferred from ' + fromAgent + ' to ' + toAgent
      });
    }

    return result;
  }

  splitTask(parentTaskId, subtasks, mainAgent) {
    const results = [];
    const state = {
      parentTaskId: parentTaskId,
      subtasks: [],
      parentMap: {}
    };

    subtasks.forEach(function(config) {
      const taskResult = this.createTask({
        title: config.title,
        description: config.description,
        assignee: config.assignee,
        priority: config.priority || 'P2',
        status: 'assigned'
      });

      state.subtasks.push({
        id: taskResult.id,
        assignee: config.assignee,
        status: 'assigned'
      });
      state.parentMap[taskResult.id] = parentTaskId;

      this.createMessage({
        type: 'TASK_ASSIGN',
        from: mainAgent,
        to: config.assignee,
        subject: 'Subtask Assignment: ' + config.title,
        taskId: taskResult.id,
        summary: 'Subtask of ' + parentTaskId + ' assigned to you'
      });

      results.push(taskResult);
    }.bind(this));

    const statePath = path.join(this.rootDir, '.maf', 'workflow-state.json');
    let existingState = {};
    if (fs.existsSync(statePath)) {
      existingState = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    }
    existingState[parentTaskId] = state;
    fs.writeFileSync(statePath, JSON.stringify(existingState, null, 2), 'utf-8');

    return results;
  }

  reportResult(subtaskId, result, agent) {
    const statePath = path.join(this.rootDir, '.maf', 'workflow-state.json');
    if (!fs.existsSync(statePath)) {
      return { error: 'No workflow state found' };
    }

    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    let parentTaskId = null;
    let parentState = null;

    Object.keys(state).forEach(function(pid) {
      const subtask = state[pid].subtasks.find(function(s) { return s.id === subtaskId; });
      if (subtask) {
        parentTaskId = pid;
        parentState = state[pid];
      }
    });

    if (!parentTaskId) {
      return { error: 'Parent task not found for subtask' };
    }

    this.updateTask(subtaskId, { status: 'done' });

    if (!parentState.results) {
      parentState.results = {};
    }
    parentState.results[subtaskId] = {
      agent: agent,
      result: result,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');

    this.createMessage({
      type: 'TASK_COMPLETE',
      from: agent,
      to: 'Coordinator',
      subject: 'Subtask Complete: ' + subtaskId,
      taskId: parentTaskId,
      summary: 'Subtask completed by ' + agent,
      details: 'Result: ' + result
    });

    return { success: true, parentTaskId: parentTaskId };
  }

  collectResults(parentTaskId) {
    const statePath = path.join(this.rootDir, '.maf', 'workflow-state.json');
    if (!fs.existsSync(statePath)) {
      return { error: 'No workflow state found' };
    }

    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    const parentState = state[parentTaskId];
    
    if (!parentState) {
      return { error: 'Parent task not found' };
    }

    const subtasks = parentState.subtasks || [];
    const results = parentState.results || {};
    
    let completed = 0;
    subtasks.forEach(function(st) {
      if (results[st.id]) {
        st.status = 'done';
        completed++;
      }
    });

    const allCompleted = completed === subtasks.length && subtasks.length > 0;

    if (allCompleted) {
      this.createMessage({
        type: 'NOTIFICATION',
        from: 'System',
        to: '*',
        subject: 'All Subtasks Completed: ' + parentTaskId,
        taskId: parentTaskId,
        summary: 'All ' + subtasks.length + ' subtasks have been completed'
      });
    }

    return {
      parentTaskId: parentTaskId,
      subtasks: subtasks,
      results: results,
      completed: completed,
      total: subtasks.length,
      allCompleted: allCompleted
    };
  }

  generateId(prefix) {
    const date = new Date();
    const dateStr = date.toISOString().replace(/-/g, '').split('T')[0];
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return prefix + '-' + dateStr + '-' + random;
  }

  // Memory System Methods
  getAgentMemory(agentName) {
    if (!this.memoryManager) {
      return null;
    }
    return this.memoryManager.getAgentMemory(agentName);
  }

  async initAgentMemory(agentName) {
    if (!this.memoryManager) {
      return null;
    }
    const memory = this.memoryManager.getAgentMemory(agentName);
    await memory.init();
    return memory;
  }

  async agentRemember(agentName, content, metadata) {
    const memory = this.getAgentMemory(agentName);
    if (!memory) return null;
    await memory.init();
    
    // Add to short-term memory
    memory.remember(content, metadata);
    
    // Record as episodic event
    await memory.recordEvent({
      type: 'memory_add',
      action: 'Added to short-term memory',
      details: { content: content.substring(0, 100) }
    });
    
    return memory;
  }

  async agentMemorize(agentName, content, metadata) {
    const memory = this.getAgentMemory(agentName);
    if (!memory) return null;
    await memory.init();
    
    // Add to long-term memory
    const item = await memory.memorize(content, metadata);
    
    // Record as episodic event
    await memory.recordEvent({
      type: 'memory_persist',
      action: 'Added to long-term memory',
      details: { itemId: item.id, content: content.substring(0, 100) }
    });
    
    return item;
  }

  async agentRecall(agentName, query, options) {
    const memory = this.getAgentMemory(agentName);
    if (!memory) return null;
    await memory.init();
    
    if (query) {
      return await memory.retrieve(query, options);
    }
    return memory.recall(options && options.limit);
  }

  async agentRecallEvents(agentName, startTime, endTime) {
    const memory = this.getAgentMemory(agentName);
    if (!memory) return null;
    await memory.init();
    return await memory.recallEvents(startTime, endTime);
  }

  async getAgentContext(agentName, maxItems) {
    const memory = this.getAgentMemory(agentName);
    if (!memory) return null;
    await memory.init();
    return await memory.getContextSummary(maxItems);
  }

  async searchAllMemories(query, options) {
    if (!this.memoryManager) return {};
    return await this.memoryManager.searchAll(query, options);
  }

  getMemoryStats() {
    if (!this.memoryManager) return null;
    return this.memoryManager.getAllStats();
  }

  // LLM Methods
  createLLM(config) {
    return createLLMAdapter({ ...this.config.llm, ...config });
  }

  async chat(agentName, messages, options) {
    options = options || {};
    const llm = this.createLLM(options.llm || {});
    
    // Add context from memory if available
    if (this.memory && options.includeContext) {
      const context = await this.getAgentContext(agentName, 5);
      if (context && context.recentMemory && context.recentMemory.length > 0) {
        messages = [
          { role: 'system', content: 'Recent context: ' + context.recentMemory.join('\n') },
          ...messages
        ];
      }
    }
    
    const response = await llm.chat(messages, options);
    
    // Record in memory
    if (this.memory) {
      const memory = this.getAgentMemory(agentName);
      if (memory) {
        await memory.recordEvent({
          type: 'llm_chat',
          action: 'LLM chat interaction',
          details: { 
            messageCount: messages.length, 
            responseLength: response.content ? response.content.length : 0 
          }
        });
      }
    }
    
    return response;
  }

  async embed(text, options) {
    options = options || {};
    const llm = this.createLLM(options.llm || {});
    return await llm.embed(text);
  }

  // Tool Methods
  registerTool(config) {
    if (!this.toolManager) {
      this.toolManager = new ToolManager();
    }
    return this.toolManager.registerTool(config);
  }

  getTool(name) {
    return this.toolManager ? this.toolManager.getTool(name) : null;
  }

  listTools() {
    return this.toolManager ? this.toolManager.listTools() : [];
  }

  async executeTool(name, params) {
    if (!this.toolManager) {
      return { success: false, error: 'Tool system not enabled' };
    }
    return await this.toolManager.executeTool(name, params);
  }

  // Agent Runtime Methods
  getAgentRuntime(agentName) {
    return this.agentRuntimes.get(agentName);
  }

  async createAgentRuntime(agentName, config) {
    config = config || {};
    const agentConfig = this.getAgent(agentName);
    
    const runtimeConfig = {
      name: agentName,
      role: agentConfig ? agentConfig.description : 'Agent',
      description: agentConfig ? agentConfig.description : '',
      llm: { ...this.config.llm, ...config.llm },
      memory: {
        enabled: this.config.memory.enabled,
        rootPath: path.join(this.rootDir, '.maf', 'memory'),
        ...this.config.memory,
        ...config.memory
      },
      tools: {
        enabled: this.config.tools.enabled,
        builtin: this.config.tools.builtin,
        custom: config.tools || [],
        ...this.config.tools,
        ...config.tools
      },
      ...config
    };
    
    const runtime = new AgentRuntime(runtimeConfig);
    await runtime.init();
    this.agentRuntimes.set(agentName, runtime);
    
    return runtime;
  }

  async runAgent(agentName, input, options) {
    options = options || {};
    
    let runtime = this.getAgentRuntime(agentName);
    if (!runtime) {
      runtime = await this.createAgentRuntime(agentName, options);
    }
    
    return await runtime.run(input);
  }
}

module.exports = { 
  MultiAgentFramework, 
  DEFAULT_CONFIG,
  MemoryManager: require('./memory').MemoryManager,
  AgentMemory: require('./memory').AgentMemory,
  createLLMAdapter: require('./llm/adapter').createLLMAdapter,
  ToolManager: require('./tools').ToolManager,
  AgentRuntime: require('./agent').AgentRuntime
};
