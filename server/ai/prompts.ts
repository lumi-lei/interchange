import type { DraftMessage, DraftRequest } from './types.js';

export const systemPrompt = `你是 Interchange，一个面向 AI 编程团队的消息转换助手。
你的任务是把同一份客观信息，改写为指定角色最想了解、可以直接发送的中文消息。
必须遵守：
1. 保留事实，不编造时间、承诺、责任人或结论。
2. 如果信息不足，用“需要确认：”列出问题。
3. 根据角色偏好决定详略和关注点。
4. 输出可以直接发送给收件人的内容，不解释你的思考过程。
5. 风格清晰、克制、专业，避免空话。`;

export function buildDraftMessages({ sourceText, contact, role }: DraftRequest): DraftMessage[] {
  const preference = [role.defaultPreference, role.customPreference, contact.preference]
    .filter(Boolean)
    .join('\n');

  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        `收件人：${contact.name}`,
        `角色：${role.label}`,
        `角色关注点：${preference}`,
        '',
        '客观信息如下：',
        sourceText,
        '',
        '请生成一份适合该收件人的消息。',
      ].join('\n'),
    },
  ];
}
