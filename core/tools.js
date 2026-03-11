/**
 * Tool System for Multi-Agent Framework
 * 
 * Provides tool registration, execution, and management
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Base Tool Class
class Tool {
  constructor(config) {
    config = config || {};
    this.name = config.name || 'unknown';
    this.description = config.description || 'No description';
    this.parameters = config.parameters || {};
    this.required = config.required || [];
    this.handler = config.handler || null;
    this.timeout = config.timeout || 30000;
    this.retries = config.retries || 0;
  }

  validate(params) {
    const errors = [];
    
    this.required.forEach(function(param) {
      if (params[param] === undefined || params[param] === null) {
        errors.push('Missing required parameter: ' + param);
      }
    });

    Object.keys(params).forEach(function(key) {
      if (this.parameters[key]) {
        const schema = this.parameters[key];
        const value = params[key];
        
        if (schema.type) {
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          if (actualType !== schema.type) {
            errors.push('Parameter ' + key + ' should be ' + schema.type + ', got ' + actualType);
          }
        }
      }
    }.bind(this));

    return errors.length === 0 ? null : errors;
  }

  async execute(params) {
    const errors = this.validate(params);
    if (errors) {
      return { success: false, error: 'Validation failed', details: errors };
    }

    if (!this.handler) {
      return { success: false, error: 'No handler defined' };
    }

    let lastError = null;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const result = await Promise.race([
          this.handler(params),
          new Promise(function(_, reject) {
            setTimeout(function() { reject(new Error('Timeout')); }, this.timeout);
          }.bind(this))
        ]);
        return { success: true, result: result };
      } catch (e) {
        lastError = e;
        if (attempt < this.retries) {
          await new Promise(function(r) { setTimeout(r, 1000); });
        }
      }
    }

    return { success: false, error: lastError.message };
  }

  toJSON() {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
      required: this.required
    };
  }
}

// Tool Registry
class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.categories = new Map();
  }

  register(tool) {
    if (!(tool instanceof Tool)) {
      tool = new Tool(tool);
    }
    this.tools.set(tool.name, tool);
    return tool;
  }

  unregister(name) {
    return this.tools.delete(name);
  }

  get(name) {
    return this.tools.get(name);
  }

  has(name) {
    return this.tools.has(name);
  }

  list() {
    return Array.from(this.tools.values()).map(function(t) { return t.toJSON(); });
  }

  listByCategory(category) {
    const tools = this.categories.get(category) || [];
    return tools.map(function(name) { return this.tools.get(name); }.bind(this)).filter(Boolean);
  }

  categorize(toolName, category) {
    if (!this.categories.has(category)) {
      this.categories.set(category, []);
    }
    this.categories.get(category).push(toolName);
  }

  async execute(name, params) {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: 'Tool not found: ' + name };
    }
    return await tool.execute(params || {});
  }

  getSchema() {
    const schema = {
      type: 'object',
      properties: {},
      required: []
    };

    this.tools.forEach(function(tool, name) {
      schema.properties[name] = {
        type: 'object',
        description: tool.description,
        properties: tool.parameters
      };
    });

    return schema;
  }
}

// Built-in Tools

const fileReadTool = new Tool({
  name: 'file_read',
  description: 'Read content from a file',
  parameters: {
    path: { type: 'string', description: 'File path to read' },
    encoding: { type: 'string', description: 'File encoding (default: utf-8)' }
  },
  required: ['path'],
  handler: async function(params) {
    const encoding = params.encoding || 'utf-8';
    const content = fs.readFileSync(params.path, encoding);
    return { content: content, path: params.path };
  }
});

const fileWriteTool = new Tool({
  name: 'file_write',
  description: 'Write content to a file',
  parameters: {
    path: { type: 'string', description: 'File path to write' },
    content: { type: 'string', description: 'Content to write' },
    encoding: { type: 'string', description: 'File encoding (default: utf-8)' }
  },
  required: ['path', 'content'],
  handler: async function(params) {
    const encoding = params.encoding || 'utf-8';
    const dir = path.dirname(params.path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(params.path, params.content, encoding);
    return { success: true, path: params.path, bytes: params.content.length };
  }
});

const fileExistsTool = new Tool({
  name: 'file_exists',
  description: 'Check if a file exists',
  parameters: {
    path: { type: 'string', description: 'File path to check' }
  },
  required: ['path'],
  handler: async function(params) {
    return { exists: fs.existsSync(params.path), path: params.path };
  }
});

const directoryListTool = new Tool({
  name: 'directory_list',
  description: 'List files in a directory',
  parameters: {
    path: { type: 'string', description: 'Directory path' },
    recursive: { type: 'boolean', description: 'List recursively' }
  },
  required: ['path'],
  handler: async function(params) {
    if (!fs.existsSync(params.path)) {
      return { error: 'Directory not found', path: params.path };
    }
    
    const results = [];
    
    function listDir(dirPath, basePath) {
      const items = fs.readdirSync(dirPath);
      items.forEach(function(item) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);
        results.push({
          name: item,
          path: path.relative(basePath, itemPath),
          type: stat.isDirectory() ? 'directory' : 'file',
          size: stat.size
        });
        if (params.recursive && stat.isDirectory()) {
          listDir(itemPath, basePath);
        }
      });
    }
    
    listDir(params.path, params.path);
    return { files: results, count: results.length };
  }
});

const shellExecuteTool = new Tool({
  name: 'shell_execute',
  description: 'Execute a shell command',
  parameters: {
    command: { type: 'string', description: 'Command to execute' },
    cwd: { type: 'string', description: 'Working directory' },
    timeout: { type: 'number', description: 'Timeout in milliseconds' }
  },
  required: ['command'],
  timeout: 60000,
  handler: async function(params) {
    return new Promise(function(resolve, reject) {
      const timeout = params.timeout || 60000;
      const options = {};
      if (params.cwd) options.cwd = params.cwd;
      
      try {
        const output = execSync(params.command, {
          ...options,
          timeout: timeout,
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024
        });
        resolve({ stdout: output, stderr: '', exitCode: 0 });
      } catch (e) {
        resolve({
          stdout: e.stdout || '',
          stderr: e.stderr || e.message,
          exitCode: e.status || 1
        });
      }
    });
  }
});

const httpRequestTool = new Tool({
  name: 'http_request',
  description: 'Make an HTTP request',
  parameters: {
    url: { type: 'string', description: 'Request URL' },
    method: { type: 'string', description: 'HTTP method (GET, POST, etc.)' },
    headers: { type: 'object', description: 'Request headers' },
    body: { type: 'string', description: 'Request body' },
    timeout: { type: 'number', description: 'Timeout in milliseconds' }
  },
  required: ['url'],
  timeout: 30000,
  handler: async function(params) {
    const http = require('http');
    const https = require('https');
    
    const url = new URL(params.url);
    const client = url.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: params.method || 'GET',
      headers: params.headers || {}
    };

    return new Promise(function(resolve, reject) {
      const timeout = params.timeout || 30000;
      const req = client.request(options, function(res) {
        let data = '';
        res.on('data', function(chunk) { data += chunk; });
        res.on('end', function() {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      });

      req.on('error', function(e) { reject(e); });
      req.setTimeout(timeout, function() {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (params.body) req.write(params.body);
      req.end();
    });
  }
});

const jsonParseTool = new Tool({
  name: 'json_parse',
  description: 'Parse JSON string',
  parameters: {
    text: { type: 'string', description: 'JSON text to parse' }
  },
  required: ['text'],
  handler: async function(params) {
    try {
      const data = JSON.parse(params.text);
      return { success: true, data: data };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
});

const jsonStringifyTool = new Tool({
  name: 'json_stringify',
  description: 'Convert object to JSON string',
  parameters: {
    data: { type: 'object', description: 'Object to stringify' },
    pretty: { type: 'boolean', description: 'Pretty print' }
  },
  required: ['data'],
  handler: async function(params) {
    try {
      const json = params.pretty 
        ? JSON.stringify(params.data, null, 2)
        : JSON.stringify(params.data);
      return { success: true, json: json };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
});

const textSearchTool = new Tool({
  name: 'text_search',
  description: 'Search for pattern in text',
  parameters: {
    text: { type: 'string', description: 'Text to search in' },
    pattern: { type: 'string', description: 'Pattern to search for' },
    flags: { type: 'string', description: 'Regex flags (i, g, m)' }
  },
  required: ['text', 'pattern'],
  handler: async function(params) {
    try {
      const flags = params.flags || 'g';
      const regex = new RegExp(params.pattern, flags);
      const matches = [];
      let match;
      const re = new RegExp(params.pattern, flags);
      while ((match = re.exec(params.text)) !== null) {
        matches.push({
          match: match[0],
          index: match.index,
          groups: match.slice(1)
        });
        if (!flags.includes('g')) break;
      }
      return { success: true, matches: matches, count: matches.length };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
});

const textReplaceTool = new Tool({
  name: 'text_replace',
  description: 'Replace pattern in text',
  parameters: {
    text: { type: 'string', description: 'Original text' },
    pattern: { type: 'string', description: 'Pattern to replace' },
    replacement: { type: 'string', description: 'Replacement text' },
    flags: { type: 'string', description: 'Regex flags' }
  },
  required: ['text', 'pattern', 'replacement'],
  handler: async function(params) {
    try {
      const flags = params.flags || 'g';
      const regex = new RegExp(params.pattern, flags);
      const result = params.text.replace(regex, params.replacement);
      return { success: true, result: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
});

// Tool Manager
class ToolManager {
  constructor() {
    this.registry = new ToolRegistry();
    this.registerBuiltInTools();
  }

  registerBuiltInTools() {
    this.registry.register(fileReadTool);
    this.registry.register(fileWriteTool);
    this.registry.register(fileExistsTool);
    this.registry.register(directoryListTool);
    this.registry.register(shellExecuteTool);
    this.registry.register(httpRequestTool);
    this.registry.register(jsonParseTool);
    this.registry.register(jsonStringifyTool);
    this.registry.register(textSearchTool);
    this.registry.register(textReplaceTool);

    // Categorize tools
    this.registry.categorize('file_read', 'filesystem');
    this.registry.categorize('file_write', 'filesystem');
    this.registry.categorize('file_exists', 'filesystem');
    this.registry.categorize('directory_list', 'filesystem');
    this.registry.categorize('shell_execute', 'system');
    this.registry.categorize('http_request', 'network');
    this.registry.categorize('json_parse', 'data');
    this.registry.categorize('json_stringify', 'data');
    this.registry.categorize('text_search', 'text');
    this.registry.categorize('text_replace', 'text');
  }

  registerTool(config) {
    return this.registry.register(config);
  }

  getTool(name) {
    return this.registry.get(name);
  }

  listTools() {
    return this.registry.list();
  }

  async executeTool(name, params) {
    return await this.registry.execute(name, params);
  }

  getToolSchema() {
    return this.registry.getSchema();
  }
}

// Create tool from function
function createTool(name, description, handler, parameters, required) {
  return new Tool({
    name: name,
    description: description,
    parameters: parameters || {},
    required: required || [],
    handler: handler
  });
}

module.exports = {
  Tool,
  ToolRegistry,
  ToolManager,
  createTool,
  // Built-in tools
  fileReadTool,
  fileWriteTool,
  fileExistsTool,
  directoryListTool,
  shellExecuteTool,
  httpRequestTool,
  jsonParseTool,
  jsonStringifyTool,
  textSearchTool,
  textReplaceTool
};
