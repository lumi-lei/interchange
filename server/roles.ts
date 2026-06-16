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

