/**
 * Tool System for Multi-Agent Framework
 * 
 * Supports:
 * - Tool registration and discovery
 * - Tool execution with validation
 * - Built-in tools (file, web, code, api)
 * - Custom tool creation
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const TOOL_STATUS = {
  REGISTERED: 'registered',
  ACTIVE: 'active',
  DISABLED: 'disabled',
  ERROR: 'error'
};

const BUILTIN_TOOLS = {};

class ToolDefinition {
  constructor(definition) {
    this.name = definition.name;
    this.description = definition.description || '';
    this.version = definition.version || '1.0.0';
    this.category = definition.category || 'general';
    this.parameters = definition.parameters || {};
    this.returns = definition.returns || {};
    this.examples = definition.examples || [];
    this.permissions = definition.permissions || [];
    this.timeout = definition.timeout || 30000;
    this.retryCount = definition.retryCount || 0;
    this.retryDelay = definition.retryDelay || 1000;
    this.handler = definition.handler || null;
    this.status = TOOL_STATUS.REGISTERED;
    this.metadata = definition.metadata || {};
    this.createdAt = new Date().toISOString();
    this.lastUsed = null;
    this.useCount = 0;
    this.errorCount = 0;
  }

  validate(params) {
    const errors = [];
    
    for (const [key, schema] of Object.entries(this.parameters)) {
      if (schema.required && (params[key] === undefined || params[key] === null)) {
        errors.push(`Missing required parameter: ${key}`);
        continue;
      }

      if (params[key] !== undefined && schema.type) {
        const actualType = Array.isArray(params[key]) ? 'array' : typeof params[key];
        if (actualType !== schema.type) {
          errors.push(`Parameter ${key} should be ${schema.type}, got ${actualType}`);
        }
      }

      if (params[key] !== undefined && schema.enum && !schema.enum.includes(params[key])) {
        errors.push(`Parameter ${key} must be one of: ${schema.enum.join(', ')}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  toJSON() {
    return {
      name: this.name,
      description: this.description,
      version: this.version,
      category: this.category,
      parameters: this.parameters,
      returns: this.returns,
      examples: this.examples,
      permissions: this.permissions,
      timeout: this.timeout,
      status: this.status,
      metadata: this.metadata,
      createdAt: this.createdAt,
      lastUsed: this.lastUsed,
      useCount: this.useCount,
      errorCount: this.errorCount
    };
  }
}

class ToolRegistry extends EventEmitter {
  constructor(options) {
    super();
    options = options || {};
    this.tools = new Map();
    this.categories = new Map();
    this.storagePath = options.storagePath || './.maf/tools';
    this.permissionChecker = options.permissionChecker || null;
  }

  async init() {
    await this.loadBuiltInTools();
    await this.loadCustomTools();
  }

  register(definition) {
    if (this.tools.has(definition.name)) {
      throw new Error(`Tool already registered: ${definition.name}`);
    }

    const tool = new ToolDefinition(definition);
    this.tools.set(tool.name, tool);

    if (!this.categories.has(tool.category)) {
      this.categories.set(tool.category, new Set());
    }
    this.categories.get(tool.category).add(tool.name);

    this.emit('tool:registered', { name: tool.name, tool });
    return tool;
  }

  unregister(name) {
    const tool = this.tools.get(name);
    if (!tool) {
      return false;
    }

    this.tools.delete(name);
    
    const categoryTools = this.categories.get(tool.category);
    if (categoryTools) {
      categoryTools.delete(name);
      if (categoryTools.size === 0) {
        this.categories.delete(tool.category);
      }
    }

    this.emit('tool:unregistered', { name });
    return true;
  }

  get(name) {
    return this.tools.get(name);
  }

  list(options) {
    options = options || {};
    let tools = Array.from(this.tools.values());

    if (options.category) {
      tools = tools.filter(t => t.category === options.category);
    }

    if (options.status) {
      tools = tools.filter(t => t.status === options.status);
    }

    return tools.map(t => t.toJSON());
  }

  listCategories() {
    const result = {};
    for (const [category, toolNames] of this.categories) {
      result[category] = Array.from(toolNames);
    }
    return result;
  }

  async execute(name, params, context) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    if (tool.status === TOOL_STATUS.DISABLED) {
      throw new Error(`Tool is disabled: ${name}`);
    }

    const validation = tool.validate(params || {});
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }

    if (this.permissionChecker && tool.permissions.length > 0) {
      const hasPermission = await this.permissionChecker(context, tool.permissions);
      if (!hasPermission) {
        throw new Error(`Permission denied for tool: ${name}`);
      }
    }

    const startTime = Date.now();
    let lastError = null;
    let attempts = 0;
    const maxAttempts = tool.retryCount + 1;

    while (attempts < maxAttempts) {
      try {
        tool.status = TOOL_STATUS.ACTIVE;
        this.emit('tool:executing', { name, params, attempt: attempts + 1 });

        const result = await Promise.race([
          tool.handler(params, context),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Tool execution timeout')), tool.timeout)
          )
        ]);

        const duration = Date.now() - startTime;
        tool.lastUsed = new Date().toISOString();
        tool.useCount++;

        this.emit('tool:executed', { name, params, result, duration });
        return { success: true, result, duration };

      } catch (error) {
        lastError = error;
        attempts++;
        tool.errorCount++;

        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, tool.retryDelay));
        }
      }
    }

    tool.status = TOOL_STATUS.ERROR;
    const duration = Date.now() - startTime;
    this.emit('tool:error', { name, params, error: lastError, duration });
    
    return { success: false, error: lastError.message, duration };
  }

  enable(name) {
    const tool = this.tools.get(name);
    if (tool) {
      tool.status = TOOL_STATUS.REGISTERED;
      this.emit('tool:enabled', { name });
      return true;
    }
    return false;
  }

  disable(name) {
    const tool = this.tools.get(name);
    if (tool) {
      tool.status = TOOL_STATUS.DISABLED;
      this.emit('tool:disabled', { name });
      return true;
    }
    return false;
  }

  async loadBuiltInTools() {
    for (const [name, handler] of Object.entries(BUILTIN_TOOLS)) {
      try {
        this.register(handler);
      } catch (e) {
        // Tool already registered
      }
    }
  }

  async loadCustomTools() {
    const toolsPath = path.join(this.storagePath, 'custom');
    if (!fs.existsSync(toolsPath)) {
      return;
    }

    const files = fs.readdirSync(toolsPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
      try {
        const toolPath = path.join(toolsPath, file);
        delete require.cache[require.resolve(toolPath)];
        const definition = require(toolPath);
        if (definition.name && definition.handler) {
          this.register(definition);
        }
      } catch (e) {
        this.emit('tool:load:error', { file, error: e.message });
      }
    }
  }

  async saveCustomTool(definition) {
    const toolsPath = path.join(this.storagePath, 'custom');
    if (!fs.existsSync(toolsPath)) {
      fs.mkdirSync(toolsPath, { recursive: true });
    }

    const filePath = path.join(toolsPath, `${definition.name}.js`);
    const content = `/**
 * Custom Tool: ${definition.name}
 * ${definition.description || ''}
 */

