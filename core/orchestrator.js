/**
 * Orchestrator for Multi-Agent Framework
 * 
 * The main controller that:
 * - Receives user instructions
 * - Plans and decomposes tasks
 * - Creates and manages dynamic agents
 * - Validates and accepts/rejects task results
 * - Handles clarification requests
 * - Manages the overall workflow
 */

const { SessionManager, Session, SESSION_STATUS } = require('./session');
const { DynamicAgentFactory, DynamicAgent, AGENT_TYPES } = require('./dynamic-agent');
const { createLLMAdapter } = require('./llm/adapter');
const { AgentMemory } = require('./memory');

const ORCHESTRATOR_STATUS = {
  IDLE: 'idle',
  PLANNING: 'planning',
  EXECUTING: 'executing',
  WAITING_CLARIFICATION: 'waiting_clarification',
  VALIDATING: 'validating',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

const TASK_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  NEEDS_CLARIFICATION: 'needs_clarification',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  FAILED: 'failed'
};

const DEFAULT_ORCHESTRATOR_CONFIG = {
  maxRejectCount: 3,
  maxTaskRetries: 3,
  maxConcurrentAgents: 5,
  autoSave: true,
  llm: {
    provider: 'mock',
    model: 'default',
    temperature: 0.7
  },
  memory: {
    enabled: true,
    shortTerm: { maxSize: 100 },
    longTerm: { maxSize: 5000 },
    episodic: { maxEvents: 1000 }
  }
};

const PLANNING_PROMPT = `You are a task planner. Analyze the user's request and create a structured task plan.

User Request: {userInput}

{context}

Create a task plan in the following JSON format:
{
  "understanding": "Your understanding of what the user wants",
  "needsClarification": false,
  "clarificationQuestions": [],
  "tasks": [
    {
      "id": "task_1",
      "title": "Task title",
      "description": "Detailed task description",
      "type": "coder|researcher|writer|analyzer|tester|reviewer|designer|planner|general",
      "priority": "high|medium|low",
      "dependencies": [],
      "expectedOutput": "What the output should look like",
      "acceptanceCriteria": ["criteria 1", "criteria 2"],
      "estimatedComplexity": "low|medium|high"
    }
  ],
  "executionOrder": ["task_1", "task_2"],
  "estimatedTotalTime": "estimated time to complete all tasks"
}

If the request is unclear, set needsClarification to true and provide clarificationQuestions.
Only output the JSON, no other text.`;

const VALIDATION_PROMPT = `You are a task validator. Evaluate whether the task result meets the acceptance criteria.

Task: {taskTitle}
Description: {taskDescription}
Acceptance Criteria: {acceptanceCriteria}

Task Result:
{result}

Evaluate the result and respond in JSON format:
{
  "accepted": true|false,
  "score": 0-100,
  "feedback": "Detailed feedback on what was done well and what needs improvement",
  "issues": ["issue 1", "issue 2"],
  "suggestions": ["suggestion 1", "suggestion 2"]
}

Only output the JSON, no other text.`;

class Task {
  constructor(config) {
    config = config || {};
    this.id = config.id || 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    this.title = config.title || 'Untitled Task';
    this.description = config.description || '';
    this.type = config.type || 'general';
    this.priority = config.priority || 'medium';
    this.status = TASK_STATUS.PENDING;
    this.dependencies = config.dependencies || [];
    this.expectedOutput = config.expectedOutput || '';
    this.acceptanceCriteria = config.acceptanceCriteria || [];
    this.estimatedComplexity = config.estimatedComplexity || 'medium';
    this.assignedAgentId = null;
    this.assignedAgentName = null;
    this.sessionId = null;
    this.result = null;
    this.validationResult = null;
    this.rejectCount = 0;
    this.retryCount = 0;
    this.createdAt = new Date().toISOString();
    this.startedAt = null;
    this.completedAt = null;
    this.needsClarification = false;
    this.clarificationQuestions = [];
    this.clarificationResponses = [];
  }

