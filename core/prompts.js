/**
 * Prompt Management System
 * 
 * Features:
 * - Prompt Template Library
 * - Dynamic Prompt Generation
 * - Variable Substitution
 * - Prompt Optimization
 * - Multi-language Support
 */

const { EventEmitter } = require('events');

const PROMPT_CATEGORIES = {
  SYSTEM: 'system',
  TASK: 'task',
  REASONING: 'reasoning',
  CODING: 'coding',
  ANALYSIS: 'analysis',
  WRITING: 'writing',
  RESEARCH: 'research',
  COMMUNICATION: 'communication'
};

const DEFAULT_TEMPLATES = {
  'system:base': {
    id: 'system:base',
    category: PROMPT_CATEGORIES.SYSTEM,
    name: 'Base System Prompt',
    description: 'Basic system prompt template',
    template: 'You are {{name}}, a {{role}}. {{description}}',
    variables: ['name', 'role', 'description'],
    language: 'en'
  },
  'system:expert': {
    id: 'system:expert',
    category: PROMPT_CATEGORIES.SYSTEM,
    name: 'Expert System Prompt',
    description: 'Expert-level system prompt with capabilities',
    template: `You are {{name}}, an expert {{role}} with deep expertise in {{domain}}.

Your capabilities include:
{{#each capabilities}}
- {{this}}
{{/each}}

Your responsibilities:
{{#each responsibilities}}
- {{this}}
{{/each}}

Approach each task with:
1. Careful analysis of requirements
2. Systematic problem-solving
3. Clear communication of findings
4. Thorough verification of results`,
    variables: ['name', 'role', 'domain', 'capabilities', 'responsibilities'],
    language: 'en'
  },
  'system:cot': {
    id: 'system:cot',
    category: PROMPT_CATEGORIES.SYSTEM,
    name: 'Chain-of-Thought System',
    description: 'System prompt for CoT reasoning',
    template: `You are {{name}}, an analytical AI assistant.

When solving problems, always follow this process:
1. **Understand**: Carefully read and understand the problem
2. **Analyze**: Break down the problem into components
3. **Reason**: Apply step-by-step logical reasoning
4. **Conclude**: Arrive at a well-supported conclusion

Format your response as:
\`\`\`json
{
  "reasoning": "Your step-by-step reasoning process",
  "conclusion": "Your final conclusion",
  "confidence": "high/medium/low",
  "action": {...} or "toolCall": {...} or "content": "..."
}
\`\`\``,
    variables: ['name'],
    language: 'en'
  },
  'system:react': {
    id: 'system:react',
    category: PROMPT_CATEGORIES.SYSTEM,
    name: 'ReAct Agent System',
    description: 'System prompt for ReAct-style agents',
    template: `You are {{name}}, a ReAct (Reasoning + Acting) agent.

Available tools:
{{#each tools}}
- {{name}}: {{description}}
{{/each}}

For each step, follow this format:
THOUGHT: Analyze the current situation and decide what to do
ACTION: Choose a tool and provide parameters
OBSERVATION: Process the result

Continue until you have a final answer, then respond with:
FINAL ANSWER: [your answer]`,
    variables: ['name', 'tools'],
    language: 'en'
  },
  'task:analyze': {
    id: 'task:analyze',
    category: PROMPT_CATEGORIES.TASK,
    name: 'Task Analysis',
    description: 'Analyze a task and create a plan',
    template: `Analyze the following task and create an execution plan:

**Task**: {{task}}

**Context**: {{context}}

Provide:
1. Task breakdown into subtasks
2. Required resources and tools
3. Potential challenges and solutions
4. Estimated complexity (1-5)
5. Recommended approach`,
    variables: ['task', 'context'],
    language: 'en'
  },
  'task:execute': {
    id: 'task:execute',
    category: PROMPT_CATEGORIES.TASK,
    name: 'Task Execution',
    description: 'Execute a specific task',
    template: `Execute the following task:

**Task**: {{task}}
**Type**: {{type}}
**Priority**: {{priority}}

{{#if constraints}}
**Constraints**:
{{#each constraints}}
- {{this}}
{{/each}}
{{/if}}

Complete the task and provide:
1. Execution steps taken
2. Results achieved
3. Any issues encountered
4. Recommendations for improvement`,
    variables: ['task', 'type', 'priority', 'constraints'],
    language: 'en'
  },
  'reasoning:step': {
    id: 'reasoning:step',
    category: PROMPT_CATEGORIES.REASONING,
    name: 'Step-by-Step Reasoning',
    description: 'Detailed step-by-step reasoning prompt',
    template: `Problem: {{problem}}

Let me think through this step by step:

Step 1: {{step1}}
Step 2: {{step2}}
...

Current reasoning chain:
{{reasoningChain}}

What is the next step? Provide your reasoning and conclusion.`,
    variables: ['problem', 'step1', 'step2', 'reasoningChain'],
    language: 'en'
  },
  'coding:implement': {
    id: 'coding:implement',
    category: PROMPT_CATEGORIES.CODING,
    name: 'Code Implementation',
    description: 'Implement code based on requirements',
    template: `Implement the following:

**Requirement**: {{requirement}}
**Language**: {{language}}
**Style**: {{style}}

{{#if constraints}}
**Constraints**:
{{#each constraints}}
- {{this}}
{{/each}}
{{/if}}

Provide:
1. Complete, working code
2. Brief explanation of the approach
3. Any assumptions made
4. Test cases if applicable`,
    variables: ['requirement', 'language', 'style', 'constraints'],
    language: 'en'
  },
  'coding:review': {
    id: 'coding:review',
    category: PROMPT_CATEGORIES.CODING,
    name: 'Code Review',
    description: 'Review code for quality and issues',
    template: `Review the following code:

\`\`\`{{language}}
{{code}}
\`\`\`

Check for:
1. Correctness and bugs
2. Code style and best practices
3. Performance considerations
4. Security vulnerabilities
5. Maintainability

Provide:
- Overall assessment (1-10)
- Issues found (with line numbers)
- Suggestions for improvement
- Refactored code if needed`,
    variables: ['language', 'code'],
    language: 'en'
  },
  'analysis:data': {
    id: 'analysis:data',
    category: PROMPT_CATEGORIES.ANALYSIS,
    name: 'Data Analysis',
    description: 'Analyze data and provide insights',
    template: `Analyze the following data:

**Data**: {{data}}
**Context**: {{context}}
**Questions**: {{questions}}

Provide:
1. Summary statistics
2. Key patterns and trends
3. Anomalies or outliers
4. Answers to specific questions
5. Recommendations based on findings`,
    variables: ['data', 'context', 'questions'],
    language: 'en'
  },
  'writing:document': {
    id: 'writing:document',
    category: PROMPT_CATEGORIES.WRITING,
    name: 'Document Writing',
    description: 'Write a document based on requirements',
    template: `Write a {{documentType}} with the following specifications:

**Topic**: {{topic}}
**Audience**: {{audience}}
**Tone**: {{tone}}
**Length**: {{length}}

{{#if outline}}
**Outline**:
{{outline}}
{{/if}}

{{#if keyPoints}}
**Key Points to Include**:
{{#each keyPoints}}
- {{this}}
{{/each}}
{{/if}}

Ensure the document is:
- Well-structured and organized
- Clear and concise
- Appropriate for the audience
- Free of errors`,
    variables: ['documentType', 'topic', 'audience', 'tone', 'length', 'outline', 'keyPoints'],
    language: 'en'
  },
  'research:investigate': {
    id: 'research:investigate',
    category: PROMPT_CATEGORIES.RESEARCH,
    name: 'Research Investigation',
    description: 'Conduct research on a topic',
    template: `Research the following topic:

**Topic**: {{topic}}
**Scope**: {{scope}}
**Depth**: {{depth}}

Focus on:
1. Key concepts and definitions
2. Current state of knowledge
3. Different perspectives and approaches
4. Recent developments
5. Open questions and future directions

Provide:
- Executive summary
- Detailed findings
- Sources and references
- Gaps in knowledge`,
    variables: ['topic', 'scope', 'depth'],
    language: 'en'
  },
  'communication:explain': {
    id: 'communication:explain',
    category: PROMPT_CATEGORIES.COMMUNICATION,
    name: 'Explanation',
    description: 'Explain a concept clearly',
    template: `Explain the following concept:

**Concept**: {{concept}}
**Audience**: {{audience}}
**Detail Level**: {{detailLevel}}

Your explanation should:
1. Start with a simple overview
2. Build up to more complex aspects
3. Use analogies and examples
4. Address common misconceptions
5. Provide practical applications

Make it {{tone}} and {{style}}.`,
    variables: ['concept', 'audience', 'detailLevel', 'tone', 'style'],
    language: 'en'
  }
};

