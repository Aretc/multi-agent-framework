#!/usr/bin/env node

/**
 * Multi-Agent Framework CLI
 * Command-line interface for managing agents, tasks, messages, and workflows
 */

const path = require('path');
const fs = require('fs');
const { MultiAgentFramework } = require('../core');

const args = process.argv.slice(2);
const command = args[0];

function getFramework() {
  const rootDir = process.cwd();
  return new MultiAgentFramework({ rootDir: rootDir });
}

function showHelp() {
  console.log('');
  console.log('Multi-Agent Framework CLI');
  console.log('');
  console.log('Usage: maf <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log('');
  console.log('  Project:');
  console.log('    init [preset]              Initialize a new project (default|minimal|none)');
  console.log('    config                     Show current configuration');
  console.log('');
  console.log('  Agents:');
  console.log('    agent list                 List all agents');
  console.log('    agent add <name>           Add a new agent');
  console.log('    agent show <name>          Show agent details');
  console.log('');
  console.log('  Tasks:');
  console.log('    task create <title>        Create a new task');
  console.log('    task list [status]         List tasks (optional filter by status)');
  console.log('    task show <id>             Show task details');
  console.log('    task assign <id> <agent>   Assign task to agent');
  console.log('    task status <id> <status>  Update task status');
  console.log('');
  console.log('  Messages:');
  console.log('    message send <to> <subject> [options]  Send a message');
  console.log('    message list [type] [agent]            List messages');
  console.log('');
  console.log('  Workflow:');
  console.log('    workflow transfer <taskId> <from> <to>  Transfer task between agents');
  console.log('    workflow split <parentId> <config.json> Split task into subtasks');
  console.log('    workflow report <subtaskId> <result> <agent> Report subtask result');
  console.log('    workflow collect <parentId>             Collect subtask results');
  console.log('');
  console.log('  Watch:');
  console.log('    watch                      Start file watcher for auto-notifications');
  console.log('');
  console.log('  Memory:');
  console.log('    memory show <agent>        Show agent memory stats');
  console.log('    memory remember <agent> <content>  Add to short-term memory');
  console.log('    memory memorize <agent> <content>  Add to long-term memory');
  console.log('    memory recall <agent> [query]      Recall from memory');
  console.log('    memory events <agent>              Show recent events');
  console.log('    memory clear <agent> [type]        Clear memory (short_term|long_term|episodic)');
  console.log('');
  console.log('  LLM:');
  console.log('    llm chat <agent> <message>         Chat with agent using LLM');
  console.log('    llm config                         Show LLM configuration');
  console.log('');
  console.log('  Tools:');
  console.log('    tool list                          List available tools');
  console.log('    tool exec <name> <params_json>     Execute a tool');
  console.log('');
  console.log('  Agent Runtime:');
  console.log('    run <agent> <input>                Run agent with input');
  console.log('');
  console.log('Options:');
  console.log('  --priority <P0-P3>          Set priority');
  console.log('  --assignee <agent>          Set assignee');
  console.log('  --type <type>               Set message type');
  console.log('  --file <path>               Use config file');
  console.log('');
  console.log('Examples:');
  console.log('  maf init default');
  console.log('  maf task create "Implement feature X" --priority P1');
  console.log('  maf task assign TASK-001 Developer');
  console.log('  maf workflow transfer TASK-001 Developer Reviewer');
  console.log('  maf memory remember Developer "Working on login feature"');
  console.log('');
}

function initProject() {
  const preset = args[1] || 'default';
  const framework = getFramework();
  const result = framework.initProject({ preset: preset });
  console.log('Project initialized with preset: ' + preset);
  console.log('Created directories:');
  result.dirs.forEach(function(dir) {
    console.log('  - ' + dir);
  });
}

function showConfig() {
  const framework = getFramework();
  console.log(JSON.stringify(framework.config, null, 2));
}

function listAgents() {
  const framework = getFramework();
  const agents = framework.listAgents();
  console.log('\n=== Agents ===\n');
  if (agents.length === 0) {
    console.log('No agents configured. Run "maf init" to set up a project.');
    return;
  }
  agents.forEach(function(agent) {
    console.log('- ' + agent.name + ': ' + agent.description);
  });
}

function addAgent() {
  const name = args[2];
  if (!name) {
    console.log('Usage: maf agent add <name>');
    process.exit(1);
  }
  const framework = getFramework();
  const agent = {
    name: name,
    description: 'Custom agent',
    responsibilities: [],
    outputs: [],
    permissions: []
  };
  framework.registerAgent(agent);
  framework.createAgentFile(agent);
  console.log('Agent created: ' + name);
}

function showAgent() {
  const name = args[2];
  if (!name) {
    console.log('Usage: maf agent show <name>');
    process.exit(1);
  }
  const framework = getFramework();
  const agent = framework.getAgent(name);
  if (!agent) {
    console.log('Agent not found: ' + name);
    return;
  }
  console.log('\n=== Agent: ' + agent.name + ' ===\n');
  console.log('Description: ' + agent.description);
  console.log('Responsibilities: ' + (agent.responsibilities || []).join(', '));
  console.log('Outputs: ' + (agent.outputs || []).join(', '));
}

function createTask() {
  const title = args[2];
  if (!title) {
    console.log('Usage: maf task create <title>');
    process.exit(1);
  }
  
  const options = {};
  for (let i = 3; i < args.length; i++) {
    if (args[i] === '--priority' && args[i + 1]) {
      options.priority = args[++i];
    } else if (args[i] === '--assignee' && args[i + 1]) {
      options.assignee = args[++i];
    }
  }
  
  const framework = getFramework();
  const result = framework.createTask({
    title: title,
    priority: options.priority,
    assignee: options.assignee
  });
  
  console.log('Task created: ' + result.id);
  console.log('Path: ' + result.path);
}

function listTasks() {
  const status = args[2];
  const framework = getFramework();
  const tasks = framework.listTasks(status);
  
  console.log('\n=== Tasks ===\n');
  if (tasks.length === 0) {
    console.log('No tasks found.');
    return;
  }
  
  tasks.forEach(function(task) {
    console.log(task.id + ' [' + task.status + '] ' + task.title.substring(0, 40) + ' (' + task.assignee + ')');
  });
}

function showTask() {
  const taskId = args[2];
  if (!taskId) {
    console.log('Usage: maf task show <id>');
    process.exit(1);
  }
  const framework = getFramework();
  const taskInfo = framework.findTask(taskId);
  if (!taskInfo) {
    console.log('Task not found: ' + taskId);
    return;
  }
  console.log('\n=== Task: ' + taskInfo.task.id + ' ===\n');
  console.log('Title: ' + taskInfo.task.title);
  console.log('Status: ' + taskInfo.task.status);
  console.log('Priority: ' + taskInfo.task.priority);
  console.log('Assignee: ' + taskInfo.task.assignee);
}

function assignTask() {
  const taskId = args[2];
  const agent = args[3];
  if (!taskId || !agent) {
    console.log('Usage: maf task assign <id> <agent>');
    process.exit(1);
  }
  const framework = getFramework();
  const result = framework.updateTask(taskId, { assignee: agent, status: 'assigned' });
  if (result.success) {
    console.log('Task ' + taskId + ' assigned to ' + agent);
  } else {
    console.log('Error: ' + result.error);
  }
}

function updateTaskStatus() {
  const taskId = args[2];
  const status = args[3];
  if (!taskId || !status) {
    console.log('Usage: maf task status <id> <status>');
    process.exit(1);
  }
  const framework = getFramework();
  const result = framework.updateTask(taskId, { status: status });
  if (result.success) {
    console.log('Task ' + taskId + ' status updated to ' + status);
  } else {
    console.log('Error: ' + result.error);
  }
}

function sendMessage() {
  const to = args[2];
  const subject = args[3];
  if (!to || !subject) {
    console.log('Usage: maf message send <to> <subject> [--type <type>] [--priority <P0-P3>]');
    process.exit(1);
  }
  
  const options = { to: to, subject: subject };
  for (let i = 4; i < args.length; i++) {
    if (args[i] === '--type' && args[i + 1]) {
      options.type = args[++i];
    } else if (args[i] === '--priority' && args[i + 1]) {
      options.priority = args[++i];
    } else if (args[i] === '--task' && args[i + 1]) {
      options.taskId = args[++i];
    } else if (args[i] === '--details' && args[i + 1]) {
      options.details = args[++i];
    }
  }
  
  const framework = getFramework();
  const result = framework.createMessage(options);
  console.log('Message sent: ' + result.id);
}

function listMessages() {
  const type = args[2];
  const agent = args[3];
  const framework = getFramework();
  const messages = framework.listMessages(type, agent);
  
  console.log('\n=== Messages ===\n');
  if (messages.length === 0) {
    console.log('No messages found.');
    return;
  }
  
  messages.forEach(function(msg) {
    console.log(msg.id + ' [' + msg.type + '] ' + (msg.to ? '-> ' + msg.to : 'broadcast'));
  });
}

function transferTask() {
  const taskId = args[2];
  const fromAgent = args[3];
  const toAgent = args[4];
  if (!taskId || !fromAgent || !toAgent) {
    console.log('Usage: maf workflow transfer <taskId> <fromAgent> <toAgent>');
    process.exit(1);
  }
  const framework = getFramework();
  const result = framework.transferTask(taskId, fromAgent, toAgent);
  if (result.success) {
    console.log('Task ' + taskId + ' transferred from ' + fromAgent + ' to ' + toAgent);
  } else {
    console.log('Error: ' + result.error);
  }
}

function splitTask() {
  const parentId = args[2];
  const configFile = args[3];
  if (!parentId) {
    console.log('Usage: maf workflow split <parentId> --file <config.json>');
    process.exit(1);
  }
  
  let config = [];
  const fileIdx = args.indexOf('--file');
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    try {
      const configPath = path.resolve(args[fileIdx + 1]);
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      console.log('Error reading config file: ' + e.message);
      process.exit(1);
    }
  }
  
  const framework = getFramework();
  const results = framework.splitTask(parentId, config, 'Coordinator');
  console.log('Created ' + results.length + ' subtasks:');
  results.forEach(function(r) {
    console.log('  - ' + r.id + ' -> ' + r.task.assignee);
  });
}