  assign(agentId, agentName, sessionId) {
    this.assignedAgentId = agentId;
    this.assignedAgentName = agentName;
    this.sessionId = sessionId;
    this.status = TASK_STATUS.ASSIGNED;
    this.startedAt = new Date().toISOString();
    return this;
  }

  start() {
    this.status = TASK_STATUS.IN_PROGRESS;
    return this;
  }

  complete(result) {
    this.result = result;
    this.status = TASK_STATUS.COMPLETED;
    this.completedAt = new Date().toISOString();
    return this;
  }

  reject(validationResult) {
    this.validationResult = validationResult;
    this.rejectCount++;
    this.status = TASK_STATUS.REJECTED;
    return this;
  }

  requestClarification(questions) {
    this.needsClarification = true;
    this.clarificationQuestions = questions;
    this.status = TASK_STATUS.NEEDS_CLARIFICATION;
    return this;
  }

  provideClarification(responses) {
    this.clarificationResponses = responses;
    this.needsClarification = false;
    this.status = TASK_STATUS.PENDING;
    return this;
  }

  fail(error) {
    this.status = TASK_STATUS.FAILED;
    this.error = error;
    this.completedAt = new Date().toISOString();
    return this;
  }

  canRetry(maxRetries) {
    return this.retryCount < maxRetries;
  }

  incrementRetry() {
    this.retryCount++;
    this.status = TASK_STATUS.PENDING;
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      type: this.type,
      priority: this.priority,
      status: this.status,
      dependencies: this.dependencies,
      expectedOutput: this.expectedOutput,
      acceptanceCriteria: this.acceptanceCriteria,
      estimatedComplexity: this.estimatedComplexity,
      assignedAgentId: this.assignedAgentId,
      assignedAgentName: this.assignedAgentName,
      sessionId: this.sessionId,
      result: this.result,
      validationResult: this.validationResult,
      rejectCount: this.rejectCount,
      retryCount: this.retryCount,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      needsClarification: this.needsClarification,
      clarificationQuestions: this.clarificationQuestions,
      clarificationResponses: this.clarificationResponses
    };
  }

  static fromJSON(data) {
    const task = new Task(data);
    task.status = data.status;
    task.result = data.result;
    task.validationResult = data.validationResult;
    task.rejectCount = data.rejectCount || 0;
    task.retryCount = data.retryCount || 0;
    task.error = data.error;
    return task;
  }
}

class Orchestrator {
  constructor(options) {
    options = options || {};
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...options };
    
    this.status = ORCHESTRATOR_STATUS.IDLE;
    this.sessionManager = new SessionManager({
      rootPath: options.sessionRootPath || './.maf/sessions'
    });
    this.agentFactory = new DynamicAgentFactory({
      llm: this.config.llm,
      memoryRootPath: options.agentMemoryRootPath || './.maf/agents'
    });
    
    this.llm = createLLMAdapter(this.config.llm);
    this.memory = null;
    
    this.currentSession = null;
    this.tasks = new Map();
    this.executionQueue = [];
    this.completedTasks = [];
    this.clarificationCallback = null;
    
