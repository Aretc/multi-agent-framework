#!/usr/bin/env node

/**
 * Multi-Agent Framework Web API
 * RESTful API server for dashboard
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { MultiAgentFramework } = require('../../core');

function createApp(options) {
  options = options || {};
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  const rootDir = options.rootDir || process.cwd();
  const framework = new MultiAgentFramework({ rootDir: rootDir });

  app.use(cors());
  app.use(express.json());

  // Build path
  const buildPath = path.join(__dirname, '../dashboard/build');
  console.log('Static files path:', buildPath);
  
  if (require('fs').existsSync(buildPath)) {
    app.use(express.static(buildPath));
  }

  // ============ API Routes ============

  // System
  app.get('/api/system/info', function(req, res) {
    res.json({
      success: true,
      data: {
        name: 'Multi-Agent Framework',
        version: '1.0.0',
        status: 'running',
        uptime: process.uptime()
      }
    });
  });

  app.get('/api/system/stats', async function(req, res) {
    try {
      const orchestratorStatus = framework.getOrchestratorStatus();
      const sessions = framework.listSessions();
      const agents = framework.listDynamicAgents();
      const memoryStats = framework.getMemoryStats();

      res.json({
        success: true,
        data: {
          sessions: sessions.length,
          activeSessions: sessions.filter(function(s) { return s.status === 'active'; }).length,
          agents: agents.length,
          tasks: orchestratorStatus ? orchestratorStatus.totalTasks : 0,
          completedTasks: orchestratorStatus ? orchestratorStatus.completedTasks : 0,
          memory: memoryStats
        }
      });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Sessions
  app.get('/api/sessions', function(req, res) {
    const sessions = framework.listSessions();
    res.json({ success: true, data: sessions });
  });

  app.get('/api/sessions/:id', async function(req, res) {
    try {
      const session = await framework.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      res.json({ success: true, data: session.getStats() });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/sessions', function(req, res) {
    const session = framework.createSession(req.body);
    res.json({ success: true, data: { id: session.id } });
  });

  app.delete('/api/sessions/:id', async function(req, res) {
    try {
      const result = await framework.deleteSession(req.params.id);
      res.json({ success: result.success });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Agents
  app.get('/api/agents', function(req, res) {
    const staticAgents = framework.listAgents();
    const dynamicAgents = framework.listDynamicAgents();
    res.json({
      success: true,
      data: {
        static: staticAgents,
        dynamic: dynamicAgents
      }
    });
  });

  app.get('/api/agents/templates', function(req, res) {
    const templates = framework.getAgentTemplates();
    res.json({ success: true, data: templates });
  });

  app.post('/api/agents', async function(req, res) {
    try {
      const agent = await framework.createDynamicAgent(req.body);
      io.emit('agent:created', agent.getStats());
      res.json({ success: true, data: agent.getStats() });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/agents/:id', function(req, res) {
    const agent = framework.getDynamicAgent(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    res.json({ success: true, data: agent.getStats() });
  });

  app.delete('/api/agents/:id', async function(req, res) {
    try {
      const removed = await framework.removeDynamicAgent(req.params.id);
      if (removed) {
        io.emit('agent:removed', { id: req.params.id });
      }
      res.json({ success: removed });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Tasks
  app.get('/api/tasks', function(req, res) {
    const status = req.query.status;
    const tasks = framework.listTasks(status);
    res.json({ success: true, data: tasks });
  });

  app.get('/api/tasks/orchestrator', function(req, res) {
    const tasks = framework.getAllOrchestratorTasks();
    res.json({ success: true, data: tasks });
  });

  app.post('/api/tasks/orchestrator', function(req, res) {
    try {
      const task = framework.orchestrator.addTask(req.body);
      io.emit('task:created', task.toJSON());
      res.json({ success: true, data: task.toJSON() });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/tasks/orchestrator/:id/cancel', function(req, res) {
    try {
      const task = framework.orchestrator.tasks.get(req.params.id);
      if (task) {
        task.status = 'cancelled';
        io.emit('task:updated', task.toJSON());
        res.json({ success: true, data: task.toJSON() });
      } else {
        res.status(404).json({ success: false, error: 'Task not found' });
      }
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/tasks/orchestrator/:id', function(req, res) {
    try {
      const removed = framework.orchestrator.tasks.delete(req.params.id);
      if (removed) {
        io.emit('task:deleted', { id: req.params.id });
      }
      res.json({ success: removed });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/tasks', function(req, res) {
    const result = framework.createTask(req.body);
    io.emit('task:created', result);
    res.json({ success: true, data: result });
  });

  app.get('/api/tasks/:id', function(req, res) {
    const taskInfo = framework.findTask(req.params.id);
    if (!taskInfo) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, data: taskInfo });
  });

  app.put('/api/tasks/:id', function(req, res) {
    const result = framework.updateTask(req.params.id, req.body);
    if (result.success) {
      io.emit('task:updated', result.task);
    }
    res.json(result);
  });

  // Orchestrator
  app.get('/api/orchestrator/status', function(req, res) {
    const status = framework.getOrchestratorStatus();
    res.json({ success: true, data: status });
  });

  app.post('/api/orchestrator/ask', async function(req, res) {
    try {
      const userInput = req.body.input;
      const context = req.body.context;

      framework.setClarificationCallback(function(data) {
        io.emit('clarification:needed', data);
      });

      framework.onOrchestratorEvent('task_created', function(task) {
        io.emit('task:created', task);
      });

      framework.onOrchestratorEvent('task_assigned', function(task) {
        io.emit('task:assigned', task);
      });

      framework.onOrchestratorEvent('task_completed', function(task) {
        io.emit('task:completed', task);
      });

      framework.onOrchestratorEvent('task_rejected', function(task) {
        io.emit('task:rejected', task);
      });

      framework.onOrchestratorEvent('agent_created', function(agent) {
        io.emit('agent:created', agent);
      });

      const result = await framework.processUserInput(userInput, context);
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/orchestrator/clarify', async function(req, res) {
    try {
      const sessionId = req.body.sessionId;
      const responses = req.body.responses;
      const result = await framework.provideClarification(sessionId, responses);
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/orchestrator/pause', async function(req, res) {
    await framework.pauseOrchestrator();
    io.emit('orchestrator:paused', {});
    res.json({ success: true });
  });

  app.post('/api/orchestrator/resume', async function(req, res) {
    await framework.resumeOrchestrator();
    io.emit('orchestrator:resumed', {});
    res.json({ success: true });
  });

  app.post('/api/orchestrator/cancel', async function(req, res) {
    await framework.cancelOrchestrator();
    io.emit('orchestrator:cancelled', {});
    res.json({ success: true });
  });

  // Memory
  app.get('/api/memory/:agent', async function(req, res) {
    try {
      const memory = framework.getAgentMemory(req.params.agent);
      if (!memory) {
        return res.status(404).json({ success: false, error: 'Memory not found' });
      }
      await memory.init();
      res.json({ success: true, data: memory.getStats() });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/memory/:agent/recall', async function(req, res) {
    try {
      const query = req.query.q;
      const results = await framework.agentRecall(req.params.agent, query);
      res.json({ success: true, data: results });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/memory/:agent/remember', async function(req, res) {
    try {
      await framework.agentRemember(req.params.agent, req.body.content, req.body.metadata);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/memory/:agent', async function(req, res) {
    try {
      const memory = framework.getAgentMemory(req.params.agent);
      if (memory) {
        await memory.init();
        await memory.clear(req.query.type);
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // LLM
  app.get('/api/llm/config', function(req, res) {
    const config = framework.config.llm || {};
    res.json({
      success: true,
      data: {
        provider: config.provider || 'mock',
        model: config.model || 'default',
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 4096,
        configured: !!config.apiKey
      }
    });
  });

  app.post('/api/llm/chat', async function(req, res) {
    try {
      const agentName = req.body.agent;
      const message = req.body.message;
      const response = await framework.chat(agentName, [
        { role: 'user', content: message }
      ]);
      res.json({ success: true, data: response });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Tools
  app.get('/api/tools', function(req, res) {
    const tools = framework.listTools();
    res.json({ success: true, data: tools });
  });

  app.post('/api/tools/:name/execute', async function(req, res) {
    try {
      const result = await framework.executeTool(req.params.name, req.body.params);
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/tools/:name/enable', async function(req, res) {
    try {
      const result = framework.enableTool(req.params.name);
      res.json({ success: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/tools/:name/disable', async function(req, res) {
    try {
      const result = framework.disableTool(req.params.name);
      res.json({ success: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/tools/stats', function(req, res) {
    const stats = framework.getToolStats();
    res.json({ success: true, data: stats });
  });

  app.post('/api/tools', async function(req, res) {
    try {
      const definition = req.body;
      if (!definition.name) {
        return res.status(400).json({ success: false, error: 'Tool name is required' });
      }
      if (!definition.handler) {
        return res.status(400).json({ success: false, error: 'Tool handler is required' });
      }
      if (typeof definition.handler === 'string') {
        try {
          definition.handler = eval(definition.handler);
        } catch (e) {
          return res.status(400).json({ success: false, error: 'Invalid handler code: ' + e.message });
        }
      }
      const tool = framework.registerTool(definition);
      res.json({ success: true, data: tool.toJSON() });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/tools/:name', async function(req, res) {
    try {
      const result = framework.unregisterTool(req.params.name);
      res.json({ success: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Skills
  app.get('/api/skills', function(req, res) {
    const skills = framework.listSkills();
    res.json({ success: true, data: skills });
  });

  app.get('/api/skills/:name', function(req, res) {
    const skill = framework.getSkill(req.params.name);
    if (!skill) {
      return res.status(404).json({ success: false, error: 'Skill not found' });
    }
    res.json({ success: true, data: skill });
  });

  app.post('/api/skills/install', async function(req, res) {
    try {
      const skill = await framework.installSkill(req.body);
      res.json({ success: true, data: skill });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/skills/:name/enable', async function(req, res) {
    try {
      const result = framework.enableSkill(req.params.name);
      res.json({ success: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/skills/:name/disable', async function(req, res) {
    try {
      const result = framework.disableSkill(req.params.name);
      res.json({ success: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/skills/:name/execute', async function(req, res) {
    try {
      const result = await framework.executeSkill(req.params.name, req.body.input);
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/skills/:name', async function(req, res) {
    try {
      const result = await framework.uninstallSkill(req.params.name);
      res.json({ success: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/skills/stats', function(req, res) {
    const stats = framework.getSkillStats();
    res.json({ success: true, data: stats });
  });

  // Rules
  app.get('/api/rules', function(req, res) {
    const rules = framework.listRules();
    res.json({ success: true, data: rules });
  });

  app.get('/api/rules/:name', function(req, res) {
    const rule = framework.getRule(req.params.name);
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    res.json({ success: true, data: rule });
  });

  app.post('/api/rules', async function(req, res) {
    try {
      const rule = framework.registerRule(req.body);
      res.json({ success: true, data: rule });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/rules/:name/enable', async function(req, res) {
    try {
      const result = framework.enableRule(req.params.name);
      res.json({ success: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/rules/:name/disable', async function(req, res) {
    try {
      const result = framework.disableRule(req.params.name);
      res.json({ success: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/rules/validate', async function(req, res) {
    try {
      const result = await framework.validateWithRules(req.body.data);
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/rules/stats', function(req, res) {
    const stats = framework.getRuleStats();
    res.json({ success: true, data: stats });
  });

  // MCP
  app.get('/api/mcp/clients', function(req, res) {
    const clients = framework.listMCPClients();
    res.json({ success: true, data: clients });
  });

  app.post('/api/mcp/clients', async function(req, res) {
    try {
      const client = await framework.addMCPClient(req.body.name, req.body.config);
      res.json({ success: true, data: client.getStatus() });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/mcp/clients/:name', async function(req, res) {
    try {
      const result = await framework.removeMCPClient(req.params.name);
      res.json({ success: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/mcp/tools', function(req, res) {
    const tools = framework.getAllMCPTools();
    res.json({ success: true, data: tools });
  });

  app.get('/api/mcp/resources', function(req, res) {
    const resources = framework.getAllMCPResources();
    res.json({ success: true, data: resources });
  });

  app.get('/api/mcp/prompts', function(req, res) {
    const prompts = framework.getAllMCPPrompts();
    res.json({ success: true, data: prompts });
  });

  app.post('/api/mcp/execute', async function(req, res) {
    try {
      const result = await framework.callMCPTool(req.body.client, req.body.tool, req.body.args);
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/mcp/stats', function(req, res) {
    const stats = framework.getMCPStats();
    res.json({ success: true, data: stats });
  });

  // Config
  app.get('/api/config', function(req, res) {
    res.json({ success: true, data: framework.config });
  });

  // Serve frontend - must be after API routes
  app.get('*', function(req, res) {
    const indexPath = path.join(buildPath, 'index.html');
    if (require('fs').existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Dashboard not built. Run: cd web/dashboard && npm run build');
    }
  });

  // WebSocket events
  io.on('connection', function(socket) {
    console.log('Client connected:', socket.id);
    socket.emit('connected', { id: socket.id });

    socket.on('disconnect', function() {
      console.log('Client disconnected:', socket.id);
    });
  });

  return { app: app, server: server, io: io, framework: framework };
}

function startServer(port, rootDir) {
  port = port || 3000;
  rootDir = rootDir || process.cwd();
  
  const { server, io, framework } = createApp({ rootDir: rootDir });

  server.listen(port, function() {
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   Multi-Agent Framework Dashboard          ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log('║   Web:  http://localhost:' + port + '              ║');
    console.log('║   API:  http://localhost:' + port + '/api          ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
    console.log('Press Ctrl+C to stop the server');
  });

  return { server: server, io: io, framework: framework };
}

// Start server if run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const portArg = args.find(function(arg) { return arg.startsWith('--port='); });
  const port = portArg ? parseInt(portArg.split('=')[1]) : (process.env.PORT || 3000);
  startServer(port);
}

module.exports = { createApp: createApp, startServer: startServer };
