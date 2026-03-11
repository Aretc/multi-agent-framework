/**
 * LLM Adapter System
 * Supports multiple LLM providers: OpenAI, Anthropic, Local models
 */

const https = require('https');
const http = require('http');

// Base LLM Adapter
class LLMAdapter {
  constructor(config) {
    this.config = config || {};
    this.model = this.config.model || 'default';
    this.maxTokens = this.config.maxTokens || 4096;
    this.temperature = this.config.temperature || 0.7;
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
    return Math.ceil(text.length / 4);
  }
}

// OpenAI Adapter
class OpenAIAdapter extends LLMAdapter {
  constructor(config) {
    super(config);
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.model = config.model || 'gpt-4';
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.organization = config.organization;
  }

  async chat(messages, options) {
    options = options || {};
    const formattedMessages = this.formatMessages(messages);

    const body = {
      model: options.model || this.model,
      messages: formattedMessages,
      max_tokens: options.maxTokens || this.maxTokens,
      temperature: options.temperature !== undefined ? options.temperature : this.temperature
    };

    if (options.tools) {
      body.tools = options.tools;
      body.tool_choice = options.toolChoice || 'auto';
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + this.apiKey
    };

    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }

    const response = await this.request('/chat/completions', body, headers);

    return {
      content: response.choices[0].message.content,
      role: response.choices[0].message.role,
      toolCalls: response.choices[0].message.tool_calls,
      usage: response.usage,
      model: response.model,
      finishReason: response.choices[0].finish_reason
    };
  }

  async embed(text) {
    const body = {
      model: 'text-embedding-ada-002',
      input: text
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + this.apiKey
    };

    const response = await this.request('/embeddings', body, headers);
    return response.data[0].embedding;
  }

  async request(endpoint, body, headers) {
    const url = new URL(this.baseUrl + endpoint);

    return new Promise(function(resolve, reject) {
      const req = https.request({
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: headers
      }, function(res) {
        let data = '';
        res.on('data', function(chunk) { data += chunk; });
        res.on('end', function() {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(new Error(json.error?.message || 'API Error'));
            } else {
              resolve(json);
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(body));
      req.end();
    });
  }
}

// Anthropic Adapter
class AnthropicAdapter extends LLMAdapter {
  constructor(config) {
    super(config);
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    this.model = config.model || 'claude-3-sonnet-20240229';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
  }

  async chat(messages, options) {
    options = options || {};
    const formattedMessages = this.formatMessages(messages);

    // Extract system message if present
    let systemPrompt = '';
    const chatMessages = formattedMessages.filter(function(m) {
      if (m.role === 'system') {
        systemPrompt = m.content;
        return false;
      }
      return true;
    });

    const body = {
      model: options.model || this.model,
      messages: chatMessages,
      max_tokens: options.maxTokens || this.maxTokens,
      temperature: options.temperature !== undefined ? options.temperature : this.temperature
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (options.tools) {
      body.tools = this.formatTools(options.tools);
    }

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01'
    };

    const response = await this.request('/messages', body, headers);

    return {
      content: response.content[0].text,
      role: 'assistant',
      toolCalls: response.content.filter(function(c) { return c.type === 'tool_use'; }),
      usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
      model: response.model,
      finishReason: response.stop_reason
    };
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
    // Anthropic doesn't have a dedicated embedding API
    // Return a hash-based pseudo-embedding for compatibility
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

  async request(endpoint, body, headers) {
    const url = new URL(this.baseUrl + endpoint);

    return new Promise(function(resolve, reject) {
      const req = https.request({
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: headers
      }, function(res) {
        let data = '';
        res.on('data', function(chunk) { data += chunk; });
        res.on('end', function() {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(new Error(json.error?.message || 'API Error'));
            } else {
              resolve(json);
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(body));
      req.end();
    });
  }
}

// Local LLM Adapter (for Ollama, LM Studio, etc.)
class LocalLLMAdapter extends LLMAdapter {
  constructor(config) {
    super(config);
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model || 'llama2';
    this.provider = config.provider || 'ollama';
  }

  async chat(messages, options) {
    options = options || {};

    if (this.provider === 'ollama') {
      return await this.ollamaChat(messages, options);
    } else if (this.provider === 'lmstudio') {
      return await this.lmstudioChat(messages, options);
    }

    throw new Error('Unknown local provider: ' + this.provider);
  }

  async ollamaChat(messages, options) {
    const formattedMessages = this.formatMessages(messages);

    const body = {
      model: options.model || this.model,
      messages: formattedMessages,
      stream: false,
      options: {
        temperature: options.temperature !== undefined ? options.temperature : this.temperature,
        num_predict: options.maxTokens || this.maxTokens
      }
    };

    const response = await this.request('/api/chat', body);

    return {
      content: response.message.content,
      role: response.message.role,
      usage: { input_tokens: response.prompt_eval_count, output_tokens: response.eval_count },
      model: response.model,
      finishReason: response.done ? 'stop' : 'length'
    };
  }

  async lmstudioChat(messages, options) {
    const formattedMessages = this.formatMessages(messages);

    const body = {
      model: options.model || this.model,
      messages: formattedMessages,
      max_tokens: options.maxTokens || this.maxTokens,
      temperature: options.temperature !== undefined ? options.temperature : this.temperature
    };

    const response = await this.request('/v1/chat/completions', body);

    return {
      content: response.choices[0].message.content,
      role: response.choices[0].message.role,
      usage: response.usage,
      model: response.model,
      finishReason: response.choices[0].finish_reason
    };
  }

  async embed(text) {
    const body = {
      model: 'nomic-embed-text',
      prompt: text
    };

    const response = await this.request('/api/embeddings', body);
    return response.embedding;
  }

  async request(endpoint, body) {
    const url = new URL(this.baseUrl + endpoint);
    const lib = url.protocol === 'https:' ? https : http;

    return new Promise(function(resolve, reject) {
      const req = lib.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, function(res) {
        let data = '';
        res.on('data', function(chunk) { data += chunk; });
        res.on('end', function() {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(body));
      req.end();
    });
  }
}

// Mock LLM Adapter (for testing without API)
class MockLLMAdapter extends LLMAdapter {
  constructor(config) {
    super(config);
    this.responses = config.responses || {};
    this.defaultResponse = config.defaultResponse || 'This is a mock response.';
  }

  async chat(messages, options) {
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage.content || lastMessage;

    // Check for predefined responses
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

    return {
      content: this.defaultResponse,
      role: 'assistant',
      usage: { input_tokens: 10, output_tokens: 20 },
      model: 'mock',
      finishReason: 'stop'
    };
  }

  async embed(text) {
    const embedding = [];
    for (let i = 0; i < 1536; i++) {
      embedding.push(Math.random());
    }
    return embedding;
  }
}

// LLM Factory
function createLLMAdapter(config) {
  config = config || {};
  const provider = config.provider || 'mock';

  switch (provider.toLowerCase()) {
    case 'openai':
      return new OpenAIAdapter(config);
    case 'anthropic':
      return new AnthropicAdapter(config);
    case 'local':
    case 'ollama':
      return new LocalLLMAdapter(config);
    case 'mock':
    default:
      return new MockLLMAdapter(config);
  }
}

module.exports = {
  LLMAdapter,
  OpenAIAdapter,
  AnthropicAdapter,
  LocalLLMAdapter,
  MockLLMAdapter,
  createLLMAdapter
};