function reportResult() {
  const subtaskId = args[2];
  const result = args[3];
  const agent = args[4];
  if (!subtaskId || !result || !agent) {
    console.log('Usage: maf workflow report <subtaskId> <result> <agent>');
    process.exit(1);
  }
  const framework = getFramework();
  const res = framework.reportResult(subtaskId, result, agent);
  if (res.success) {
    console.log('Result reported for ' + subtaskId);
  } else {
    console.log('Error: ' + res.error);
  }
}

function collectResults() {
  const parentId = args[2];
  if (!parentId) {
    console.log('Usage: maf workflow collect <parentId>');
    process.exit(1);
  }
  const framework = getFramework();
  const result = framework.collectResults(parentId);
  if (result.error) {
    console.log('Error: ' + result.error);
    return;
  }
  console.log('\n=== Results for ' + parentId + ' ===\n');
  console.log('Progress: ' + result.completed + '/' + result.total);
  if (result.allCompleted) {
    console.log('\nAll subtasks completed!');
  }
}

function startWatch() {
  console.log('Starting file watcher...');
  console.log('Note: For better performance, install chokidar: npm install chokidar');
  console.log('Press Ctrl+C to stop\n');
  
  const framework = getFramework();
  const pollInterval = 5000;
  const taskStates = {};
  
  function checkChanges() {
    const statuses = framework.config.tasks.statuses;
    statuses.forEach(function(status) {
      const dirPath = path.join(framework.rootDir, 'tasks', status);
      if (!fs.existsSync(dirPath)) return;
      
      const files = fs.readdirSync(dirPath).filter(function(f) { return f.endsWith('.md'); });
      files.forEach(function(file) {
        const taskId = file.replace('.md', '');
        if (!taskStates[taskId]) {
          taskStates[taskId] = { status: status };
          return;
        }
        
        if (taskStates[taskId].status !== status) {
          const oldStatus = taskStates[taskId].status;
          taskStates[taskId].status = status;
          
          console.log('[' + new Date().toISOString() + '] Task ' + taskId + ': ' + oldStatus + ' -> ' + status);
          
          const taskInfo = framework.findTask(taskId);
          if (taskInfo) {
            const workflow = framework.config.workflows[status];
            if (workflow && workflow.notify) {
              framework.createMessage({
                type: 'TASK_UPDATE',
                from: taskInfo.task.assignee || 'System',
                to: workflow.notifyAgent || 'Coordinator',
                subject: 'Task Status Update: ' + taskInfo.task.title,
                taskId: taskId,
                summary: 'Task status changed from ' + oldStatus + ' to ' + status
              });
              console.log('  -> Notification sent to ' + (workflow.notifyAgent || 'Coordinator'));
            }
          }
        }
      });
    });
  }
  
  checkChanges();
  setInterval(checkChanges, pollInterval);
}

