/**
 * External AI Tools Integration
 * 
 * Supports integration with:
 * - Claude Code (CLI)
 * - Cursor (CLI)
 * - Codex/OpenAI (API)
 * - Trae (CLI)
 * - Generic CLI tools
 * - Custom tools via adapters
 */

const { spawn, exec } = require('child_process');
const { EventEmitter } = require('events');
const https = require('https');

const ADAPTER_TYPES = {
  CLI: 'cli',
  API: 'api',
  MCP: 'mcp'
};

const TOOL_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  ERROR: 'error',
  COMPLETED: 'completed'
};

class BaseToolAdapter extends EventEmitter {
  constructor(config) {
    super();
    this.config = config || {};
    this.name = config.name || 'unknown';
    this.type = config.type || 'unknown';
    this.status = TOOL_STATUS.IDLE;
    this.lastResult = null;
    this.history = [];
  }

  async execute(task) {
    throw new Error('execute() must be implemented by subclass');
  }

  async stop() {
    this.status = TOOL_STATUS.IDLE;
  }

  getStatus() {
    return {
      name: this.name,
      type: this.type,
      status: this.status,
      lastResult: this.lastResult ? {
        success: this.lastResult.success,
        timestamp: this.lastResult.timestamp
      } : null
    };
  }

  getHistory(limit) {
    limit = limit || 50;
    return this.history.slice(-limit);
  }

  _recordResult(result) {
    this.lastResult = {
      ...result,
      timestamp: Date.now()
    };
    this.history.push(this.lastResult);
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }
    this.emit('result', this.lastResult);
  }
}

class CLIAdapter extends BaseToolAdapter {
  constructor(config) {
    super(config);
    this.type = ADAPTER_TYPES.CLI;
    this.command = config.command;
    this.args = config.args || [];
    this.cwd = config.cwd || process.cwd();
    this.env = config.env || {};
    this.timeout = config.timeout || 300000;
    this.process = null;
  }

  async execute(task) {
    const self = this;
    
    if (this.status === TOOL_STATUS.RUNNING) {
      return { success: false, error: 'Tool is already running' };
    }

    this.status = TOOL_STATUS.RUNNING;
    this.emit('start', { task: task });

    return new Promise(function(resolve) {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const args = self._buildArgs(task);
      
      self.process = spawn(self.command, args, {
        cwd: self.cwd,
        env: { ...process.env, ...self.env },
        shell: true
      });

      const timeoutId = setTimeout(function() {
        timedOut = true;
        if (self.process) {
          self.process.kill();
        }
        self.status = TOOL_STATUS.ERROR;
        const result = { 
          success: false, 
          error: 'Execution timeout after ' + (self.timeout / 1000) + 's',
          stdout: stdout,
          stderr: stderr
        };
        self._recordResult(result);
        self.emit('error', result);
        resolve(result);
      }, self.timeout);

      self.process.stdout.on('data', function(data) {
        const chunk = data.toString();
        stdout += chunk;
        self.emit('stdout', { data: chunk });
      });

      self.process.stderr.on('data', function(data) {
        const chunk = data.toString();
        stderr += chunk;
        self.emit('stderr', { data: chunk });
      });

      self.process.on('close', function(code) {
        if (timedOut) return;
        
        clearTimeout(timeoutId);
        self.process = null;
        
        const result = {
          success: code === 0,
          exitCode: code,
          stdout: stdout,
          stderr: stderr,
          output: stdout || stderr
        };
        
        self.status = code === 0 ? TOOL_STATUS.COMPLETED : TOOL_STATUS.ERROR;
        self._recordResult(result);
        
        if (result.success) {
          self.emit('complete', result);
        } else {
          self.emit('error', result);
        }
        
        resolve(result);
      });

      self.process.on('error', function(err) {
        if (timedOut) return;
        
        clearTimeout(timeoutId);
        self.process = null;
        
        const result = {
          success: false,
          error: err.message,
          stdout: stdout,
          stderr: stderr
        };
        
        self.status = TOOL_STATUS.ERROR;
        self._recordResult(result);
        self.emit('error', result);
        resolve(result);
      });

      if (task.input) {
        try {
          self.process.stdin.write(task.input);
          self.process.stdin.end();
        } catch (e) {}
      }
    });
  }