const OPTIMIZATION_RULES = [
  {
    name: 'clarity',
    description: 'Ensure prompts are clear and unambiguous',
    apply: function(prompt) {
      return prompt.replace(/\s+/g, ' ').trim();
    }
  },
  {
    name: 'specificity',
    description: 'Add specificity markers',
    apply: function(prompt) {
      if (!prompt.includes('Specifically')) {
        return 'Specifically, ' + prompt.charAt(0).toLowerCase() + prompt.slice(1);
      }
      return prompt;
    }
  },
  {
    name: 'structure',
    description: 'Add structure markers if missing',
    apply: function(prompt) {
      if (prompt.length > 500 && !prompt.includes('##')) {
        return '## Task\n\n' + prompt;
      }
      return prompt;
    }
  },
  {
    name: 'examples',
    description: 'Encourage example inclusion',
    apply: function(prompt, context) {
      if (context && context.includeExamples && !prompt.includes('Example')) {
        return prompt + '\n\nProvide examples where appropriate.';
      }
      return prompt;
    }
  }
];

class PromptManager extends EventEmitter {
  constructor(config) {
    super();
    this.config = config || {};
    this.templates = new Map();
    this.customTemplates = new Map();
    this.variables = new Map();
    this.history = [];
    
    this._loadDefaultTemplates();
  }