// Memory functions
async function showMemoryStats() {
  const agentName = args[2];
  if (!agentName) {
    console.log('Usage: maf memory show <agent>');
    process.exit(1);
  }
  
  const framework = getFramework();
  const memory = framework.getAgentMemory(agentName);
  if (!memory) {
    console.log('Memory system not enabled. Check configuration.');
    return;
  }
  
  await memory.init();
  const stats = memory.getStats();
  
  console.log('\n=== Memory Stats for ' + agentName + ' ===\n');
  console.log('Short-term memory: ' + stats.shortTerm.size + '/' + stats.shortTerm.maxSize);
  console.log('Long-term memory: ' + stats.longTerm.size + '/' + stats.longTerm.maxSize);
  console.log('Episodic memory: ' + stats.episodic.size + '/' + stats.episodic.maxEvents);
}

async function addShortTermMemory() {
  const agentName = args[2];
  const content = args[3];
  if (!agentName || !content) {
    console.log('Usage: maf memory remember <agent> <content>');
    process.exit(1);
  }
  
  const framework = getFramework();
  await framework.agentRemember(agentName, content);
  console.log('Added to ' + agentName + '\'s short-term memory');
}

async function addLongTermMemory() {
  const agentName = args[2];
  const content = args[3];
  if (!agentName || !content) {
    console.log('Usage: maf memory memorize <agent> <content>');
    process.exit(1);
  }
  
  const framework = getFramework();
  const item = await framework.agentMemorize(agentName, content);
  console.log('Added to ' + agentName + '\'s long-term memory: ' + item.id);
}

