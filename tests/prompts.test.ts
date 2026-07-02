import { describe, expect, it } from 'vitest';
import { buildDraftMessages } from '../server/ai/prompts.js';
import type { DraftRequest } from '../server/ai/types.js';

describe('draft prompts', () => {
  it('builds a system and user message for draft generation', () => {
    const messages = buildDraftMessages(sampleDraftRequest());

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('includes the recipient, role preferences, contact preference, and source text', () => {
    const messages = buildDraftMessages(sampleDraftRequest());
    const userMessage = messages[1].content;

    expect(userMessage).toContain('收件人：AI');
    expect(userMessage).toContain('角色：我的 AI 编程工具');
    expect(userMessage).toContain('角色默认关注点：默认偏好：先给结论。');
    expect(userMessage).toContain('推荐提示词模板：模板偏好：输出可执行任务。');
    expect(userMessage).toContain('用户自定义补充：自定义偏好：补充风险。');
    expect(userMessage).toContain('收件人补充偏好：联系人偏好：少用术语。');
    expect(userMessage).toContain('变更：新增联系人管理。');
  });

  it('treats templates and user supplements as rewrite instructions without fabricating facts', () => {
    const messages = buildDraftMessages(sampleDraftRequest());

    expect(messages[0].content).toMatch(/不编造|保留事实/);
    expect(messages[0].content).toContain('把推荐提示词模板视为该角色的基础改写方式');
    expect(messages[0].content).toContain('把用户自定义补充视为高优先级提示词');
    expect(messages[0].content).toContain('不要在正文中解释或原样复述“推荐提示词模板”或“用户自定义补充”字段');
    expect(messages[0].content).toContain('如果角色是 AI 编程软件，把推荐提示词模板和用户自定义补充理解为给下游 AI 的开发提示词');
    expect(messages[0].content).toContain('事实约束最高');
    expect(messages[1].content).toContain('请严格按推荐提示词模板和用户自定义补充改写成一份适合该收件人的消息');
  });
});

function sampleDraftRequest(): DraftRequest {
  return {
    sourceText: '变更：新增联系人管理。',
    contact: {
      id: 1,
      name: 'AI',
      roleKey: 'my_ai_coding_tool',
      webhookUrl: '',
      preference: '联系人偏好：少用术语。',
      active: true,
      createdAt: '',
      updatedAt: '',
    },
    role: {
      key: 'my_ai_coding_tool',
      label: '我的 AI 编程工具',
      defaultPreference: '默认偏好：先给结论。',
      templatePreference: '模板偏好：输出可执行任务。',
      customPreference: '自定义偏好：补充风险。',
      updatedAt: '',
    },
  };
}
