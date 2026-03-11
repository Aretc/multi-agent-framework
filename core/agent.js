/**
 * Enhanced Agent Runtime
 * 
 * Features:
 * - ReAct Loop (Reasoning + Acting)
 * - Chain-of-Thought (CoT) Reasoning
 * - Multi-turn Conversation Management
 * - Context Compression
 * - Streaming Support
 */

const { createLLMAdapter } = require('./llm/adapter');
const { AgentMemory } = require('./memory');
const { ToolManager, BUILTIN_TOOLS } = require('./tools');
const { createPromptManager, PROMPT_CATEGORIES } = require('./prompts');
const { EventEmitter } = require('events');

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
    timeout: 60000,
    enableCoT: true,
    enableCompression: true,
    compressionThreshold: 4000
  }
};

const AGENT_STATES = {
  IDLE: 'idle',
  THINKING: 'thinking',
  ACTING: 'acting',
  OBSERVING: 'observing',
  STREAMING: 'streaming',
  COMPLETED: 'completed',
  ERROR: 'error'
};

class AgentRuntime extends EventEmitter {
  constructor(config) {
    super();
    config = config || {};
    this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
    
    this.name = config.name || 'Agent';
    this.role = config.role || 'assistant';
    this.description = config.description || '';
    
    this.llm = createLLMAdapter(this.config.llm);
    
    if (this.config.memory.enabled) {
      this.memory = new AgentMemory(this.name, {
        rootPath: this.config.memory.rootPath || './.maf/memory',
        config: this.config.memory
      });
    }
    
    if (this.config.tools.enabled) {
      this.toolManager = new ToolManager();
      
      if (this.config.tools.builtin) {
        for (const [name, tool] of Object.entries(BUILTIN_TOOLS)) {
          try {
            this.toolManager.registerTool(tool);
          } catch (e) {}
        }
      }
      
      if (this.config.tools.custom) {
        this.config.tools.custom.forEach(function(tool) {
          if (typeof tool === 'string' && BUILTIN_TOOLS[tool]) {
            try {
              this.toolManager.registerTool(BUILTIN_TOOLS[tool]);
            } catch (e) {}
          } else if (typeof tool === 'object' && tool.name) {
            try {
              this.toolManager.registerTool(tool);
            } catch (e) {}
          }
        }.bind(this));
      }
    }
    
    this.promptManager = createPromptManager(this.config.prompts || {});
    
    this.state = AGENT_STATES.IDLE;
    this.currentTask = null;
    this.history = [];
    this.conversationHistory = [];
    this.thoughtChain = [];
  }

  async init() {
    if (this.memory) {
      await this.memory.init();
    }
    return this;
  }

  async think(context) {
    this.state = AGENT_STATES.THINKING;
    this.emit('stateChange', { state: AGENT_STATES.THINKING, context: context });
    
    const messages = this.buildMessages(context);
    
    try {
      const response = await this.llm.chat(messages);
      
      if (this.memory) {
        await this.memory.recordEvent({
          type: 'thinking',
          action: 'LLM inference',
          details: { 
            inputTokens: response.usage?.input_tokens, 
            outputTokens: response.usage?.output_tokens 
          }
        });
      }
      
      const thought = this.parseResponse(response);
      
      if (this.config.behavior.enableCoT && thought.reasoning) {
        this.thoughtChain.push({
          step: this.thoughtChain.length + 1,
          reasoning: thought.reasoning,
          conclusion: thought.conclusion || thought.content,
          timestamp: Date.now()
        });
      }
      
      this.emit('thought', { thought: thought, context: context });
      return thought;
    } catch (e) {
      this.state = AGENT_STATES.ERROR;
      this.emit('error', { error: e, phase: 'think' });
      throw e;
    }
  }

