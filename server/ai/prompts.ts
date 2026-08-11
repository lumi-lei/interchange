import type { DraftMessage, DraftRequest, RoleSuggestionRequest } from './types.js';

export const systemPrompt = `你是 Interchange，一个面向 AI 编程团队的消息转换助手。
你的任务是把同一份客观信息，改写为指定角色最想了解、可以直接发送的中文消息。
必须遵守：
1. 保留事实，不编造时间、承诺、责任人或结论。
2. 如果信息不足，用“需要确认：”列出问题。
3. 根据角色默认关注点决定信息取舍。
4. 把推荐提示词模板视为该角色的基础改写方式，用它决定最终消息的结构、任务边界和输出格式。
5. 把用户自定义补充视为高优先级提示词，用它调整最终消息的语气、结构、措辞、详略、任务边界和输出格式。
6. 不要在正文中解释或原样复述“推荐提示词模板”或“用户自定义补充”字段，除非字段明确要求输出某段文字。
7. 如果角色是 AI 编程软件，把推荐提示词模板和用户自定义补充理解为给下游 AI 的开发提示词，用它们调整任务拆分、实现边界、验收标准和下一步行动。
8. 用户自定义补充优先于推荐提示词模板、角色默认关注点和收件人补充偏好；但事实约束最高，不能因此改变事实。
9. 当角色默认关注点标记为“无固定习惯”时，不要套用任何岗位假设；只依据用户自定义补充、收件人补充偏好和客观信息生成。
10. 输出可以直接发送给收件人的内容，不解释你的思考过程。
11. 风格清晰、克制、专业，避免空话。`;

export function buildDraftMessages({ sourceText, contact, role }: DraftRequest): DraftMessage[] {
  const defaultPreference = role.defaultPreference.trim() || '无固定习惯。';
  const templatePreference = role.templatePreference.trim() || '无内置模板。';
  const customPreference = role.customPreference.trim() || '无额外要求。';
  const contactPreference = contact.preference.trim() || '无额外要求。';

  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        `收件人：${contact.name}`,
        `角色：${role.label}`,
        `角色默认关注点：${defaultPreference}`,
        `推荐提示词模板：${templatePreference}`,
        `用户自定义补充：${customPreference}`,
        `收件人补充偏好：${contactPreference}`,
        '',
        '客观信息如下：',
        sourceText,
        '',
        '请严格按推荐提示词模板和用户自定义补充改写成一份适合该收件人的消息；不要把这些提示词字段作为说明文字原样放入正文。',
      ].join('\n'),
    },
  ];
}

const roleSuggestionSystemPrompt = `你是 Interchange 的角色配置助手。
你的任务是根据用户提供的角色名称，以及可选的偏好方案名称，写出可直接保存到角色配置中的中文建议。
必须遵守：
1. 只输出建议正文，不要标题、Markdown、引号、解释或寒暄。
2. 表达具体、克制、可执行，避免空泛口号。
3. 角色名称本身不足以确定职业时，不要编造其身份、权限、行业或组织背景；应使用通用且合理的关注维度。
4. 不得承诺未经确认的时间、结果或能力。
5. 默认关注点控制在 45 至 90 个汉字；偏好方案内容控制在 70 至 150 个汉字。`;

export function buildRoleSuggestionMessages({ roleLabel, preferenceSetName }: RoleSuggestionRequest): DraftMessage[] {
  const isPreferenceSet = Boolean(preferenceSetName?.trim());
  const task = isPreferenceSet
    ? [
      `角色名称：${roleLabel.trim()}`,
      `偏好方案名称：${preferenceSetName!.trim()}`,
      '请生成该偏好方案的内容，描述该角色输出信息时应采用的语气、结构、信息取舍和注意事项。',
    ]
    : [
      `角色名称：${roleLabel.trim()}`,
      '请生成该角色的默认关注点，描述其通常应优先关注的信息维度。',
    ];

  return [
    { role: 'system', content: roleSuggestionSystemPrompt },
    { role: 'user', content: task.join('\n') },
  ];
}