module.exports = ${JSON.stringify(definition, null, 2).replace(
  /"handler":\s*"(.+)"/g,
  '"handler": $1'
)};

// Replace the handler string above with your actual handler function
`;

    fs.writeFileSync(filePath, content, 'utf-8');
    this.register(definition);
  }

  getStats() {
    const tools = Array.from(this.tools.values());
    return {
      total: tools.length,
      byStatus: {
        registered: tools.filter(t => t.status === TOOL_STATUS.REGISTERED).length,
        active: tools.filter(t => t.status === TOOL_STATUS.ACTIVE).length,
        disabled: tools.filter(t => t.status === TOOL_STATUS.DISABLED).length,
        error: tools.filter(t => t.status === TOOL_STATUS.ERROR).length
      },
      byCategory: Object.fromEntries(
        Array.from(this.categories.entries()).map(([k, v]) => [k, v.size])
      ),
      totalExecutions: tools.reduce((sum, t) => sum + t.useCount, 0),
      totalErrors: tools.reduce((sum, t) => sum + t.errorCount, 0)
    };
  }
}

// Built-in Tools Implementation
BUILTIN_TOOLS.file_read = {
  name: 'file_read',
  description: 'Read content from a file',
  version: '1.0.0',
  category: 'file',
  parameters: {
    path: { type: 'string', required: true, description: 'File path to read' },
    encoding: { type: 'string', default: 'utf-8', description: 'File encoding' }
  },
  returns: { type: 'string', description: 'File content' },
  permissions: ['file:read'],
  handler: async (params) => {
    return fs.readFileSync(params.path, params.encoding || 'utf-8');
  }
};

BUILTIN_TOOLS.file_write = {
  name: 'file_write',
  description: 'Write content to a file',
  version: '1.0.0',
  category: 'file',
  parameters: {
    path: { type: 'string', required: true, description: 'File path to write' },
    content: { type: 'string', required: true, description: 'Content to write' },
    encoding: { type: 'string', default: 'utf-8', description: 'File encoding' }
  },
  returns: { type: 'boolean', description: 'Success status' },
  permissions: ['file:write'],
  handler: async (params) => {
    const dir = path.dirname(params.path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(params.path, params.content, params.encoding || 'utf-8');
    return true;
  }
};

BUILTIN_TOOLS.file_list = {
  name: 'file_list',
  description: 'List files in a directory',
  version: '1.0.0',
  category: 'file',
  parameters: {
    path: { type: 'string', required: true, description: 'Directory path' },
    recursive: { type: 'boolean', default: false, description: 'List recursively' },
    pattern: { type: 'string', description: 'Glob pattern to filter files' }
  },
  returns: { type: 'array', description: 'List of file paths' },
  permissions: ['file:read'],
  handler: async (params) => {
    const results = [];
    const walk = (dir) => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && params.recursive) {
          walk(fullPath);
        } else if (stat.isFile()) {
          if (!params.pattern || fullPath.match(new RegExp(params.pattern))) {
            results.push(fullPath);
          }
        }
      }
    };
    walk(params.path);
    return results;
  }
};

BUILTIN_TOOLS.file_delete = {
  name: 'file_delete',
  description: 'Delete a file or directory',
  version: '1.0.0',
  category: 'file',
  parameters: {
    path: { type: 'string', required: true, description: 'Path to delete' },
    recursive: { type: 'boolean', default: false, description: 'Delete recursively' }
  },
  returns: { type: 'boolean', description: 'Success status' },
  permissions: ['file:delete'],
  handler: async (params) => {
    if (fs.existsSync(params.path)) {
      if (fs.statSync(params.path).isDirectory()) {
        fs.rmSync(params.path, { recursive: params.recursive });
      } else {
        fs.unlinkSync(params.path);
      }
      return true;
    }
    return false;
  }
};

BUILTIN_TOOLS.code_execute = {
  name: 'code_execute',
  description: 'Execute JavaScript code',
  version: '1.0.0',
  category: 'code',
  parameters: {
    code: { type: 'string', required: true, description: 'JavaScript code to execute' },
    timeout: { type: 'number', default: 5000, description: 'Execution timeout in ms' }
  },
  returns: { type: 'any', description: 'Execution result' },
  permissions: ['code:execute'],
  timeout: 10000,
  handler: async (params) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Code execution timeout'));
      }, params.timeout || 5000);

      try {
        const result = eval(params.code);
        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
};

BUILTIN_TOOLS.api_call = {
  name: 'api_call',
  description: 'Make an HTTP API call',
  version: '1.0.0',
  category: 'network',
  parameters: {
    url: { type: 'string', required: true, description: 'API URL' },
    method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], default: 'GET' },
    headers: { type: 'object', description: 'Request headers' },
    body: { type: 'object', description: 'Request body' },
    timeout: { type: 'number', default: 30000, description: 'Request timeout in ms' }
  },
  returns: { type: 'object', description: 'Response data' },
  permissions: ['network:access'],
  timeout: 60000,
  handler: async (params) => {
    const fetch = global.fetch || require('node-fetch');
    const options = {
      method: params.method || 'GET',
      headers: params.headers || {},
      timeout: params.timeout || 30000
    };

    if (params.body && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
      options.body = JSON.stringify(params.body);
      options.headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(params.url, options);
    const data = await response.json();
    
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data
    };
  }
};

BUILTIN_TOOLS.json_parse = {
  name: 'json_parse',
  description: 'Parse JSON string',
  version: '1.0.0',
  category: 'data',
  parameters: {
    string: { type: 'string', required: true, description: 'JSON string to parse' }
  },
  returns: { type: 'any', description: 'Parsed data' },
  handler: async (params) => {
    return JSON.parse(params.string);
  }
};

BUILTIN_TOOLS.json_stringify = {
  name: 'json_stringify',
  description: 'Convert object to JSON string',
  version: '1.0.0',
  category: 'data',
  parameters: {
    object: { type: 'object', required: true, description: 'Object to stringify' },
    pretty: { type: 'boolean', default: false, description: 'Pretty print' }
  },
  returns: { type: 'string', description: 'JSON string' },
  handler: async (params) => {
    return JSON.stringify(params.object, null, params.pretty ? 2 : 0);
  }
};

BUILTIN_TOOLS.text_process = {
  name: 'text_process',
  description: 'Process text with various operations',
  version: '1.0.0',
  category: 'text',
  parameters: {
    text: { type: 'string', required: true, description: 'Text to process' },
    operation: { 
      type: 'string', 
      required: true,
      enum: ['uppercase', 'lowercase', 'trim', 'split', 'join', 'replace', 'regex'],
      description: 'Operation to perform' 
    },
    options: { type: 'object', description: 'Operation options' }
  },
  returns: { type: 'any', description: 'Processed result' },
  handler: async (params) => {
    const { text, operation, options = {} } = params;
    
    switch (operation) {
      case 'uppercase':
        return text.toUpperCase();
      case 'lowercase':
        return text.toLowerCase();
      case 'trim':
        return text.trim();
      case 'split':
        return text.split(options.separator || ' ');
      case 'join':
        return Array.isArray(text) ? text.join(options.separator || ' ') : text;
      case 'replace':
        return text.replace(new RegExp(options.pattern, options.flags || 'g'), options.replacement || '');
      case 'regex':
        const matches = text.match(new RegExp(options.pattern, options.flags));
        return options.fullMatch ? matches : (matches ? matches[0] : null);
      default:
        return text;
    }
  }
};

BUILTIN_TOOLS.shell_exec = {
  name: 'shell_exec',
  description: 'Execute a shell command',
  version: '1.0.0',
  category: 'system',
  parameters: {
    command: { type: 'string', required: true, description: 'Command to execute' },
    cwd: { type: 'string', description: 'Working directory' },
    timeout: { type: 'number', default: 30000, description: 'Execution timeout' }
  },
  returns: { type: 'object', description: 'Execution result with stdout, stderr, exitCode' },
  permissions: ['system:exec'],
  timeout: 60000,
  handler: async (params) => {
    const { exec } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Command execution timeout'));
      }, params.timeout || 30000);

      exec(params.command, { cwd: params.cwd }, (error, stdout, stderr) => {
        clearTimeout(timeout);
        resolve({
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          exitCode: error ? error.code : 0,
          success: !error
        });
      });
    });
  }
};

module.exports = {
  ToolDefinition,
  ToolRegistry,
  BUILTIN_TOOLS,
  TOOL_STATUS
};
