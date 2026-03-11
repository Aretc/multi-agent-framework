/**
 * Intelligent Router System
 * 
 * Features:
 * - Task Intelligent Assignment
 * - Load Balancing
 * - Capability Matching
 * - Multiple Routing Strategies
 * - Agent Performance Tracking
 */

const { EventEmitter } = require('events');

const ROUTING_STRATEGIES = {
  BEST_MATCH: 'best_match',
  CAPABILITY: 'capability',
  LOAD_BALANCED: 'load_balanced',
  PRIORITY: 'priority',
  ROUND_ROBIN: 'round_robin',
  LEAST_LOADED: 'least_loaded'
};

const TASK_TYPES = {
  TASK: 'task',
  CODING: 'coding',
  RESEARCH: 'research',
  WRITING: 'writing',
  ANALYSIS: 'analysis',
  TESTING: 'testing',
  REVIEW: 'review',
  DESIGN: 'design',
  PLANNING: 'planning',
  COORDINATION: 'coordination',
  GENERAL: 'general'
};

const AGENT_CAPABILITIES = {
  coder: ['coding', 'debugging', 'testing', 'code_review', 'refactoring', 'api_development', 'scripting'],
  researcher: ['research', 'analysis', 'summarization', 'fact_checking', 'data_collection', 'literature_review'],
  writer: ['writing', 'editing', 'formatting', 'translation', 'content_creation', 'proofreading'],
  analyzer: ['analysis', 'visualization', 'reporting', 'statistics', 'data_processing', 'insights'],
  tester: ['testing', 'validation', 'bug_reporting', 'quality_assurance', 'automation', 'test_planning'],
  reviewer: ['review', 'feedback', 'suggestions', 'quality_check', 'documentation'],
  designer: ['design', 'prototyping', 'user_experience', 'visual_design', 'wireframing'],
  planner: ['planning', 'scheduling', 'estimation', 'resource_management', 'risk_assessment'],
  coordinator: ['coordination', 'communication', 'management', 'delegation', 'monitoring'],
  general: ['reasoning', 'analysis', 'communication', 'problem_solving', 'general_tasks']
};

const TASK_KEYWORDS = {
  coding: ['code', 'implement', 'function', 'class', 'method', 'api', 'debug', 'fix', 'refactor', 'script', 'program', 'develop', 'build', 'create'],
  research: ['research', 'investigate', 'study', 'analyze', 'explore', 'find', 'search', 'gather', 'survey', 'review literature'],
  writing: ['write', 'document', 'article', 'blog', 'report', 'content', 'draft', 'edit', 'proofread', 'translate'],
  analysis: ['analyze', 'analysis', 'data', 'statistics', 'metrics', 'insights', 'trends', 'patterns', 'visualization'],
  testing: ['test', 'testing', 'qa', 'quality', 'verify', 'validate', 'check', 'automate', 'unit test', 'integration'],
  review: ['review', 'check', 'audit', 'feedback', 'approve', 'critique', 'evaluate', 'assess'],
  design: ['design', 'ui', 'ux', 'interface', 'prototype', 'wireframe', 'mockup', 'visual', 'layout'],
  planning: ['plan', 'schedule', 'roadmap', 'timeline', 'estimate', 'strategy', 'organize', 'prioritize'],
  coordination: ['coordinate', 'manage', 'delegate', 'assign', 'monitor', 'track', 'communicate', 'sync'],
  general: ['help', 'assist', 'general', 'any', 'misc']
};

class AgentProfile {
  constructor(config) {
    config = config || {};
    this.id = config.id || 'agent-' + Date.now();
    this.name = config.name || 'Agent';
    this.type = config.type || 'general';
    this.capabilities = config.capabilities || AGENT_CAPABILITIES[this.type] || [];
    this.priority = config.priority || 5;
    this.maxConcurrentTasks = config.maxConcurrentTasks || 3;
    this.currentTasks = config.currentTasks || 0;
    this.completedTasks = config.completedTasks || 0;
    this.successRate = config.successRate || 1.0;
    this.averageResponseTime = config.averageResponseTime || 1000;
    this.lastAssignedAt = config.lastAssignedAt || 0;
    this.specializations = config.specializations || [];
    this.tags = config.tags || [];
    this.status = config.status || 'available';
  }

