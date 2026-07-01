import { afterEach, describe, expect, it, vi } from 'vitest';
import { config, type TextModelProviderName } from '../server/config.js';
import { generateDraft, resolveTextProvider } from '../server/ai/modelRouter.js';
import { deepSeekProvider } from '../server/ai/providers/deepseek.js';
import type { DraftRequest } from '../server/ai/types.js';

const originalProvider = config.textModelProvider;

describe('model router', () => {
  afterEach(() => {
    config.textModelProvider = originalProvider;
    vi.restoreAllMocks();
  });

  it('resolves the default text provider from config', () => {
    config.textModelProvider = 'deepseek';

    expect(resolveTextProvider()).toBe(deepSeekProvider);
  });

  it('normalizes explicit provider names', () => {
    expect(resolveTextProvider('DEEPSEEK')).toBe(deepSeekProvider);
    expect(resolveTextProvider(' deepseek ')).toBe(deepSeekProvider);
  });

  it('throws a readable 503 error for unsupported text providers', () => {
    expect(() => resolveTextProvider('unknown-provider')).toThrow(
      'Unsupported TEXT_MODEL_PROVIDER "unknown-provider". Supported providers: deepseek.',
    );
    expect(() => resolveTextProvider('unknown-provider')).toThrow(expect.objectContaining({ status: 503 }));
  });

  it('generates drafts through the resolved text provider', async () => {
    config.textModelProvider = 'deepseek';
    const providerSpy = vi.spyOn(deepSeekProvider, 'generateDraft').mockResolvedValueOnce({ content: 'routed draft' });
    const input = sampleDraftRequest();

    await expect(generateDraft(input)).resolves.toBe('routed draft');
    expect(providerSpy).toHaveBeenCalledWith(input);
  });

  it('does not silently fall back for unsupported configured providers', async () => {
    config.textModelProvider = 'unknown-provider' as TextModelProviderName;

    await expect(generateDraft(sampleDraftRequest())).rejects.toMatchObject({
      status: 503,
      message: 'Unsupported TEXT_MODEL_PROVIDER "unknown-provider". Supported providers: deepseek.',
    });
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
      preference: '',
      active: true,
      createdAt: '',
      updatedAt: '',
    },
    role: {
      key: 'my_ai_coding_tool',
      label: '我的 AI 编程工具',
      defaultPreference: '偏好直接给出实现要点。',
      customPreference: '',
      updatedAt: '',
    },
  };
}
