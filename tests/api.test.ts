import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { createApp } from '../server/index.js';
import { db } from '../server/db.js';

describe('Interchange API', () => {
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

