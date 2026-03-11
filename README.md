# Multi-Agent Framework

A flexible, extensible framework for AI agent collaboration with intelligent task orchestration, session isolation, and a modern web dashboard.

[中文文档](./README_CN.md)

## Features

### Core Features
- **Dynamic Agent System**: Create agents dynamically based on task requirements with 10 built-in agent types
- **Session Isolation**: Each agent operates in isolated sessions to prevent memory pollution
- **Task Validation & Rejection**: Built-in task validation with rejection handling and automatic agent recreation
- **Clarification Mechanism**: Interactive clarification when user intent is unclear
- **Three-Tier Memory**: Short-term, long-term, and episodic memory for each agent

### Tool System
- **Built-in Tools**: File operations, code execution, HTTP requests, JSON processing, text manipulation, shell commands
- **Custom Tools**: Create and register custom tools with validation
- **Tool Management**: Enable/disable tools dynamically via CLI or Dashboard

### Skill System
- **Skill Templates**: Basic, Code, Analysis, Automation templates
- **Skill Registry**: Install, enable, disable skills
- **Custom Skills**: Create specialized skills for specific tasks

### Rule Engine
- **Rule Types**: Validation, Constraint, Trigger, Guard rules
- **Priority System**: Configurable rule priorities
- **Dynamic Rules**: Add/remove rules at runtime

### MCP Integration
- **Model Context Protocol**: Connect to external MCP servers
- **Tool Discovery**: Automatic tool discovery from MCP servers
- **Resource Access**: Access external resources through MCP

### Web Dashboard
- **Real-time Monitoring**: WebSocket-based real-time updates
- **Statistics Panel**: Sessions, agents, tasks, completions
- **Full Management**: Create, edit, delete agents, tasks, sessions, tools, skills, rules, MCP clients
- **Activity Log**: Real-time log with filtering (info/warning/error)
- **Bilingual Support**: English/Chinese i18n

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/Aretc/multi-agent-framework.git

# Navigate to the framework directory
cd multi-agent-framework

# Install dependencies
npm install

# Link globally (optional)
npm link
```

### Start Dashboard

```bash
# Start the web dashboard
cd web/api
node server.js

# Open http://localhost:3000 in your browser
```

### CLI Usage

```bash
# Initialize a new project
maf init default

# Ask the orchestrator
maf ask "Create a REST API for user management"

# Provide clarification
maf clarify "Users need authentication; Use JWT tokens"

# Check status
maf status

# Manage agents
maf agent list
maf agent create coder --name "API Developer"
maf agent templates

# Manage sessions
maf session list
maf session show <id>
maf session close <id>

# Manage tools
maf tool list
maf tool enable <name>
maf tool disable <name>

# Manage skills
maf skill list
maf skill install <name> --template code

# Manage rules
maf rule list
maf rule add <name> --type validation

