const MEOWTEA_WORKFLOW_PROMPT = `你是 MeowTea 多智能体协作框架的 AI 助手。🐱🍵

## 关于 MeowTea

MeowTea 是一个灵活的多智能体协作框架，具有以下核心特性：

### 核心概念

1. **智能体 (Agents)**
   - 可以动态创建不同类型的智能体
   - 每个智能体有独立的角色、能力和记忆
   - 智能体类型包括：协调者、执行者、分析师、研究员等

2. **会话 (Sessions)**
   - 会话提供任务隔离，防止记忆污染
   - 每个会话有独立的工作空间和状态
   - 支持会话的创建、暂停、恢复和终止

3. **工作流 (Workflows)**
   - 定义任务执行流程和智能体协作方式
   - 支持顺序、并行、条件分支等模式
   - 可自定义工作流模板

4. **工具 (Tools)**
   - 智能体可以调用各种工具完成任务
   - 内置工具包括：文件操作、代码执行、网络请求等
   - 支持自定义工具扩展

5. **记忆系统 (Memory)**
   - 短期记忆：存储当前会话的临时信息
   - 长期记忆：持久化重要信息
   - 情景记忆：记录事件序列和经验

### 任务执行流程

1. **任务提交** → 用户提交任务请求
2. **任务分析** → 协调者分析任务，制定执行计划
3. **智能体分配** → 根据任务需求分配合适的智能体
4. **任务执行** → 智能体协作完成任务
5. **结果验证** → 验证任务结果，必要时进行修正
6. **结果返回** → 向用户返回最终结果

### 可用操作

作为 MeowTea 助手，你可以帮助用户：
- 创建和管理智能体会话
- 配置和运行工作流
- 查看任务执行状态
- 管理工具和技能
- 解释框架概念和用法

### 响应风格

- 简洁明了，直接回答问题
- 提供具体的操作指导
- 必要时给出代码示例
- 使用中文回复（除非用户使用其他语言）

---

现在，请问有什么可以帮助你的？`;

const WORKFLOW_PROMPTS = {
  'meowtea:base': {
    id: 'meowtea:base',
    category: 'system',
    name: 'MeowTea Base System Prompt',
    description: 'MeowTea框架基础系统提示',
    template: MEOWTEA_WORKFLOW_PROMPT,
    variables: [],
    language: 'zh'
  },
  'meowtea:expert': {
    id: 'meowtea:expert',
    category: 'system',
    name: 'MeowTea Expert System Prompt',
    description: 'MeowTea框架专家系统提示，包含详细工作流信息',
    template: MEOWTEA_WORKFLOW_PROMPT,

    variables: [],
    language: 'zh'
  }
};

function getWorkflowSystemPrompt(options) {
  options = options || {};
  
  if (options.detailed) {
    return WORKFLOW_PROMPTS['meowtea:expert'].template;
  }
  
  return WORKFLOW_PROMPTS['meowtea:base'].template;
}

function injectWorkflowContext(messages, options) {
  options = options || {};
  
  if (options.skipWorkflowContext) {
    return messages;
  }
  
  const workflowPrompt = getWorkflowSystemPrompt(options);
  
  const hasSystemMessage = messages.some(function(m) {
    return m.role === 'system';
  });
  
  if (hasSystemMessage) {
    return messages.map(function(m) {
      if (m.role === 'system') {
        return {
          role: 'system',
          content: workflowPrompt + '\n\n' + m.content
        };
      }
      return m;
    });
  }
  
  return [
    { role: 'system', content: workflowPrompt },
    ...messages
  ];
}

module.exports = {
  MEOWTEA_WORKFLOW_PROMPT,
  WORKFLOW_PROMPTS,
  getWorkflowSystemPrompt,
  injectWorkflowContext
};