async function recallMemory() {
  const agentName = args[2];
  const query = args[3];
  if (!agentName) {
    console.log('Usage: maf memory recall <agent> [query]');
    process.exit(1);
  }
  
  const framework = getFramework();
  const results = await framework.agentRecall(agentName, query);
  
  console.log('\n=== Memory Recall for ' + agentName + ' ===\n');
  if (!results || results.length === 0) {
    console.log('No memories found.');
    return;
  }
  
  results.forEach(function(item, i) {
    console.log((i + 1) + '. ' + item.content.substring(0, 80) + '...');
    console.log('   Created: ' + item.createdAt);
    console.log('');
  });
}

async function showEvents() {
  const agentName = args[2];
  if (!agentName) {
    console.log('Usage: maf memory events <agent>');
    process.exit(1);
  }
  
  const framework = getFramework();
  const events = await framework.agentRecallEvents(agentName);
  
  console.log('\n=== Recent Events for ' + agentName + ' ===\n');
  if (!events || events.length === 0) {
    console.log('No events found.');
    return;
  }
  
  events.slice(-10).forEach(function(event, i) {
    console.log((i + 1) + '. [' + event.type + '] ' + event.action);
    console.log('   Time: ' + event.timestamp);
    console.log('');
  });
}

async function clearMemory() {
  const agentName = args[2];
  const type = args[3];
  if (!agentName) {
    console.log('Usage: maf memory clear <agent> [type]');
    process.exit(1);
  }
  
  const framework = getFramework();
  const memory = framework.getAgentMemory(agentName);
  if (!memory) {
    console.log('Memory system not enabled.');
    return;
  }
  
  await memory.init();
  await memory.clear(type);
  console.log('Cleared ' + (type || 'all') + ' memory for ' + agentName);
}

// LLM functions
async function llmChat() {
  const agentName = args[2];
  const message = args[3];
  if (!agentName || !message) {
    console.log('Usage: maf llm chat <agent> <message>');
    process.exit(1);
  }
  
  const framework = getFramework();
  
  try {
    const response = await framework.chat(agentName, [
      { role: 'user', content: message }
    ]);
    
    console.log('\n=== ' + agentName + ' Response ===\n');
    console.log(response.content);
    console.log('\n[Model: ' + response.model + ', Tokens: ' + (response.usage?.input_tokens || 0) + ' in / ' + (response.usage?.output_tokens || 0) + ' out]');
  } catch (e) {
    console.log('Error: ' + e.message);
  }
}

function showLLMConfig() {
  const framework = getFramework();
  const llmConfig = framework.config.llm || {};
  
  console.log('\n=== LLM Configuration ===\n');
  console.log('Provider: ' + (llmConfig.provider || 'mock'));
  console.log('Model: ' + (llmConfig.model || 'default'));
  console.log('Base URL: ' + (llmConfig.baseUrl || 'default'));
  console.log('API Key: ' + (llmConfig.apiKey ? '***configured***' : 'not set'));
  console.log('Temperature: ' + (llmConfig.temperature || 0.7));
  console.log('Max Tokens: ' + (llmConfig.maxTokens || 4096));
}