# Manage MCP
maf mcp list
maf mcp connect <name> --command "npx @modelcontextprotocol/server-filesystem"
```

## Project Structure

```
multi-agent-framework/
├── cli/                    # CLI commands
│   └── index.js           # Main CLI entry
├── core/                   # Core framework
│   ├── index.js           # Main framework class
│   ├── orchestrator.js    # Task orchestration
│   ├── dynamic-agent.js   # Dynamic agent factory
│   ├── session.js         # Session management
│   ├── memory.js          # Three-tier memory
│   ├── tools.js           # Tool registry
│   ├── skills.js          # Skill system
│   ├── rules.js           # Rule engine
│   ├── mcp.js             # MCP integration
│   └── agent.js           # Agent runtime
├── web/
│   ├── api/               # REST API server
│   │   └── server.js      # Express server
│   └── dashboard/         # React dashboard
│       └── src/
│           └── index.js   # Dashboard UI
├── maf.config.json        # Configuration
└── package.json
```

## Configuration

### maf.config.json

```json
{
  "agents": [],
  "workflows": {},
  "memory": {
    "enabled": true,
    "shortTerm": { "maxSize": 100, "maxAge": 3600000 },
    "longTerm": { "maxSize": 10000 },
    "episodic": { "maxEvents": 1000, "retentionDays": 30 }
  },
  "llm": {
    "enabled": false,
    "provider": "mock",
    "model": "default",
    "temperature": 0.7,
    "maxTokens": 4096
  },
  "tools": {
    "enabled": true,
    "builtin": true,
    "custom": []
  },
  "skills": {
    "enabled": true
  },
  "rules": {
    "enabled": true
  },
  "mcp": {
    "enabled": true
  },
  "orchestrator": {
    "enabled": true,
    "maxRejectCount": 3,
    "maxTaskRetries": 3,
    "maxConcurrentAgents": 5
  }
}
```

## Agent Types

| Type | Description | Capabilities |
|------|-------------|--------------|
| **general** | General-purpose agent | reasoning, analysis, communication |
| **coder** | Code implementation | coding, debugging, testing, code_review |
| **researcher** | Research & analysis | research, analysis, summarization, fact_checking |
| **writer** | Content creation | writing, editing, formatting, translation |
| **analyzer** | Data analysis | analysis, visualization, reporting |
| **tester** | Quality assurance | testing, validation, bug_reporting |
| **reviewer** | Code review | code_review, feedback, suggestions |
| **designer** | UI/UX design | design, prototyping, user_experience |
| **planner** | Project planning | planning, scheduling, estimation |
| **coordinator** | Task coordination | coordination, communication, management |

## Built-in Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `file_read` | Read file content | `path`, `encoding` |
| `file_write` | Write to file | `path`, `content`, `encoding` |
| `file_list` | List directory | `path`, `recursive`, `pattern` |
| `file_delete` | Delete file/directory | `path`, `recursive` |
| `code_execute` | Execute JavaScript | `code`, `timeout` |
| `api_call` | HTTP request | `url`, `method`, `headers`, `body` |
| `json_parse` | Parse JSON | `string` |
| `json_stringify` | To JSON string | `object`, `pretty` |
| `text_process` | Text operations | `text`, `operation`, `options` |
| `shell_exec` | Shell command | `command`, `cwd`, `timeout` |

## API Reference

### System
```
GET  /api/system/stats          # System statistics
```

### Agents
```
GET  /api/agents                # List all agents
POST /api/agents                # Create agent
GET  /api/agents/templates      # List templates
GET  /api/agents/:id            # Get agent details
DELETE /api/agents/:id          # Delete agent
```

### Tasks
```
GET  /api/tasks/orchestrator    # List orchestrator tasks
POST /api/tasks/orchestrator    # Create task
POST /api/tasks/orchestrator/:id/cancel  # Cancel task
DELETE /api/tasks/orchestrator/:id       # Delete task
```

### Sessions
```
GET  /api/sessions              # List sessions
POST /api/sessions              # Create session
GET  /api/sessions/:id          # Get session
POST /api/sessions/:id/close    # Close session
DELETE /api/sessions/:id        # Delete session
```

### Tools
```
GET  /api/tools                 # List tools
POST /api/tools                 # Create tool
DELETE /api/tools/:name         # Delete tool
POST /api/tools/:name/execute   # Execute tool
POST /api/tools/:name/enable    # Enable tool
POST /api/tools/:name/disable   # Disable tool
GET  /api/tools/stats           # Tool statistics
```

### Skills
```
GET  /api/skills                # List skills
POST /api/skills/install        # Install skill
GET  /api/skills/:name          # Get skill
POST /api/skills/:name/enable   # Enable skill
POST /api/skills/:name/disable  # Disable skill
POST /api/skills/:name/execute  # Execute skill
DELETE /api/skills/:name        # Uninstall skill
```

### Rules
```
GET  /api/rules                 # List rules
POST /api/rules                 # Create rule
GET  /api/rules/:name           # Get rule
POST /api/rules/:name/enable    # Enable rule
POST /api/rules/:name/disable   # Disable rule
DELETE /api/rules/:name         # Delete rule
```

### MCP
```
GET  /api/mcp/clients           # List MCP clients
POST /api/mcp/clients           # Add MCP client
GET  /api/mcp/clients/:name     # Get client
POST /api/mcp/clients/:name/connect    # Connect client
POST /api/mcp/clients/:name/disconnect # Disconnect client
DELETE /api/mcp/clients/:name   # Delete client
GET  /api/mcp/tools             # List all MCP tools
```

### Orchestrator
```
GET  /api/orchestrator/status   # Get status
POST /api/orchestrator/ask      # Send instruction
POST /api/orchestrator/clarify  # Provide clarification
POST /api/orchestrator/pause    # Pause
POST /api/orchestrator/resume   # Resume
POST /api/orchestrator/cancel   # Cancel
```

## Use Cases

- **Software Development**: Full development lifecycle with specialized agents
- **Content Creation**: Writers, editors, reviewers working together
- **Research Projects**: Researchers, analysts, writers collaborating
- **Business Operations**: Strategy, operations, finance teams
- **Game Development**: Designers, artists, programmers, testers
- **Data Analysis**: Analysts, visualizers, reporters

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT License - see LICENSE file for details.
