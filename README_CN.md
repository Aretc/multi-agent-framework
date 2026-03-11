# MeowTea 🐱🍵

一个灵活、可扩展的 AI 智能体协作框架，具有智能任务编排、会话隔离和现代化 Web 控制面板。

[English](./README.md)

## 功能特性

### 核心功能
- **动态智能体系统**：根据任务需求动态创建智能体，内置 10 种智能体类型
- **会话隔离**：每个智能体在独立会话中运行，防止记忆污染
- **任务验证与打回**：内置任务验证机制，支持打回处理和自动智能体重建
- **澄清机制**：当用户意图不明确时，主动提问澄清
- **三层记忆系统**：短期记忆、长期记忆、情景记忆

### 工具系统
- **内置工具**：文件操作、代码执行、HTTP 请求、JSON 处理、文本处理、Shell 命令
- **自定义工具**：创建并注册带有验证的自定义工具
- **工具管理**：通过 CLI 或 Dashboard 动态启用/禁用工具

### 技能系统
- **技能模板**：Basic、Code、Analysis、Automation 模板
- **技能注册表**：安装、启用、禁用技能
- **自定义技能**：为特定任务创建专门的技能

### 规则引擎
- **规则类型**：Validation、Constraint、Trigger、Guard 规则
- **优先级系统**：可配置的规则优先级
- **动态规则**：运行时添加/删除规则

### MCP 集成
- **Model Context Protocol**：连接外部 MCP 服务器
- **工具发现**：自动发现 MCP 服务器的工具
- **资源访问**：通过 MCP 访问外部资源

### Web 控制面板
- **实时监控**：基于 WebSocket 的实时更新
- **统计面板**：会话数、智能体数、任务数、完成数
- **完整管理**：创建、编辑、删除智能体、任务、会话、工具、技能、规则、MCP 客户端
- **活动日志**：实时日志 + 筛选功能 (info/warning/error)
- **双语支持**：中英文 i18n 国际化

## 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/Aretc/multi-agent-framework.git

# 进入框架目录
cd multi-agent-framework

# 安装依赖
npm install

# 全局链接（可选）
npm link
```

### 启动控制面板

```bash
# 启动 Web 控制面板（全局安装后可在任意目录运行）
meowtea web

# 或指定端口
meowtea web --port=8080

# 在浏览器中打开 http://localhost:3000
```

### CLI 使用

```bash
# 初始化新项目
meowtea init default

# 向编排器发送指令
meowtea ask "创建用户管理的 REST API"

# 提供澄清信息
meowtea clarify "用户需要认证；使用 JWT 令牌"

# 查看状态
meowtea status

# 管理智能体
meowtea agent list
meowtea agent create coder --name "API 开发者"
meowtea agent templates

# 管理会话
meowtea session list
meowtea session show <id>
meowtea session close <id>

# 管理工具
meowtea tool list
meowtea tool enable <name>
meowtea tool disable <name>

# 管理技能
meowtea skill list
meowtea skill install <name> --template code

# 管理规则
meowtea rule list
meowtea rule add <name> --type validation

