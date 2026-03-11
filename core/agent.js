/**
 * Agent Runtime
 * 
 * Combines LLM, Memory, and Tools to create intelligent agents
 */

const { createLLMAdapter } = require('./llm/adapter');
const { AgentMemory } = require('./memory');
const { ToolManager, BUILTIN_TOOLS } = require('./tools');

const DEFAULT_AGENT_CONFIG = {
  llm: {
    provider: 'mock',
    model: 'default'
  },
  memory: {
    enabled: true,
    shortTerm: { maxSize: 100 },
    longTerm: { maxSize: 1000 },
    episodic: { maxEvents: 500 }
  },
  tools: {
    enabled: true,
    builtin: true
  },
  behavior: {
    maxIterations: 10,
    timeout: 60000
  }
};

class AgentRuntime {
  constructor(config) {
    config = config || {};
    this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
    
    this.name = config.name || 'Agent';
    this.role = config.role || 'assistant';
    this.description = config.description || '';
    
    // Initialize LLM
    this.llm = createLLMAdapter(this.config.llm);
    
    // Initialize Memory
    if (this.config.memory.enabled) {
      this.memory = new AgentMemory(this.name, {
        rootPath: this.config.memory.rootPath || './.maf/memory',
        config: this.config.memory
      });
    }
    
    // Initialize Tools
    if (this.config.tools.enabled) {
      this.toolManager = new ToolManager();
      
      // Register built-in tools
      if (this.config.tools.builtin) {
        for (const [name, tool] of Object.entries(BUILTIN_TOOLS)) {
          try {
            this.toolManager.registerTool(tool);
          } catch (e) {
            // Tool already registered
          }
        }
      }
      
      // Register custom tools by name or definition
      if (this.config.tools.custom) {
        this.config.tools.custom.forEach(function(tool) {
          if (typeof tool === 'string' && BUILTIN_TOOLS[tool]) {
            // Tool is a name reference to built-in tool
            try {
              this.toolManager.registerTool(BUILTIN_TOOLS[tool]);
            } catch (e) {
              // Tool already registered
            }
          } else if (typeof tool === 'object' && tool.name) {
            // Tool is a definition object
            try {
              this.toolManager.registerTool(tool);
            } catch (e) {
              // Tool already registered
            }
          }
        }.bind(this));
      }
    }
    
    // State
    this.state = 'idle';
    this.currentTask = null;
    this.history = [];
  }

  async init() {
    if (this.memory) {
      await this.memory.init();
    }
    return this;
  }

  async think(context) {
    this.state = 'thinking';
    
    const messages = this.buildMessages(context);
    
    try {
      const response = await this.llm.chat(messages);
      
      // Record thinking event
      if (this.memory) {
        await this.memory.recordEvent({
          type: 'thinking',
          action: 'LLM inference',
          details: { inputTokens: response.usage?.input_tokens, outputTokens: response.usage?.output_tokens }
        });
      }
      
      return this.parseResponse(response);
    } catch (e) {
      this.state = 'error';
      throw e;
    }
  }

  async act(decision) {
    this.state = 'acting';
    
    if (decision.toolCall) {
      return await this.executeTool(decision.toolCall.name, decision.toolCall.params);
    }
    
    if (decision.action) {
      return await this.executeAction(decision.action);
    }
    
    return { type: 'message', content: decision.content };
  }

  async observe(result) {
    this.state = 'observing';
    
    if (this.memory) {
      await this.memory.recordEvent({
        type: 'observation',
        action: 'Action result',
        details: { result: JSON.stringify(result).substring(0, 200) }
      });
    }
    
    return result;
  }

  async run(input, context) {
    context = context || {};
    this.state = 'running';
    this.currentTask = input;
    
    const maxIterations = this.config.behavior.maxIterations;
    let iteration = 0;
    let currentContext = { ...context, input: input };
    let done = false;
    let finalResult = null;

    while (!done && iteration < maxIterations) {
      iteration++;
      
      // Think
      const thought = await this.think(currentContext);
      this.history.push({ type: 'thought', data: thought, iteration: iteration });
      
      // Check if done
      if (thought.done || thought.type === 'final') {
        done = true;
        finalResult = thought;
        break;
      }
      
      // Act
      const actionResult = await this.act(thought);
      this.history.push({ type: 'action', data: actionResult, iteration: iteration });
      
      // Observe
      const observation = await this.observe(actionResult);
      this.history.push({ type: 'observation', data: observation, iteration: iteration });
      
      // Update context
      currentContext.lastThought = thought;
      currentContext.lastAction = actionResult;
      currentContext.lastObservation = observation;
      
      // Check for completion
      if (observation.type === 'final' || observation.done) {
        done = true;
        finalResult = observation;
      }
    }
    
    this.state = 'completed';
    this.currentTask = null;
    
    return {
      result: finalResult,
      iterations: iteration,
      history: this.history.slice(-iteration * 3)
    };
  }

