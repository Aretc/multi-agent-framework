/**
 * Dynamic Agent Factory for Multi-Agent Framework
 * 
 * Creates agents dynamically based on task requirements.
 * Each agent is created with a unique session to prevent memory pollution.
 */

const { AgentRuntime } = require('./agent');
const { AgentMemory } = require('./memory');
const { createLLMAdapter } = require('./llm/adapter');
const { ToolManager } = require('./tools');
const { Session } = require('./session');

const AGENT_TYPES = {
  GENERAL: 'general',
  CODER: 'coder',
  RESEARCHER: 'researcher',
  WRITER: 'writer',
  ANALYZER: 'analyzer',
  TESTER: 'tester',
  REVIEWER: 'reviewer',
  DESIGNER: 'designer',
  PLANNER: 'planner',
  COORDINATOR: 'coordinator'
};

const AGENT_TEMPLATES = {
  general: {
    name: 'GeneralAgent',
    description: 'A general-purpose agent that can handle various tasks',
    capabilities: ['reasoning', 'analysis', 'communication'],
    defaultTools: ['file_read', 'file_write', 'json_parse', 'json_stringify']
  },
  coder: {
    name: 'CoderAgent',
    description: 'Specialized in writing, debugging, and refactoring code',
    capabilities: ['coding', 'debugging', 'testing', 'code_review'],
    defaultTools: ['file_read', 'file_write', 'shell_execute', 'text_search', 'text_replace']
  },
  researcher: {
    name: 'ResearcherAgent',
    description: 'Specialized in research, analysis, and information gathering',
    capabilities: ['research', 'analysis', 'summarization', 'fact_checking'],
    defaultTools: ['file_read', 'http_request', 'json_parse', 'text_search']
  },
  writer: {
    name: 'WriterAgent',
    description: 'Specialized in writing documentation, articles, and content',
    capabilities: ['writing', 'editing', 'formatting', 'translation'],
    defaultTools: ['file_read', 'file_write', 'text_search', 'text_replace']
  },
  analyzer: {
    name: 'AnalyzerAgent',
    description: 'Specialized in data analysis and reporting',
    capabilities: ['data_analysis', 'visualization', 'reporting', 'statistics'],
    defaultTools: ['file_read', 'json_parse', 'json_stringify', 'text_search']
  },
  tester: {
    name: 'TesterAgent',
    description: 'Specialized in testing and quality assurance',
    capabilities: ['test_design', 'test_execution', 'bug_reporting', 'quality_metrics'],
    defaultTools: ['file_read', 'file_write', 'shell_execute', 'json_parse']
  },
  reviewer: {
    name: 'ReviewerAgent',
    description: 'Specialized in code review and quality control',
    capabilities: ['code_review', 'standards_checking', 'best_practices', 'security_audit'],
    defaultTools: ['file_read', 'text_search', 'json_parse', 'json_stringify']
  },
  designer: {
    name: 'DesignerAgent',
    description: 'Specialized in UI/UX design and architecture',
    capabilities: ['ui_design', 'ux_research', 'prototyping', 'design_systems'],
    defaultTools: ['file_read', 'file_write', 'json_parse', 'text_search']
  },
  planner: {
    name: 'PlannerAgent',
    description: 'Specialized in planning and task decomposition',
    capabilities: ['planning', 'task_decomposition', 'scheduling', 'resource_allocation'],
    defaultTools: ['file_read', 'file_write', 'json_parse', 'json_stringify']
  },
  coordinator: {
    name: 'CoordinatorAgent',
    description: 'Specialized in coordinating multiple agents and tasks',
    capabilities: ['coordination', 'task_assignment', 'progress_tracking', 'conflict_resolution'],
    defaultTools: ['file_read', 'file_write', 'json_parse', 'json_stringify']
  }
};

const DEFAULT_AGENT_CONFIG = {
  maxIterations: 15,
  timeout: 120000,
  memory: {
    enabled: true,
    shortTerm: { maxSize: 50, maxAge: 1800000 },
    longTerm: { maxSize: 2000 },
    episodic: { maxEvents: 200, retentionDays: 7 }
  }
};

class DynamicAgent {
  constructor(config) {
    config = config || {};
    this.id = config.id || this._generateId();
    this.name = config.name || 'DynamicAgent';
    this.type = config.type || AGENT_TYPES.GENERAL;
    this.description = config.description || '';
    this.capabilities = config.capabilities || [];
    this.tools = config.tools || [];
    this.llm = config.llm || null;
    this.memory = config.memory || null;
    this.session = config.session || null;
    this.runtime = config.runtime || null;
    this.createdAt = new Date().toISOString();
    this.taskCount = 0;
    this.rejectCount = 0;
    this.status = 'idle';
  }