# 管理 MCP
meowtea mcp list
meowtea mcp connect <name> --command "npx @modelcontextprotocol/server-filesystem"
```

## 项目结构

```
meowtea/
├── cli/                    # CLI 命令
│   └── index.js           # CLI 入口
├── core/                   # 核心框架
│   ├── index.js           # 主框架类
│   ├── orchestrator.js    # 任务编排
│   ├── dynamic-agent.js   # 动态智能体工厂
│   ├── session.js         # 会话管理
│   ├── memory.js          # 三层记忆
│   ├── tools.js           # 工具注册表
│   ├── skills.js          # 技能系统
│   ├── rules.js           # 规则引擎
│   ├── mcp.js             # MCP 集成
│   └── agent.js           # 智能体运行时
├── web/
│   ├── api/               # REST API 服务器
│   │   └── server.js      # Express 服务器
│   └── dashboard/         # React 控制面板
│       └── src/
│           └── index.js   # Dashboard UI
├── meowtea.config.json    # 配置文件
└── package.json
```

## 配置

### meowtea.config.json

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

## 智能体类型

| 类型 | 描述 | 能力 |
|------|------|------|
| **general** | 通用智能体 | reasoning, analysis, communication |
| **coder** | 代码实现 | coding, debugging, testing, code_review |
| **researcher** | 研究分析 | research, analysis, summarization, fact_checking |
| **writer** | 内容创作 | writing, editing, formatting, translation |
| **analyzer** | 数据分析 | analysis, visualization, reporting |
| **tester** | 质量保证 | testing, validation, bug_reporting |
| **reviewer** | 代码审查 | code_review, feedback, suggestions |
| **designer** | UI/UX 设计 | design, prototyping, user_experience |
| **planner** | 项目规划 | planning, scheduling, estimation |
| **coordinator** | 任务协调 | coordination, communication, management |

## 内置工具

| 工具 | 描述 | 参数 |
|------|------|------|
| `file_read` | 读取文件内容 | `path`, `encoding` |
| `file_write` | 写入文件 | `path`, `content`, `encoding` |
| `file_list` | 列出目录 | `path`, `recursive`, `pattern` |
| `file_delete` | 删除文件/目录 | `path`, `recursive` |
| `code_execute` | 执行 JavaScript | `code`, `timeout` |
| `api_call` | HTTP 请求 | `url`, `method`, `headers`, `body` |
| `json_parse` | 解析 JSON | `string` |
| `json_stringify` | 转为 JSON 字符串 | `object`, `pretty` |
| `text_process` | 文本操作 | `text`, `operation`, `options` |
| `shell_exec` | Shell 命令 | `command`, `cwd`, `timeout` |

## API 参考

### 系统
```
GET  /api/system/stats          # 系统统计
```

### 智能体
```
GET  /api/agents                # 列出所有智能体
POST /api/agents                # 创建智能体
GET  /api/agents/templates      # 列出模板
GET  /api/agents/:id            # 获取智能体详情
DELETE /api/agents/:id          # 删除智能体
```

### 任务
```
GET  /api/tasks/orchestrator    # 列出编排器任务
POST /api/tasks/orchestrator    # 创建任务
POST /api/tasks/orchestrator/:id/cancel  # 取消任务
DELETE /api/tasks/orchestrator/:id       # 删除任务
```

### 会话
```
GET  /api/sessions              # 列出会话
POST /api/sessions              # 创建会话
GET  /api/sessions/:id          # 获取会话
POST /api/sessions/:id/close    # 关闭会话
DELETE /api/sessions/:id        # 删除会话
```

### 工具
```
GET  /api/tools                 # 列出工具
POST /api/tools                 # 创建工具
DELETE /api/tools/:name         # 删除工具
POST /api/tools/:name/execute   # 执行工具
POST /api/tools/:name/enable    # 启用工具
POST /api/tools/:name/disable   # 禁用工具
GET  /api/tools/stats           # 工具统计
```

### 技能
```
GET  /api/skills                # 列出技能
POST /api/skills/install        # 安装技能
GET  /api/skills/:name          # 获取技能
POST /api/skills/:name/enable   # 启用技能
POST /api/skills/:name/disable  # 禁用技能
POST /api/skills/:name/execute  # 执行技能
DELETE /api/skills/:name        # 卸载技能
```

### 规则
```
GET  /api/rules                 # 列出规则
POST /api/rules                 # 创建规则
GET  /api/rules/:name           # 获取规则
POST /api/rules/:name/enable    # 启用规则
POST /api/rules/:name/disable   # 禁用规则
DELETE /api/rules/:name         # 删除规则
```

### MCP
```
GET  /api/mcp/clients           # 列出 MCP 客户端
POST /api/mcp/clients           # 添加 MCP 客户端
GET  /api/mcp/clients/:name     # 获取客户端
POST /api/mcp/clients/:name/connect    # 连接客户端
POST /api/mcp/clients/:name/disconnect # 断开客户端
DELETE /api/mcp/clients/:name   # 删除客户端
GET  /api/mcp/tools             # 列出所有 MCP 工具
```

### 编排器
```
GET  /api/orchestrator/status   # 获取状态
POST /api/orchestrator/ask      # 发送指令
POST /api/orchestrator/clarify  # 提供澄清
POST /api/orchestrator/pause    # 暂停
POST /api/orchestrator/resume   # 恢复
POST /api/orchestrator/cancel   # 取消
```

## 使用场景

- **软件开发**：专业智能体协作完成完整开发周期
- **内容创作**：作者、编辑、审稿人协作
- **研究项目**：研究员、分析师、作者协作
- **业务运营**：策略、运营、财务团队协作
- **游戏开发**：设计师、美术、程序员、测试协作
- **数据分析**：分析师、可视化、报告生成协作

## 贡献

欢迎贡献！请随时提交问题和拉取请求。

## 许可证

MIT 许可证 - 详情见 LICENSE 文件。
