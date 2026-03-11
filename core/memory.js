/**
 * Memory System for Multi-Agent Framework
 * 
 * Supports multiple memory types:
 * - Short-term memory (working memory)
 * - Long-term memory (persistent storage)
 * - Episodic memory (event sequences)
 */

const fs = require('fs');
const path = require('path');

const MEMORY_TYPES = {
  SHORT_TERM: 'short_term',
  LONG_TERM: 'long_term',
  EPISODIC: 'episodic'
};

const DEFAULT_CONFIG = {
  shortTerm: {
    maxSize: 100,
    maxAge: 3600000 // 1 hour in ms
  },
  longTerm: {
    maxSize: 10000,
    indexFields: ['content', 'type', 'tags']
  },
  episodic: {
    maxEvents: 1000,
    retentionDays: 30
  }
};

class MemoryItem {
  constructor(data) {
    this.id = data.id || this.generateId();
    this.content = data.content;
    this.type = data.type || 'general';
    this.metadata = data.metadata || {};
    this.tags = data.tags || [];
    this.importance = data.importance || 0.5;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.lastAccessed = data.lastAccessed || new Date().toISOString();
    this.accessCount = data.accessCount || 0;
  }

  generateId() {
    return 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  touch() {
    this.lastAccessed = new Date().toISOString();
    this.accessCount++;
  }

  toJSON() {
    return {
      id: this.id,
      content: this.content,
      type: this.type,
      metadata: this.metadata,
      tags: this.tags,
      importance: this.importance,
      createdAt: this.createdAt,
      lastAccessed: this.lastAccessed,
      accessCount: this.accessCount
    };
  }

  static fromJSON(json) {
    return new MemoryItem(json);
  }
}

class ShortTermMemory {
  constructor(config) {
    this.config = config || DEFAULT_CONFIG.shortTerm;
    this.items = [];
    this.maxSize = this.config.maxSize;
    this.maxAge = this.config.maxAge;
  }

  add(content, metadata) {
    metadata = metadata || {};
    const item = new MemoryItem({
      content: content,
      type: metadata.type || 'working',
      metadata: metadata,
      importance: metadata.importance || 0.5
    });

    this.items.unshift(item);
    this.enforceLimit();
    return item;
  }

  get(limit) {
    limit = limit || 10;
    this.cleanup();
    return this.items.slice(0, limit);
  }

  getById(id) {
    const item = this.items.find(function(i) { return i.id === id; });
    if (item) {
      item.touch();
    }
    return item;
  }

  search(query, options) {
    options = options || {};
    const limit = options.limit || 10;
    const queryLower = query.toLowerCase();

    return this.items
      .filter(function(item) {
        return item.content.toLowerCase().indexOf(queryLower) !== -1 ||
               item.tags.some(function(tag) { return tag.toLowerCase().indexOf(queryLower) !== -1; });
      })
      .slice(0, limit);
  }

  remove(id) {
    const index = this.items.findIndex(function(i) { return i.id === id; });
    if (index !== -1) {
      return this.items.splice(index, 1)[0];
    }
    return null;
  }

  clear() {
    this.items = [];
  }

  cleanup() {
    const now = Date.now();
    this.items = this.items.filter(function(item) {
      const age = now - new Date(item.createdAt).getTime();
      return age < this.maxAge;
    }.bind(this));
  }

  enforceLimit() {
    if (this.items.length > this.maxSize) {
      this.items = this.items.slice(0, this.maxSize);
    }
  }

  size() {
    return this.items.length;
  }

  toJSON() {
    return this.items.map(function(item) { return item.toJSON(); });
  }