  _buildArgs(task) {
    const args = [...this.args];
    
    if (task.prompt) {
      args.push('--prompt', task.prompt);
    }
    if (task.file) {
      args.push('--file', task.file);
    }
    if (task.output) {
      args.push('--output', task.output);
    }
    if (task.args && Array.isArray(task.args)) {
      args.push(...task.args);
    }
    
    return args;
  }

  async stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.status = TOOL_STATUS.IDLE;
    this.emit('stopped', {});
  }

  isAvailable() {
    const self = this;
    return new Promise(function(resolve) {
      exec('where ' + self.command + ' 2>nul || which ' + self.command + ' 2>/dev/null', function(error) {
        resolve(!error);
      });
    });
  }
}

class ClaudeCodeAdapter extends CLIAdapter {
  constructor(config) {
    super({
      ...config,
      command: config.command || 'claude',
      args: config.args || []
    });
    this.name = 'claude-code';
  }

  _buildArgs(task) {
    const args = [];
    
    const prompt = task.prompt || task.description || task.input;
    if (prompt) {
      args.push('-p', prompt);
    }
    
    if (task.files && task.files.length > 0) {
      task.files.forEach(function(f) {
        args.push(f);
      });
    }
    
    if (task.output) {
      args.push('--output', task.output);
    }
    
    if (task.maxTokens) {
      args.push('--max-tokens', String(task.maxTokens));
    }
    
    if (task.args && Array.isArray(task.args)) {
      args.push(...task.args);
    }
    
    return args;
  }
}

class TraeAdapter extends CLIAdapter {
  constructor(config) {
    super({
      ...config,
      command: config.command || 'trae',
      args: config.args || []
    });
    this.name = 'trae';
  }

  _buildArgs(task) {
    const args = [];
    
    const prompt = task.prompt || task.description || task.input;
    if (prompt) {
      args.push(prompt);
    }
    
    if (task.file) {
      args.push('--file', task.file);
    }
    
    if (task.mode) {
      args.push('--mode', task.mode);
    }
    
    if (task.args && Array.isArray(task.args)) {
      args.push(...task.args);
    }
    
    return args;
  }
}

class CursorAdapter extends CLIAdapter {
  constructor(config) {
    super({
      ...config,
      command: config.command || 'cursor',
      args: config.args || []
    });
    this.name = 'cursor';
  }

  _buildArgs(task) {
    const args = [];
    
    if (task.file) {
      args.push(task.file);
    }
    
    if (task.prompt) {
      args.push('--prompt', task.prompt);
    }
    
    if (task.args && Array.isArray(task.args)) {
      args.push(...task.args);
    }
    
    return args;
  }
}

class CodexAdapter extends BaseToolAdapter {
  constructor(config) {
    super(config);
    this.type = ADAPTER_TYPES.API;
    this.name = 'codex';
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.model = config.model || 'gpt-4o';
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  async execute(task) {
    const self = this;
    
    if (this.status === TOOL_STATUS.RUNNING) {
      return { success: false, error: 'Tool is already running' };
    }

    this.status = TOOL_STATUS.RUNNING;
    this.emit('start', { task: task });

    const prompt = task.prompt || task.description || task.input;
    
    const systemPrompt = task.systemPrompt || 'You are an expert code generation assistant. Generate clean, efficient, and well-documented code. Include comments and follow best practices.';
    
    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: task.maxTokens || 4096,
      temperature: task.temperature !== undefined ? task.temperature : 0.7
    });