    this.eventHandlers = {
      'task_created': [],
      'task_assigned': [],
      'task_completed': [],
      'task_rejected': [],
      'agent_created': [],
      'clarification_needed': [],
      'session_completed': []
    };
  }

  async initialize() {
    if (this.config.memory.enabled) {
      this.memory = new AgentMemory('orchestrator', {
        rootPath: './.maf/orchestrator',
        config: this.config.memory
      });
      await this.memory.init();
    }
    return this;
  }

  on(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(handler);
    }
    return this;
  }

  emit(event, data) {
    const handlers = this.eventHandlers[event] || [];
    handlers.forEach(function(handler) {
      try {
        handler(data);
      } catch (e) {
        console.error('Event handler error:', e);
      }
    });
  }

  setClarificationCallback(callback) {
    this.clarificationCallback = callback;
    return this;
  }

  addTask(taskData) {
    if (!this.currentSession) {
      this.currentSession = this.sessionManager.createSession();
    }
    
    const task = new Task({
      title: taskData.title,
      description: taskData.description || '',
      priority: taskData.priority || 'medium',
      assignedAgentId: taskData.assignedAgentId || null,
      ...taskData
    });
    
    this.tasks.set(task.id, task);
    this.executionQueue.push(task.id);
    this.emit('task_created', task);
    
    return task;
  }

  async processUserInput(userInput, context) {
    context = context || {};
    this.status = ORCHESTRATOR_STATUS.PLANNING;
    
    this.currentSession = this.sessionManager.createSession();
    await this.currentSession.initialize({
      llm: this.config.llm
    });
    this.currentSession.setUserInput(userInput);
    
    if (this.memory) {
      await this.memory.recordEvent({
        type: 'session_started',
        action: 'New user input received',
        details: { userInput: userInput.substring(0, 200) }
      });
    }
    
    const plan = await this._planTasks(userInput, context);
    
    if (plan.needsClarification) {
      this.status = ORCHESTRATOR_STATUS.WAITING_CLARIFICATION;
      
      this.emit('clarification_needed', {
        sessionId: this.currentSession.id,
        questions: plan.clarificationQuestions,
        understanding: plan.understanding
      });
      
      if (this.clarificationCallback) {
        return {
          needsClarification: true,
          questions: plan.clarificationQuestions,
          understanding: plan.understanding,
          sessionId: this.currentSession.id
        };
      }
      
      return {
        needsClarification: true,
        questions: plan.clarificationQuestions,
        sessionId: this.currentSession.id
      };
    }
    
    this.currentSession.setTaskPlan(plan);
    
    plan.tasks.forEach(function(taskData) {
      const task = new Task(taskData);
      this.tasks.set(task.id, task);
      this.emit('task_created', task);
    }.bind(this));
    
    this._buildExecutionQueue(plan.executionOrder);
    
    return await this._executePlan();
  }

  async provideClarification(sessionId, responses) {
    if (!this.currentSession || this.currentSession.id !== sessionId) {
      const session = await this.sessionManager.getSession(sessionId);
      if (!session) {
        return { error: 'Session not found' };
      }
      this.currentSession = session;
    }
    
    const userInput = this.currentSession.context.userInput;
    const context = {
      clarificationResponses: responses
    };
    
    this.status = ORCHESTRATOR_STATUS.PLANNING;
    
    const plan = await this._planTasks(userInput, context);
    
    if (plan.needsClarification) {
      return {
        needsClarification: true,
        questions: plan.clarificationQuestions
      };
    }
    
    this.currentSession.setTaskPlan(plan);
    
    plan.tasks.forEach(function(taskData) {
      const task = new Task(taskData);
      this.tasks.set(task.id, task);
      this.emit('task_created', task);
    }.bind(this));
    
    this._buildExecutionQueue(plan.executionOrder);
    
    return await this._executePlan();
  }

  async _planTasks(userInput, context) {
    let prompt = PLANNING_PROMPT.replace('{userInput}', userInput);
    
    let contextStr = '';
    if (context.clarificationResponses && context.clarificationResponses.length > 0) {
      contextStr = 'Clarification provided:\n';
      context.clarificationResponses.forEach(function(r, i) {
        contextStr += (i + 1) + '. ' + r + '\n';
      });
    }
    if (context.previousResults && context.previousResults.length > 0) {
      contextStr += '\nPrevious task results:\n';
      context.previousResults.forEach(function(r, i) {
        contextStr += (i + 1) + '. ' + r.taskId + ': ' + r.summary + '\n';
      });
    }
    prompt = prompt.replace('{context}', contextStr);
    
    try {
      const response = await this.llm.chat([
        { role: 'user', content: prompt }
      ]);
      
      const content = response.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return this._createDefaultPlan(userInput);
    } catch (e) {
      console.error('Planning error:', e);
      return this._createDefaultPlan(userInput);
    }
  }

  _createDefaultPlan(userInput) {
    return {
      understanding: userInput,
      needsClarification: false,
      tasks: [{
        id: 'task_1',
        title: 'Process user request',
        description: userInput,
        type: 'general',
        priority: 'medium',
        dependencies: [],
        expectedOutput: 'Complete the user request',
        acceptanceCriteria: ['Task completed successfully'],
        estimatedComplexity: 'medium'
      }],
      executionOrder: ['task_1']
    };
  }

  _buildExecutionQueue(order) {
    this.executionQueue = order || Array.from(this.tasks.keys());
  }

  async _executePlan() {
    this.status = ORCHESTRATOR_STATUS.EXECUTING;
    
    const results = [];
    
    while (this.executionQueue.length > 0) {
      const taskId = this.executionQueue.shift();
      const task = this.tasks.get(taskId);
      
      if (!task) continue;
      
      const depsCompleted = this._checkDependencies(task);
      if (!depsCompleted) {
        this.executionQueue.push(taskId);
        continue;
      }
      
      const result = await this._executeTask(task);
      results.push(result);
      
      if (task.status === TASK_STATUS.NEEDS_CLARIFICATION) {
        return {
          needsClarification: true,
          taskId: task.id,
          questions: task.clarificationQuestions,
          sessionId: this.currentSession.id
        };
      }
    }
    
    this.status = ORCHESTRATOR_STATUS.COMPLETED;
    this.currentSession.complete({ results: results });
    
    this.emit('session_completed', {
      sessionId: this.currentSession.id,
      results: results
    });
    
    return {
      success: true,
      results: results,
      sessionId: this.currentSession.id
    };
  }

  _checkDependencies(task) {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }
    
    const self = this;
    return task.dependencies.every(function(depId) {
      const depTask = self.tasks.get(depId);
      return depTask && depTask.status === TASK_STATUS.COMPLETED;
    });
  }

  async _executeTask(task) {
    const sessionId = this.currentSession.createChildSession(task.id, task.assignedAgentId);
    
    const agent = await this.agentFactory.createAgentForTask({
      title: task.title,
      description: task.description,
      suggestedAgentName: task.type + '_agent_' + task.id
    });
    
    task.assign(agent.id, agent.name, sessionId);
    this.emit('task_assigned', task);
    
    this.currentSession.registerAgent(agent.id, {
      name: agent.name,
      type: agent.type,
      taskId: task.id
    });
    
    task.start();
    
    const executionContext = {
      previousResults: this._getPreviousResults(task.dependencies)
    };
    
    if (task.clarificationResponses && task.clarificationResponses.length > 0) {
      executionContext.clarification = task.clarificationResponses;
    }
    
    const result = await agent.execute(task, executionContext);
    
    if (result.needsClarification) {
      task.requestClarification(result.questions);
      this.emit('clarification_needed', {
        taskId: task.id,
        questions: result.questions
      });
      return {
        taskId: task.id,
        needsClarification: true,
        questions: result.questions
      };
    }
    
    this.status = ORCHESTRATOR_STATUS.VALIDATING;
    const validationResult = await this._validateTaskResult(task, result);
    
    if (validationResult.accepted) {
      task.complete(result);
      this.currentSession.addTaskResult(task.id, result);
      this.completedTasks.push(task.id);
      this.emit('task_completed', task);
      
      return {
        taskId: task.id,
        success: true,
        result: result,
        validation: validationResult
      };
    } else {
      return await this._handleRejectedTask(task, result, validationResult);
    }
  }

  async _validateTaskResult(task, result) {
    if (!task.acceptanceCriteria || task.acceptanceCriteria.length === 0) {
      return { accepted: true, score: 100, feedback: 'No criteria defined' };
    }
    
    let prompt = VALIDATION_PROMPT
      .replace('{taskTitle}', task.title)
      .replace('{taskDescription}', task.description)
      .replace('{acceptanceCriteria}', JSON.stringify(task.acceptanceCriteria))
      .replace('{result}', JSON.stringify(result).substring(0, 2000));
    
    try {
      const response = await this.llm.chat([
        { role: 'user', content: prompt }
      ]);
      
      const content = response.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return { accepted: true, score: 70, feedback: 'Validation parsing failed, accepting by default' };
    } catch (e) {
      console.error('Validation error:', e);
      return { accepted: true, score: 70, feedback: 'Validation error, accepting by default' };
    }
  }

  async _handleRejectedTask(task, result, validationResult) {
    task.reject(validationResult);
    this.emit('task_rejected', task);
    
    const agent = this.agentFactory.getAgent(task.assignedAgentId);
    if (agent) {
      agent.incrementRejectCount();
    }
    
    if (task.rejectCount >= this.config.maxRejectCount) {
      if (agent) {
        await this.agentFactory.removeAgent(agent.id);
      }
      
      const newAgent = await this.agentFactory.createAgentForTask({
        title: task.title,
        description: task.description + '\n\nPrevious attempts failed. Feedback: ' + validationResult.feedback,
        suggestedAgentName: task.type + '_agent_' + task.id + '_v2'
      });
      
      task.assign(newAgent.id, newAgent.name, this.currentSession.createChildSession(task.id, newAgent.id));
      task.rejectCount = 0;
      
      this.executionQueue.unshift(task.id);
      
      return {
        taskId: task.id,
        status: 'reassigned',
        reason: 'Max reject count reached, created new agent',
        previousValidation: validationResult
      };
    }
    
    if (task.canRetry(this.config.maxTaskRetries)) {
      task.incrementRetry();
      this.executionQueue.unshift(task.id);
      
      return {
        taskId: task.id,
        status: 'retrying',
        retryCount: task.retryCount,
        validation: validationResult
      };
    }
    
    task.fail('Max retries exceeded');
    return {
      taskId: task.id,
      success: false,
      error: 'Max retries exceeded',
      validation: validationResult
    };
  }

  _getPreviousResults(dependencyIds) {
    if (!dependencyIds || dependencyIds.length === 0) {
      return [];
    }
    
    const self = this;
    return dependencyIds.map(function(depId) {
      const depTask = self.tasks.get(depId);
      if (depTask && depTask.result) {
        return {
          taskId: depId,
          summary: depTask.result.result ? 
            JSON.stringify(depTask.result.result).substring(0, 200) : 
            'Task completed'
        };
      }
      return null;
    }).filter(Boolean);
  }

  async provideTaskClarification(taskId, responses) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { error: 'Task not found' };
    }
    
    task.provideClarification(responses);
    
    this.executionQueue.unshift(taskId);
    
    return await this._executePlan();
  }

  getStatus() {
    return {
      status: this.status,
      sessionId: this.currentSession ? this.currentSession.id : null,
      totalTasks: this.tasks.size,
      completedTasks: this.completedTasks.length,
      pendingTasks: this.executionQueue.length,
      activeAgents: this.agentFactory.listAgents().length
    };
  }

  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  getAllTasks() {
    return Array.from(this.tasks.values()).map(function(task) {
      return task.toJSON();
    });
  }

  async pause() {
    if (this.currentSession) {
      this.currentSession.pause();
    }
    this.status = ORCHESTRATOR_STATUS.IDLE;
    return this;
  }

  async resume() {
    if (this.currentSession) {
      this.currentSession.resume();
    }
    return await this._executePlan();
  }

  async cancel() {
    this.status = ORCHESTRATOR_STATUS.FAILED;
    if (this.currentSession) {
      this.currentSession.fail('Cancelled by user');
    }
    this.executionQueue = [];
    return this;
  }

  async save() {
    if (this.currentSession) {
      await this.currentSession.save();
    }
    return this;
  }
}

module.exports = {
  Orchestrator,
  Task,
  ORCHESTRATOR_STATUS,
  TASK_STATUS,
  DEFAULT_ORCHESTRATOR_CONFIG
};
