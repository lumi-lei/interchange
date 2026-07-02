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
import { buildDingTalkSign } from '../server/delivery.js';
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
    deliveryType: 'generic_webhook',
    webhookUrl: '',
    dingtalkSecret: '',
    dingtalkKeyword: '',
    preference: '',
    active: true,
    createdAt: '',
    updatedAt: '',
  },
  role: {
    key: 'my_ai_coding_tool',
    label: '我的 AI 编程工具',
    defaultPreference: '偏好直接给出实现要点。',
    templatePreference: '模板偏好。',
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

  it('does not expose DingTalk robot secrets through contact APIs', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/contacts')
      .send({
        name: 'DingTalk',
        roleKey: 'product',
        deliveryType: 'dingtalk_robot',
        webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=test',
        dingtalkSecret: 'ding-secret',
        dingtalkKeyword: 'Interchange',
        preference: '',
        active: true,
      })
      .expect(201);

    expect(created.body.dingtalkSecretConfigured).toBe(true);
    expect(created.body).not.toHaveProperty('dingtalkSecret');

    const contacts = await request(app).get('/api/contacts').expect(200);
    const matched = contacts.body.find((contact: any) => contact.id === created.body.id);
    expect(matched.dingtalkSecretConfigured).toBe(true);
    expect(matched).not.toHaveProperty('dingtalkSecret');

    const cleared = await request(app)
      .put(`/api/contacts/${created.body.id}`)
      .send({ clearDingtalkSecret: true })
      .expect(200);
    expect(cleared.body.dingtalkSecretConfigured).toBe(false);
  });

  it('toggles contact active state through the existing update endpoint', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/contacts')
      .send({ name: '状态切换', roleKey: 'qa', webhookUrl: '', preference: '', active: true })
      .expect(201);

    const disabled = await request(app)
      .put(`/api/contacts/${created.body.id}`)
      .send({ active: false })
      .expect(200);

    expect(disabled.body.active).toBe(false);

    const enabled = await request(app)
      .put(`/api/contacts/${created.body.id}`)
      .send({ active: true })
      .expect(200);

    expect(enabled.body.active).toBe(true);
  });

  it('skips inactive contacts during generation', async () => {
    const app = createApp();
    const contact = await request(app)
      .post('/api/contacts')
      .send({ name: '停用联系人', roleKey: 'product', webhookUrl: '', preference: '', active: false })
      .expect(201);

    const response = await request(app)
      .post('/api/generate')
      .send({ sourceText: '变更：只验证停用联系人会被跳过。', inputRecordId: null, contactIds: [contact.body.id] })
      .expect(200);

    expect(response.body.drafts).toEqual([]);
  });

  it('keeps the existing permanent delete contact endpoint behavior', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/contacts')
      .send({ name: '待删除联系人', roleKey: 'qa', webhookUrl: '', preference: '', active: false })
      .expect(201);

    await request(app).delete(`/api/contacts/${created.body.id}`).expect(204);

    const contacts = await request(app).get('/api/contacts').expect(200);
    expect(contacts.body.some((contact: any) => contact.id === created.body.id)).toBe(false);
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

  it('returns built-in AI coding prompt templates separately from custom preferences', async () => {
    const response = await request(createApp()).get('/api/roles').expect(200);
    const myAiRole = response.body.find((role: any) => role.key === 'my_ai_coding_tool');
    const teammateAiRole = response.body.find((role: any) => role.key === 'teammate_ai_coding_tool');

    expect(myAiRole.templatePreference).toContain('主执行 AI');
    expect(myAiRole.templatePreference).toContain('Agent Skills');
    expect(myAiRole.templatePreference).toContain('OpenSpec');
    expect(myAiRole.templatePreference).toContain('未完成文档发现前，不要修改代码');
    expect(myAiRole.templatePreference).not.toBe(myAiRole.customPreference);
    expect(teammateAiRole.templatePreference).toContain('同项目协作 AI');
    expect(teammateAiRole.templatePreference).toContain('Agent Skills');
    expect(teammateAiRole.templatePreference).toContain('OpenSpec');
    expect(teammateAiRole.templatePreference).toContain('协作边界');
    expect(teammateAiRole.templatePreference).not.toBe(teammateAiRole.customPreference);
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
        templatePreference: '模板偏好',
        customPreference: '自定义偏好',
      },
    });

    expect(messages[0].content).toContain('保留事实');
    expect(messages[0].content).toContain('用户自定义补充视为高优先级提示词');
    expect(messages[1].content).toContain('收件人：AI');
    expect(messages[1].content).toContain('角色：我的 AI 编程工具');
    expect(messages[1].content).toContain('角色默认关注点：默认偏好');
    expect(messages[1].content).toContain('推荐提示词模板：模板偏好');
    expect(messages[1].content).toContain('用户自定义补充：自定义偏好');
    expect(messages[1].content).toContain('收件人补充偏好：联系人偏好');
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

  it('sends confirmed messages to a DingTalk robot as signed markdown', async () => {
    let received: any = null;
    let receivedUrl = '';
    const receiver = express();
    receiver.use(express.json());
    receiver.post('/hook', (req, res) => {
      received = req.body;
      receivedUrl = req.url;
      res.status(200).json({ errcode: 0, errmsg: 'ok' });
    });

    const server = await new Promise<Server>((resolve) => {
      const instance = createServer(receiver);
      instance.listen(0, '127.0.0.1', () => resolve(instance));
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No test server address');
      const webhookUrl = `http://127.0.0.1:${address.port}/hook?access_token=test-token`;
      const secret = 'this is a secret';
      const app = createApp();
      const contact = await request(app)
        .post('/api/contacts')
        .send({
          name: 'Ding',
          roleKey: 'product',
          deliveryType: 'dingtalk_robot',
          webhookUrl,
          dingtalkSecret: secret,
          dingtalkKeyword: 'Interchange',
          preference: '',
          active: true,
        })
        .expect(201);

      const response = await request(app)
        .post('/api/send')
        .send({ messages: [{ generationRecordId: null, contactId: contact.body.id, content: '确认发送内容' }] })
        .expect(200);

      expect(response.body.results[0].ok).toBe(true);
      expect(received.msgtype).toBe('markdown');
      expect(received.markdown.title).toBe('Interchange - Ding');
      expect(received.markdown.text).toContain('Interchange');
      expect(received.markdown.text).toContain('确认发送内容');

      const url = new URL(`http://127.0.0.1${receivedUrl}`);
      const timestamp = Number(url.searchParams.get('timestamp'));
      expect(timestamp).toBeGreaterThan(0);
      expect(url.searchParams.get('sign')).toBe(buildDingTalkSign(secret, timestamp));

      const records = await request(app).get('/api/records').expect(200);
      expect(records.body.sends[0].delivery_type).toBe('dingtalk_robot');
      expect(records.body.sends[0].payload).not.toContain(secret);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
