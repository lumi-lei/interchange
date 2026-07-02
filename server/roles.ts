export type RoleKey =
  | 'product'
  | 'qa'
  | 'tech_lead'
  | 'department_leader'
  | 'customer'
  | 'my_ai_coding_tool'
  | 'teammate_ai_coding_tool';

export type RoleDefinition = {
  key: RoleKey;
  label: string;
  defaultPreference: string;
};

export const rolePromptTemplates: Partial<Record<RoleKey, string>> = {
  my_ai_coding_tool: [
    '你是当前任务的主执行 AI。请把输入内容转换成可直接交给 AI 编程软件执行的任务提示词。',
    '执行前置流程：使用本项目已封装的 Agent Skills 进入项目工作流；优先读取 AGENTS.md、OpenSpec 工作流说明、docs/ 下与任务相关的文档。',
    '如果任务缺少规格说明，先按 OpenSpec 工作流生成或补齐项目相关文档；未完成文档发现前，不要修改代码。',
    '动代码前必须先回复：已读取的 docs 文档、已读取或生成/更新的 OpenSpec 文档、本次任务边界、计划修改的文件、需要确认的问题。',
    '实现阶段只基于已读取文档和用户提供的客观信息，不扩展未确认需求，不扩大实现范围，不跳过测试和验收。',
  ].join('\n'),
  teammate_ai_coding_tool: [
    '你是同项目协作 AI。请把输入内容转换成可直接交给协作 AI 编程软件执行的协作提示词。',
    '执行前置流程：使用本项目已封装的 Agent Skills 进入项目工作流；优先读取 AGENTS.md、OpenSpec 工作流说明、docs/ 下与协作范围相关的文档。',
    '如果协作范围缺少规格说明，先按 OpenSpec 工作流生成或补齐项目相关文档；未完成文档发现前，不要修改代码。',
    '动代码前必须先回复：已读取的 docs 文档、已读取或生成/更新的 OpenSpec 文档、协作边界、依赖关系、计划修改的文件、需要确认的问题。',
    '不要重复主执行者的完整任务清单；优先指出接口契约、避免冲突的文件/模块、测试要求、合并注意事项和风险。',
    '实现阶段只基于已读取文档和用户提供的客观信息，不扩展未确认需求，不扩大实现范围，不跳过测试和验收。',
  ].join('\n'),
};

export const roleDefinitions: RoleDefinition[] = [
  {
    key: 'product',
    label: '产品',
    defaultPreference: '关注用户价值、范围变化、交互影响、验收口径和是否需要调整需求文档。',
  },
  {
    key: 'qa',
    label: '测试',
    defaultPreference: '关注测试范围、风险点、回归影响、验收步骤、边界条件和需要补充的测试数据。',
  },
  {
    key: 'tech_lead',
    label: '研发组长',
    defaultPreference: '关注技术方案变化、影响模块、风险、依赖、排期影响和需要协调的工程决策。',
  },
  {
    key: 'department_leader',
    label: '部门领导',
    defaultPreference: '关注目标、进展、风险、资源诉求、对外承诺和业务影响，避免过多实现细节。',
  },
  {
    key: 'customer',
    label: '客户',
    defaultPreference: '关注可感知价值、交付时间、使用影响、注意事项和需要客户确认的问题。',
  },
  {
    key: 'my_ai_coding_tool',
    label: '我的 AI 编程软件',
    defaultPreference: '关注可执行的开发上下文、文件/模块、约束、验收标准和下一步任务。',
  },
  {
    key: 'teammate_ai_coding_tool',
    label: '同项目同事的 AI 编程软件',
    defaultPreference: '关注客观事实、变更边界、接口契约、兼容性要求、测试要求和避免误改的注意事项。',
  },
];

export function isRoleKey(value: string): value is RoleKey {
  return roleDefinitions.some((role) => role.key === value);
}

export function roleTemplatePreference(key: RoleKey) {
  return rolePromptTemplates[key] ?? '';
}
