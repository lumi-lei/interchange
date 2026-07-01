import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DraftRequest, TextModelProvider } from '../server/ai/types.js';

const createMock = vi.fn();
const constructorMock = vi.fn();

vi.mock('openai', () => ({
  default: class OpenAIMock {
    chat = {
      completions: {
        create: createMock,
      },
    };

    constructor(options: unknown) {
      constructorMock(options);
    }
  },
}));

describe('DeepSeek provider', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('implements the unified text model provider contract', async () => {
    const { deepSeekProvider } = await import('../server/ai/providers/deepseek.js');
    const provider: TextModelProvider = deepSeekProvider;

    expect(provider).toHaveProperty('generateDraft');
    expect(typeof provider.generateDraft).toBe('function');
  });

  it('throws a readable 503 error when DEEPSEEK_API_KEY is missing', async () => {
    const { config } = await import('../server/config.js');
    const { deepSeekProvider } = await import('../server/ai/providers/deepseek.js');
    const originalApiKey = config.deepseekApiKey;

    try {
      config.deepseekApiKey = '';

      await expect(deepSeekProvider.generateDraft(sampleDraftRequest())).rejects.toMatchObject({
        status: 503,
        message: expect.stringContaining('DEEPSEEK_API_KEY'),
      });
      expect(constructorMock).not.toHaveBeenCalled();
      expect(createMock).not.toHaveBeenCalled();
    } finally {
      config.deepseekApiKey = originalApiKey;
    }
  });

  it('calls DeepSeek through OpenAI-compatible chat completions with shared prompt messages', async () => {
    const { config } = await import('../server/config.js');
    const { deepSeekProvider } = await import('../server/ai/providers/deepseek.js');
    const originalApiKey = config.deepseekApiKey;
    const originalModel = config.deepseekModel;

    try {
      config.deepseekApiKey = 'test-deepseek-key';
      config.deepseekModel = 'deepseek-v4-flash';
      createMock.mockResolvedValueOnce({
        choices: [{ message: { content: '  生成内容  ' } }],
      });

      const response = await deepSeekProvider.generateDraft(sampleDraftRequest());

      expect(response).toEqual({ content: '生成内容' });
      expect(constructorMock).toHaveBeenCalledWith({
        apiKey: 'test-deepseek-key',
        baseURL: 'https://api.deepseek.com',
      });
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
        model: 'deepseek-v4-flash',
        stream: false,
      }));

      const request = createMock.mock.calls[0][0];
      expect(request.messages[0].role).toBe('system');
      expect(request.messages[1].content).toContain('收件人：AI');
      expect(request.messages[1].content).toContain('角色：我的 AI 编程工具');
      expect(request.messages[1].content).toContain('角色关注点：偏好直接给出实现要点。\n联系人偏好');
      expect(request.messages[1].content).toContain('变更：新增联系人管理。');
    } finally {
      config.deepseekApiKey = originalApiKey;
      config.deepseekModel = originalModel;
    }
  });

  it('returns an empty string when the provider response has no content', async () => {
    const { config } = await import('../server/config.js');
    const { deepSeekProvider } = await import('../server/ai/providers/deepseek.js');
    const originalApiKey = config.deepseekApiKey;

    try {
      config.deepseekApiKey = 'test-deepseek-key';
      createMock.mockResolvedValueOnce({ choices: [{ message: {} }] });

      await expect(deepSeekProvider.generateDraft(sampleDraftRequest())).resolves.toEqual({ content: '' });
    } finally {
      config.deepseekApiKey = originalApiKey;
    }
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
      preference: '联系人偏好',
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