  async thinkStream(context, onChunk) {
    this.state = AGENT_STATES.STREAMING;
    this.emit('stateChange', { state: AGENT_STATES.STREAMING, context: context });
    
    const messages = this.buildMessages(context);
    let fullContent = '';
    
    try {
      const response = await this.llm.stream(messages, function(chunk, accumulated) {
        fullContent = accumulated;
        if (onChunk) onChunk(chunk, accumulated);
        this.emit('chunk', { chunk: chunk, accumulated: accumulated });
      }.bind(this));
      
      const thought = this.parseResponse(response);
      
      if (this.config.behavior.enableCoT && thought.reasoning) {
        this.thoughtChain.push({
          step: this.thoughtChain.length + 1,
          reasoning: thought.reasoning,
          conclusion: thought.conclusion || thought.content,
          timestamp: Date.now()
        });
      }
      
      this.emit('thought', { thought: thought, context: context });
      return thought;
    } catch (e) {
      this.state = AGENT_STATES.ERROR;
      this.emit('error', { error: e, phase: 'thinkStream' });
      throw e;
    }
  }

  async act(decision) {
    this.state = AGENT_STATES.ACTING;
    this.emit('stateChange', { state: AGENT_STATES.ACTING, decision: decision });
    
    if (decision.toolCall) {
      const result = await this.executeTool(decision.toolCall.name, decision.toolCall.params);
      this.emit('action', { type: 'tool', name: decision.toolCall.name, result: result });
      return result;
    }
    
    if (decision.action) {
      const result = await this.executeAction(decision.action);
      this.emit('action', { type: 'action', action: decision.action, result: result });
      return result;
    }
    
    return { type: 'message', content: decision.content };
  }

  async observe(result) {
    this.state = AGENT_STATES.OBSERVING;
    this.emit('stateChange', { state: AGENT_STATES.OBSERVING, result: result });
    
    if (this.memory) {
      await this.memory.recordEvent({
        type: 'observation',
        action: 'Action result',
        details: { result: JSON.stringify(result).substring(0, 200) }
      });
    }
    
    this.emit('observation', { result: result });
    return result;
  }

  async run(input, context) {
    context = context || {};
    this.state = AGENT_STATES.IDLE;
    this.currentTask = input;
    this.history = [];
    this.thoughtChain = [];
    
    const maxIterations = this.config.behavior.maxIterations;
    let iteration = 0;
    let currentContext = { ...context, input: input };
    let done = false;
    let finalResult = null;

    this.emit('runStart', { input: input, context: context });

    while (!done && iteration < maxIterations) {
      iteration++;
      
      this.emit('iterationStart', { iteration: iteration, maxIterations: maxIterations });
      
      const thought = await this.think(currentContext);
      this.history.push({ type: 'thought', data: thought, iteration: iteration });
      
      if (thought.done || thought.type === 'final') {
        done = true;
        finalResult = thought;
        break;
      }
      
      const actionResult = await this.act(thought);
      this.history.push({ type: 'action', data: actionResult, iteration: iteration });
      
      const observation = await this.observe(actionResult);
      this.history.push({ type: 'observation', data: observation, iteration: iteration });
      
      currentContext.lastThought = thought;
      currentContext.lastAction = actionResult;
      currentContext.lastObservation = observation;
      currentContext.iteration = iteration;
      
      if (observation.type === 'final' || observation.done) {
        done = true;
        finalResult = observation;
      }
      
      if (this.config.behavior.enableCompression) {
        currentContext = await this.compressContext(currentContext);
      }
      
      this.emit('iterationEnd', { iteration: iteration, result: observation });
    }
    
    this.state = AGENT_STATES.COMPLETED;
    this.currentTask = null;
    
    const runResult = {
      result: finalResult,
      iterations: iteration,
      history: this.history.slice(-iteration * 3),
      thoughtChain: this.thoughtChain
    };
    
    this.emit('runEnd', runResult);
    return runResult;
  }