  _generateId() {
    return 'agent_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  async initialize(options) {
    options = options || {};
    
    if (!this.memory && options.memory !== false) {
      const memoryPath = options.memoryPath || './.maf/agents/' + this.id;
      this.memory = new AgentMemory(this.id, {
        rootPath: memoryPath,
        config: DEFAULT_AGENT_CONFIG.memory
      });
      await this.memory.init();
    }
    
    if (!this.llm && options.llm) {
      this.llm = createLLMAdapter(options.llm);
    }
    
    if (!this.runtime) {
      const runtimeConfig = {
        name: this.name,
        role: this.description,
        description: this.description,
        llm: options.llm || { provider: 'mock' },
        memory: {
          enabled: !!this.memory,
          rootPath: options.memoryPath || './.maf/agents/' + this.id,
          ...DEFAULT_AGENT_CONFIG.memory
        },
        tools: {
          enabled: true,
          builtin: true,
          custom: this.tools
        },
        behavior: {
          maxIterations: DEFAULT_AGENT_CONFIG.maxIterations,
          timeout: DEFAULT_AGENT_CONFIG.timeout
        }
      };
      
      this.runtime = new AgentRuntime(runtimeConfig);
      await this.runtime.init();
    }
    
    this.status = 'ready';
    return this;
  }

  async execute(task, context) {
    context = context || {};
    this.status = 'busy';
    this.taskCount++;
    
    const startTime = Date.now();
    
    try {
      const input = this._buildTaskInput(task, context);
      
      const result = await this.runtime.run(input, {
        systemPrompt: this._buildSystemPrompt(task),
        ...context
      });
      
      const executionTime = Date.now() - startTime;
      
      if (this.memory) {
        await this.memory.recordEvent({
          type: 'task_execution',
          action: 'Executed task: ' + (task.title || task.id || 'unknown'),
          details: {
            taskId: task.id,
            executionTime: executionTime,
            success: !result.error
          }
        });
      }
      
      this.status = 'idle';
      
      return {
        success: !result.error,
        result: result.result || result,
        executionTime: executionTime,
        iterations: result.iterations,
        agentId: this.id,
        agentName: this.name
      };
    } catch (e) {
      this.status = 'error';
      
      if (this.memory) {
        await this.memory.recordEvent({
          type: 'task_error',
          action: 'Task execution failed',
          details: {
            taskId: task.id,
            error: e.message
          }
        });
      }
      
      return {
        success: false,
        error: e.message,
        agentId: this.id,
        agentName: this.name
      };
    }
  }

  _buildTaskInput(task, context) {
    let input = '';
    
    if (task.title) {
      input += 'Task: ' + task.title + '\n\n';
    }
    
    if (task.description) {
      input += 'Description: ' + task.description + '\n\n';
    }
    
    if (task.requirements && task.requirements.length > 0) {
      input += 'Requirements:\n';
      task.requirements.forEach(function(req, i) {
        input += (i + 1) + '. ' + req + '\n';
      });
      input += '\n';
    }
    
    if (task.context) {
      input += 'Context: ' + task.context + '\n\n';
    }
    
    if (context.previousResults && context.previousResults.length > 0) {
      input += 'Previous Results:\n';
      context.previousResults.forEach(function(r, i) {
        input += (i + 1) + '. ' + r.summary + '\n';
      });
      input += '\n';
    }
    
    if (task.expectedOutput) {
      input += 'Expected Output: ' + task.expectedOutput + '\n';
    }
    
    return input || JSON.stringify(task);
  }

  _buildSystemPrompt(task) {
    let prompt = 'You are ' + this.name;
    
    if (this.description) {
      prompt += ', ' + this.description;
    }
    
    if (this.capabilities.length > 0) {
      prompt += '\n\nYour capabilities include: ' + this.capabilities.join(', ') + '.';
    }
    
    if (task.constraints && task.constraints.length > 0) {
      prompt += '\n\nConstraints:\n';
      task.constraints.forEach(function(c) {
        prompt += '- ' + c + '\n';
      });
    }
    
    prompt += '\n\nComplete the task to the best of your ability. If you need clarification, respond with a JSON object: {"needsClarification": true, "questions": ["question1", "question2"]}';
    
    return prompt;
  }

  incrementRejectCount() {
    this.rejectCount++;
    return this;
  }

  resetRejectCount() {
    this.rejectCount = 0;
    return this;
  }