  _loadDefaultTemplates() {
    const self = this;
    Object.entries(DEFAULT_TEMPLATES).forEach(function([id, template]) {
      self.templates.set(id, template);
    });
  }

  registerTemplate(template) {
    if (!template.id || !template.template) {
      throw new Error('Template must have id and template');
    }
    
    this.customTemplates.set(template.id, template);
    this.emit('template:registered', { id: template.id, template: template });
    
    return template;
  }

  getTemplate(id) {
    return this.customTemplates.get(id) || this.templates.get(id);
  }

  listTemplates(category) {
    const self = this;
    const all = [...this.templates.values(), ...this.customTemplates.values()];
    
    if (category) {
      return all.filter(function(t) { return t.category === category; });
    }
    
    return all;
  }

  deleteTemplate(id) {
    if (this.templates.has(id)) {
      throw new Error('Cannot delete default template');
    }
    
    const deleted = this.customTemplates.delete(id);
    if (deleted) {
      this.emit('template:deleted', { id: id });
    }
    
    return deleted;
  }

  render(templateId, variables) {
    const template = this.getTemplate(templateId);
    
    if (!template) {
      throw new Error('Template not found: ' + templateId);
    }
    
    return this.renderTemplate(template, variables);
  }

  renderTemplate(template, variables) {
    variables = variables || {};
    let result = template.template;
    
    result = this._processConditionals(result, variables);
    result = this._processLoops(result, variables);
    result = this._processVariables(result, variables);
    
    this.history.push({
      templateId: template.id,
      variables: variables,
      result: result,
      timestamp: Date.now()
    });
    
    this.emit('prompt:rendered', { templateId: template.id, result: result });
    
    return result;
  }

  _processVariables(template, variables) {
    let result = template;
    
    Object.entries(variables).forEach(function([key, value]) {
      const regex = new RegExp('\\{\\{' + key + '\\}\\}', 'g');
      if (Array.isArray(value)) {
        result = result.replace(regex, value.join(', '));
      } else if (typeof value === 'object') {
        result = result.replace(regex, JSON.stringify(value));
      } else {
        result = result.replace(regex, String(value || ''));
      }
    });
    
    return result;
  }

  _processConditionals(template, variables) {
    let result = template;
    
    const ifRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    result = result.replace(ifRegex, function(match, varName, content) {
      return variables[varName] ? content : '';
    });
    
    return result;
  }