    return new Promise(function(resolve) {
      const url = new URL(self.baseUrl + '/chat/completions');
      
      const req = https.request({
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + self.apiKey
        },
        timeout: 120000
      }, function(res) {
        let data = '';
        res.on('data', function(chunk) { data += chunk; });
        res.on('end', function() {
          try {
            const json = JSON.parse(data);
            
            if (res.statusCode >= 400) {
              const result = {
                success: false,
                error: json.error?.message || 'API Error',
                statusCode: res.statusCode
              };
              self.status = TOOL_STATUS.ERROR;
              self._recordResult(result);
              self.emit('error', result);
              resolve(result);
              return;
            }

            const content = json.choices[0]?.message?.content || '';
            
            const result = {
              success: true,
              output: content,
              code: self._extractCode(content),
              usage: json.usage,
              model: json.model
            };
            
            self.status = TOOL_STATUS.COMPLETED;
            self._recordResult(result);
            self.emit('complete', result);
            resolve(result);
          } catch (e) {
            const result = {
              success: false,
              error: 'Failed to parse response: ' + e.message,
              raw: data.substring(0, 500)
            };
            self.status = TOOL_STATUS.ERROR;
            self._recordResult(result);
            self.emit('error', result);
            resolve(result);
          }
        });
      });

      req.on('error', function(err) {
        const result = {
          success: false,
          error: err.message
        };
        self.status = TOOL_STATUS.ERROR;
        self._recordResult(result);
        self.emit('error', result);
        resolve(result);
      });

      req.on('timeout', function() {
        req.destroy();
        const result = {
          success: false,
          error: 'Request timeout'
        };
        self.status = TOOL_STATUS.ERROR;
        self._recordResult(result);
        self.emit('error', result);
        resolve(result);
      });

      req.write(body);
      req.end();
    });
  }

  _extractCode(content) {
    const codeBlocks = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      codeBlocks.push({
        language: match[1] || 'text',
        code: match[2].trim()
      });
    }
    
    return codeBlocks;
  }
}

class GenericCLIAdapter extends CLIAdapter {
  constructor(config) {
    super(config);
    this.name = config.name || 'generic-cli';
    this.promptTemplate = config.promptTemplate || '{prompt}';
    this.outputParser = config.outputParser || null;
  }

  _buildArgs(task) {
    const args = [...this.args];
    const prompt = task.prompt || task.description || task.input || '';
    
    const finalPrompt = this.promptTemplate.replace('{prompt}', prompt);
    
    if (finalPrompt) {
      args.push(finalPrompt);
    }
    
    if (task.args && Array.isArray(task.args)) {
      args.push(...task.args);
    }
    
    return args;
  }
}

class ExternalToolManager extends EventEmitter {
  constructor(config) {
    super();
    this.config = config || {};
    this.tools = new Map();
    this.tasks = new Map();
    this.taskQueue = [];
    this.running = false;
  }

  registerTool(config) {
    const self = this;
    let adapter;
    
    switch (config.type) {
      case 'claude-code':
        adapter = new ClaudeCodeAdapter(config);
        break;
      case 'trae':
        adapter = new TraeAdapter(config);
        break;
      case 'cursor':
        adapter = new CursorAdapter(config);
        break;
      case 'codex':
      case 'openai':
        adapter = new CodexAdapter(config);
        break;
      case 'cli':
        adapter = new GenericCLIAdapter(config);
        break;
      default:
        adapter = new GenericCLIAdapter(config);
    }
    
    this.tools.set(adapter.name, adapter);
    
    adapter.on('start', function(data) {
      self.emit('tool:start', { tool: adapter.name, data: data });
    });
    
    adapter.on('complete', function(data) {
      self.emit('tool:complete', { tool: adapter.name, data: data });
    });
    
    adapter.on('error', function(data) {
      self.emit('tool:error', { tool: adapter.name, data: data });
    });
    
    adapter.on('stdout', function(data) {
      self.emit('tool:stdout', { tool: adapter.name, data: data });
    });
    
    adapter.on('stderr', function(data) {
      self.emit('tool:stderr', { tool: adapter.name, data: data });
    });
    
    this.emit('tool:registered', { name: adapter.name, type: adapter.type });
    
    return adapter;
  }

