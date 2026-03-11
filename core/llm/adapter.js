/**
 * LLM Adapter System - Enhanced Version
 * Supports multiple LLM providers: OpenAI, Anthropic, Local models (Ollama, LM Studio)
 * Features: Streaming, Retry, Timeout, Token Counting, Function Calling
 */

const https = require('https');
const http = require('http');
const { EventEmitter } = require('events');
const { Readable } = require('stream');

const LLM_PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  OLLAMA: 'ollama',
  LMSTUDIO: 'lmstudio',
  MOCK: 'mock'
};

const DEFAULT_MODELS = {
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20241022',
  ollama: 'llama3.2',
  lmstudio: 'local-model',
  mock: 'mock-model'
};

const MODEL_CONTEXT_SIZES = {
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16385,
  'claude-3-5-sonnet-20241022': 200000,
  'claude-3-opus-20240229': 200000,
  'claude-3-sonnet-20240229': 200000,
  'claude-3-haiku-20240307': 200000,
  'llama3.2': 128000,
  'llama3.1': 128000,
  'llama2': 4096,
  'mistral': 32000,
  'codellama': 16384,
  'deepseek-coder': 16384
};

class LLMAdapter extends EventEmitter {
  constructor(config) {
    super();
    this.config = config || {};
    this.model = this.config.model || 'default';
    this.maxTokens = this.config.maxTokens || 4096;
    this.temperature = this.config.temperature !== undefined ? this.config.temperature : 0.7;
    this.timeout = this.config.timeout || 120000;
    this.maxRetries = this.config.maxRetries || 3;
    this.retryDelay = this.config.retryDelay || 1000;
  }

  async chat(messages, options) {
    throw new Error('chat() must be implemented by subclass');
  }

  async embed(text) {
    throw new Error('embed() must be implemented by subclass');
  }

  async stream(messages, onChunk, options) {
    const result = await this.chat(messages, options);
    if (onChunk) {
      onChunk(result.content);
    }
    return result;
  }

  formatMessages(messages) {
    return messages.map(function(m) {
      if (typeof m === 'string') {
        return { role: 'user', content: m };
      }
      return m;
    });
  }

  countTokens(text) {
    if (!text) return 0;
    if (typeof text !== 'string') {
      text = JSON.stringify(text);
    }
    const charCount = text.length;
    const wordCount = text.split(/\s+/).length;
    return Math.ceil((charCount / 4 + wordCount * 0.5) / 2);
  }

  countMessagesTokens(messages) {
    const self = this;
    let total = 0;
    messages.forEach(function(m) {
      total += self.countTokens(m.content || '');
      total += 4;
    });
    return total;
  }

  getContextSize(model) {
    return MODEL_CONTEXT_SIZES[model] || 8192;
  }

  async withRetry(fn, retries) {
    const self = this;
    retries = retries !== undefined ? retries : this.maxRetries;
    let lastError;
    
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (e) {
        lastError = e;
        if (i < retries && self.isRetryableError(e)) {
          const delay = self.retryDelay * Math.pow(2, i);
          self.emit('retry', { attempt: i + 1, delay: delay, error: e.message });
          await self.sleep(delay);
        } else {
          break;
        }
      }
    }
    throw lastError;
  }

  isRetryableError(error) {
    const message = error.message.toLowerCase();
    return message.includes('rate limit') ||
           message.includes('timeout') ||
           message.includes('429') ||
           message.includes('503') ||
           message.includes('502') ||
           message.includes('connection');
  }

  sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  truncateMessages(messages, maxTokens) {
    const self = this;
    const result = [];
    let totalTokens = 0;
    
    for (let i = messages.length - 1; i >= 0; i--) {
      const msgTokens = self.countTokens(messages[i].content || '');
      if (totalTokens + msgTokens <= maxTokens) {
        result.unshift(messages[i]);
        totalTokens += msgTokens;
      } else {
        break;
      }
    }
    
    if (result.length === 0 && messages.length > 0) {
      result.push(messages[messages.length - 1]);
    }
    
    return result;
  }

  toJSON() {
    return {
      provider: this.constructor.name.replace('Adapter', '').toLowerCase(),
      model: this.model,
      maxTokens: this.maxTokens,
      temperature: this.temperature
    };
  }
}

class OpenAIAdapter extends LLMAdapter {
  constructor(config) {
    super(config);
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.model = config.model || DEFAULT_MODELS.openai;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.organization = config.organization;
  }