// Tool functions
function listTools() {
  const framework = getFramework();
  const tools = framework.listTools();
  
  console.log('\n=== Available Tools ===\n');
  if (tools.length === 0) {
    console.log('No tools available.');
    return;
  }
  
  tools.forEach(function(tool, i) {
    console.log((i + 1) + '. ' + tool.name);
    console.log('   ' + tool.description);
    if (tool.required && tool.required.length > 0) {
      console.log('   Required: ' + tool.required.join(', '));
    }
    console.log('');
  });
}

async function execTool() {
  const toolName = args[2];
  const paramsJson = args[3];
  if (!toolName) {
    console.log('Usage: maf tool exec <name> [params_json]');
    process.exit(1);
  }
  
  let params = {};
  if (paramsJson) {
    try {
      params = JSON.parse(paramsJson);
    } catch (e) {
      console.log('Invalid JSON params: ' + e.message);
      process.exit(1);
    }
  }
  
  const framework = getFramework();
  const result = await framework.executeTool(toolName, params);
  
  console.log('\n=== Tool Execution Result ===\n');
  console.log('Tool: ' + toolName);
  console.log('Success: ' + result.success);
  if (result.result) {
    console.log('Result: ' + JSON.stringify(result.result, null, 2).substring(0, 500));
  }
  if (result.error) {
    console.log('Error: ' + result.error);
  }
}

// Agent Runtime functions
async function runAgent() {
  const agentName = args[2];
  const input = args[3];
  if (!agentName || !input) {
    console.log('Usage: maf run <agent> <input>');
    process.exit(1);
  }
  
  const framework = getFramework();
  
  console.log('\n=== Running Agent: ' + agentName + ' ===\n');
  console.log('Input: ' + input);
  console.log('');
  
  try {
    const result = await framework.runAgent(agentName, input);
    
    console.log('--- Result ---');
    if (result.result) {
      console.log(JSON.stringify(result.result, null, 2));
    }
    console.log('\nIterations: ' + result.iterations);
  } catch (e) {
    console.log('Error: ' + e.message);
  }
}

switch (command) {
  case 'init':
    initProject();
    break;
  case 'config':
    showConfig();
    break;
  case 'agent':
    var subCmd = args[1];
    if (subCmd === 'list') listAgents();
    else if (subCmd === 'add') addAgent();
    else if (subCmd === 'show') showAgent();
    else console.log('Unknown agent command. Use: list, add, show');
    break;
  case 'task':
    var subCmd = args[1];
    if (subCmd === 'create') createTask();
    else if (subCmd === 'list') listTasks();
    else if (subCmd === 'show') showTask();
    else if (subCmd === 'assign') assignTask();
    else if (subCmd === 'status') updateTaskStatus();
    else console.log('Unknown task command. Use: create, list, show, assign, status');
    break;
  case 'message':
    var subCmd = args[1];
    if (subCmd === 'send') sendMessage();
    else if (subCmd === 'list') listMessages();
    else console.log('Unknown message command. Use: send, list');
    break;
  case 'workflow':
    var subCmd = args[1];
    if (subCmd === 'transfer') transferTask();
    else if (subCmd === 'split') splitTask();
    else if (subCmd === 'report') reportResult();
    else if (subCmd === 'collect') collectResults();
    else console.log('Unknown workflow command. Use: transfer, split, report, collect');
    break;
  case 'watch':
    startWatch();
    break;
  case 'memory':
    var subCmd = args[1];
    if (subCmd === 'show') showMemoryStats();
    else if (subCmd === 'remember') addShortTermMemory();
    else if (subCmd === 'memorize') addLongTermMemory();
    else if (subCmd === 'recall') recallMemory();
    else if (subCmd === 'events') showEvents();
    else if (subCmd === 'clear') clearMemory();
    else console.log('Unknown memory command. Use: show, remember, memorize, recall, events, clear');
    break;
  case 'llm':
    var subCmd = args[1];
    if (subCmd === 'chat') llmChat();
    else if (subCmd === 'config') showLLMConfig();
    else console.log('Unknown llm command. Use: chat, config');
    break;
  case 'tool':
    var subCmd = args[1];
    if (subCmd === 'list') listTools();
    else if (subCmd === 'exec') execTool();
    else console.log('Unknown tool command. Use: list, exec');
    break;
  case 'run':
    runAgent();
    break;
  case '--help':
  case '-h':
  default:
    showHelp();
    break;
}