  async runStream(input, context, onChunk) {
    context = context || {};
    this.state = AGENT_STATES.IDLE;
    this.currentTask = input;
    this.history = [];
    this.thoughtChain = [];
    
    const maxIterations = this.config.behavior.maxIterations;
    let iteration = 0;
    let currentContext = { ...context, input: input };
    let done = false;
    let finalResult = null;

    this.emit('runStart', { input: input, context: context });

    while (!done && iteration < maxIterations) {
      iteration++;
      
      this.emit('iterationStart', { iteration: iteration, maxIterations: maxIterations });
      
      const thought = await this.thinkStream(currentContext, onChunk);
      this.history.push({ type: 'thought', data: thought, iteration: iteration });
      
      if (thought.done || thought.type === 'final') {
        done = true;
        finalResult = thought;
        break;
      }
      
      const actionResult = await this.act(thought);
      this.history.push({ type: 'action', data: actionResult, iteration: iteration });
      
      const observation = await this.observe(actionResult);
      this.history.push({ type: 'observation', data: observation, iteration: iteration });
      
      currentContext.lastThought = thought;
      currentContext.lastAction = actionResult;
      currentContext.lastObservation = observation;
      currentContext.iteration = iteration;
      
      if (observation.type === 'final' || observation.done) {
        done = true;
        finalResult = observation;
      }
      
      this.emit('iterationEnd', { iteration: iteration, result: observation });
    }
    
    this.state = AGENT_STATES.COMPLETED;
    this.currentTask = null;
    
    const runResult = {
      result: finalResult,
      iterations: iteration,
      history: this.history.slice(-iteration * 3),
      thoughtChain: this.thoughtChain
    };
    
    this.emit('runEnd', runResult);
    return runResult;
  }