  static fromJSON(data, config) {
    const memory = new ShortTermMemory(config);
    memory.items = data.map(function(item) { return MemoryItem.fromJSON(item); });
    return memory;
  }
}

class LongTermMemory {
  constructor(config, storagePath) {
    this.config = config || DEFAULT_CONFIG.longTerm;
    this.storagePath = storagePath;
    this.index = new Map();
    this.items = [];
    this.maxSize = this.config.maxSize;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    if (this.storagePath && fs.existsSync(this.storagePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.storagePath, 'utf-8'));
        this.items = data.map(function(item) { return MemoryItem.fromJSON(item); });
        this.rebuildIndex();
      } catch (e) {
        this.items = [];
      }
    }
    this.initialized = true;
  }

  rebuildIndex() {
    this.index.clear();
    this.items.forEach(function(item) {
      this.indexItem(item);
    }.bind(this));
  }

  indexItem(item) {
    var self = this;
    // Index by content words
    var words = item.content.toLowerCase().split(/\s+/);
    words.forEach(function(word) {
      if (word.length > 2) {
        if (!self.index.has(word)) {
          self.index.set(word, new Set());
        }
        self.index.get(word).add(item.id);
      }
    });

    // Index by tags
    item.tags.forEach(function(tag) {
      var tagLower = tag.toLowerCase();
      if (!self.index.has(tagLower)) {
        self.index.set(tagLower, new Set());
      }
      self.index.get(tagLower).add(item.id);
    });

    // Index by type
    if (!self.index.has('type:' + item.type)) {
      self.index.set('type:' + item.type, new Set());
    }
    self.index.get('type:' + item.type).add(item.id);
  }

  async add(content, metadata) {
    await this.init();
    metadata = metadata || {};

    const item = new MemoryItem({
      content: content,
      type: metadata.type || 'knowledge',
      metadata: metadata,
      tags: metadata.tags || [],
      importance: metadata.importance || 0.5
    });

    this.items.unshift(item);
    this.indexItem(item);
    this.enforceLimit();
    await this.save();

    return item;
  }

  async get(limit) {
    await this.init();
    limit = limit || 20;
    return this.items.slice(0, limit);
  }

  async getById(id) {
    await this.init();
    const item = this.items.find(function(i) { return i.id === id; });
    if (item) {
      item.touch();
      await this.save();
    }
    return item;
  }

  async search(query, options) {
    await this.init();
    options = options || {};
    const limit = options.limit || 10;
    const minScore = options.minScore || 0.1;

    const queryWords = query.toLowerCase().split(/\s+/);
    const scores = new Map();

    // Calculate scores based on index matches
    queryWords.forEach(function(word) {
      if (word.length > 2 && this.index.has(word)) {
        this.index.get(word).forEach(function(itemId) {
          scores.set(itemId, (scores.get(itemId) || 0) + 1);
        });
      }
    }.bind(this));

    // Normalize scores
    const maxScore = Math.max.apply(null, Array.from(scores.values()).concat([1]));
    const results = [];

    scores.forEach(function(score, itemId) {
      const normalizedScore = score / maxScore;
      if (normalizedScore >= minScore) {
        const item = this.items.find(function(i) { return i.id === itemId; });
        if (item) {
          results.push({
            item: item,
            score: normalizedScore
          });
        }
      }
    }.bind(this));

    // Sort by score and return top results
    results.sort(function(a, b) { return b.score - a.score; });
    return results.slice(0, limit);
  }

  async update(id, updates) {
    await this.init();
    const item = this.items.find(function(i) { return i.id === id; });
    if (item) {
      Object.assign(item, updates);
      item.touch();
      await this.save();
      return item;
    }
    return null;
  }

  async remove(id) {
    await this.init();
    const index = this.items.findIndex(function(i) { return i.id === id; });
    if (index !== -1) {
      const item = this.items.splice(index, 1)[0];
      this.rebuildIndex();
      await this.save();
      return item;
    }
    return null;
  }

  async clear() {
    this.items = [];
    this.index.clear();
    await this.save();
  }

  enforceLimit() {
    if (this.items.length > this.maxSize) {
      // Remove least important items
      this.items.sort(function(a, b) {
        return (b.importance + b.accessCount * 0.1) - (a.importance + a.accessCount * 0.1);
      });
      this.items = this.items.slice(0, this.maxSize);
      this.rebuildIndex();
    }
  }

  async save() {
    if (this.storagePath) {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storagePath, JSON.stringify(this.toJSON(), null, 2), 'utf-8');
    }
  }

  size() {
    return this.items.length;
  }

  toJSON() {
    return this.items.map(function(item) { return item.toJSON(); });
  }

  static fromJSON(data, config, storagePath) {
    const memory = new LongTermMemory(config, storagePath);
    memory.items = data.map(function(item) { return MemoryItem.fromJSON(item); });
    memory.rebuildIndex();
    memory.initialized = true;
    return memory;
  }
}

