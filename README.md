# Multi-Agent Framework

A flexible, extensible framework for AI agent collaboration in software development and beyond.

## Features

- **Configurable Agent System**: Define custom agents with specific roles, responsibilities, and permissions
- **Task Management**: Create, assign, track, and manage tasks across agents
- **Message Passing**: Built-in communication protocol between agents
- **Workflow Automation**: Automatic task transitions and notifications
- **Memory System**: Three-tier memory (short-term, long-term, episodic) for each agent
- **File-based Storage**: Simple, transparent data storage using Markdown and JSON
- **CLI Tool**: Full-featured command-line interface
- **Extensible**: Easy to customize for different use cases

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/multi-agent-framework.git

# Navigate to the framework directory
cd multi-agent-framework

# Link globally (optional)
npm link
```

### Initialize a New Project

```bash
# Create a new project directory
mkdir my-project && cd my-project

# Initialize with default preset (8 agents)
maf init default

# Or use minimal preset (3 agents)
maf init minimal

# Or start from scratch
maf init none
```

### Basic Usage

```bash
# List available agents
maf agent list

# Create a task
maf task create "Implement user authentication" --priority P1

# Assign task to an agent
maf task assign TASK-001 Developer

# Update task status
maf task status TASK-001 in-progress

# List tasks
maf task list

# Transfer task between agents
maf workflow transfer TASK-001 Developer Reviewer
```

## Project Structure

After initialization, your project will have:

```
my-project/
├── agents/              # Agent definitions (Markdown)
├── tasks/               # Task files organized by status
│   ├── pending/
│   ├── assigned/
│   ├── in-progress/
│   ├── review/
│   ├── testing/
│   ├── done/
│   └── blocked/
├── messages/            # Agent communications
│   ├── broadcast/       # Messages to all agents
│   └── direct/          # Direct messages to specific agents
├── docs/                # Project documentation
├── .maf/                # Framework state
└── maf.config.json      # Configuration file
```

## Configuration

### maf.config.json

```json
{
  "agents": [
    {
      "name": "Developer",
      "description": "Code implementation and testing",
      "responsibilities": ["Feature implementation", "Unit testing"],
      "outputs": ["Source code", "Tests"],
      "permissions": ["write_code", "create_tests"]
    }
  ],
  "workflows": {
    "pending": { "next": "assigned", "notify": true },
    "assigned": { "next": "in-progress", "notify": false },
    "in-progress": { "next": "review", "notify": true, "notifyAgent": "Reviewer" }
  }
}
```

## Presets

### Default (8 Agents)
- Coordinator - Task coordination
- ProductManager - Requirements
- Architect - Technical design
- Developer - Implementation
- Tester - Quality assurance
- Reviewer - Code review
- BusinessManager - Business analysis
- Designer - UI/UX design

### Minimal (3 Agents)
- Coordinator - Task coordination
- Developer - Implementation
- Reviewer - Code review

### Custom Presets
Create your own preset by adding a JSON file to the `presets/` directory.

## CLI Commands

### Project Management
```bash
maf init [preset]        # Initialize project
maf config               # Show configuration
```

### Agent Management
```bash
maf agent list           # List all agents
maf agent add <name>     # Add new agent
maf agent show <name>    # Show agent details
```

### Task Management
```bash
maf task create <title> [--priority P0-P3] [--assignee <agent>]
maf task list [status]
maf task show <id>
maf task assign <id> <agent>
maf task status <id> <status>
```

### Messaging
```bash
maf message send <to> <subject> [--type <type>] [--priority <P0-P3>]
maf message list [type] [agent]
```

### Workflow
```bash
maf workflow transfer <taskId> <fromAgent> <toAgent>
maf workflow split <parentId> --file <config.json>
maf workflow report <subtaskId> <result> <agent>
maf workflow collect <parentId>
```

### Watch Mode
```bash
maf watch                # Auto-detect changes and send notifications
```

### Memory System
```bash
maf memory show <agent>              # Show agent memory stats
maf memory remember <agent> <content>  # Add to short-term memory
maf memory memorize <agent> <content>  # Add to long-term memory
maf memory recall <agent> [query]      # Recall from memory
maf memory events <agent>              # Show recent events
maf memory clear <agent> [type]        # Clear memory
```

## Memory System

Each agent has a three-tier memory system:

| Memory Type | Purpose | Persistence | Capacity |
|-------------|---------|-------------|----------|
| **Short-term** | Working memory, current context | Session | 100 items |
| **Long-term** | Knowledge, important facts | Persistent | 10,000 items |
| **Episodic** | Event history, actions | Persistent | 1,000 events |

### Memory Usage Example

```javascript
// Add to short-term memory (working context)
await framework.agentRemember('Developer', 'Working on login feature', {
  type: 'task_context',
  importance: 0.8
});

// Add to long-term memory (persistent knowledge)
await framework.agentMemorize('Developer', 'JWT authentication pattern', {
  type: 'knowledge',
  tags: ['auth', 'security']
});

// Recall from memory
const memories = await framework.agentRecall('Developer', 'authentication');

