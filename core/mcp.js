/**
 * MCP (Model Context Protocol) Integration for Multi-Agent Framework
 * 
 * MCP allows connecting to external tools, resources, and prompts
 * through a standardized protocol.
 * 
 * @see https://modelcontextprotocol.io
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { spawn, ChildProcess } = require('child_process');

const MCP_CONNECTION_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error'
};

const MCP_RESOURCE_TYPE = {
  TEXT: 'text',
  BINARY: 'binary',
  FILE: 'file',
  DIRECTORY: 'directory'
};

class MCPClient extends EventEmitter {
  constructor(options) {
    super();
    options = options || {};
    this.name = options.name || 'mcp-client';
    this.command = options.command;
    this.args = options.args || [];
    this.env = options.env || {};
    this.cwd = options.cwd || process.cwd();
    
    this.status = MCP_CONNECTION_STATUS.DISCONNECTED;
    this.process = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.capabilities = {};
    this.tools = new Map();
    this.resources = new Map();
    this.prompts = new Map();
    
    this.buffer = '';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 3;
    this.reconnectDelay = options.reconnectDelay || 1000;
  }

  async connect() {
    if (this.status === MCP_CONNECTION_STATUS.CONNECTED) {
      return true;
    }

    this.status = MCP_CONNECTION_STATUS.CONNECTING;
    this.emit('connecting', { name: this.name });

    try {
      this.process = spawn(this.command, this.args, {
        cwd: this.cwd,
        env: { ...process.env, ...this.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.process.stdout.on('data', (data) => this.handleData(data));
      this.process.stderr.on('data', (data) => this.handleError(data));
      this.process.on('close', (code) => this.handleClose(code));
      this.process.on('error', (error) => this.handleProcessError(error));

      await this.initialize();
      
      this.status = MCP_CONNECTION_STATUS.CONNECTED;
      this.reconnectAttempts = 0;
      this.emit('connected', { name: this.name });
      
      return true;
    } catch (error) {
      this.status = MCP_CONNECTION_STATUS.ERROR;
      this.emit('error', { name: this.name, error: error.message });
      throw error;
    }
  }

  async disconnect() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    
    this.status = MCP_CONNECTION_STATUS.DISCONNECTED;
    this.emit('disconnected', { name: this.name });
  }

  async initialize() {
    const result = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      },
      clientInfo: {
        name: 'multi-agent-framework',
        version: '1.5.0'
      }
    });

    this.capabilities = result.capabilities || {};

    if (this.capabilities.tools) {
      await this.loadTools();
    }

    if (this.capabilities.resources) {
      await this.loadResources();
    }

    if (this.capabilities.prompts) {
      await this.loadPrompts();
    }

    await this.sendNotification('notifications/initialized', {});
  }

  async loadTools() {
    const result = await this.sendRequest('tools/list', {});
    const tools = result.tools || [];
    
    this.tools.clear();
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
    
    this.emit('tools:loaded', { count: tools.length });
  }

  async loadResources() {
    const result = await this.sendRequest('resources/list', {});
    const resources = result.resources || [];
    
    this.resources.clear();
    for (const resource of resources) {
      this.resources.set(resource.uri, resource);
    }
    
    this.emit('resources:loaded', { count: resources.length });
  }

  async loadPrompts() {
    const result = await this.sendRequest('prompts/list', {});
    const prompts = result.prompts || [];
    
    this.prompts.clear();
    for (const prompt of prompts) {
      this.prompts.set(prompt.name, prompt);
    }
    
    this.emit('prompts:loaded', { count: prompts.length });
  }

  handleData(data) {
    this.buffer += data.toString();
    
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          this.handleMessage(message);
        } catch (e) {
          this.emit('parse:error', { line, error: e.message });
        }
      }
    }
  }

  handleMessage(message) {
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message || 'MCP request failed'));
      } else {
        resolve(message.result);
      }
    } else if (message.method) {
      this.emit('notification', message);
    }
  }

  handleError(data) {
    this.emit('stderr', { data: data.toString() });
  }

  handleClose(code) {
    this.status = MCP_CONNECTION_STATUS.DISCONNECTED;
    this.emit('closed', { code });

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
    }
  }

  handleProcessError(error) {
    this.status = MCP_CONNECTION_STATUS.ERROR;
    this.emit('process:error', { error: error.message });
  }

  sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      
      const message = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params
      }) + '\n';

      this.pendingRequests.set(id, { resolve, reject });

      try {
        this.process.stdin.write(message);
      } catch (error) {
        this.pendingRequests.delete(id);
        reject(error);
      }

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  sendNotification(method, params) {
    const message = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params
    }) + '\n';

    this.process.stdin.write(message);
  }

  async callTool(name, args) {
    if (!this.tools.has(name)) {
      throw new Error(`Tool not found: ${name}`);
    }

    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args
    });

    return result;
  }

  async readResource(uri) {
    if (!this.resources.has(uri)) {
      throw new Error(`Resource not found: ${uri}`);
    }

    const result = await this.sendRequest('resources/read', { uri });
    return result;
  }

  async getPrompt(name, args) {
    if (!this.prompts.has(name)) {
      throw new Error(`Prompt not found: ${name}`);
    }

    const result = await this.sendRequest('prompts/get', {
      name,
      arguments: args
    });

    return result;
  }

  listTools() {
    return Array.from(this.tools.values());
  }

  listResources() {
    return Array.from(this.resources.values());
  }

  listPrompts() {
    return Array.from(this.prompts.values());
  }

  getTool(name) {
    return this.tools.get(name);
  }

  getResource(uri) {
    return this.resources.get(uri);
  }

  getPrompt(name) {
    return this.prompts.get(name);
  }

  getStatus() {
    return {
      name: this.name,
      status: this.status,
      capabilities: this.capabilities,
      toolsCount: this.tools.size,
      resourcesCount: this.resources.size,
      promptsCount: this.prompts.size
    };
  }
}

class MCPManager extends EventEmitter {
  constructor(options) {
    super();
    options = options || {};
    this.clients = new Map();
    this.configPath = options.configPath || './.maf/mcp-config.json';
    this.toolRegistry = options.toolRegistry || null;
  }

  async init() {
    await this.loadConfig();
  }

  async loadConfig() {
    if (!fs.existsSync(this.configPath)) {
      return;
    }

    try {
      const config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      const servers = config.mcpServers || {};

      for (const [name, serverConfig] of Object.entries(servers)) {
        await this.addClient(name, serverConfig);
      }
    } catch (e) {
      this.emit('config:error', { error: e.message });
    }
  }

  async saveConfig() {
    const servers = {};
    
    for (const [name, client] of this.clients) {
      servers[name] = {
        command: client.command,
        args: client.args,
        env: client.env,
        cwd: client.cwd
      };
    }

    const config = { mcpServers: servers };
    const dir = path.dirname(this.configPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  async addClient(name, config) {
    if (this.clients.has(name)) {
      throw new Error(`MCP client already exists: ${name}`);
    }

    const client = new MCPClient({
      name,
      command: config.command,
      args: config.args || [],
      env: config.env || {},
      cwd: config.cwd
    });

    client.on('connected', () => this.emit('client:connected', { name }));
    client.on('disconnected', () => this.emit('client:disconnected', { name }));
    client.on('error', (data) => this.emit('client:error', { name, ...data }));

    this.clients.set(name, client);
    
    await client.connect();
    
    if (this.toolRegistry) {
      this.registerTools(name, client);
    }

    return client;
  }

  async removeClient(name) {
    const client = this.clients.get(name);
    if (!client) {
      return false;
    }

    await client.disconnect();
    this.clients.delete(name);
    
    if (this.toolRegistry) {
      this.unregisterTools(name);
    }

    return true;
  }

  getClient(name) {
    return this.clients.get(name);
  }

  listClients() {
    return Array.from(this.clients.values()).map(c => c.getStatus());
  }

  registerTools(clientName, client) {
    const tools = client.listTools();
    
    for (const tool of tools) {
      const toolName = `${clientName}_${tool.name}`;
      
      this.toolRegistry.register({
        name: toolName,
        description: tool.description || '',
        category: 'mcp',
        parameters: this.convertSchema(tool.inputSchema || {}),
        handler: async (params) => {
          const result = await client.callTool(tool.name, params);
          return this.extractResult(result);
        },
        metadata: {
          mcpClient: clientName,
          mcpTool: tool.name
        }
      });
    }
  }

  unregisterTools(clientName) {
    if (!this.toolRegistry) return;

    const tools = this.toolRegistry.list({ category: 'mcp' });
    
    for (const tool of tools) {
      if (tool.metadata && tool.metadata.mcpClient === clientName) {
        this.toolRegistry.unregister(tool.name);
      }
    }
  }

  convertSchema(schema) {
    const params = {};
    const properties = schema.properties || {};
    const required = schema.required || [];

    for (const [name, prop] of Object.entries(properties)) {
      params[name] = {
        type: prop.type || 'string',
        required: required.includes(name),
        description: prop.description || '',
        enum: prop.enum
      };
    }

    return params;
  }

  extractResult(result) {
    if (result.content && Array.isArray(result.content)) {
      return result.content.map(c => {
        if (c.type === 'text') {
          return c.text;
        } else if (c.type === 'image') {
          return { type: 'image', data: c.data, mimeType: c.mimeType };
        } else if (c.type === 'resource') {
          return c.resource;
        }
        return c;
      });
    }
    return result;
  }

  async callTool(clientName, toolName, args) {
    const client = this.clients.get(clientName);
    if (!client) {
      throw new Error(`MCP client not found: ${clientName}`);
    }

    return await client.callTool(toolName, args);
  }

  async readResource(clientName, uri) {
    const client = this.clients.get(clientName);
    if (!client) {
      throw new Error(`MCP client not found: ${clientName}`);
    }

    return await client.readResource(uri);
  }

  async getPrompt(clientName, promptName, args) {
    const client = this.clients.get(clientName);
    if (!client) {
      throw new Error(`MCP client not found: ${clientName}`);
    }

    return await client.getPrompt(promptName, args);
  }

  getAllTools() {
    const tools = [];
    
    for (const [name, client] of this.clients) {
      const clientTools = client.listTools();
      for (const tool of clientTools) {
        tools.push({
          client: name,
          ...tool
        });
      }
    }

    return tools;
  }

  getAllResources() {
    const resources = [];
    
    for (const [name, client] of this.clients) {
      const clientResources = client.listResources();
      for (const resource of clientResources) {
        resources.push({
          client: name,
          ...resource
        });
      }
    }

    return resources;
  }

  getAllPrompts() {
    const prompts = [];
    
    for (const [name, client] of this.clients) {
      const clientPrompts = client.listPrompts();
      for (const prompt of clientPrompts) {
        prompts.push({
          client: name,
          ...prompt
        });
      }
    }

    return prompts;
  }

  getStats() {
    const clients = this.listClients();
    return {
      totalClients: clients.length,
      connectedClients: clients.filter(c => c.status === MCP_CONNECTION_STATUS.CONNECTED).length,
      totalTools: clients.reduce((sum, c) => sum + c.toolsCount, 0),
      totalResources: clients.reduce((sum, c) => sum + c.resourcesCount, 0),
      totalPrompts: clients.reduce((sum, c) => sum + c.promptsCount, 0)
    };
  }
}

module.exports = {
  MCPClient,
  MCPManager,
  MCP_CONNECTION_STATUS,
  MCP_RESOURCE_TYPE
};