class EpisodicMemory {
  constructor(config, storagePath) {
    this.config = config || DEFAULT_CONFIG.episodic;
    this.storagePath = storagePath;
    this.events = [];
    this.maxEvents = this.config.maxEvents;
    this.retentionDays = this.config.retentionDays;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    if (this.storagePath && fs.existsSync(this.storagePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.storagePath, 'utf-8'));
        this.events = data;
      } catch (e) {
        this.events = [];
      }
    }
    this.initialized = true;
  }

  async record(event) {
    await this.init();

    const record = {
      id: 'epi_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      type: event.type || 'general',
      agent: event.agent || 'unknown',
      action: event.action || '',
      details: event.details || {},
      result: event.result || null,
      relatedTask: event.relatedTask || null,
      relatedMessage: event.relatedMessage || null,
      sessionId: event.sessionId || null
    };

    this.events.push(record);
    this.enforceLimit();
    await this.save();

    return record;
  }

  async getRange(startTime, endTime) {
    await this.init();
    const start = startTime ? new Date(startTime).getTime() : 0;
    const end = endTime ? new Date(endTime).getTime() : Date.now();

    return this.events.filter(function(event) {
      const eventTime = new Date(event.timestamp).getTime();
      return eventTime >= start && eventTime <= end;
    });
  }

  async getByAgent(agent, limit) {
    await this.init();
    limit = limit || 100;

    return this.events
      .filter(function(event) { return event.agent === agent; })
      .slice(-limit);
  }

  async getByType(type, limit) {
    await this.init();
    limit = limit || 100;

    return this.events
      .filter(function(event) { return event.type === type; })
      .slice(-limit);
  }

  async getByTask(taskId) {
    await this.init();
    return this.events.filter(function(event) { return event.relatedTask === taskId; });
  }

  async getBySession(sessionId) {
    await this.init();
    return this.events.filter(function(event) { return event.sessionId === sessionId; });
  }

  async getRecent(limit) {
    await this.init();
    limit = limit || 50;
    return this.events.slice(-limit);
  }

  async search(query, options) {
    await this.init();
    options = options || {};
    const limit = options.limit || 20;
    const queryLower = query.toLowerCase();

    return this.events
      .filter(function(event) {
        return (event.action && event.action.toLowerCase().indexOf(queryLower) !== -1) ||
               JSON.stringify(event.details).toLowerCase().indexOf(queryLower) !== -1;
      })
      .slice(-limit);
  }

  async clear() {
    this.events = [];
    await this.save();
  }

  async cleanup() {
    const cutoff = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
    this.events = this.events.filter(function(event) {
      return new Date(event.timestamp).getTime() > cutoff;
    });
    await this.save();
  }

  enforceLimit() {
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  async save() {
    if (this.storagePath) {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storagePath, JSON.stringify(this.events, null, 2), 'utf-8');
    }
  }

  size() {
    return this.events.length;
  }

  toJSON() {
    return this.events;
  }
}

class AgentMemory {
  constructor(agentName, options) {
    options = options || {};
    this.agentName = agentName;
    this.rootPath = options.rootPath || './.maf/memory';
    this.config = { ...DEFAULT_CONFIG, ...options.config };

    const agentPath = path.join(this.rootPath, agentName);

    this.shortTerm = new ShortTermMemory(this.config.shortTerm);
    this.longTerm = new LongTermMemory(
      this.config.longTerm,
      path.join(agentPath, 'long_term.json')
    );
    this.episodic = new EpisodicMemory(
      this.config.episodic,
      path.join(agentPath, 'episodic.json')
    );
  }

  async init() {
    const agentPath = path.join(this.rootPath, this.agentName);
    if (!fs.existsSync(agentPath)) {
      fs.mkdirSync(agentPath, { recursive: true });
    }
    await this.longTerm.init();
    await this.episodic.init();
  }

  // Short-term memory methods
  remember(content, metadata) {
    return this.shortTerm.add(content, metadata);
  }

  recall(limit) {
    return this.shortTerm.get(limit);
  }

  recallRecent(limit) {
    return this.shortTerm.get(limit);
  }

  // Long-term memory methods
  async memorize(content, metadata) {
    return await this.longTerm.add(content, metadata);
  }

  async retrieve(query, options) {
    const results = await this.longTerm.search(query, options);
    return results.map(function(r) { return r.item; });
  }

  async retrieveWithScore(query, options) {
    return await this.longTerm.search(query, options);
  }

  // Episodic memory methods
  async recordEvent(event) {
    event.agent = this.agentName;
    return await this.episodic.record(event);
  }

  async recallEvents(startTime, endTime) {
    return await this.episodic.getRange(startTime, endTime);
  }