// Get context summary for LLM
const context = await framework.getAgentContext('Developer');
```

### Memory Configuration

```json
{
  "memory": {
    "enabled": true,
    "shortTerm": { "maxSize": 100, "maxAge": 3600000 },
    "longTerm": { "maxSize": 10000 },
    "episodic": { "maxEvents": 1000, "retentionDays": 30 }
  }
}
```

## LLM Integration

The framework supports multiple LLM providers with customizable configurations.

### Supported Providers

| Provider | Models | Features |
|----------|--------|----------|
| **OpenAI** | GPT-4, GPT-3.5 | Chat, Embeddings, Tools |
| **Anthropic** | Claude 3 | Chat, Tools |
| **Local** | Ollama, LM Studio | Chat, Embeddings |
| **Mock** | - | Testing without API |

### LLM Configuration

```json
{
  "llm": {
    "enabled": true,
    "provider": "openai",
    "model": "gpt-4",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "your-api-key",
    "temperature": 0.7,
    "maxTokens": 4096
  }
}
```

### LLM CLI Commands

```bash
# Chat with an agent
maf llm chat Developer "How should I implement authentication?"

# Show LLM configuration
maf llm config
```

### LLM API Usage

```javascript
// Chat with context from memory
const response = await framework.chat('Developer', [
  { role: 'user', content: 'Implement user authentication' }
], { includeContext: true });

// Generate embeddings
const embedding = await framework.embed('authentication token');

// Create custom LLM instance
const customLLM = framework.createLLM({
  provider: 'anthropic',
  model: 'claude-3-sonnet-20240229',
  apiKey: process.env.ANTHROPIC_API_KEY
});
```

## Tool System

Agents can use tools to interact with the environment.

### Built-in Tools

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `file_read` | Read file content | `path` |
| `file_write` | Write to file | `path`, `content` |
| `file_exists` | Check file existence | `path` |
| `directory_list` | List directory | `path` |
| `shell_execute` | Run shell command | `command` |
| `http_request` | Make HTTP request | `url` |
| `json_parse` | Parse JSON | `text` |
| `json_stringify` | To JSON string | `data` |
| `text_search` | Search text | `text`, `pattern` |
| `text_replace` | Replace text | `text`, `pattern`, `replacement` |

### Tool CLI Commands

```bash
# List available tools
maf tool list

# Execute a tool
maf tool exec file_read '{"path": "./README.md"}'
```

### Tool API Usage

```javascript
// Register custom tool
framework.registerTool({
  name: 'database_query',
  description: 'Execute database query',
  parameters: {
    query: { type: 'string', description: 'SQL query' }
  },
  required: ['query'],
  handler: async (params) => {
    // Execute query
    return { rows: [] };
  }
});

// Execute tool
const result = await framework.executeTool('file_read', {
  path: './config.json'
});
```

## Agent Runtime

The Agent Runtime combines LLM, Memory, and Tools for intelligent agent behavior.

### ReAct Loop

```
Think → Act → Observe → Think → ...
```

### Running Agents

```bash
# Run agent with input
maf run Developer "Implement user login feature"
```

### Runtime API

```javascript
// Create agent runtime
const runtime = await framework.createAgentRuntime('Developer', {
  llm: { provider: 'openai', model: 'gpt-4' },
  tools: ['file_read', 'file_write', 'shell_execute']
});

// Run agent
const result = await runtime.run('Implement authentication');

// Direct runtime usage
const runtime = framework.getAgentRuntime('Developer');
await runtime.remember('Working on login feature');
const memories = await runtime.recall('login');
```

## Workflow Example

```bash
# 1. Create a main task
maf task create "Build REST API" --priority P1

# 2. Split into subtasks (create split-config.json first)
maf workflow split TASK-001 --file split-config.json

# 3. Sub-agents report completion
maf workflow report TASK-001-A "API endpoints implemented" Developer
maf workflow report TASK-001-B "Tests passing" Tester

# 4. Collect results
maf workflow collect TASK-001
```

## API Usage

```javascript
const { MultiAgentFramework } = require('multi-agent-framework');

const framework = new MultiAgentFramework({
  rootDir: './my-project'
});

// Initialize project
framework.initProject({ preset: 'default' });

// Create task
const task = framework.createTask({
  title: 'New feature',
  priority: 'P1',
  assignee: 'Developer'
});

// Transfer task
framework.transferTask(task.id, 'Developer', 'Reviewer');

// Create message
framework.createMessage({
  type: 'NOTIFICATION',
  from: 'Coordinator',
  to: '*',
  subject: 'Sprint started'
});
```

## Extending the Framework

### Adding Custom Agents

1. Add to `maf.config.json`:
```json
{
  "agents": [
    {
      "name": "DevOps",
      "description": "Infrastructure and deployment",
      "responsibilities": ["CI/CD", "Infrastructure"],
      "outputs": ["Pipelines", "Configs"],
      "permissions": ["deploy", "configure"]
    }
  ]
}
```

2. Create `agents/DevOps.md` with detailed role definition.

### Custom Workflows

Modify the `workflows` section in `maf.config.json`:

```json
{
  "workflows": {
    "pending": { "next": "assigned", "notify": true, "notifyAgent": "assignee" },
    "assigned": { "next": "in-progress", "notify": false },
    "in-progress": { "next": "testing", "notify": true, "notifyAgent": "Tester" },
    "testing": { "next": "staging", "notify": true, "notifyAgent": "DevOps" },
    "staging": { "next": "production", "notify": true, "notifyAgent": "DevOps" },
    "production": { "next": null, "notify": true, "notifyAgent": "Coordinator" }
  }
}
```

## Use Cases

- **Software Development**: Full development lifecycle with specialized agents
- **Content Creation**: Writers, editors, reviewers working together
- **Research Projects**: Researchers, analysts, writers collaborating
- **Business Operations**: Strategy, operations, finance teams
- **Game Development**: Designers, artists, programmers, testers

## Contributing

Contributions are welcome! Please read our contributing guidelines.

## License

MIT License - see LICENSE file for details.
