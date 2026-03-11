/**
 * Rules Management System for Multi-Agent Framework
 * 
 * Rules define constraints, validations, and behaviors:
 * - Pre/post conditions for actions
 * - Validation rules for data
 * - Trigger rules for events
 * - Constraint rules for resources
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const RULE_STATUS = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
  ERROR: 'error'
};

const RULE_TYPES = {
  VALIDATION: 'validation',
  CONSTRAINT: 'constraint',
  TRIGGER: 'trigger',
  TRANSFORM: 'transform',
  GUARD: 'guard'
};

const RULE_PRIORITY = {
  CRITICAL: 0,
  HIGH: 25,
  MEDIUM: 50,
  LOW: 75,
  BACKGROUND: 100
};

class RuleDefinition {
  constructor(definition) {
    this.id = definition.id || this.generateId();
    this.name = definition.name;
    this.description = definition.description || '';
    this.type = definition.type || RULE_TYPES.VALIDATION;
    this.priority = definition.priority !== undefined ? definition.priority : RULE_PRIORITY.MEDIUM;
    
    this.condition = definition.condition || null;
    this.action = definition.action || null;
    this.transform = definition.transform || null;
    
    this.scope = definition.scope || 'global';
    this.target = definition.target || null;
    this.events = definition.events || [];
    
    this.enabled = definition.enabled !== false;
    this.status = RULE_STATUS.ACTIVE;
    
    this.metadata = definition.metadata || {};
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.triggerCount = 0;
    this.lastTriggered = null;
  }

  generateId() {
    return 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      type: this.type,
      priority: this.priority,
      condition: this.condition,
      action: this.action,
      transform: this.transform,
      scope: this.scope,
      target: this.target,
      events: this.events,
      enabled: this.enabled,
      status: this.status,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      triggerCount: this.triggerCount,
      lastTriggered: this.lastTriggered
    };
  }

  static fromJSON(json) {
    const rule = new RuleDefinition(json);
    rule.id = json.id;
    rule.createdAt = json.createdAt;
    rule.updatedAt = json.updatedAt;
    rule.triggerCount = json.triggerCount || 0;
    rule.lastTriggered = json.lastTriggered;
    return rule;
  }
}

class RuleEngine extends EventEmitter {
  constructor(options) {
    super();
    options = options || {};
    this.rules = new Map();
    this.rulesByType = new Map();
    this.rulesByScope = new Map();
    this.rulesByEvent = new Map();
    this.storagePath = options.storagePath || './.maf/rules';
    this.context = options.context || {};
  }

  async init() {
    await this.loadRules();
  }

  register(definition) {
    if (this.rules.has(definition.name)) {
      throw new Error(`Rule already registered: ${definition.name}`);
    }

    const rule = new RuleDefinition(definition);
    this.rules.set(rule.name, rule);

    this.indexByType(rule);
    this.indexByScope(rule);
    this.indexByEvents(rule);

    this.emit('rule:registered', { name: rule.name, rule });
    return rule;
  }

  unregister(name) {
    const rule = this.rules.get(name);
    if (!rule) {
      return false;
    }

    this.rules.delete(name);
    this.removeFromIndex(rule);

    this.emit('rule:unregistered', { name });
    return true;
  }

  indexByType(rule) {
    if (!this.rulesByType.has(rule.type)) {
      this.rulesByType.set(rule.type, new Set());
    }
    this.rulesByType.get(rule.type).add(rule.name);
  }

  indexByScope(rule) {
    if (!this.rulesByScope.has(rule.scope)) {
      this.rulesByScope.set(rule.scope, new Set());
    }
    this.rulesByScope.get(rule.scope).add(rule.name);
  }

  indexByEvents(rule) {
    for (const event of rule.events) {
      if (!this.rulesByEvent.has(event)) {
        this.rulesByEvent.set(event, new Set());
      }
      this.rulesByEvent.get(event).add(rule.name);
    }
  }

  removeFromIndex(rule) {
    const typeRules = this.rulesByType.get(rule.type);
    if (typeRules) {
      typeRules.delete(rule.name);
    }

    const scopeRules = this.rulesByScope.get(rule.scope);
    if (scopeRules) {
      scopeRules.delete(rule.name);
    }

    for (const event of rule.events) {
      const eventRules = this.rulesByEvent.get(event);
      if (eventRules) {
        eventRules.delete(rule.name);
      }
    }
  }

  get(name) {
    return this.rules.get(name);
  }

  list(options) {
    options = options || {};
    let rules = Array.from(this.rules.values());

    if (options.type) {
      rules = rules.filter(r => r.type === options.type);
    }

    if (options.scope) {
      rules = rules.filter(r => r.scope === options.scope);
    }

    if (options.enabled !== undefined) {
      rules = rules.filter(r => r.enabled === options.enabled);
    }

    return rules.sort((a, b) => a.priority - b.priority).map(r => r.toJSON());
  }

  async evaluate(data, options) {
    options = options || {};
    const scope = options.scope || 'global';
    const type = options.type;
    
    let rules = Array.from(this.rules.values())
      .filter(r => r.enabled && (r.scope === scope || r.scope === 'global'));

    if (type) {
      rules = rules.filter(r => r.type === type);
    }

    rules.sort((a, b) => a.priority - b.priority);

    const results = [];
    for (const rule of rules) {
      try {
        const result = await this.evaluateRule(rule, data);
        results.push({
          rule: rule.name,
          passed: result.passed,
          message: result.message,
          data: result.data
        });
      } catch (error) {
        results.push({
          rule: rule.name,
          passed: false,
          error: error.message
        });
      }
    }

    return results;
  }

  async evaluateRule(rule, data) {
    if (!rule.condition) {
      return { passed: true };
    }

    let passed = false;
    let message = '';
    let resultData = data;

    if (typeof rule.condition === 'function') {
      passed = await rule.condition(data, this.context);
    } else if (typeof rule.condition === 'string') {
      try {
        const evalFunc = new Function('data', 'context', `return ${rule.condition}`);
        passed = evalFunc(data, this.context);
      } catch (e) {
        passed = false;
        message = `Condition evaluation error: ${e.message}`;
      }
    } else if (typeof rule.condition === 'object') {
      passed = this.evaluateObjectCondition(rule.condition, data);
    }

    if (passed && rule.transform) {
      resultData = await this.applyTransform(rule, data);
    }

    if (passed && rule.action) {
      await this.executeAction(rule, data);
    }

    rule.triggerCount++;
    rule.lastTriggered = new Date().toISOString();

    return { passed, message, data: resultData };
  }

  evaluateObjectCondition(condition, data) {
    for (const [key, value] of Object.entries(condition)) {
      const dataValue = this.getNestedValue(data, key);
      
      if (value === null || value === undefined) {
        if (dataValue !== value) return false;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        for (const [op, operand] of Object.entries(value)) {
          if (!this.evaluateOperator(op, dataValue, operand)) {
            return false;
          }
        }
      } else if (Array.isArray(value)) {
        if (!value.includes(dataValue)) return false;
      } else {
        if (dataValue !== value) return false;
      }
    }
    return true;
  }

  evaluateOperator(operator, value, operand) {
    switch (operator) {
      case '$eq': return value === operand;
      case '$ne': return value !== operand;
      case '$gt': return value > operand;
      case '$gte': return value >= operand;
      case '$lt': return value < operand;
      case '$lte': return value <= operand;
      case '$in': return Array.isArray(operand) && operand.includes(value);
      case '$nin': return Array.isArray(operand) && !operand.includes(value);
      case '$exists': return (operand ? value !== undefined : value === undefined);
      case '$regex': return new RegExp(operand).test(String(value));
      case '$contains': return String(value).includes(operand);
      case '$startsWith': return String(value).startsWith(operand);
      case '$endsWith': return String(value).endsWith(operand);
      default: return false;
    }
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  async applyTransform(rule, data) {
    if (typeof rule.transform === 'function') {
      return await rule.transform(data, this.context);
    } else if (typeof rule.transform === 'string') {
      try {
        const transformFunc = new Function('data', 'context', rule.transform);
        return transformFunc(data, this.context);
      } catch (e) {
        this.emit('rule:error', { name: rule.name, error: e.message });
        return data;
      }
    }
    return data;
  }

  async executeAction(rule, data) {
    if (typeof rule.action === 'function') {
      await rule.action(data, this.context);
    } else if (typeof rule.action === 'string') {
      try {
        const actionFunc = new Function('data', 'context', rule.action);
        await actionFunc(data, this.context);
      } catch (e) {
        this.emit('rule:error', { name: rule.name, error: e.message });
      }
    }
  }

  async validate(data, options) {
    const results = await this.evaluate(data, { ...options, type: RULE_TYPES.VALIDATION });
    const failures = results.filter(r => !r.passed);
    
    return {
      valid: failures.length === 0,
      failures,
      results
    };
  }

  async checkConstraints(data, options) {
    const results = await this.evaluate(data, { ...options, type: RULE_TYPES.CONSTRAINT });
    const violations = results.filter(r => !r.passed);
    
    return {
      satisfied: violations.length === 0,
      violations,
      results
    };
  }

  async trigger(event, data) {
    const ruleNames = this.rulesByEvent.get(event) || new Set();
    const rules = Array.from(ruleNames)
      .map(name => this.rules.get(name))
      .filter(r => r && r.enabled);

    rules.sort((a, b) => a.priority - b.priority);

    const results = [];
    for (const rule of rules) {
      try {
        const result = await this.evaluateRule(rule, data);
        results.push({
          rule: rule.name,
          triggered: result.passed,
          data: result.data
        });
        this.emit('rule:triggered', { name: rule.name, event, result });
      } catch (error) {
        results.push({
          rule: rule.name,
          triggered: false,
          error: error.message
        });
      }
    }

    return results;
  }

  async guard(action, data) {
    const guardRules = Array.from(this.rules.values())
      .filter(r => r.enabled && r.type === RULE_TYPES.GUARD)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of guardRules) {
      if (rule.target && rule.target !== action) continue;
      
      const result = await this.evaluateRule(rule, data);
      if (!result.passed) {
        this.emit('rule:blocked', { name: rule.name, action, data });
        return { allowed: false, blockedBy: rule.name, reason: result.message };
      }
    }

    return { allowed: true };
  }

  enable(name) {
    const rule = this.rules.get(name);
    if (rule) {
      rule.enabled = true;
      rule.status = RULE_STATUS.ACTIVE;
      this.emit('rule:enabled', { name });
      return true;
    }
    return false;
  }

  disable(name) {
    const rule = this.rules.get(name);
    if (rule) {
      rule.enabled = false;
      rule.status = RULE_STATUS.DISABLED;
      this.emit('rule:disabled', { name });
      return true;
    }
    return false;
  }

  async loadRules() {
    const rulesPath = path.join(this.storagePath, 'rules.json');
    if (!fs.existsSync(rulesPath)) {
      return;
    }

    try {
      const data = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));
      for (const ruleData of data) {
        try {
          const rule = RuleDefinition.fromJSON(ruleData);
          this.rules.set(rule.name, rule);
          this.indexByType(rule);
          this.indexByScope(rule);
          this.indexByEvents(rule);
        } catch (e) {
          this.emit('rule:load:error', { name: ruleData.name, error: e.message });
        }
      }
    } catch (e) {
      this.emit('rule:load:error', { error: e.message });
    }
  }

  async saveRules() {
    const rulesPath = path.join(this.storagePath, 'rules.json');
    const dir = path.dirname(rulesPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data = Array.from(this.rules.values()).map(r => r.toJSON());
    fs.writeFileSync(rulesPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  setContext(key, value) {
    this.context[key] = value;
  }

  getContext(key) {
    return key ? this.context[key] : this.context;
  }

  getStats() {
    const rules = Array.from(this.rules.values());
    return {
      total: rules.length,
      byType: Object.fromEntries(
        Array.from(this.rulesByType.entries()).map(([k, v]) => [k, v.size])
      ),
      byScope: Object.fromEntries(
        Array.from(this.rulesByScope.entries()).map(([k, v]) => [k, v.size])
      ),
      enabled: rules.filter(r => r.enabled).length,
      disabled: rules.filter(r => !r.enabled).length,
      totalTriggers: rules.reduce((sum, r) => sum + r.triggerCount, 0)
    };
  }
}

const BUILTIN_RULES = [
  {
    name: 'file_size_limit',
    description: 'Limit file size to prevent memory issues',
    type: RULE_TYPES.CONSTRAINT,
    priority: RULE_PRIORITY.HIGH,
    condition: { 'size': { '$lte': 10485760 } },
    scope: 'file',
    target: 'file_write'
  },
  {
    name: 'required_fields',
    description: 'Ensure required fields are present',
    type: RULE_TYPES.VALIDATION,
    priority: RULE_PRIORITY.HIGH,
    condition: (data) => {
      if (!data.required || !data.fields) return true;
      return data.required.every(field => data.fields[field] !== undefined);
    },
    scope: 'validation'
  },
  {
    name: 'rate_limit',
    description: 'Rate limiting for API calls',
    type: RULE_TYPES.CONSTRAINT,
    priority: RULE_PRIORITY.CRITICAL,
    condition: (data, context) => {
      const key = data.key || 'default';
      const now = Date.now();
      const window = context.rateLimitWindow || 60000;
      const maxRequests = context.rateLimitMax || 100;
      
      if (!context.rateLimits) context.rateLimits = {};
      if (!context.rateLimits[key]) context.rateLimits[key] = [];
      
      context.rateLimits[key] = context.rateLimits[key].filter(t => now - t < window);
      
      if (context.rateLimits[key].length >= maxRequests) {
        return false;
      }
      
      context.rateLimits[key].push(now);
      return true;
    },
    scope: 'api'
  },
  {
    name: 'sanitize_input',
    description: 'Sanitize user input to prevent injection',
    type: RULE_TYPES.TRANSFORM,
    priority: RULE_PRIORITY.HIGH,
    transform: (data) => {
      if (typeof data === 'string') {
        return data
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }
      return data;
    },
    scope: 'input'
  }
];

module.exports = {
  RuleDefinition,
  RuleEngine,
  RULE_STATUS,
  RULE_TYPES,
  RULE_PRIORITY,
  BUILTIN_RULES
};
