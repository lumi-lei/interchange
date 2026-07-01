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
    expect(userMessage).toContain('默认偏好：先给结论。');
    expect(userMessage).toContain('自定义偏好：补充风险。');
    expect(userMessage).toContain('联系人偏好：少用术语。');
    expect(userMessage).toContain('变更：新增联系人管理。');
  });

  it('keeps the system prompt anchored on not fabricating facts', () => {
    const messages = buildDraftMessages(sampleDraftRequest());

    expect(messages[0].content).toMatch(/不编造|保留事实/);
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
      customPreference: '自定义偏好：补充风险。',
      updatedAt: '',
    },
  };
}
