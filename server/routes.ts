import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { config } from './config.js';
import { repo } from './db.js';
import { generateDraft } from './deepseek.js';
import { parseUploadedFile } from './parser.js';
import { isRoleKey, type RoleKey } from './roles.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploadLimitMb * 1024 * 1024, files: 1 },
});

const roleKeySchema = z.string().refine(isRoleKey, 'Invalid role key');

const contactSchema = z.object({
  name: z.string().min(1),
  roleKey: roleKeySchema,
  webhookUrl: z.string().default(''),
  preference: z.string().default(''),
  active: z.boolean().optional(),
});

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    deepseekConfigured: Boolean(config.deepseekApiKey),
    model: config.deepseekModel,
  });
});

router.get('/roles', (_req, res) => {
  res.json(repo.roles());
});

router.put('/roles/:key', (req, res) => {
  const key = roleKeySchema.parse(req.params.key) as RoleKey;
  const body = z.object({ customPreference: z.string().default('') }).parse(req.body);
  res.json(repo.updateRole(key, body.customPreference));
});

router.get('/contacts', (_req, res) => {
  res.json(repo.contacts());
});

router.post('/contacts', (req, res) => {
  const body = contactSchema.parse(req.body);
  res.status(201).json(repo.createContact(body as any));
});

router.put('/contacts/:id', (req, res) => {
  const id = Number(req.params.id);
  const body = contactSchema.partial().parse(req.body);
  const updated = repo.updateContact(id, body as any);
  if (!updated) return res.status(404).json({ error: 'Contact not found' });
  res.json(updated);
});

router.delete('/contacts/:id', (req, res) => {
  const deleted = repo.deleteContact(Number(req.params.id));
  res.status(deleted ? 204 : 404).send();
});

router.post('/inputs/parse', upload.single('file'), async (req, res) => {
  const typedText = typeof req.body.text === 'string' ? req.body.text.trim() : '';
  if (typedText) {
    const inputRecordId = repo.createInputRecord('text', '', typedText);
    return res.json({ inputRecordId, sourceType: 'text', filename: '', text: typedText });
  }

  if (!req.file) return res.status(400).json({ error: 'Text or file is required' });

  const parsed = await parseUploadedFile(req.file);
  if (!parsed.text) return res.status(422).json({ error: 'No text could be extracted from this file' });
  const inputRecordId = repo.createInputRecord(parsed.sourceType, parsed.filename, parsed.text);
  res.json({ inputRecordId, ...parsed });
});

router.post('/generate', async (req, res) => {
  const body = z.object({
    sourceText: z.string().min(1),
    inputRecordId: z.number().nullable().optional(),
    contactIds: z.array(z.number()).min(1),
  }).parse(req.body);

  const roles = new Map(repo.roles().map((role) => [role.key, role]));
  const drafts = [];

  for (const contactId of body.contactIds) {
    const contact = repo.contact(contactId);
    if (!contact || !contact.active) continue;
    const role = roles.get(contact.roleKey);
    if (!role) continue;
    const content = await generateDraft({ sourceText: body.sourceText, contact, role });
    const generationRecordId = repo.createGenerationRecord(
      body.inputRecordId ?? null,
      contact.id,
      contact.roleKey,
      content,
    );
    drafts.push({ generationRecordId, contact, role, content });
  }

  res.json({ drafts });
});

router.post('/send', async (req, res) => {
  const body = z.object({
    messages: z.array(z.object({
      generationRecordId: z.number().nullable().optional(),
      contactId: z.number(),
      content: z.string().min(1),
    })).min(1),
  }).parse(req.body);

  const results = [];
  for (const message of body.messages) {
    const contact = repo.contact(message.contactId);
    if (!contact) {
      results.push({ contactId: message.contactId, ok: false, error: 'Contact not found' });
      continue;
    }
    if (!contact.webhookUrl) {
      const error = 'Webhook URL is empty';
      const sendRecordId = repo.createSendRecord({
        generationRecordId: message.generationRecordId ?? null,
        contactId: contact.id,
        webhookUrl: '',
        payload: { content: message.content },
        error,
      });
      results.push({ contactId: contact.id, sendRecordId, ok: false, error });
      continue;
    }

    const payload = {
      source: 'interchange',
      recipient: contact.name,
      role: contact.roleKey,
      content: message.content,
      sentAt: new Date().toISOString(),
    };

    try {
      const response = await fetch(contact.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const responseBody = await response.text();
      const sendRecordId = repo.createSendRecord({
        generationRecordId: message.generationRecordId ?? null,
        contactId: contact.id,
        webhookUrl: contact.webhookUrl,
        payload,
        responseStatus: response.status,
        responseBody: responseBody.slice(0, 2000),
        error: response.ok ? '' : `HTTP ${response.status}`,
      });
      results.push({ contactId: contact.id, sendRecordId, ok: response.ok, status: response.status });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      const sendRecordId = repo.createSendRecord({
        generationRecordId: message.generationRecordId ?? null,
        contactId: contact.id,
        webhookUrl: contact.webhookUrl,
        payload,
        error: messageText,
      });
      results.push({ contactId: contact.id, sendRecordId, ok: false, error: messageText });
    }
  }

  res.json({ results });
});

router.get('/records', (_req, res) => {
  res.json(repo.records());
});

export { router, upload };