  buildMessages(context) {
    const messages = [];
    
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(context)
    });
    
    if (this.memory) {
      const recentMemory = this.memory.recall(10);
      recentMemory.forEach(function(item) {
        messages.push({
          role: 'user',
          content: '[Memory] ' + item.content
        });
      });
    }
    
    if (this.thoughtChain.length > 0 && this.config.behavior.enableCoT) {
      const cotPrompt = this.buildCoTPrompt();
      if (cotPrompt) {
        messages.push({
          role: 'assistant',
          content: '[Previous Reasoning]\n' + cotPrompt
        });
      }
    }
    
    if (context.input) {
      messages.push({
        role: 'user',
        content: context.input
      });
    }
    
    if (context.lastObservation) {
      messages.push({
        role: 'user',
        content: '[Observation] ' + JSON.stringify(context.lastObservation).substring(0, 500)
      });
    }
    
    if (context.history) {
      context.history.forEach(function(msg) {
        messages.push(msg);
      });
    }
    
    this.conversationHistory.forEach(function(msg) {
      messages.push(msg);
    });
    
    return messages;
  }

  buildSystemPrompt(context) {
    const self = this;
    
    if (context.promptTemplate) {
      const template = this.promptManager.getTemplate(context.promptTemplate);
      if (template) {
        const vars = {
          name: this.name,
          role: this.role,
          description: this.description || '',
          ...context.promptVariables
        };
        
        if (this.toolManager) {
          vars.tools = this.toolManager.listTools();
        }
        
        return this.promptManager.renderTemplate(template, vars);
      }
    }
    
    const builder = this.promptManager.createPromptBuilder();
    
    builder.system('You are ' + this.name + (this.role ? ', a ' + this.role : '') + (this.description ? '. ' + this.description : ''));
    
    if (this.config.behavior.enableCoT) {
      builder.task('Use Chain-of-Thought reasoning. Format your response as:\n```json\n{"reasoning": "Step-by-step reasoning...", "conclusion": "Your conclusion", "action": {...} or "toolCall": {...} or "content": "..."}\n```');
    }
    
    if (this.toolManager) {
      const tools = this.toolManager.listTools();
      if (tools.length > 0) {
        builder.tools(tools);
        builder.output('To use a tool: {"toolCall": {"name": "tool_name", "params": {...}}}');
      }
    }
    
    builder.context('Available actions:\n- remember: Store in short-term memory\n- memorize: Store in long-term memory\n- recall: Retrieve from memory\n- respond: Provide final response\n\nTo use an action: {"action": {"type": "action_name", ...params}}');
    
    if (context.systemPrompt) {
      builder.context(context.systemPrompt);
    }
    
    return builder.build();
  }

  buildCoTPrompt() {
    if (this.thoughtChain.length === 0) return '';
    
    return this.thoughtChain.slice(-3).map(function(t) {
      return 'Step ' + t.step + ': ' + t.reasoning + ' => ' + t.conclusion;
    }).join('\n');
  }

  parseResponse(response) {
    const content = response.content || '';
    
    try {
      const parsed = JSON.parse(content);
      
      if (parsed.toolCall) {
        return {
          type: 'tool_call',
          toolCall: parsed.toolCall,
          reasoning: parsed.reasoning,
          content: content
        };
      }
      
      if (parsed.action) {
        return {
          type: 'action',
          action: parsed.action,
          reasoning: parsed.reasoning,
          conclusion: parsed.conclusion,
          content: content
        };
      }
      
      if (parsed.done || parsed.type === 'final') {
        return {
          type: 'final',
          content: parsed.content || parsed.result || parsed.conclusion || content,
          reasoning: parsed.reasoning,
          done: true
        };
      }
      
      if (parsed.reasoning) {
        return {
          type: 'reasoning',
          reasoning: parsed.reasoning,
          conclusion: parsed.conclusion,
          action: parsed.action,
          toolCall: parsed.toolCall,
          content: content
        };
      }
    } catch (e) {}
    
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

  async compressContext(context) {
    const threshold = this.config.behavior.compressionThreshold;
    
    const contextStr = JSON.stringify(context);
    if (contextStr.length < threshold) {
      return context;
    }
    
    const compressed = {
      input: context.input,
      iteration: context.iteration,
      summary: await this.summarizeHistory()
    };
    
    if (context.lastObservation) {
      compressed.lastObservationSummary = {
        type: context.lastObservation.type,
        preview: JSON.stringify(context.lastObservation).substring(0, 200)
      };
    }
    
    this.emit('contextCompressed', { 
      originalSize: contextStr.length, 
      compressedSize: JSON.stringify(compressed).length 
    });
    
    return compressed;
  }

  async summarizeHistory() {
    if (this.history.length === 0) return '';
    
    const recentHistory = this.history.slice(-6);
    const summary = recentHistory.map(function(h) {
      if (h.type === 'thought') {
        return 'Thought: ' + (h.data.reasoning || h.data.content || '').substring(0, 100);
      }
      if (h.type === 'action') {
        return 'Action: ' + (h.data.type || JSON.stringify(h.data)).substring(0, 100);
      }
      if (h.type === 'observation') {
        return 'Observation: ' + JSON.stringify(h.data.result || h.data).substring(0, 100);
      }
      return '';
    }).join('\n');
    
    return summary;
  }

  addToConversation(role, content) {
    this.conversationHistory.push({ role: role, content: content });
    
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }
  }

  clearConversation() {
    this.conversationHistory = [];
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
      conversationLength: this.conversationHistory.length,
      thoughtChainLength: this.thoughtChain.length,
      memoryStats: this.memory ? this.memory.getStats() : null
    };
  }

  getThoughtChain() {
    return this.thoughtChain.slice();
  }

  getHistory() {
    return this.history.slice();
  }

  reset() {
    this.state = AGENT_STATES.IDLE;
    this.currentTask = null;
    this.history = [];
    this.thoughtChain = [];
  }

  resetAll() {
    this.reset();
    this.conversationHistory = [];
  }

  registerPromptTemplate(template) {
    return this.promptManager.registerTemplate(template);
  }

  getPromptTemplate(id) {
    return this.promptManager.getTemplate(id);
  }

  listPromptTemplates(category) {
    return this.promptManager.listTemplates(category);
  }

  renderPrompt(templateId, variables) {
    return this.promptManager.render(templateId, variables);
  }

  optimizePrompt(prompt, options) {
    return this.promptManager.optimize(prompt, options);
  }

  createPromptBuilder() {
    return this.promptManager.createPromptBuilder();
  }
}

function createAgent(config) {
  const runtime = new AgentRuntime(config);
  return runtime;
}

module.exports = {
  AgentRuntime,
  createAgent,
  DEFAULT_AGENT_CONFIG,
  AGENT_STATES
};