  async chat(messages, options) {
    const self = this;
    options = options || {};
    
    return this.withRetry(async function() {
      const formattedMessages = self.formatMessages(messages);
      const contextSize = self.getContextSize(options.model || self.model);
      const maxInputTokens = contextSize - (options.maxTokens || self.maxTokens) - 100;
      
      let processedMessages = formattedMessages;
      if (self.countMessagesTokens(formattedMessages) > maxInputTokens) {
        processedMessages = self.truncateMessages(formattedMessages, maxInputTokens);
        self.emit('truncated', { original: formattedMessages.length, truncated: processedMessages.length });
      }

      const body = {
        model: options.model || self.model,
        messages: processedMessages,
        max_tokens: options.maxTokens || self.maxTokens,
        temperature: options.temperature !== undefined ? options.temperature : self.temperature
      };

      if (options.tools) {
        body.tools = options.tools;
        body.tool_choice = options.toolChoice || 'auto';
      }

      if (options.responseFormat) {
        body.response_format = options.responseFormat;
      }

      if (options.stop) {
        body.stop = options.stop;
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + self.apiKey
      };

      if (self.organization) {
        headers['OpenAI-Organization'] = self.organization;
      }

      const response = await self.request('/chat/completions', body, headers, options.timeout || self.timeout);

      const result = {
        content: response.choices[0].message.content,
        role: response.choices[0].message.role,
        toolCalls: response.choices[0].message.tool_calls,
        usage: response.usage,
        model: response.model,
        finishReason: response.choices[0].finish_reason
      };

      self.emit('response', result);
      return result;
    });
  }