  buildMessages(context) {
    const messages = [];
    
    // System message
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(context)
    });
    
    // Memory context
    if (this.memory) {
      const recentMemory = this.memory.recall(10);
      recentMemory.forEach(function(item) {
        messages.push({
          role: 'user',
          content: '[Memory] ' + item.content
        });
      });
    }
    
    // Current input
    if (context.input) {
      messages.push({
        role: 'user',
        content: context.input
      });
    }
    
    // Conversation history
    if (context.history) {
      context.history.forEach(function(msg) {
        messages.push(msg);
      });
    }
    
    return messages;
  }

  buildSystemPrompt(context) {
    let prompt = 'You are ' + this.name;
    if (this.role) prompt += ', a ' + this.role;
    if (this.description) prompt += '. ' + this.description;
    
    // Add available tools
    if (this.toolManager) {
      const tools = this.toolManager.listTools();
      if (tools.length > 0) {
        prompt += '\n\nAvailable tools:\n';
        tools.forEach(function(tool) {
          prompt += '- ' + tool.name + ': ' + tool.description + '\n';
        });
        prompt += '\nTo use a tool, respond with: {"toolCall": {"name": "tool_name", "params": {...}}}';
      }
    }
    
    // Add context
    if (context.systemPrompt) {
      prompt += '\n\n' + context.systemPrompt;
    }
    
    return prompt;
  }

  parseResponse(response) {
    const content = response.content || '';
    
    // Try to parse as JSON (tool call)
    try {
      const parsed = JSON.parse(content);
      if (parsed.toolCall) {
        return {
          type: 'tool_call',
          toolCall: parsed.toolCall,
          content: content
        };
      }
      if (parsed.action) {
        return {
          type: 'action',
          action: parsed.action,
          content: content
        };
      }
      if (parsed.done) {
        return {
          type: 'final',
          content: parsed.content || parsed.result || content,
          done: true
        };
      }
    } catch (e) {
      // Not JSON, treat as text response
    }
    
    return {
      type: 'text',
      content: content
    };
  }

  async executeTool(name, params) {
    if (!this.toolManager) {
      return { error: 'Tools not enabled', type: 'error' };
    }
    
    const result = await this.toolManager.executeTool(name, params);
    
    if (this.memory) {
      await this.memory.recordEvent({
        type: 'tool_execution',
        action: 'Executed tool: ' + name,
        details: { params: params, result: JSON.stringify(result).substring(0, 200) }
      });
    }
    
    return {
      type: 'tool_result',
      tool: name,
      result: result
    };
  }

  async executeAction(action) {
    switch (action.type) {
      case 'remember':
        if (this.memory) {
          await this.memory.remember(action.content, action.metadata);
          return { type: 'success', message: 'Remembered' };
        }
        return { type: 'error', message: 'Memory not enabled' };
        
      case 'memorize':
        if (this.memory) {
          await this.memory.memorize(action.content, action.metadata);
          return { type: 'success', message: 'Memorized' };
        }
        return { type: 'error', message: 'Memory not enabled' };
        
      case 'recall':
        if (this.memory) {
          const results = await this.memory.retrieve(action.query, action.options);
          return { type: 'recall_result', results: results };
        }
        return { type: 'error', message: 'Memory not enabled' };
        
      case 'respond':
        return { type: 'final', content: action.content, done: true };
        
      default:
        return { type: 'error', message: 'Unknown action: ' + action.type };
    }
  }

  async remember(content, metadata) {
    if (!this.memory) return null;
    await this.memory.init();
    return this.memory.remember(content, metadata);
  }

  async memorize(content, metadata) {
    if (!this.memory) return null;
    await this.memory.init();
    return this.memory.memorize(content, metadata);
  }

  async recall(query, options) {
    if (!this.memory) return null;
    await this.memory.init();
    if (query) {
      return this.memory.retrieve(query, options);
    }
    return this.memory.recall(options && options.limit);
  }

  getState() {
    return {
      name: this.name,
      role: this.role,
      state: this.state,
      currentTask: this.currentTask,
      historyLength: this.history.length,
      memoryStats: this.memory ? this.memory.getStats() : null
    };
  }

  reset() {
    this.state = 'idle';
    this.currentTask = null;
    this.history = [];
  }
}

// Agent Factory
function createAgent(config) {
  const runtime = new AgentRuntime(config);
  return runtime;
}

module.exports = {
  AgentRuntime,
  createAgent,
  DEFAULT_AGENT_CONFIG
};
