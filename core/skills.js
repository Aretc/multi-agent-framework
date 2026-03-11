/**
 * Skills Management System for Multi-Agent Framework
 * 
 * Skills are composable capability units that can:
 * - Combine multiple tools
 * - Include rules and constraints
 * - Be discovered and installed dynamically
 * - Support versioning and dependencies
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const SKILL_STATUS = {
  INSTALLED: 'installed',
  ACTIVE: 'active',
  DISABLED: 'disabled',
  ERROR: 'error',
  PENDING: 'pending'
};

class SkillDefinition {
  constructor(definition) {
    this.id = definition.id || this.generateId();
    this.name = definition.name;
    this.version = definition.version || '1.0.0';
    this.description = definition.description || '';
    this.author = definition.author || 'unknown';
    this.category = definition.category || 'general';
    this.tags = definition.tags || [];
    
    this.tools = definition.tools || [];
    this.rules = definition.rules || [];
    this.dependencies = definition.dependencies || [];
    
    this.config = definition.config || {};
    this.defaultConfig = definition.defaultConfig || {};
    
    this.entryPoint = definition.entryPoint || 'index.js';
    this.handler = definition.handler || null;
    
    this.status = SKILL_STATUS.INSTALLED;
    this.enabled = true;
    this.priority = definition.priority || 50;
    
    this.metadata = definition.metadata || {};
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.lastUsed = null;
    this.useCount = 0;
  }

  generateId() {
    return 'skill_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  validateConfig(config) {
    const merged = { ...this.defaultConfig, ...config };
    const errors = [];

    if (this.config.required) {
      for (const field of this.config.required) {
        if (merged[field] === undefined) {
          errors.push(`Missing required config: ${field}`);
        }
      }
    }

    return { valid: errors.length === 0, errors, config: merged };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      description: this.description,
      author: this.author,
      category: this.category,
      tags: this.tags,
      tools: this.tools,
      rules: this.rules,
      dependencies: this.dependencies,
      config: this.config,
      defaultConfig: this.defaultConfig,
      status: this.status,
      enabled: this.enabled,
      priority: this.priority,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastUsed: this.lastUsed,
      useCount: this.useCount
    };
  }

  static fromJSON(json) {
    const skill = new SkillDefinition(json);
    skill.id = json.id;
    skill.createdAt = json.createdAt;
    skill.updatedAt = json.updatedAt;
    skill.lastUsed = json.lastUsed;
    skill.useCount = json.useCount || 0;
    return skill;
  }
}

class SkillRegistry extends EventEmitter {
  constructor(options) {
    super();
    options = options || {};
    this.skills = new Map();
    this.categories = new Map();
    this.storagePath = options.storagePath || './.maf/skills';
    this.toolRegistry = options.toolRegistry || null;
    this.ruleEngine = options.ruleEngine || null;
  }

  async init() {
    await this.loadInstalledSkills();
  }

  async install(definition, source) {
    if (this.skills.has(definition.name)) {
      const existing = this.skills.get(definition.name);
      if (existing.version === definition.version) {
        throw new Error(`Skill ${definition.name}@${definition.version} already installed`);
      }
      await this.uninstall(definition.name);
    }

    const skill = new SkillDefinition(definition);
    
    if (skill.dependencies.length > 0) {
      await this.checkDependencies(skill);
    }

    this.skills.set(skill.name, skill);

    if (!this.categories.has(skill.category)) {
      this.categories.set(skill.category, new Set());
    }
    this.categories.get(skill.category).add(skill.name);

    if (source) {
      await this.saveSkill(skill, source);
    }

    this.emit('skill:installed', { name: skill.name, version: skill.version });
    return skill;
  }

  async uninstall(name) {
    const skill = this.skills.get(name);
    if (!skill) {
      return false;
    }

    this.skills.delete(name);

    const categorySkills = this.categories.get(skill.category);
    if (categorySkills) {
      categorySkills.delete(name);
      if (categorySkills.size === 0) {
        this.categories.delete(skill.category);
      }
    }

    const skillPath = path.join(this.storagePath, skill.name);
    if (fs.existsSync(skillPath)) {
      fs.rmSync(skillPath, { recursive: true });
    }

    this.emit('skill:uninstalled', { name });
    return true;
  }

  async checkDependencies(skill) {
    const missing = [];
    
    for (const dep of skill.dependencies) {
      const depName = typeof dep === 'string' ? dep : dep.name;
      if (!this.skills.has(depName)) {
        missing.push(depName);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing dependencies: ${missing.join(', ')}`);
    }
  }

  get(name) {
    return this.skills.get(name);
  }

  list(options) {
    options = options || {};
    let skills = Array.from(this.skills.values());

    if (options.category) {
      skills = skills.filter(s => s.category === options.category);
    }

    if (options.status) {
      skills = skills.filter(s => s.status === options.status);
    }

    if (options.enabled !== undefined) {
      skills = skills.filter(s => s.enabled === options.enabled);
    }

    if (options.tag) {
      skills = skills.filter(s => s.tags.includes(options.tag));
    }

    return skills.map(s => s.toJSON());
  }

  listCategories() {
    const result = {};
    for (const [category, skillNames] of this.categories) {
      result[category] = Array.from(skillNames);
    }
    return result;
  }

  async execute(name, input, context) {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill not found: ${name}`);
    }

    if (!skill.enabled) {
      throw new Error(`Skill is disabled: ${name}`);
    }

    if (!skill.handler) {
      throw new Error(`Skill has no handler: ${name}`);
    }

    const startTime = Date.now();
    try {
      skill.status = SKILL_STATUS.ACTIVE;
      this.emit('skill:executing', { name, input });

      const result = await skill.handler(input, {
        ...context,
        skill,
        tools: this.toolRegistry,
        rules: this.ruleEngine
      });

      const duration = Date.now() - startTime;
      skill.lastUsed = new Date().toISOString();
      skill.useCount++;

      this.emit('skill:executed', { name, result, duration });
      return { success: true, result, duration };

    } catch (error) {
      const duration = Date.now() - startTime;
      skill.status = SKILL_STATUS.ERROR;
      this.emit('skill:error', { name, error: error.message, duration });
      return { success: false, error: error.message, duration };
    }
  }

  enable(name) {
    const skill = this.skills.get(name);
    if (skill) {
      skill.enabled = true;
      skill.status = SKILL_STATUS.INSTALLED;
      this.emit('skill:enabled', { name });
      return true;
    }
    return false;
  }

  disable(name) {
    const skill = this.skills.get(name);
    if (skill) {
      skill.enabled = false;
      skill.status = SKILL_STATUS.DISABLED;
      this.emit('skill:disabled', { name });
      return true;
    }
    return false;
  }

  configure(name, config) {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill not found: ${name}`);
    }

    const validation = skill.validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
    }

    skill.config = validation.config;
    skill.updatedAt = new Date().toISOString();
    this.emit('skill:configured', { name, config: validation.config });
    return skill;
  }

  async loadInstalledSkills() {
    if (!fs.existsSync(this.storagePath)) {
      return;
    }

    const dirs = fs.readdirSync(this.storagePath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const dir of dirs) {
      try {
        const skillPath = path.join(this.storagePath, dir);
        const manifestPath = path.join(skillPath, 'skill.json');

        if (!fs.existsSync(manifestPath)) {
          continue;
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const skill = SkillDefinition.fromJSON(manifest);

        const entryPath = path.join(skillPath, skill.entryPoint);
        if (fs.existsSync(entryPath)) {
          delete require.cache[require.resolve(entryPath)];
          const module = require(entryPath);
          skill.handler = module.handler || module.default || module;
        }

        this.skills.set(skill.name, skill);

        if (!this.categories.has(skill.category)) {
          this.categories.set(skill.category, new Set());
        }
        this.categories.get(skill.category).add(skill.name);

      } catch (e) {
        this.emit('skill:load:error', { name: dir, error: e.message });
      }
    }
  }

  async saveSkill(skill, source) {
    const skillPath = path.join(this.storagePath, skill.name);
    if (!fs.existsSync(skillPath)) {
      fs.mkdirSync(skillPath, { recursive: true });
    }

    const manifestPath = path.join(skillPath, 'skill.json');
    fs.writeFileSync(manifestPath, JSON.stringify(skill.toJSON(), null, 2), 'utf-8');

    if (source) {
      const entryPath = path.join(skillPath, skill.entryPoint);
      fs.writeFileSync(entryPath, source, 'utf-8');
    }
  }

  async createFromTemplate(name, template) {
    const templates = {
      basic: {
        name,
        description: 'A basic skill',
        category: 'general',
        tools: [],
        rules: [],
        dependencies: [],
        config: {},
        defaultConfig: {}
      },
      code: {
        name,
        description: 'A code-related skill',
        category: 'development',
        tools: ['file_read', 'file_write', 'code_execute'],
        rules: [],
        dependencies: [],
        config: { language: 'javascript' },
        defaultConfig: { language: 'javascript' }
      },
      analysis: {
        name,
        description: 'An analysis skill',
        category: 'analysis',
        tools: ['file_read', 'json_parse', 'text_process'],
        rules: [],
        dependencies: [],
        config: {},
        defaultConfig: {}
      },
      automation: {
        name,
        description: 'An automation skill',
        category: 'automation',
        tools: ['shell_exec', 'api_call', 'file_write'],
        rules: [],
        dependencies: [],
        config: { timeout: 30000 },
        defaultConfig: { timeout: 30000 }
      }
    };

    const definition = templates[template] || templates.basic;
    const source = `/**
 * Skill: ${name}
 * ${definition.description}
 */