  getLoad() {
    return this.currentTasks / this.maxConcurrentTasks;
  }

  isAvailable() {
    return this.status === 'available' && this.currentTasks < this.maxConcurrentTasks;
  }

  getCapabilityScore(capability) {
    if (this.capabilities.includes(capability)) {
      if (this.specializations.includes(capability)) {
        return 1.0;
      }
      return 0.8;
    }
    return 0.1;
  }

  getPerformanceScore() {
    return this.successRate * (1 - this.getLoad() * 0.5);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      capabilities: this.capabilities,
      priority: this.priority,
      maxConcurrentTasks: this.maxConcurrentTasks,
      currentTasks: this.currentTasks,
      completedTasks: this.completedTasks,
      successRate: this.successRate,
      averageResponseTime: this.averageResponseTime,
      lastAssignedAt: this.lastAssignedAt,
      specializations: this.specializations,
      tags: this.tags,
      status: this.status,
      load: this.getLoad()
    };
  }
}

class TaskProfile {
  constructor(config) {
    config = config || {};
    this.id = config.id || 'task-' + Date.now();
    this.type = config.type || 'general';
    this.priority = config.priority || 5;
    this.requiredCapabilities = config.requiredCapabilities || [];
    this.preferredAgentType = config.preferredAgentType;
    this.estimatedComplexity = config.estimatedComplexity || 5;
    this.deadline = config.deadline;
    this.tags = config.tags || [];
    this.keywords = config.keywords || [];
    this.constraints = config.constraints || [];
    this.title = config.title || '';
    this.description = config.description || '';
    this.assignedAgent = null;
    this.status = 'pending';
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      priority: this.priority,
      requiredCapabilities: this.requiredCapabilities,
      preferredAgentType: this.preferredAgentType,
      estimatedComplexity: this.estimatedComplexity,
      deadline: this.deadline,
      tags: this.tags,
      keywords: this.keywords,
      constraints: this.constraints,
      title: this.title,
      description: this.description,
      assignedAgent: this.assignedAgent,
      status: this.status
    };
  }
}

class IntelligentRouter extends EventEmitter {
  constructor(config) {
    super();
    this.config = config || {};
    this.strategy = this.config.strategy || ROUTING_STRATEGIES.BEST_MATCH;
    this.agents = new Map();
    this.tasks = new Map();
    this.assignmentHistory = [];
    this.roundRobinIndex = 0;
  }

  registerAgent(agentConfig) {
    const profile = agentConfig instanceof AgentProfile ? agentConfig : new AgentProfile(agentConfig);
    this.agents.set(profile.id, profile);
    this.emit('agent:registered', { agent: profile.toJSON() });
    return profile;
  }

  unregisterAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.agents.delete(agentId);
      this.emit('agent:unregistered', { agentId: agentId });
      return true;
    }
    return false;
  }

  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  listAgents(availableOnly) {
    const agents = Array.from(this.agents.values());
    if (availableOnly) {
      return agents.filter(function(a) { return a.isAvailable(); }).map(function(a) { return a.toJSON(); });
    }
    return agents.map(function(a) { return a.toJSON(); });
  }

  updateAgentStatus(agentId, status, currentTasks) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      if (currentTasks !== undefined) {
        agent.currentTasks = currentTasks;
      }
      this.emit('agent:updated', { agent: agent.toJSON() });
      return true;
    }
    return false;
  }

  detectTaskType(task) {
    const text = ((task.description || '') + ' ' + (task.title || '') + ' ' + (task.keywords || []).join(' ')).toLowerCase();
    
    const scores = {};
    
    Object.entries(TASK_KEYWORDS).forEach(function([type, keywords]) {
      let score = 0;
      keywords.forEach(function(keyword) {
        if (text.includes(keyword.toLowerCase())) {
          score += 1;
        }
      });
      scores[type] = score;
    });
    
    let maxScore = 0;
    let detectedType = TASK_TYPES.GENERAL;
    
    Object.entries(scores).forEach(function([type, score]) {
      if (score > maxScore) {
        maxScore = score;
        detectedType = type;
      }
    });
    
    return {
      type: detectedType,
      confidence: maxScore > 0 ? maxScore / Object.keys(TASK_KEYWORDS).length : 0,
      scores: scores
    };
  }

  extractRequiredCapabilities(task) {
    const capabilities = task.requiredCapabilities || [];
    const detection = this.detectTaskType(task);
    
    if (capabilities.length === 0 && detection.type) {
      return AGENT_CAPABILITIES[detection.type] || [];
    }
    
    return capabilities;
  }

  createTaskProfile(taskConfig) {
    const profile = taskConfig instanceof TaskProfile ? taskConfig : new TaskProfile(taskConfig);
    
    if (!profile.type || profile.type === 'general') {
      const detection = this.detectTaskType(profile);
      profile.type = detection.type;
    }
    
    if (profile.requiredCapabilities.length === 0) {
      profile.requiredCapabilities = this.extractRequiredCapabilities(profile);
    }
    
    this.tasks.set(profile.id, profile);
    this.emit('task:created', { task: profile.toJSON() });
    
    return profile;
  }

  calculateAgentScore(agent, task) {
    let score = 0;
    
    const capabilityScore = this.calculateCapabilityScore(agent, task);
    score += capabilityScore * 0.4;
    
    const loadScore = 1 - agent.getLoad();
    score += loadScore * 0.2;
    
    const performanceScore = agent.getPerformanceScore();
    score += performanceScore * 0.2;
    
    if (task.preferredAgentType && agent.type === task.preferredAgentType) {
      score += 0.15;
    }
    
    if (agent.type === task.type) {
      score += 0.05;
    }
    
    return Math.min(score, 1.0);
  }

  calculateCapabilityScore(agent, task) {
    if (task.requiredCapabilities.length === 0) {
      return 0.5;
    }
    
    let totalScore = 0;
    task.requiredCapabilities.forEach(function(capability) {
      totalScore += agent.getCapabilityScore(capability);
    });
    
    return totalScore / task.requiredCapabilities.length;
  }

  selectAgent(task, strategy) {
    const self = this;
    strategy = strategy || this.strategy;
    
    const availableAgents = Array.from(this.agents.values()).filter(function(a) { return a.isAvailable(); });
    
    if (availableAgents.length === 0) {
      return null;
    }
    
    const taskProfile = task instanceof TaskProfile ? task : this.createTaskProfile(task);
    
    switch (strategy) {
      case ROUTING_STRATEGIES.CAPABILITY:
        return this.selectByCapability(availableAgents, taskProfile);
      case ROUTING_STRATEGIES.LOAD_BALANCED:
        return this.selectByLoadBalance(availableAgents);
      case ROUTING_STRATEGIES.PRIORITY:
        return this.selectByPriority(availableAgents, taskProfile);
      case ROUTING_STRATEGIES.ROUND_ROBIN:
        return this.selectByRoundRobin(availableAgents);
      case ROUTING_STRATEGIES.LEAST_LOADED:
        return this.selectByLeastLoaded(availableAgents);
      case ROUTING_STRATEGIES.BEST_MATCH:
      default:
        return this.selectBestMatch(availableAgents, taskProfile);
    }
  }

  selectByCapability(agents, task) {
    let bestAgent = null;
    let bestScore = -1;
    
    agents.forEach(function(agent) {
      const score = this.calculateCapabilityScore(agent, task);
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }.bind(this));
    
    return bestAgent;
  }

  selectByLoadBalance(agents) {
    let selectedAgent = null;
    let lowestLoad = Infinity;
    
    agents.forEach(function(agent) {
      const load = agent.getLoad();
      if (load < lowestLoad) {
        lowestLoad = load;
        selectedAgent = agent;
      }
    });
    
    return selectedAgent;
  }

  selectByPriority(agents, task) {
    const sortedAgents = agents.slice().sort(function(a, b) {
      return b.priority - a.priority;
    });
    
    return sortedAgents[0];
  }

  selectByRoundRobin(agents) {
    const selectedAgent = agents[this.roundRobinIndex % agents.length];
    this.roundRobinIndex++;
    return selectedAgent;
  }

  selectByLeastLoaded(agents) {
    return this.selectByLoadBalance(agents);
  }

  selectBestMatch(agents, task) {
    let bestAgent = null;
    let bestScore = -1;
    
    agents.forEach(function(agent) {
      const score = this.calculateAgentScore(agent, task);
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }.bind(this));
    
    return bestAgent;
  }

  assignTask(task, strategy) {
    const taskProfile = task instanceof TaskProfile ? task : this.createTaskProfile(task);
    
    const agent = this.selectAgent(taskProfile, strategy);
    
    if (!agent) {
      this.emit('assignment:failed', { task: taskProfile.toJSON(), reason: 'No available agents' });
      return null;
    }
    
    taskProfile.assignedAgent = agent.id;
    taskProfile.status = 'assigned';
    agent.currentTasks++;
    agent.lastAssignedAt = Date.now();
    
    this.assignmentHistory.push({
      taskId: taskProfile.id,
      agentId: agent.id,
      timestamp: Date.now(),
      strategy: strategy || this.strategy
    });
    
    this.emit('task:assigned', { 
      task: taskProfile.toJSON(), 
      agent: agent.toJSON() 
    });
    
    return {
      task: taskProfile,
      agent: agent
    };
  }

  completeTask(taskId, success) {
    const task = this.tasks.get(taskId);
    
    if (!task) {
      return false;
    }
    
    const agent = this.agents.get(task.assignedAgent);
    
    if (agent) {
      agent.currentTasks = Math.max(0, agent.currentTasks - 1);
      agent.completedTasks++;
      
      if (success !== undefined) {
        const total = agent.completedTasks;
        const successful = success ? Math.ceil(total * agent.successRate) + 1 : Math.ceil(total * agent.successRate);
        agent.successRate = successful / (total + 1);
      }
    }
    
    task.status = success ? 'completed' : 'failed';
    
    this.emit('task:completed', { 
      taskId: taskId, 
      agentId: task.assignedAgent,
      success: success 
    });
    
    return true;
  }

  getStats() {
    const agents = Array.from(this.agents.values());
    const tasks = Array.from(this.tasks.values());
    
    const totalAgents = agents.length;
    const availableAgents = agents.filter(function(a) { return a.isAvailable(); }).length;
    const totalTasks = tasks.length;
    const pendingTasks = tasks.filter(function(t) { return t.status === 'pending'; }).length;
    const assignedTasks = tasks.filter(function(t) { return t.status === 'assigned'; }).length;
    const completedTasks = tasks.filter(function(t) { return t.status === 'completed'; }).length;
    
    const avgLoad = agents.length > 0 ? agents.reduce(function(sum, a) { return sum + a.getLoad(); }, 0) / agents.length : 0;
    const avgSuccessRate = agents.length > 0 ? agents.reduce(function(sum, a) { return sum + a.successRate; }, 0) / agents.length : 0;
    
    return {
      agents: {
        total: totalAgents,
        available: availableAgents,
        busy: totalAgents - availableAgents,
        averageLoad: avgLoad,
        averageSuccessRate: avgSuccessRate
      },
      tasks: {
        total: totalTasks,
        pending: pendingTasks,
        assigned: assignedTasks,
        completed: completedTasks
      },
      assignments: this.assignmentHistory.length
    };
  }

  setStrategy(strategy) {
    if (Object.values(ROUTING_STRATEGIES).includes(strategy)) {
      this.strategy = strategy;
      this.emit('strategy:changed', { strategy: strategy });
      return true;
    }
    return false;
  }

  getAssignmentHistory(limit) {
    limit = limit || 100;
    return this.assignmentHistory.slice(-limit);
  }

  rebalance() {
    const overloadedAgents = Array.from(this.agents.values()).filter(function(a) { return a.getLoad() > 0.8; });
    const underloadedAgents = Array.from(this.agents.values()).filter(function(a) { return a.getLoad() < 0.3 && a.isAvailable(); });
    
    if (overloadedAgents.length === 0 || underloadedAgents.length === 0) {
      return { rebalanced: false, reason: 'No rebalancing needed' };
    }
    
    this.emit('rebalance:started', { 
      overloaded: overloadedAgents.length, 
      underloaded: underloadedAgents.length 
    });
    
    return {
      rebalanced: true,
      overloadedCount: overloadedAgents.length,
      underloadedCount: underloadedAgents.length
    };
  }
}

function createIntelligentRouter(config) {
  return new IntelligentRouter(config);
}

module.exports = {
  IntelligentRouter,
  AgentProfile,
  TaskProfile,
  createIntelligentRouter,
  ROUTING_STRATEGIES,
  TASK_TYPES,
  AGENT_CAPABILITIES,
  TASK_KEYWORDS
};