  async stream(messages, onChunk, options) {
    const self = this;
    options = options || {};
    
    return new Promise(function(resolve, reject) {
      const formattedMessages = self.formatMessages(messages);
      
      const body = {
        model: options.model || self.model,
        messages: formattedMessages,
        max_tokens: options.maxTokens || self.maxTokens,
        temperature: options.temperature !== undefined ? options.temperature : self.temperature,
        stream: true
      };

      if (options.tools) {
        body.tools = options.tools;
        body.tool_choice = options.toolChoice || 'auto';
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + self.apiKey
      };

      if (self.organization) {
        headers['OpenAI-Organization'] = self.organization;
      }

      const url = new URL(self.baseUrl + '/chat/completions');
      let fullContent = '';
      let toolCalls = [];
      let usage = null;

      const req = https.request({
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: headers,
        timeout: options.timeout || self.timeout
      }, function(res) {
        let buffer = '';
        
        res.on('data', function(chunk) {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          lines.forEach(function(line) {
            line = line.trim();
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                return;
              }
              
              try {
                const json = JSON.parse(data);
                const delta = json.choices[0]?.delta;
                
                if (delta?.content) {
                  fullContent += delta.content;
                  if (onChunk) {
                    onChunk(delta.content, fullContent);
                  }
                  self.emit('chunk', { content: delta.content, accumulated: fullContent });
                }
                
                if (delta?.tool_calls) {
                  delta.tool_calls.forEach(function(tc) {
                    if (!toolCalls[tc.index]) {
                      toolCalls[tc.index] = { id: tc.id, type: 'function', function: { name: '', arguments: '' } };
                    }
                    if (tc.function?.name) {
                      toolCalls[tc.index].function.name += tc.function.name;
                    }
                    if (tc.function?.arguments) {
                      toolCalls[tc.index].function.arguments += tc.function.arguments;
                    }
                  });
                }
                
                if (json.usage) {
                  usage = json.usage;
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          });
        });
        
        res.on('end', function() {
          const result = {
            content: fullContent,
            role: 'assistant',
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            usage: usage,
            model: options.model || self.model,
            finishReason: 'stop'
          };
          self.emit('response', result);
          resolve(result);
        });
        
        res.on('error', reject);
      });

      req.on('error', reject);
      req.on('timeout', function() {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.write(JSON.stringify(body));
      req.end();
    });
  }

  async embed(text, options) {
    const self = this;
    options = options || {};
    
    const body = {
      model: options.model || 'text-embedding-3-small',
      input: Array.isArray(text) ? text : [text]
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + this.apiKey
    };

    const response = await this.request('/embeddings', body, headers, options.timeout || this.timeout);
    
    if (Array.isArray(text)) {
      return response.data.map(function(d) { return d.embedding; });
    }
    return response.data[0].embedding;
  }

  async request(endpoint, body, headers, timeout) {
    const url = new URL(this.baseUrl + endpoint);
    const self = this;

    return new Promise(function(resolve, reject) {
      const req = https.request({
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: headers,
        timeout: timeout || self.timeout
      }, function(res) {
        let data = '';
        res.on('data', function(chunk) { data += chunk; });
        res.on('end', function() {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 400) {
              const errorMsg = json.error?.message || json.error?.type || 'API Error: ' + res.statusCode;
              reject(new Error(errorMsg));
            } else {
              resolve(json);
            }
          } catch (e) {
            reject(new Error('Failed to parse response: ' + data.substring(0, 200)));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', function() {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.write(JSON.stringify(body));
      req.end();
    });
  }
}

class AnthropicAdapter extends LLMAdapter {
  constructor(config) {
    super(config);
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    this.model = config.model || DEFAULT_MODELS.anthropic;
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
  }

  async chat(messages, options) {
    const self = this;
    options = options || {};
    
    return this.withRetry(async function() {
      const formattedMessages = self.formatMessages(messages);
      
      let systemPrompt = '';
      const chatMessages = formattedMessages.filter(function(m) {
        if (m.role === 'system') {
          systemPrompt = m.content;
          return false;
        }
        return true;
      });

      const body = {
        model: options.model || self.model,
        messages: chatMessages,
        max_tokens: options.maxTokens || self.maxTokens,
        temperature: options.temperature !== undefined ? options.temperature : self.temperature
      };

      if (systemPrompt) {
        body.system = systemPrompt;
      }

      if (options.tools) {
        body.tools = self.formatTools(options.tools);
        if (options.toolChoice) {
          body.tool_choice = options.toolChoice;
        }
      }

      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': self.apiKey,
        'anthropic-version': '2023-06-01'
      };

      const response = await self.request('/messages', body, headers, options.timeout || self.timeout);

      const result = {
        content: response.content.find(function(c) { return c.type === 'text'; })?.text || '',
        role: 'assistant',
        toolCalls: response.content.filter(function(c) { return c.type === 'tool_use'; }).map(function(c) {
          return {
            id: c.id,
            type: 'function',
            function: {
              name: c.name,
              arguments: JSON.stringify(c.input)
            }
          };
        }),
        usage: { 
          input_tokens: response.usage.input_tokens, 
          output_tokens: response.usage.output_tokens 
        },
        model: response.model,
        finishReason: response.stop_reason
      };

      self.emit('response', result);
      return result;
    });
  }

  async stream(messages, onChunk, options) {
    const self = this;
    options = options || {};
    
    return new Promise(function(resolve, reject) {
      const formattedMessages = self.formatMessages(messages);
      
      let systemPrompt = '';
      const chatMessages = formattedMessages.filter(function(m) {
        if (m.role === 'system') {
          systemPrompt = m.content;
          return false;
        }
        return true;
      });

      const body = {
        model: options.model || self.model,
        messages: chatMessages,
        max_tokens: options.maxTokens || self.maxTokens,
        temperature: options.temperature !== undefined ? options.temperature : self.temperature,
        stream: true
      };

      if (systemPrompt) {
        body.system = systemPrompt;
      }

      if (options.tools) {
        body.tools = self.formatTools(options.tools);
      }

      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': self.apiKey,
        'anthropic-version': '2023-06-01'
      };

      const url = new URL(self.baseUrl + '/messages');
      let fullContent = '';
      let toolCalls = [];
      let usage = null;

      const req = https.request({
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: headers,
        timeout: options.timeout || self.timeout
      }, function(res) {
        let buffer = '';
        
        res.on('data', function(chunk) {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          lines.forEach(function(line) {
            line = line.trim();
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              try {
                const json = JSON.parse(data);
                
                if (json.type === 'content_block_delta' && json.delta?.text) {
                  fullContent += json.delta.text;
                  if (onChunk) {
                    onChunk(json.delta.text, fullContent);
                  }
                  self.emit('chunk', { content: json.delta.text, accumulated: fullContent });
                }
                
                if (json.type === 'content_block_start' && json.content_block?.type === 'tool_use') {
                  toolCalls[json.index] = {
                    id: json.content_block.id,
                    type: 'function',
                    function: { name: json.content_block.name, arguments: '' }
                  };
                }
                
                if (json.type === 'content_block_delta' && json.delta?.partial_json) {
                  if (toolCalls[json.index]) {
                    toolCalls[json.index].function.arguments += json.delta.partial_json;
                  }
                }
                
                if (json.type === 'message_delta' && json.usage) {
                  usage = json.usage;
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          });
        });
        
        res.on('end', function() {
          const result = {
            content: fullContent,
            role: 'assistant',
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            usage: usage,
            model: options.model || self.model,
            finishReason: 'end_turn'
          };
          self.emit('response', result);
          resolve(result);
        });
        
        res.on('error', reject);
      });

      req.on('error', reject);
      req.on('timeout', function() {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.write(JSON.stringify(body));
      req.end();
    });
  }

  formatTools(tools) {
    return tools.map(function(tool) {
      return {
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters
      };
    });
  }

  async embed(text) {
    const hash = this.simpleHash(text);
    const embedding = [];
    for (let i = 0; i < 1536; i++) {
      embedding.push((Math.sin(hash + i) + 1) / 2);
    }
    return embedding;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  async request(endpoint, body, headers, timeout) {
    const url = new URL(this.baseUrl + endpoint);
    const self = this;

    return new Promise(function(resolve, reject) {
      const req = https.request({
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: headers,
        timeout: timeout || self.timeout
      }, function(res) {
        let data = '';
        res.on('data', function(chunk) { data += chunk; });
        res.on('end', function() {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 400) {
              const errorMsg = json.error?.message || json.error?.type || 'API Error: ' + res.statusCode;
              reject(new Error(errorMsg));
            } else {
              resolve(json);
            }
          } catch (e) {
            reject(new Error('Failed to parse response: ' + data.substring(0, 200)));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', function() {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.write(JSON.stringify(body));
      req.end();
    });
  }
}

class OllamaAdapter extends LLMAdapter {
  constructor(config) {
    super(config);
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model || DEFAULT_MODELS.ollama;
  }

  async chat(messages, options) {
    const self = this;
    options = options || {};
    
    return this.withRetry(async function() {
      const formattedMessages = self.formatMessages(messages);

      const body = {
        model: options.model || self.model,
        messages: formattedMessages,
        stream: false,
        options: {
          temperature: options.temperature !== undefined ? options.temperature : self.temperature,
          num_predict: options.maxTokens || self.maxTokens
        }
      };

      if (options.tools) {
        body.tools = self.formatToolsForOllama(options.tools);
      }

      const response = await self.request('/api/chat', body, options.timeout || self.timeout);

      const result = {
        content: response.message.content,
        role: response.message.role,
        usage: { 
          input_tokens: response.prompt_eval_count, 
          output_tokens: response.eval_count 
        },
        model: response.model,
        finishReason: response.done ? 'stop' : 'length'
      };

      self.emit('response', result);
      return result;
    });
  }

  async stream(messages, onChunk, options) {
    const self = this;
    options = options || {};
    
    return new Promise(function(resolve, reject) {
      const formattedMessages = self.formatMessages(messages);

      const body = {
        model: options.model || self.model,
        messages: formattedMessages,
        stream: true,
        options: {
          temperature: options.temperature !== undefined ? options.temperature : self.temperature,
          num_predict: options.maxTokens || self.maxTokens
        }
      };

      const url = new URL(self.baseUrl + '/api/chat');
      let fullContent = '';
      let usage = null;

      const lib = url.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: options.timeout || self.timeout
      }, function(res) {
        let buffer = '';
        
        res.on('data', function(chunk) {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          lines.forEach(function(line) {
            line = line.trim();
            if (line) {
              try {
                const json = JSON.parse(line);
                
                if (json.message?.content) {
                  fullContent += json.message.content;
                  if (onChunk) {
                    onChunk(json.message.content, fullContent);
                  }
                  self.emit('chunk', { content: json.message.content, accumulated: fullContent });
                }
                
                if (json.done) {
                  usage = {
                    input_tokens: json.prompt_eval_count,
                    output_tokens: json.eval_count
                  };
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          });
        });
        
        res.on('end', function() {
          const result = {
            content: fullContent,
            role: 'assistant',
            usage: usage,
            model: options.model || self.model,
            finishReason: 'stop'
          };
          self.emit('response', result);
          resolve(result);
        });
        
        res.on('error', reject);
      });

      req.on('error', reject);
      req.on('timeout', function() {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.write(JSON.stringify(body));
      req.end();
    });
  }

  formatToolsForOllama(tools) {
    return tools.map(function(tool) {
      return {
        type: 'function',
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters
        }
      };
    });
  }

  async embed(text, options) {
    options = options || {};
    const body = {
      model: options.model || 'nomic-embed-text',
      input: Array.isArray(text) ? text : [text]
    };

    const response = await this.request('/api/embed', body, options.timeout || this.timeout);
    
    if (Array.isArray(text)) {
      return response.embeddings;
    }
    return response.embeddings[0];
  }

  async listModels() {
    const response = await this.request('/api/tags', {}, this.timeout, 'GET');
    return response.models.map(function(m) { return m.name; });
  }

  async pullModel(model) {
    return this.request('/api/pull', { name: model, stream: false }, this.timeout);
  }

  async request(endpoint, body, timeout, method) {
    const url = new URL(this.baseUrl + endpoint);
    const lib = url.protocol === 'https:' ? https : http;
    const self = this;

    return new Promise(function(resolve, reject) {
      const reqOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: timeout || self.timeout
      };

      const req = lib.request(reqOptions, function(res) {
        let data = '';
        res.on('data', function(chunk) { data += chunk; });
        res.on('end', function() {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Failed to parse response: ' + data.substring(0, 200)));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', function() {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (method !== 'GET' && body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }
}

class LMStudioAdapter extends LLMAdapter {
  constructor(config) {
    super(config);
    this.baseUrl = config.baseUrl || 'http://localhost:1234';
    this.model = config.model || DEFAULT_MODELS.lmstudio;
  }

  async chat(messages, options) {
    const self = this;
    options = options || {};
    
    return this.withRetry(async function() {
      const formattedMessages = self.formatMessages(messages);

      const body = {
        model: options.model || self.model,
        messages: formattedMessages,
        max_tokens: options.maxTokens || self.maxTokens,
        temperature: options.temperature !== undefined ? options.temperature : self.temperature
      };

      if (options.tools) {
        body.tools = options.tools;
        body.tool_choice = options.toolChoice || 'auto';
      }

      const response = await self.request('/v1/chat/completions', body, options.timeout || self.timeout);

      const result = {
        content: response.choices[0].message.content,
        role: response.choices[0].message.role,
        toolCalls: response.choices[0].message.tool_calls,
        usage: response.usage,
        model: response.model,
        finishReason: response.choices[0].finish_reason
      };

      self.emit('response', result);
      return result;
    });
  }

  async stream(messages, onChunk, options) {
    const self = this;
    options = options || {};
    
    return new Promise(function(resolve, reject) {
      const formattedMessages = self.formatMessages(messages);

      const body = {
        model: options.model || self.model,
        messages: formattedMessages,
        max_tokens: options.maxTokens || self.maxTokens,
        temperature: options.temperature !== undefined ? options.temperature : self.temperature,
        stream: true
      };

      const url = new URL(self.baseUrl + '/v1/chat/completions');
      let fullContent = '';
      let usage = null;

      const lib = url.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: options.timeout || self.timeout
      }, function(res) {
        let buffer = '';
        
        res.on('data', function(chunk) {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          lines.forEach(function(line) {
            line = line.trim();
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') return;
              
              try {
                const json = JSON.parse(data);
                const delta = json.choices[0]?.delta;
                
                if (delta?.content) {
                  fullContent += delta.content;
                  if (onChunk) {
                    onChunk(delta.content, fullContent);
                  }
                  self.emit('chunk', { content: delta.content, accumulated: fullContent });
                }
                
                if (json.usage) {
                  usage = json.usage;
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          });
        });
        
        res.on('end', function() {
          const result = {
            content: fullContent,
            role: 'assistant',
            usage: usage,
            model: options.model || self.model,
            finishReason: 'stop'
          };
          self.emit('response', result);
          resolve(result);
        });
        
        res.on('error', reject);
      });

      req.on('error', reject);
      req.on('timeout', function() {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.write(JSON.stringify(body));
      req.end();
    });
  }

  async embed(text, options) {
    options = options || {};
    const body = {
      model: options.model || 'text-embedding',
      input: Array.isArray(text) ? text : [text]
    };

    const response = await this.request('/v1/embeddings', body, options.timeout || this.timeout);
    
    if (Array.isArray(text)) {
      return response.data.map(function(d) { return d.embedding; });
    }
    return response.data[0].embedding;
  }

  async listModels() {
    const response = await this.request('/v1/models', {}, this.timeout, 'GET');
    return response.data.map(function(m) { return m.id; });
  }

  async request(endpoint, body, timeout, method) {
    const url = new URL(this.baseUrl + endpoint);
    const lib = url.protocol === 'https:' ? https : http;
    const self = this;

    return new Promise(function(resolve, reject) {
      const reqOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: timeout || self.timeout
      };

      const req = lib.request(reqOptions, function(res) {
        let data = '';
        res.on('data', function(chunk) { data += chunk; });
        res.on('end', function() {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(new Error(json.error?.message || 'API Error: ' + res.statusCode));
            } else {
              resolve(json);
            }
          } catch (e) {
            reject(new Error('Failed to parse response: ' + data.substring(0, 200)));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', function() {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (method !== 'GET' && body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }
}

class MockLLMAdapter extends LLMAdapter {
  constructor(config) {
    super(config);
    this.responses = config.responses || {};
    this.defaultResponse = config.defaultResponse || 'This is a mock response from the Multi-Agent Framework.';
    this.streamingDelay = config.streamingDelay || 10;
  }

  async chat(messages, options) {
    const self = this;
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage.content || lastMessage;

    for (const pattern in this.responses) {
      if (content.toLowerCase().includes(pattern.toLowerCase())) {
        return {
          content: this.responses[pattern],
          role: 'assistant',
          usage: { input_tokens: 10, output_tokens: 20 },
          model: 'mock',
          finishReason: 'stop'
        };
      }
    }

    const mockResponse = this.generateMockResponse(content);
    
    return {
      content: mockResponse,
      role: 'assistant',
      usage: { 
        input_tokens: self.countTokens(content), 
        output_tokens: self.countTokens(mockResponse) 
      },
      model: 'mock',
      finishReason: 'stop'
    };
  }

  async stream(messages, onChunk, options) {
    const self = this;
    const response = await this.chat(messages, options);
    const content = response.content;
    const words = content.split(' ');
    let fullContent = '';

    for (const word of words) {
      fullContent += (fullContent ? ' ' : '') + word;
      if (onChunk) {
        onChunk((fullContent ? ' ' : '') + word, fullContent);
      }
      self.emit('chunk', { content: word, accumulated: fullContent });
      await self.sleep(self.streamingDelay);
    }

    return response;
  }

  generateMockResponse(input) {
    const responses = [
      'I understand your request. Let me help you with that.',
      'Based on my analysis, here is what I found...',
      'I have processed your request. Here are the results.',
      'Let me think about this step by step.',
      'I have completed the task as requested.'
    ];
    
    if (input.toLowerCase().includes('code') || input.toLowerCase().includes('function')) {
      return 'Here is the code solution:\n\n```javascript\nfunction solution() {\n  // Implementation\n  return result;\n}\n```';
    }
    
    if (input.toLowerCase().includes('error') || input.toLowerCase().includes('bug')) {
      return 'I have identified the issue. The error appears to be related to the configuration. Please check the following:\n1. Verify your settings\n2. Check the logs\n3. Ensure all dependencies are installed';
    }
    
    if (input.toLowerCase().includes('help')) {
      return 'I am here to help! You can ask me to:\n- Write code\n- Analyze data\n- Debug issues\n- Create documentation\n- And much more!';
    }
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  async embed(text) {
    const embedding = [];
    const hash = this.simpleHash(text);
    for (let i = 0; i < 1536; i++) {
      embedding.push((Math.sin(hash + i * 0.1) + 1) / 2);
    }
    return embedding;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }
}

function createLLMAdapter(config) {
  config = config || {};
  const provider = (config.provider || 'mock').toLowerCase();

  switch (provider) {
    case 'openai':
      return new OpenAIAdapter(config);
    case 'anthropic':
    case 'claude':
      return new AnthropicAdapter(config);
    case 'ollama':
    case 'local':
      return new OllamaAdapter(config);
    case 'lmstudio':
    case 'lm-studio':
      return new LMStudioAdapter(config);
    case 'mock':
    default:
      return new MockLLMAdapter(config);
  }
}

module.exports = {
  LLMAdapter,
  OpenAIAdapter,
  AnthropicAdapter,
  OllamaAdapter,
  LMStudioAdapter,
  MockLLMAdapter,
  createLLMAdapter,
  LLM_PROVIDERS,
  DEFAULT_MODELS,
  MODEL_CONTEXT_SIZES
};