module.exports = {
  handler: async (input, context) => {
    // Your skill logic here
    const { tools, rules, config } = context;
    
    // Example: Use tools
    // if (tools) {
    //   const result = await tools.execute('file_read', { path: input.path });
    // }
    
    return {
      success: true,
      message: 'Skill ${name} executed',
      input
    };
  }
};
`;

    await this.install(definition, source);
    return this.get(name);
  }

  search(query) {
    const queryLower = query.toLowerCase();
    return Array.from(this.skills.values())
      .filter(skill => 
        skill.name.toLowerCase().includes(queryLower) ||
        skill.description.toLowerCase().includes(queryLower) ||
        skill.tags.some(tag => tag.toLowerCase().includes(queryLower))
      )
      .map(s => s.toJSON());
  }

  getStats() {
    const skills = Array.from(this.skills.values());
    return {
      total: skills.length,
      byStatus: {
        installed: skills.filter(s => s.status === SKILL_STATUS.INSTALLED).length,
        active: skills.filter(s => s.status === SKILL_STATUS.ACTIVE).length,
        disabled: skills.filter(s => s.status === SKILL_STATUS.DISABLED).length,
        error: skills.filter(s => s.status === SKILL_STATUS.ERROR).length
      },
      byCategory: Object.fromEntries(
        Array.from(this.categories.entries()).map(([k, v]) => [k, v.size])
      ),
      totalExecutions: skills.reduce((sum, s) => sum + s.useCount, 0)
    };
  }

  export(name) {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill not found: ${name}`);
    }

    const skillPath = path.join(this.storagePath, skill.name);
    const files = {};

    if (fs.existsSync(skillPath)) {
      const walk = (dir, base) => {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const relPath = path.relative(base, fullPath);
          if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath, base);
          } else {
            files[relPath] = fs.readFileSync(fullPath, 'utf-8');
          }
        }
      };
      walk(skillPath, skillPath);
    }

    return {
      manifest: skill.toJSON(),
      files
    };
  }

  async import(data) {
    const skill = SkillDefinition.fromJSON(data.manifest);
    const skillPath = path.join(this.storagePath, skill.name);
    
    if (!fs.existsSync(skillPath)) {
      fs.mkdirSync(skillPath, { recursive: true });
    }

    for (const [relPath, content] of Object.entries(data.files)) {
      const fullPath = path.join(skillPath, relPath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, content, 'utf-8');
    }

    await this.loadInstalledSkills();
    return this.get(skill.name);
  }
}

module.exports = {
  SkillDefinition,
  SkillRegistry,
  SKILL_STATUS
};