  getStats() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.status,
      taskCount: this.taskCount,
      rejectCount: this.rejectCount,
      createdAt: this.createdAt,
      memoryStats: this.memory ? this.memory.getStats() : null
    };
  }

  async clearMemory() {
    if (this.memory) {
      await this.memory.clear();
    }
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      description: this.description,
      capabilities: this.capabilities,
      tools: this.tools,
      createdAt: this.createdAt,
      taskCount: this.taskCount,
      rejectCount: this.rejectCount,
      status: this.status
    };
  }

  static fromJSON(data) {
    return new DynamicAgent({
      id: data.id,
      name: data.name,
      type: data.type,
      description: data.description,
      capabilities: data.capabilities,
      tools: data.tools,
      createdAt: data.createdAt,
      taskCount: data.taskCount,
      rejectCount: data.rejectCount,
      status: data.status
    });
  }
}

class DynamicAgentFactory {
  constructor(options) {
    options = options || {};
    this.llmConfig = options.llm || { provider: 'mock' };
    this.memoryRootPath = options.memoryRootPath || './.maf/agents';
    this.agents = new Map();
    this.agentCounter = 0;
  }

  async createAgent(options) {
    options = options || {};
    
    const template = AGENT_TEMPLATES[options.type] || AGENT_TEMPLATES.general;
    
    const agentConfig = {
      id: options.id || this._generateAgentId(options.type || 'general'),
      name: options.name || template.name + '_' + (++this.agentCounter),
      type: options.type || AGENT_TYPES.GENERAL,
      description: options.description || template.description,
      capabilities: options.capabilities || template.capabilities,
      tools: options.tools || template.defaultTools
    };
    
    const agent = new DynamicAgent(agentConfig);
    
    await agent.initialize({
      llm: { ...this.llmConfig, ...options.llm },
      memoryPath: path.join(this.memoryRootPath, agent.id),
      memory: options.memory !== false
    });
    
    this.agents.set(agent.id, agent);
    
    return agent;
  }

  _generateAgentId(type) {
    return type + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }

  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  async createAgentForTask(task) {
    const agentType = this._determineAgentType(task);
    
    const agent = await this.createAgent({
      type: agentType,
      name: task.suggestedAgentName || null,
      description: task.agentDescription || null,
      capabilities: task.requiredCapabilities || null
    });
    
    return agent;
  }

  _determineAgentType(task) {
    const taskLower = (task.title + ' ' + (task.description || '')).toLowerCase();
    
    const typeKeywords = {
      coder: ['code', 'implement', 'develop', 'program', 'debug', 'refactor', 'fix bug', 'write function'],
      researcher: ['research', 'investigate', 'analyze', 'study', 'find information', 'gather data'],
      writer: ['write', 'document', 'article', 'blog', 'content', 'documentation', 'readme'],
      analyzer: ['analyze', 'data analysis', 'statistics', 'metrics', 'report', 'dashboard'],
      tester: ['test', 'testing', 'qa', 'quality', 'test case', 'unit test', 'integration test'],
      reviewer: ['review', 'code review', 'audit', 'check', 'verify', 'validate'],
      designer: ['design', 'ui', 'ux', 'interface', 'prototype', 'wireframe', 'style'],
      planner: ['plan', 'schedule', 'roadmap', 'strategy', 'timeline', 'milestone'],
      coordinator: ['coordinate', 'manage', 'organize', 'assign', 'track', 'oversee']
    };
    
    for (const type in typeKeywords) {
      const keywords = typeKeywords[type];
      for (let i = 0; i < keywords.length; i++) {
        if (taskLower.includes(keywords[i])) {
          return type;
        }
      }
    }
    
    return AGENT_TYPES.GENERAL;
  }

  listAgents() {
    return Array.from(this.agents.values()).map(function(agent) {
      return agent.getStats();
    });
  }

  async removeAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      await agent.clearMemory();
      this.agents.delete(agentId);
      return true;
    }
    return false;
  }

  async clearAllAgents() {
    const promises = [];
    this.agents.forEach(function(agent) {
      promises.push(agent.clearMemory());
    });
    await Promise.all(promises);
    this.agents.clear();
    this.agentCounter = 0;
  }

  getTemplate(type) {
    return AGENT_TEMPLATES[type] || AGENT_TEMPLATES.general;
  }

  listTemplates() {
    return Object.keys(AGENT_TEMPLATES).map(function(key) {
      return {
        type: key,
        ...AGENT_TEMPLATES[key]
      };
    });
  }
}

const path = require('path');

module.exports = {
  DynamicAgent,
  DynamicAgentFactory,
  AGENT_TYPES,
  AGENT_TEMPLATES,
  DEFAULT_AGENT_CONFIG
};
