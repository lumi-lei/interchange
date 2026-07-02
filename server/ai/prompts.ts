import type { DraftMessage, DraftRequest } from './types.js';

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
9. 输出可以直接发送给收件人的内容，不解释你的思考过程。
10. 风格清晰、克制、专业，避免空话。`;

export function buildDraftMessages({ sourceText, contact, role }: DraftRequest): DraftMessage[] {
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
        `角色默认关注点：${role.defaultPreference}`,
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