  async recallRecentEvents(limit) {
    return await this.episodic.getRecent(limit);
  }

  // Combined search across all memory types
  async search(query, options) {
    options = options || {};
    const results = {
      shortTerm: this.shortTerm.search(query, options),
      longTerm: await this.longTerm.search(query, options),
      episodic: await this.episodic.search(query, options)
    };

    return results;
  }

  // Get context summary for LLM
  async getContextSummary(maxItems) {
    maxItems = maxItems || 10;

    const recent = this.shortTerm.get(maxItems);
    const events = await this.episodic.getRecent(5);

    return {
      agent: this.agentName,
      recentMemory: recent.map(function(item) { return item.content; }),
      recentEvents: events.map(function(e) { return e.action; }),
      shortTermSize: this.shortTerm.size(),
      longTermSize: this.longTerm.size(),
      episodicSize: this.episodic.size()
    };
  }

  // Memory management
  async clear(type) {
    if (!type || type === 'short_term') {
      this.shortTerm.clear();
    }
    if (!type || type === 'long_term') {
      await this.longTerm.clear();
    }
    if (!type || type === 'episodic') {
      await this.episodic.clear();
    }
  }

  async cleanup() {
    this.shortTerm.cleanup();
    await this.episodic.cleanup();
  }

  // Statistics
  getStats() {
    return {
      agent: this.agentName,
      shortTerm: {
        size: this.shortTerm.size(),
        maxSize: this.shortTerm.maxSize
      },
      longTerm: {
        size: this.longTerm.size(),
        maxSize: this.longTerm.maxSize
      },
      episodic: {
        size: this.episodic.size(),
        maxEvents: this.episodic.maxEvents
      }
    };
  }

  // Export/Import
  async export() {
    return {
      agent: this.agentName,
      shortTerm: this.shortTerm.toJSON(),
      longTerm: this.longTerm.toJSON(),
      episodic: this.episodic.toJSON(),
      exportedAt: new Date().toISOString()
    };
  }

  async import(data) {
    if (data.shortTerm) {
      this.shortTerm = ShortTermMemory.fromJSON(data.shortTerm, this.config.shortTerm);
    }
    if (data.longTerm) {
      this.longTerm = LongTermMemory.fromJSON(
        data.longTerm,
        this.config.longTerm,
        path.join(this.rootPath, this.agentName, 'long_term.json')
      );
    }
    if (data.episodic) {
      this.episodic.events = data.episodic;
      this.episodic.initialized = true;
    }
    await this.longTerm.save();
    await this.episodic.save();
  }
}

// Memory Manager for all agents
class MemoryManager {
  constructor(options) {
    options = options || {};
    this.rootPath = options.rootPath || './.maf/memory';
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    this.agents = new Map();
  }

  getAgentMemory(agentName) {
    if (!this.agents.has(agentName)) {
      const memory = new AgentMemory(agentName, {
        rootPath: this.rootPath,
        config: this.config
      });
      this.agents.set(agentName, memory);
    }
    return this.agents.get(agentName);
  }

  async initAgent(agentName) {
    const memory = this.getAgentMemory(agentName);
    await memory.init();
    return memory;
  }

  async initAllAgents() {
    const promises = [];
    this.agents.forEach(function(memory, agentName) {
      promises.push(memory.init());
    });
    await Promise.all(promises);
  }

  // Cross-agent memory search
  async searchAll(query, options) {
    options = options || {};
    const results = {};

    for (const [agentName, memory] of this.agents) {
      results[agentName] = await memory.search(query, options);
    }

    return results;
  }

  // Get all agent stats
  getAllStats() {
    const stats = {};
    this.agents.forEach(function(memory, agentName) {
      stats[agentName] = memory.getStats();
    });
    return stats;
  }

  // Cleanup all agents
  async cleanupAll() {
    const promises = [];
    this.agents.forEach(function(memory) {
      promises.push(memory.cleanup());
    });
    await Promise.all(promises);
  }

  // Export all memories
  async exportAll() {
    const data = {
      exportedAt: new Date().toISOString(),
      agents: {}
    };

    for (const [agentName, memory] of this.agents) {
      data.agents[agentName] = await memory.export();
    }

    return data;
  }
}

module.exports = {
  MemoryItem,
  ShortTermMemory,
  LongTermMemory,
  EpisodicMemory,
  AgentMemory,
  MemoryManager,
  MEMORY_TYPES,
  DEFAULT_CONFIG
};
