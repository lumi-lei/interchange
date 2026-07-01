import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { createApp } from '../server/index.js';
import { db } from '../server/db.js';
import { config } from '../server/config.js';
import {
  assertExternalFileModelAllowed,
  disabledExternalModelMessages,
  isFileProviderEnabled,
  isVisionProviderEnabled,
} from '../server/ai/compliance.js';
import { buildDraftMessages } from '../server/ai/prompts.js';
import { deepSeekProvider } from '../server/ai/providers/deepseek.js';
import { generateDraft as routeDraft, resolveTextProvider } from '../server/ai/modelRouter.js';
import type { DraftRequest } from '../server/ai/types.js';

const sampleDraftRequest: DraftRequest = {
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

describe('Interchange API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('../server/ai/modelRouter.js');
    vi.doUnmock('../server/deepseek.js');
  });

  afterAll(() => {
    db.close();
  });

  it('reports health without exposing secrets', async () => {
    const response = await request(createApp()).get('/api/health').expect(200);
    expect(response.body.ok).toBe(true);
    expect(response.body).not.toHaveProperty('deepseekApiKey');
  });

  it('creates and updates contacts', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/contacts')
      .send({ name: 'Webhook 测试', roleKey: 'qa', webhookUrl: '', preference: '', active: true })
      .expect(201);

    expect(created.body.id).toBeTypeOf('number');
    const updated = await request(app)
      .put(`/api/contacts/${created.body.id}`)
      .send({ preference: '先列风险，再列用例。' })
      .expect(200);

    expect(updated.body.preference).toContain('风险');
  });

  it('parses typed text into an input record', async () => {
    const response = await request(createApp())
      .post('/api/inputs/parse')
      .field('text', '修复登录页空状态，并补充测试。')
      .expect(200);

    expect(response.body.inputRecordId).toBeTypeOf('number');
    expect(response.body.text).toContain('登录页');
  });

  it('returns a clear error when DeepSeek key is missing', async () => {
    const originalApiKey = config.deepseekApiKey;
    try {
      config.deepseekApiKey = '';
      const app = createApp();
      const contact = await request(app)
        .post('/api/contacts')
        .send({ name: 'AI', roleKey: 'my_ai_coding_tool', webhookUrl: '', preference: '', active: true })
        .expect(201);

      const response = await request(app)
        .post('/api/generate')
        .send({ sourceText: '变更：新增联系人管理。', inputRecordId: null, contactIds: [contact.body.id] })
        .expect(503);

      expect(response.body.error).toContain('DEEPSEEK_API_KEY');
    } finally {
      config.deepseekApiKey = originalApiKey;
    }
  });

  it('uses DeepSeek as the default text model provider', () => {
    const originalProvider = config.textModelProvider;
    try {
      config.textModelProvider = 'deepseek';
      expect(resolveTextProvider()).toBe(deepSeekProvider);
    } finally {
      config.textModelProvider = originalProvider;
    }
  });

  it('disables external vision and file model providers by default', () => {
    expect(config.visionModelProvider).toBe('none');
    expect(config.fileModelProvider).toBe('none');
    expect(isVisionProviderEnabled()).toBe(false);
    expect(isFileProviderEnabled()).toBe(false);
  });

  it('returns readable errors when external vision or file providers are disabled', () => {
    const originalVisionProvider = config.visionModelProvider;
    const originalFileProvider = config.fileModelProvider;
    try {
      config.visionModelProvider = 'none';
      config.fileModelProvider = 'none';

      expect(() => assertExternalFileModelAllowed('vision')).toThrow(disabledExternalModelMessages.vision);
      expect(() => assertExternalFileModelAllowed('file')).toThrow(disabledExternalModelMessages.file);
    } finally {
      config.visionModelProvider = originalVisionProvider;
      config.fileModelProvider = originalFileProvider;
    }
  });

  it('does not call an external model path when local file parsing returns no text', async () => {
    const originalFileProvider = config.fileModelProvider;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      config.fileModelProvider = 'none';
      const response = await request(createApp())
        .post('/api/inputs/parse')
        .attach('file', Buffer.alloc(0), { filename: 'empty.txt', contentType: 'text/plain' })
        .expect(422);

      expect(response.body.error).toBe(disabledExternalModelMessages.file);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      config.fileModelProvider = originalFileProvider;
    }
  });

  it('keeps the existing prompt preference order', () => {
    const messages = buildDraftMessages({
      ...sampleDraftRequest,
      contact: { ...sampleDraftRequest.contact, preference: '联系人偏好' },
      role: {
        ...sampleDraftRequest.role,
        defaultPreference: '默认偏好',
        customPreference: '自定义偏好',
      },
    });

    expect(messages[0].content).toContain('保留事实');
    expect(messages[1].content).toContain('收件人：AI');
    expect(messages[1].content).toContain('角色：我的 AI 编程工具');
    expect(messages[1].content).toContain('角色关注点：默认偏好\n自定义偏好\n联系人偏好');
    expect(messages[1].content).toContain('变更：新增联系人管理。');
  });

  it('returns a readable error for missing or unsupported text model providers', async () => {
    const originalProvider = config.textModelProvider;
    try {
      config.textModelProvider = '';
      await expect(routeDraft(sampleDraftRequest)).rejects.toThrow('Unsupported TEXT_MODEL_PROVIDER');

      config.textModelProvider = 'unknown-provider';
      await expect(routeDraft(sampleDraftRequest)).rejects.toThrow('Unsupported TEXT_MODEL_PROVIDER');
    } finally {
      config.textModelProvider = originalProvider;
    }
  });

  it('calls /generate through the model router instead of the legacy DeepSeek module', async () => {
    const generateDraft = vi.fn(async () => 'router generated draft');
    vi.resetModules();
    vi.doMock('../server/ai/modelRouter.js', () => ({ generateDraft }));
    vi.doMock('../server/deepseek.js', () => ({
      generateDraft: vi.fn(async () => {
        throw new Error('legacy DeepSeek module should not be called');
      }),
    }));

    const { createApp: createMockedApp } = await import('../server/index.js');
    const { db: mockedDb } = await import('../server/db.js');
    const app = createMockedApp();

    try {
      const contact = await request(app)
        .post('/api/contacts')
        .send({ name: 'Router Contact', roleKey: 'product', webhookUrl: '', preference: '', active: true })
        .expect(201);

      const response = await request(app)
        .post('/api/generate')
        .send({ sourceText: '变更：新增联系人管理。', inputRecordId: null, contactIds: [contact.body.id] })
        .expect(200);

      expect(generateDraft).toHaveBeenCalledTimes(1);
      expect(response.body.drafts[0].content).toBe('router generated draft');
    } finally {
      mockedDb.close();
      vi.resetModules();
    }
  });

  it('sends confirmed messages to a generic webhook', async () => {
    let received: any = null;
    const receiver = express();
    receiver.use(express.json());
    receiver.post('/hook', (req, res) => {
      received = req.body;
      res.status(202).json({ ok: true });
    });

    const server = await new Promise<Server>((resolve) => {
      const instance = createServer(receiver);
      instance.listen(0, '127.0.0.1', () => resolve(instance));
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No test server address');
      const webhookUrl = `http://127.0.0.1:${address.port}/hook`;
      const app = createApp();
      const contact = await request(app)
        .post('/api/contacts')
        .send({ name: 'Hook', roleKey: 'product', webhookUrl, preference: '', active: true })
        .expect(201);

      const response = await request(app)
        .post('/api/send')
        .send({ messages: [{ generationRecordId: null, contactId: contact.body.id, content: '确认发送内容' }] })
        .expect(200);

      expect(response.body.results[0].ok).toBe(true);
      expect(received.content).toBe('确认发送内容');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