  _processLoops(template, variables) {
    let result = template;
    
    const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    result = result.replace(eachRegex, function(match, varName, content) {
      const array = variables[varName];
      if (!Array.isArray(array)) return '';
      
      return array.map(function(item) {
        if (typeof item === 'object') {
          let itemContent = content;
          Object.entries(item).forEach(function([k, v]) {
            itemContent = itemContent.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), String(v));
          });
          return itemContent;
        }
        return content.replace(/\{\{this\}\}/g, String(item));
      }).join('');
    });
    
    return result;
  }

  generatePrompt(context) {
    const parts = [];
    
    if (context.role) {
      parts.push('You are a ' + context.role + '.');
    }
    
    if (context.task) {
      parts.push('\n\nYour task: ' + context.task);
    }
    
    if (context.constraints && context.constraints.length > 0) {
      parts.push('\n\nConstraints:');
      context.constraints.forEach(function(c) {
        parts.push('\n- ' + c);
      });
    }
    
    if (context.tools && context.tools.length > 0) {
      parts.push('\n\nAvailable tools:');
      context.tools.forEach(function(t) {
        parts.push('\n- ' + t.name + ': ' + t.description);
      });
    }
    
    if (context.examples && context.examples.length > 0) {
      parts.push('\n\nExamples:');
      context.examples.forEach(function(ex, i) {
        parts.push('\n\nExample ' + (i + 1) + ':');
        parts.push('\nInput: ' + ex.input);
        parts.push('\nOutput: ' + ex.output);
      });
    }
    
    if (context.outputFormat) {
      parts.push('\n\nOutput format: ' + context.outputFormat);
    }
    
    return parts.join('');
  }

  optimize(prompt, options) {
    options = options || {};
    let optimized = prompt;
    const applied = [];
    
    OPTIMIZATION_RULES.forEach(function(rule) {
      if (options.rules && !options.rules.includes(rule.name)) {
        return;
      }
      
      const before = optimized;
      optimized = rule.apply(optimized, options);
      
      if (before !== optimized) {
        applied.push(rule.name);
      }
    });
    
    this.emit('prompt:optimized', { 
      original: prompt, 
      optimized: optimized, 
      rules: applied 
    });
    
    return {
      prompt: optimized,
      appliedRules: applied
    };
  }

  setVariable(name, value) {
    this.variables.set(name, value);
  }

  getVariable(name) {
    return this.variables.get(name);
  }

  clearVariables() {
    this.variables.clear();
  }

  createPromptBuilder() {
    return new PromptBuilder(this);
  }

  getHistory(limit) {
    limit = limit || 100;
    return this.history.slice(-limit);
  }

  exportTemplates() {
    const self = this;
    return {
      default: Object.fromEntries(this.templates),
      custom: Object.fromEntries(this.customTemplates)
    };
  }

  importTemplates(data) {
    const self = this;
    
    if (data.custom) {
      Object.entries(data.custom).forEach(function([id, template]) {
        self.customTemplates.set(id, template);
      });
    }
    
    this.emit('templates:imported', { count: Object.keys(data.custom || {}).length });
  }
}

class PromptBuilder {
  constructor(manager) {
    this.manager = manager;
    this.sections = [];
    this.variables = {};
  }

  system(content) {
    this.sections.push({ type: 'system', content: content });
    return this;
  }

  task(content) {
    this.sections.push({ type: 'task', content: content });
    return this;
  }

  context(content) {
    this.sections.push({ type: 'context', content: content });
    return this;
  }

  tools(tools) {
    this.sections.push({ type: 'tools', content: tools });
    return this;
  }

  constraints(items) {
    this.sections.push({ type: 'constraints', content: items });
    return this;
  }

  examples(items) {
    this.sections.push({ type: 'examples', content: items });
    return this;
  }

  output(format) {
    this.sections.push({ type: 'output', content: format });
    return this;
  }

  variable(name, value) {
    this.variables[name] = value;
    return this;
  }

  template(templateId, vars) {
    const self = this;
    vars = vars || {};
    Object.entries(vars).forEach(function([k, v]) {
      self.variables[k] = v;
    });
    
    const template = this.manager.getTemplate(templateId);
    if (template) {
      this.sections.push({ type: 'template', content: template });
    }
    
    return this;
  }

  build() {
    const self = this;
    const parts = [];
    
    this.sections.forEach(function(section) {
      switch (section.type) {
        case 'system':
          parts.push(section.content);
          break;
        case 'task':
          parts.push('\n\n## Task\n\n' + section.content);
          break;
        case 'context':
          parts.push('\n\n## Context\n\n' + section.content);
          break;
        case 'tools':
          parts.push('\n\n## Available Tools\n\n' + section.content.map(function(t) {
            return '- ' + t.name + ': ' + t.description;
          }).join('\n'));
          break;
        case 'constraints':
          parts.push('\n\n## Constraints\n\n' + section.content.map(function(c) {
            return '- ' + c;
          }).join('\n'));
          break;
        case 'examples':
          parts.push('\n\n## Examples\n\n' + section.content.map(function(ex, i) {
            return 'Example ' + (i + 1) + ':\nInput: ' + ex.input + '\nOutput: ' + ex.output;
          }).join('\n\n'));
          break;
        case 'output':
          parts.push('\n\n## Output Format\n\n' + section.content);
          break;
        case 'template':
          parts.push(self.manager.renderTemplate(section.content, self.variables));
          break;
      }
    });
    
    return parts.join('');
  }

  reset() {
    this.sections = [];
    this.variables = {};
    return this;
  }
}

function createPromptManager(config) {
  return new PromptManager(config);
}

module.exports = {
  PromptManager,
  PromptBuilder,
  createPromptManager,
  PROMPT_CATEGORIES,
  DEFAULT_TEMPLATES,
  OPTIMIZATION_RULES
};