  unregisterTool(name) {
    const tool = this.tools.get(name);
    if (tool) {
      tool.stop();
      this.tools.delete(name);
      this.emit('tool:unregistered', { name: name });
      return true;
    }
    return false;
  }

  getTool(name) {
    return this.tools.get(name);
  }

  listTools() {
    const result = [];
    this.tools.forEach(function(tool) {
      result.push(tool.getStatus());
    });
    return result;
  }

  async executeTask(toolName, task) {
    const tool = this.tools.get(toolName);
    
    if (!tool) {
      return { success: false, error: 'Tool not found: ' + toolName };
    }
    
    const taskId = 'task-' + Date.now();
    task.id = taskId;
    task.tool = toolName;
    task.status = 'running';
    task.startTime = Date.now();
    
    this.tasks.set(taskId, task);
    this.emit('task:start', { taskId: taskId, tool: toolName, task: task });
    
    try {
      const result = await tool.execute(task);
      
      task.status = result.success ? 'completed' : 'failed';
      task.endTime = Date.now();
      task.duration = task.endTime - task.startTime;
      task.result = result;
      
      this.emit('task:complete', { taskId: taskId, result: result });
      
      return result;
    } catch (e) {
      task.status = 'error';
      task.error = e.message;
      task.endTime = Date.now();
      
      this.emit('task:error', { taskId: taskId, error: e.message });
      
      return { success: false, error: e.message };
    }
  }

  async executeBatch(tasks) {
    const self = this;
    const results = [];
    
    for (const item of tasks) {
      const result = await this.executeTask(item.tool, item.task);
      results.push({
        tool: item.tool,
        task: item.task,
        result: result
      });
    }
    
    return results;
  }

  async executeParallel(tasks) {
    const self = this;
    const promises = tasks.map(function(item) {
      return self.executeTask(item.tool, item.task);
    });
    
    return Promise.all(promises);
  }

  queueTask(toolName, task) {
    const taskId = 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    this.taskQueue.push({
      id: taskId,
      tool: toolName,
      task: task,
      status: 'queued',
      queuedAt: Date.now()
    });
    
    this.emit('task:queued', { taskId: taskId, tool: toolName });
    
    this._processQueue();
    
    return taskId;
  }

  async _processQueue() {
    const self = this;
    
    if (this.running || this.taskQueue.length === 0) {
      return;
    }
    
    this.running = true;
    
    while (this.taskQueue.length > 0) {
      const item = this.taskQueue.shift();
      await this.executeTask(item.tool, item.task);
    }
    
    this.running = false;
  }

  getQueue() {
    return this.taskQueue.slice();
  }

  clearQueue() {
    this.taskQueue = [];
    this.emit('queue:cleared', {});
  }

  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  getTaskHistory(limit) {
    limit = limit || 100;
    const tasks = Array.from(this.tasks.values());
    return tasks.slice(-limit);
  }

  async checkToolAvailability(name) {
    const tool = this.tools.get(name);
    if (!tool) {
      return { available: false, reason: 'Tool not registered' };
    }
    
    if (tool.isAvailable) {
      const available = await tool.isAvailable();
      return { available: available, reason: available ? 'OK' : 'Command not found' };
    }
    
    return { available: true, reason: 'API-based tool' };
  }

  async checkAllToolsAvailability() {
    const self = this;
    const results = {};
    
    for (const [name, tool] of this.tools) {
      results[name] = await this.checkToolAvailability(name);
    }
    
    return results;
  }
}

function createExternalToolManager(config) {
  return new ExternalToolManager(config);
}

module.exports = {
  BaseToolAdapter,
  CLIAdapter,
  ClaudeCodeAdapter,
  TraeAdapter,
  CursorAdapter,
  CodexAdapter,
  GenericCLIAdapter,
  ExternalToolManager,
  createExternalToolManager,
  ADAPTER_TYPES,
  TOOL_STATUS
};
