#!/usr/bin/env node

/**
 * MeowTea Framework CLI
 * Command-line interface for managing agents, tasks, messages, and workflows
 * 
 * New features:
 * - Interactive mode for user input processing
 * - Dynamic agent creation and management
 * - Session management
 * - Clarification handling
 */

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { MultiAgentFramework } = require('../core');
const { startServer } = require('../web/api/server');

const args = process.argv.slice(2);
const command = args[0];

function getFramework() {
  const rootDir = process.cwd();
  return new MultiAgentFramework({ rootDir: rootDir });
}

function showHelp() {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║           MeowTea Framework                ║');
  console.log('║     🐱 Multi-Agent Collaboration 🍵        ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');
  console.log('Usage: meowtea <command> [options]');
  console.log('       mt <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log('');
  console.log('  Project:');
  console.log('    init [preset]              Initialize a new project (default|minimal|none)');
  console.log('    config                     Show current configuration');
  console.log('');
  console.log('  Interactive (New):');
  console.log('    ask "<instruction>"        Process user instruction with dynamic agents');
  console.log('    clarify <sessionId>        Provide clarification for a session');
  console.log('    status                     Show orchestrator status');
  console.log('    tasks                      List all orchestrator tasks');
  console.log('    pause                      Pause current execution');
  console.log('    resume                     Resume paused execution');
  console.log('    cancel                     Cancel current execution');
  console.log('');
  console.log('  Dynamic Agents (New):');
  console.log('    agent create <type>        Create a dynamic agent by type');
  console.log('    agent list                 List all agents (static + dynamic)');
  console.log('    agent show <name|id>       Show agent details');
  console.log('    agent templates            List available agent templates');
  console.log('    agent remove <id>          Remove a dynamic agent');
  console.log('');
  console.log('  Sessions (New):');
  console.log('    session list               List all sessions');
  console.log('    session show <id>          Show session details');
  console.log('    session close <id>         Close a session');
  console.log('    session delete <id>        Delete a session');
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
  console.log('  Web Dashboard:');
  console.log('    web [port]                 Start web dashboard server (default: 3000)');
  console.log('    web --port=3001            Start on specific port');
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
  console.log('    llm stream <agent> <message>       Stream chat response');
  console.log('    llm config                         Show LLM configuration');
  console.log('    llm providers                      List available providers');
  console.log('    llm models                         List known models');
  console.log('    llm set-provider <provider>        Set LLM provider');
  console.log('    llm set-model <model>              Set LLM model');
  console.log('    llm test                           Test LLM connection');
  console.log('');
  console.log('  Tools:');
  console.log('    tool list                          List available tools');
  console.log('    tool exec <name> <params_json>     Execute a tool');
  console.log('    tool enable <name>                 Enable a tool');
  console.log('    tool disable <name>                Disable a tool');
  console.log('    tool stats                         Show tool statistics');
  console.log('');
  console.log('  Skills:');
  console.log('    skill list                         List installed skills');
  console.log('    skill install <name> <template>    Install a skill from template');
  console.log('    skill show <name>                  Show skill details');
  console.log('    skill enable <name>                Enable a skill');
  console.log('    skill disable <name>               Disable a skill');
  console.log('    skill exec <name> <input_json>     Execute a skill');
  console.log('    skill uninstall <name>             Uninstall a skill');
  console.log('');
  console.log('  Rules:');
  console.log('    rule list                          List all rules');
  console.log('    rule add <name> <type>             Add a new rule');
  console.log('    rule show <name>                   Show rule details');
  console.log('    rule enable <name>                 Enable a rule');
  console.log('    rule disable <name>                Disable a rule');
  console.log('    rule validate <data_json>          Validate data against rules');
  console.log('    rule stats                         Show rule statistics');
  console.log('');
  console.log('  MCP (Model Context Protocol):');
  console.log('    mcp list                           List MCP clients');
  console.log('    mcp add <name> <command>           Add an MCP client');
  console.log('    mcp remove <name>                  Remove an MCP client');
  console.log('    mcp tools                          List all MCP tools');
  console.log('    mcp resources                      List all MCP resources');
  console.log('    mcp prompts                        List all MCP prompts');
  console.log('    mcp exec <client> <tool> <args>    Execute an MCP tool');
  console.log('');
  console.log('  Agent Runtime:');
  console.log('    run <agent> <input>                Run agent with input');
  console.log('');
  console.log('Options:');
  console.log('  --priority <P0-P3>          Set priority');
  console.log('  --assignee <agent>          Set assignee');
  console.log('  --type <type>               Set message type');
  console.log('  --file <path>               Use config file');
  console.log('  --interactive               Enable interactive mode');
  console.log('');
  console.log('Examples:');
  console.log('  meowtea init default');
  console.log('  meowtea ask "Create a REST API for user management"');
  console.log('  meowtea ask "Research the latest AI trends and write a summary"');
  console.log('  meowtea agent templates');
  console.log('  meowtea session list');
  console.log('  meowtea web              # Start web dashboard');
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
  const staticAgents = framework.listAgents();
  const dynamicAgents = framework.listDynamicAgents();
  
  console.log('\n=== Static Agents ===\n');
  if (staticAgents.length === 0) {
    console.log('No static agents configured. Run "maf init" to set up a project.');
  } else {
    staticAgents.forEach(function(agent) {
      console.log('- ' + agent.name + ': ' + agent.description);
    });
  }
  
  console.log('\n=== Dynamic Agents ===\n');
  if (dynamicAgents.length === 0) {
    console.log('No dynamic agents created.');
  } else {
    dynamicAgents.forEach(function(agent) {
      console.log('- [' + agent.id + '] ' + agent.name + ' (' + agent.type + '): ' + agent.status);
    });
  }
}

function showAgentTemplates() {
  const framework = getFramework();
  const templates = framework.getAgentTemplates();
  
  console.log('\n=== Agent Templates ===\n');
  templates.forEach(function(template) {
    console.log('[' + template.type + '] ' + template.name);
    console.log('  ' + template.description);
    console.log('  Capabilities: ' + template.capabilities.join(', '));
    console.log('');
  });
}

async function createDynamicAgent() {
  const type = args[2];
  if (!type) {
    console.log('Usage: maf agent create <type>');
    console.log('Available types: general, coder, researcher, writer, analyzer, tester, reviewer, designer, planner, coordinator');
    process.exit(1);
  }
  
  const framework = getFramework();
  const agent = await framework.createDynamicAgent({ type: type });
  
  console.log('Created dynamic agent:');
  console.log('  ID: ' + agent.id);
  console.log('  Name: ' + agent.name);
  console.log('  Type: ' + agent.type);
  console.log('  Description: ' + agent.description);
}

function showAgent() {
  const nameOrId = args[2];
  if (!nameOrId) {
    console.log('Usage: maf agent show <name|id>');
    process.exit(1);
  }
  
  const framework = getFramework();
  
  const staticAgent = framework.getAgent(nameOrId);
  if (staticAgent) {
    console.log('\n=== Static Agent: ' + staticAgent.name + ' ===\n');
    console.log('Description: ' + staticAgent.description);
    console.log('Responsibilities: ' + (staticAgent.responsibilities || []).join(', '));
    console.log('Outputs: ' + (staticAgent.outputs || []).join(', '));
    return;
  }
  
  const dynamicAgent = framework.getDynamicAgent(nameOrId);
  if (dynamicAgent) {
    const stats = dynamicAgent.getStats();
    console.log('\n=== Dynamic Agent: ' + stats.name + ' ===\n');
    console.log('ID: ' + stats.id);
    console.log('Type: ' + stats.type);
    console.log('Status: ' + stats.status);
    console.log('Task Count: ' + stats.taskCount);
    console.log('Reject Count: ' + stats.rejectCount);
    console.log('Created: ' + stats.createdAt);
    return;
  }
  
  console.log('Agent not found: ' + nameOrId);
}

async function removeDynamicAgent() {
  const agentId = args[2];
  if (!agentId) {
    console.log('Usage: maf agent remove <id>');
    process.exit(1);
  }
  
  const framework = getFramework();
  const removed = await framework.removeDynamicAgent(agentId);
  
  if (removed) {
    console.log('Removed dynamic agent: ' + agentId);
  } else {
    console.log('Agent not found: ' + agentId);
  }
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

async function processUserInstruction() {
  const instruction = args[1];
  if (!instruction) {
    console.log('Usage: maf ask "<instruction>"');
    process.exit(1);
  }
  
  const framework = getFramework();
  
  console.log('\n=== Processing Instruction ===\n');
  console.log('Instruction: ' + instruction);
  console.log('');
  
  framework.setClarificationCallback(function(data) {
    console.log('\n=== Clarification Needed ===\n');
    console.log('Understanding: ' + data.understanding);
    console.log('\nQuestions:');
    data.questions.forEach(function(q, i) {
      console.log('  ' + (i + 1) + '. ' + q);
    });
    console.log('\nSession ID: ' + data.sessionId);
    console.log('\nUse: maf clarify ' + data.sessionId + ' "your responses..."');
  });
  
  framework.onOrchestratorEvent('task_created', function(task) {
    console.log('[Task Created] ' + task.id + ': ' + task.title);
  });
  
  framework.onOrchestratorEvent('task_assigned', function(task) {
    console.log('[Task Assigned] ' + task.id + ' -> ' + task.assignedAgentName);
  });
  
  framework.onOrchestratorEvent('task_completed', function(task) {
    console.log('[Task Completed] ' + task.id);
  });
  
  framework.onOrchestratorEvent('task_rejected', function(task) {
    console.log('[Task Rejected] ' + task.id + ' (reject count: ' + task.rejectCount + ')');
  });
  
  framework.onOrchestratorEvent('agent_created', function(agent) {
    console.log('[Agent Created] ' + agent.name);
  });
  
  framework.onOrchestratorEvent('session_completed', function(data) {
    console.log('\n=== Session Completed ===\n');
    console.log('Session ID: ' + data.sessionId);
  });
  
  try {
    const result = await framework.processUserInput(instruction);
    
    if (result.needsClarification) {
      return;
    }
    
    console.log('\n=== Result ===\n');
    if (result.success) {
      console.log('Status: Success');
      console.log('Session ID: ' + result.sessionId);
      console.log('\nTask Results:');
      result.results.forEach(function(r, i) {
        console.log('  ' + (i + 1) + '. ' + r.taskId + ': ' + (r.success ? 'Completed' : 'Failed'));
      });
    } else {
      console.log('Status: Failed');
      console.log('Error: ' + (result.error || 'Unknown error'));
    }
  } catch (e) {
    console.log('Error: ' + e.message);
  }
}

async function provideClarification() {
  const sessionId = args[1];
  const responses = args[2];
  
  if (!sessionId || !responses) {
    console.log('Usage: maf clarify <sessionId> "<responses>"');
    process.exit(1);
  }
  
  const framework = getFramework();
  
  const responseList = responses.split(';').map(function(r) { return r.trim(); });
  
  console.log('\n=== Providing Clarification ===\n');
  console.log('Session: ' + sessionId);
  console.log('Responses: ' + responseList.join(', '));
  console.log('');
  
  try {
    const result = await framework.provideClarification(sessionId, responseList);
    
    if (result.needsClarification) {
      console.log('\n=== Additional Clarification Needed ===\n');
      result.questions.forEach(function(q, i) {
        console.log('  ' + (i + 1) + '. ' + q);
      });
      return;
    }
    
    console.log('\n=== Result ===\n');
    if (result.success) {
      console.log('Status: Success');
      console.log('Session ID: ' + result.sessionId);
    } else {
      console.log('Status: Failed');
      console.log('Error: ' + (result.error || 'Unknown error'));
    }
  } catch (e) {
    console.log('Error: ' + e.message);
  }
}

function showOrchestratorStatus() {
  const framework = getFramework();
  const status = framework.getOrchestratorStatus();
  
  if (!status) {
    console.log('No active orchestrator session.');
    return;
  }
  
  console.log('\n=== Orchestrator Status ===\n');
  console.log('Status: ' + status.status);
  console.log('Session ID: ' + (status.sessionId || 'None'));
  console.log('Total Tasks: ' + status.totalTasks);
  console.log('Completed Tasks: ' + status.completedTasks);
  console.log('Pending Tasks: ' + status.pendingTasks);
  console.log('Active Agents: ' + status.activeAgents);
}

function listOrchestratorTasks() {
  const framework = getFramework();
  const tasks = framework.getAllOrchestratorTasks();
  
  console.log('\n=== Orchestrator Tasks ===\n');
  
  if (tasks.length === 0) {
    console.log('No tasks found.');
    return;
  }
  
  tasks.forEach(function(task) {
    const statusIcon = {
      'pending': '⏳',
      'assigned': '👤',
      'in_progress': '🔄',
      'completed': '✅',
      'rejected': '❌',
      'failed': '💥',
      'needs_clarification': '❓'
    }[task.status] || '❔';
    
    console.log(statusIcon + ' [' + task.id + '] ' + task.title);
    console.log('   Status: ' + task.status);
    if (task.assignedAgentName) {
      console.log('   Agent: ' + task.assignedAgentName);
    }
    if (task.rejectCount > 0) {
      console.log('   Reject Count: ' + task.rejectCount);
    }
    console.log('');
  });
}

async function pauseOrchestrator() {
  const framework = getFramework();
  await framework.pauseOrchestrator();
  console.log('Orchestrator paused.');
}

async function resumeOrchestrator() {
  const framework = getFramework();
  await framework.resumeOrchestrator();
  console.log('Orchestrator resumed.');
}

async function cancelOrchestrator() {
  const framework = getFramework();
  await framework.cancelOrchestrator();
  console.log('Orchestrator cancelled.');
}

function listSessions() {
  const framework = getFramework();
  const sessions = framework.listSessions();
  
  console.log('\n=== Sessions ===\n');
  
  if (sessions.length === 0) {
    console.log('No sessions found.');
    return;
  }
  
  sessions.forEach(function(session) {
    console.log('[' + session.id + '] ' + session.status);
    console.log('   Created: ' + session.createdAt);
    console.log('   Updated: ' + session.updatedAt);
    console.log('');
  });
}

async function showSession() {
  const sessionId = args[2];
  if (!sessionId) {
    console.log('Usage: maf session show <id>');
    process.exit(1);
  }
  
  const framework = getFramework();
  const session = await framework.getSession(sessionId);
  
  if (!session) {
    console.log('Session not found: ' + sessionId);
    return;
  }
  
  const stats = session.getStats();
  
  console.log('\n=== Session: ' + stats.id + ' ===\n');
  console.log('Status: ' + stats.status);
  console.log('Created: ' + stats.createdAt);
  console.log('Updated: ' + stats.updatedAt);
  console.log('Tasks: ' + stats.completedTasks + '/' + stats.taskCount);
  console.log('Current Task Index: ' + stats.currentTaskIndex);
  console.log('Messages: ' + stats.messageCount);
  console.log('Agents: ' + stats.agentCount);
  console.log('History Size: ' + stats.historySize);
  console.log('Snapshots: ' + stats.snapshotCount);
}

async function closeSession() {
  const sessionId = args[2];
  if (!sessionId) {
    console.log('Usage: maf session close <id>');
    process.exit(1);
  }
  
  const framework = getFramework();
  const result = await framework.closeSession(sessionId);
  
  if (result.success) {
    console.log('Session closed: ' + sessionId);
  } else {
    console.log('Error: ' + result.error);
  }
}

async function deleteSession() {
  const sessionId = args[2];
  if (!sessionId) {
    console.log('Usage: maf session delete <id>');
    process.exit(1);
  }
  
  const framework = getFramework();
  const result = await framework.deleteSession(sessionId);
  
  if (result.success) {
    console.log('Session deleted: ' + sessionId);
  } else {
    console.log('Error: ' + result.error);
  }
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

async function startWebDashboard() {
  let port = 3000;
  
  const portArg = args.find(function(arg) { return arg.startsWith('--port='); });
  if (portArg) {
    port = parseInt(portArg.split('=')[1]);
  } else if (args[1] && !args[1].startsWith('-')) {
    const parsed = parseInt(args[1]);
    if (!isNaN(parsed)) {
      port = parsed;
    }
  }
  
  const rootDir = process.cwd();
  console.log('Starting web dashboard...');
  console.log('Working directory: ' + rootDir);
  console.log('');
  
  try {
    await startServer(port, rootDir);
  } catch (e) {
    console.error('Failed to start server:', e.message);
    process.exit(1);
  }
}

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
  console.log('Timeout: ' + (llmConfig.timeout || 120000) + 'ms');
  console.log('Max Retries: ' + (llmConfig.maxRetries || 3));
}

function listLLMProviders() {
  const { LLM_PROVIDERS, DEFAULT_MODELS } = require('../core/llm/adapter');
  
  console.log('\n=== Available LLM Providers ===\n');
  console.log('  openai     - OpenAI (GPT-4, GPT-3.5)');
  console.log('  anthropic  - Anthropic (Claude)');
  console.log('  ollama     - Ollama (Local models)');
  console.log('  lmstudio   - LM Studio (Local models)');
  console.log('  mock       - Mock adapter (testing)');
  console.log('');
  console.log('Default models:');
  Object.entries(DEFAULT_MODELS).forEach(function([provider, model]) {
    console.log('  ' + provider + ': ' + model);
  });
}

function listLLMModels() {
  const { MODEL_CONTEXT_SIZES } = require('../core/llm/adapter');
  
  console.log('\n=== Known Models & Context Sizes ===\n');
  Object.entries(MODEL_CONTEXT_SIZES).forEach(function([model, size]) {
    console.log('  ' + model + ': ' + size.toLocaleString() + ' tokens');
  });
  console.log('\nNote: You can use any model supported by your provider.');
}

async function setLLMProvider() {
  const provider = args[2];
  if (!provider) {
    console.log('Usage: maf llm set-provider <provider>');
    console.log('Providers: openai, anthropic, ollama, lmstudio, mock');
    process.exit(1);
  }
  
  const framework = getFramework();
  framework.config.llm = framework.config.llm || {};
  framework.config.llm.provider = provider;
  framework.saveConfig();
  
  console.log('LLM provider set to: ' + provider);
  console.log('Remember to set your API key if required:');
  if (provider === 'openai') {
    console.log('  Set OPENAI_API_KEY environment variable or add to config');
  } else if (provider === 'anthropic') {
    console.log('  Set ANTHROPIC_API_KEY environment variable or add to config');
  }
}

async function setLLMModel() {
  const model = args[2];
  if (!model) {
    console.log('Usage: maf llm set-model <model>');
    console.log('Example: maf llm set-model gpt-4o');
    process.exit(1);
  }
  
  const framework = getFramework();
  framework.config.llm = framework.config.llm || {};
  framework.config.llm.model = model;
  framework.saveConfig();
  
  console.log('LLM model set to: ' + model);
}

async function testLLMConnection() {
  const framework = getFramework();
  const llmConfig = framework.config.llm || {};
  
  console.log('\n=== Testing LLM Connection ===\n');
  console.log('Provider: ' + (llmConfig.provider || 'mock'));
  console.log('Model: ' + (llmConfig.model || 'default'));
  console.log('');
  
  try {
    const response = await framework.chat('test-agent', [
      { role: 'user', content: 'Say "Hello, World!" in exactly those words.' }
    ]);
    
    console.log('✅ Connection successful!');
    console.log('');
    console.log('Response: ' + response.content);
    console.log('');
    console.log('Model: ' + response.model);
    console.log('Tokens: ' + (response.usage?.input_tokens || 0) + ' in / ' + (response.usage?.output_tokens || 0) + ' out');
  } catch (e) {
    console.log('❌ Connection failed!');
    console.log('Error: ' + e.message);
    console.log('');
    console.log('Troubleshooting:');
    if (llmConfig.provider === 'openai') {
      console.log('  - Check that OPENAI_API_KEY is set');
      console.log('  - Verify your API key is valid');
    } else if (llmConfig.provider === 'anthropic') {
      console.log('  - Check that ANTHROPIC_API_KEY is set');
      console.log('  - Verify your API key is valid');
    } else if (llmConfig.provider === 'ollama') {
      console.log('  - Ensure Ollama is running (ollama serve)');
      console.log('  - Check that the model is installed (ollama pull <model>)');
    } else if (llmConfig.provider === 'lmstudio') {
      console.log('  - Ensure LM Studio is running with a model loaded');
      console.log('  - Check the server is on port 1234');
    }
  }
}

async function streamLLMChat() {
  const agentName = args[2];
  const message = args[3];
  if (!agentName || !message) {
    console.log('Usage: maf llm stream <agent> <message>');
    process.exit(1);
  }
  
  const framework = getFramework();
  
  console.log('\n=== Streaming Response ===\n');
  console.log('Agent: ' + agentName);
  console.log('Message: ' + message);
  console.log('');
  console.log('--- Response ---');
  
  try {
    const response = await framework.streamChat(agentName, [
      { role: 'user', content: message }
    ], function(chunk, accumulated) {
      process.stdout.write(chunk);
    });
    
    console.log('\n\n--- End ---');
    console.log('Model: ' + response.model);
    console.log('Tokens: ' + (response.usage?.input_tokens || 0) + ' in / ' + (response.usage?.output_tokens || 0) + ' out');
  } catch (e) {
    console.log('\nError: ' + e.message);
  }
}

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

// ========== SKILL COMMANDS ==========

async function listSkills() {
  const framework = getFramework();
  await framework.initSkills();
  const skills = framework.listSkills();
  
  console.log('\n=== Installed Skills ===\n');
  if (skills.length === 0) {
    console.log('No skills installed.');
    return;
  }
  
  skills.forEach(function(skill) {
    const status = skill.enabled ? '✅' : '❌';
    console.log(status + ' [' + skill.name + '] v' + skill.version + ' (' + skill.category + ')');
    console.log('   ' + skill.description);
    if (skill.tools && skill.tools.length > 0) {
      console.log('   Tools: ' + skill.tools.join(', '));
    }
    console.log('');
  });
}

async function installSkill() {
  const name = args[2];
  const template = args[3] || 'basic';
  
  if (!name) {
    console.log('Usage: maf skill install <name> [template]');
    console.log('Templates: basic, code, analysis, automation');
    process.exit(1);
  }
  
  const framework = getFramework();
  
  try {
    const skill = await framework.createSkillFromTemplate(name, template);
    console.log('Skill installed: ' + skill.name + ' v' + skill.version);
    console.log('Category: ' + skill.category);
    console.log('Description: ' + skill.description);
  } catch (e) {
    console.log('Error: ' + e.message);
  }
}

async function showSkill() {
  const name = args[2];
  if (!name) {
    console.log('Usage: maf skill show <name>');
    process.exit(1);
  }
  
  const framework = getFramework();
  const skill = framework.getSkill(name);
  
  if (!skill) {
    console.log('Skill not found: ' + name);
    return;
  }
  
  console.log('\n=== Skill: ' + skill.name + ' ===\n');
  console.log('Version: ' + skill.version);
  console.log('Category: ' + skill.category);
  console.log('Description: ' + skill.description);
  console.log('Status: ' + (skill.enabled ? 'Enabled' : 'Disabled'));
  console.log('Author: ' + skill.author);
  console.log('Tools: ' + (skill.tools || []).join(', '));
  console.log('Rules: ' + (skill.rules || []).join(', '));
  console.log('Dependencies: ' + (skill.dependencies || []).join(', '));
  console.log('Created: ' + skill.createdAt);
  console.log('Last Used: ' + (skill.lastUsed || 'Never'));
  console.log('Use Count: ' + skill.useCount);
}

async function enableSkill() {
  const name = args[2];
  if (!name) {
    console.log('Usage: maf skill enable <name>');
    process.exit(1);
  }
  
  const framework = getFramework();
  if (framework.enableSkill(name)) {
    console.log('Skill enabled: ' + name);
  } else {
    console.log('Skill not found: ' + name);
  }
}

async function disableSkill() {
  const name = args[2];
  if (!name) {
    console.log('Usage: maf skill disable <name>');
    process.exit(1);
  }
  
  const framework = getFramework();
  if (framework.disableSkill(name)) {
    console.log('Skill disabled: ' + name);
  } else {
    console.log('Skill not found: ' + name);
  }
}

async function executeSkill() {
  const name = args[2];
  const inputJson = args[3];
  
  if (!name) {
    console.log('Usage: maf skill exec <name> [input_json]');
    process.exit(1);
  }
  
  let input = {};
  if (inputJson) {
    try {
      input = JSON.parse(inputJson);
    } catch (e) {
      console.log('Invalid JSON input: ' + e.message);
      process.exit(1);
    }
  }
  
  const framework = getFramework();
  
  try {
    const result = await framework.executeSkill(name, input);
    console.log('\n=== Skill Execution Result ===\n');
    console.log('Success: ' + result.success);
    if (result.result) {
      console.log('Result: ' + JSON.stringify(result.result, null, 2));
    }
    if (result.error) {
      console.log('Error: ' + result.error);
    }
    console.log('Duration: ' + result.duration + 'ms');
  } catch (e) {
    console.log('Error: ' + e.message);
  }
}

async function uninstallSkill() {
  const name = args[2];
  if (!name) {
    console.log('Usage: maf skill uninstall <name>');
    process.exit(1);
  }
  
  const framework = getFramework();
  
  if (await framework.uninstallSkill(name)) {
    console.log('Skill uninstalled: ' + name);
  } else {
    console.log('Skill not found: ' + name);
  }
}

// ========== RULE COMMANDS ==========

async function listRules() {
  const framework = getFramework();
  await framework.initRules();
  const rules = framework.listRules();
  
  console.log('\n=== Rules ===\n');
  if (rules.length === 0) {
    console.log('No rules defined.');
    return;
  }
  
  rules.forEach(function(rule) {
    const status = rule.enabled ? '✅' : '❌';
    console.log(status + ' [' + rule.name + '] (' + rule.type + ', priority: ' + rule.priority + ')');
    console.log('   ' + rule.description);
    console.log('   Scope: ' + rule.scope);
    console.log('');
  });
}

async function showRule() {
  const name = args[2];
  if (!name) {
    console.log('Usage: maf rule show <name>');
    process.exit(1);
  }
  
  const framework = getFramework();
  const rule = framework.getRule(name);
  
  if (!rule) {
    console.log('Rule not found: ' + name);
    return;
  }
  
  console.log('\n=== Rule: ' + rule.name + ' ===\n');
  console.log('Type: ' + rule.type);
  console.log('Priority: ' + rule.priority);
  console.log('Description: ' + rule.description);
  console.log('Status: ' + (rule.enabled ? 'Enabled' : 'Disabled'));
  console.log('Scope: ' + rule.scope);
  if (rule.target) console.log('Target: ' + rule.target);
  if (rule.events && rule.events.length > 0) {
    console.log('Events: ' + rule.events.join(', '));
  }
  console.log('Trigger Count: ' + rule.triggerCount);
  console.log('Last Triggered: ' + (rule.lastTriggered || 'Never'));
}

async function enableRule() {
  const name = args[2];
  if (!name) {
    console.log('Usage: maf rule enable <name>');
    process.exit(1);
  }
  
  const framework = getFramework();
  if (framework.enableRule(name)) {
    console.log('Rule enabled: ' + name);
  } else {
    console.log('Rule not found: ' + name);
  }
}

async function disableRule() {
  const name = args[2];
  if (!name) {
    console.log('Usage: maf rule disable <name>');
    process.exit(1);
  }
  
  const framework = getFramework();
  if (framework.disableRule(name)) {
    console.log('Rule disabled: ' + name);
  } else {
    console.log('Rule not found: ' + name);
  }
}

async function validateWithRules() {
  const dataJson = args[2];
  if (!dataJson) {
    console.log('Usage: maf rule validate <data_json>');
    process.exit(1);
  }
  
  let data;
  try {
    data = JSON.parse(dataJson);
  } catch (e) {
    console.log('Invalid JSON: ' + e.message);
    process.exit(1);
  }
  
  const framework = getFramework();
  const result = await framework.validateWithRules(data);
  
  console.log('\n=== Validation Result ===\n');
  console.log('Valid: ' + result.valid);
  if (result.failures && result.failures.length > 0) {
    console.log('\nFailures:');
    result.failures.forEach(function(f) {
      console.log('  - ' + f.rule + ': ' + (f.message || f.error));
    });
  }
}

async function showRuleStats() {
  const framework = getFramework();
  const stats = framework.getRuleStats();
  
  if (!stats) {
    console.log('Rule engine not initialized.');
    return;
  }
  
  console.log('\n=== Rule Statistics ===\n');
  console.log('Total Rules: ' + stats.total);
  console.log('Enabled: ' + stats.enabled);
  console.log('Disabled: ' + stats.disabled);
  console.log('Total Triggers: ' + stats.totalTriggers);
  console.log('\nBy Type:');
  Object.entries(stats.byType).forEach(function([type, count]) {
    console.log('  ' + type + ': ' + count);
  });
}

// ========== MCP COMMANDS ==========

async function listMCPClients() {
  const framework = getFramework();
  await framework.initMCP();
  const clients = framework.listMCPClients();
  
  console.log('\n=== MCP Clients ===\n');
  if (clients.length === 0) {
    console.log('No MCP clients configured.');
    return;
  }
  
  clients.forEach(function(client) {
    const status = client.status === 'connected' ? '✅' : '❌';
    console.log(status + ' [' + client.name + '] ' + client.status);
    console.log('   Tools: ' + client.toolsCount);
    console.log('   Resources: ' + client.resourcesCount);
    console.log('   Prompts: ' + client.promptsCount);
    console.log('');
  });
}

async function addMCPClient() {
  const name = args[2];
  const command = args[3];
  
  if (!name || !command) {
    console.log('Usage: mcp add <name> <command>');
    console.log('Example: mcp add filesystem "npx @modelcontextprotocol/server-filesystem /path"');
    process.exit(1);
  }
  
  const framework = getFramework();
  
  try {
    await framework.addMCPClient(name, { command: command, args: [] });
    console.log('MCP client added: ' + name);
  } catch (e) {
    console.log('Error: ' + e.message);
  }
}

async function removeMCPClient() {
  const name = args[2];
  if (!name) {
    console.log('Usage: mcp remove <name>');
    process.exit(1);
  }
  
  const framework = getFramework();
  
  if (await framework.removeMCPClient(name)) {
    console.log('MCP client removed: ' + name);
  } else {
    console.log('Client not found: ' + name);
  }
}

async function listMCPTools() {
  const framework = getFramework();
  const tools = framework.getAllMCPTools();
  
  console.log('\n=== MCP Tools ===\n');
  if (tools.length === 0) {
    console.log('No MCP tools available.');
    return;
  }
  
  tools.forEach(function(tool) {
    console.log('[' + tool.client + '] ' + tool.name);
    console.log('   ' + (tool.description || 'No description'));
    console.log('');
  });
}

async function listMCPResources() {
  const framework = getFramework();
  const resources = framework.getAllMCPResources();
  
  console.log('\n=== MCP Resources ===\n');
  if (resources.length === 0) {
    console.log('No MCP resources available.');
    return;
  }
  
  resources.forEach(function(resource) {
    console.log('[' + resource.client + '] ' + resource.uri);
    console.log('   ' + (resource.name || resource.uri));
    console.log('');
  });
}

async function listMCPPrompts() {
  const framework = getFramework();
  const prompts = framework.getAllMCPPrompts();
  
  console.log('\n=== MCP Prompts ===\n');
  if (prompts.length === 0) {
    console.log('No MCP prompts available.');
    return;
  }
  
  prompts.forEach(function(prompt) {
    console.log('[' + prompt.client + '] ' + prompt.name);
    console.log('   ' + (prompt.description || 'No description'));
    console.log('');
  });
}

async function execMCPTool() {
  const clientName = args[2];
  const toolName = args[3];
  const argsJson = args[4];
  
  if (!clientName || !toolName) {
    console.log('Usage: mcp exec <client> <tool> [args_json]');
    process.exit(1);
  }
  
  let toolArgs = {};
  if (argsJson) {
    try {
      toolArgs = JSON.parse(argsJson);
    } catch (e) {
      console.log('Invalid JSON args: ' + e.message);
      process.exit(1);
    }
  }
  
  const framework = getFramework();
  
  try {
    const result = await framework.callMCPTool(clientName, toolName, toolArgs);
    console.log('\n=== MCP Tool Result ===\n');
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.log('Error: ' + e.message);
  }
}

// ========== TOOL EXTENDED COMMANDS ==========

async function enableTool() {
  const name = args[2];
  if (!name) {
    console.log('Usage: maf tool enable <name>');
    process.exit(1);
  }
  
  const framework = getFramework();
  if (framework.enableTool(name)) {
    console.log('Tool enabled: ' + name);
  } else {
    console.log('Tool not found: ' + name);
  }
}

async function disableTool() {
  const name = args[2];
  if (!name) {
    console.log('Usage: maf tool disable <name>');
    process.exit(1);
  }
  
  const framework = getFramework();
  if (framework.disableTool(name)) {
    console.log('Tool disabled: ' + name);
  } else {
    console.log('Tool not found: ' + name);
  }
}

async function showToolStats() {
  const framework = getFramework();
  const stats = framework.getToolStats();
  
  if (!stats) {
    console.log('Tool system not initialized.');
    return;
  }
  
  console.log('\n=== Tool Statistics ===\n');
  console.log('Total Tools: ' + stats.total);
  console.log('\nBy Status:');
  Object.entries(stats.byStatus).forEach(function([status, count]) {
    console.log('  ' + status + ': ' + count);
  });
  console.log('\nBy Category:');
  Object.entries(stats.byCategory).forEach(function([cat, count]) {
    console.log('  ' + cat + ': ' + count);
  });
  console.log('\nTotal Executions: ' + stats.totalExecutions);
  console.log('Total Errors: ' + stats.totalErrors);
}

switch (command) {
  case 'init':
    initProject();
    break;
  case 'config':
    showConfig();
    break;
  case 'ask':
    processUserInstruction();
    break;
  case 'clarify':
    provideClarification();
    break;
  case 'status':
    showOrchestratorStatus();
    break;
  case 'tasks':
    listOrchestratorTasks();
    break;
  case 'pause':
    pauseOrchestrator();
    break;
  case 'resume':
    resumeOrchestrator();
    break;
  case 'cancel':
    cancelOrchestrator();
    break;
  case 'agent':
    var subCmd = args[1];
    if (subCmd === 'list') listAgents();
    else if (subCmd === 'add') addAgent();
    else if (subCmd === 'show') showAgent();
    else if (subCmd === 'create') createDynamicAgent();
    else if (subCmd === 'templates') showAgentTemplates();
    else if (subCmd === 'remove') removeDynamicAgent();
    else console.log('Unknown agent command. Use: list, add, show, create, templates, remove');
    break;
  case 'session':
    var subCmd = args[1];
    if (subCmd === 'list') listSessions();
    else if (subCmd === 'show') showSession();
    else if (subCmd === 'close') closeSession();
    else if (subCmd === 'delete') deleteSession();
    else console.log('Unknown session command. Use: list, show, close, delete');
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
  case 'web':
    startWebDashboard();
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
    else if (subCmd === 'stream') streamLLMChat();
    else if (subCmd === 'config') showLLMConfig();
    else if (subCmd === 'providers') listLLMProviders();
    else if (subCmd === 'models') listLLMModels();
    else if (subCmd === 'set-provider') setLLMProvider();
    else if (subCmd === 'set-model') setLLMModel();
    else if (subCmd === 'test') testLLMConnection();
    else console.log('Unknown llm command. Use: chat, stream, config, providers, models, set-provider, set-model, test');
    break;
  case 'tool':
    var subCmd = args[1];
    if (subCmd === 'list') listTools();
    else if (subCmd === 'exec') execTool();
    else if (subCmd === 'enable') enableTool();
    else if (subCmd === 'disable') disableTool();
    else if (subCmd === 'stats') showToolStats();
    else console.log('Unknown tool command. Use: list, exec, enable, disable, stats');
    break;
  case 'skill':
    var subCmd = args[1];
    if (subCmd === 'list') listSkills();
    else if (subCmd === 'install') installSkill();
    else if (subCmd === 'show') showSkill();
    else if (subCmd === 'enable') enableSkill();
    else if (subCmd === 'disable') disableSkill();
    else if (subCmd === 'exec') executeSkill();
    else if (subCmd === 'uninstall') uninstallSkill();
    else console.log('Unknown skill command. Use: list, install, show, enable, disable, exec, uninstall');
    break;
  case 'rule':
    var subCmd = args[1];
    if (subCmd === 'list') listRules();
    else if (subCmd === 'show') showRule();
    else if (subCmd === 'enable') enableRule();
    else if (subCmd === 'disable') disableRule();
    else if (subCmd === 'validate') validateWithRules();
    else if (subCmd === 'stats') showRuleStats();
    else console.log('Unknown rule command. Use: list, show, enable, disable, validate, stats');
    break;
  case 'mcp':
    var subCmd = args[1];
    if (subCmd === 'list') listMCPClients();
    else if (subCmd === 'add') addMCPClient();
    else if (subCmd === 'remove') removeMCPClient();
    else if (subCmd === 'tools') listMCPTools();
    else if (subCmd === 'resources') listMCPResources();
    else if (subCmd === 'prompts') listMCPPrompts();
    else if (subCmd === 'exec') execMCPTool();
    else console.log('Unknown mcp command. Use: list, add, remove, tools, resources, prompts, exec');
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
