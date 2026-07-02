import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';
import { roleDefinitions, roleTemplatePreference, type RoleKey } from './roles.js';

export type Contact = {
  id: number;
  name: string;
  roleKey: RoleKey;
  webhookUrl: string;
  preference: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RoleRow = {
  key: RoleKey;
  label: string;
  defaultPreference: string;
  templatePreference: string;
  customPreference: string;
  updatedAt: string;
};

fs.mkdirSync(path.dirname(config.sqlitePath), { recursive: true });

export const db = new Database(config.sqlitePath);
db.pragma('journal_mode = WAL');

function now() {
  return new Date().toISOString();
}

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      default_preference TEXT NOT NULL,
      custom_preference TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role_key TEXT NOT NULL,
      webhook_url TEXT NOT NULL DEFAULT '',
      preference TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS input_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      filename TEXT NOT NULL DEFAULT '',
      normalized_text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generation_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      input_record_id INTEGER,
      contact_id INTEGER NOT NULL,
      role_key TEXT NOT NULL,
      draft_content TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS send_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      generation_record_id INTEGER,
      contact_id INTEGER NOT NULL,
      webhook_url TEXT NOT NULL,
      payload TEXT NOT NULL,
      response_status INTEGER,
      response_body TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);

  const insertRole = db.prepare(`
    INSERT INTO roles (key, label, default_preference, custom_preference, updated_at)
    VALUES (@key, @label, @defaultPreference, '', @updatedAt)
    ON CONFLICT(key) DO UPDATE SET
      label = excluded.label,
      default_preference = excluded.default_preference
  `);

  const seed = db.transaction(() => {
    for (const role of roleDefinitions) {
      insertRole.run({ ...role, updatedAt: now() });
    }
  });
  seed();

  const count = db.prepare('SELECT COUNT(*) AS count FROM contacts').get() as { count: number };
  if (count.count === 0) {
    const insertContact = db.prepare(`
      INSERT INTO contacts (name, role_key, webhook_url, preference, active, created_at, updated_at)
      VALUES (@name, @roleKey, @webhookUrl, @preference, 1, @createdAt, @updatedAt)
    `);
    const createdAt = now();
    const defaults = [
      { name: '产品同学', roleKey: 'product', webhookUrl: '', preference: '' },
      { name: '测试同学', roleKey: 'qa', webhookUrl: '', preference: '' },
      { name: '研发组长', roleKey: 'tech_lead', webhookUrl: '', preference: '' },
    ];
    db.transaction(() => {
      for (const contact of defaults) {
        insertContact.run({ ...contact, createdAt, updatedAt: createdAt });
      }
    })();
  }
}

function mapContact(row: any): Contact {
  return {
    id: row.id,
    name: row.name,
    roleKey: row.role_key,
    webhookUrl: row.webhook_url,
    preference: row.preference,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRole(row: any): RoleRow {
  return {
    key: row.key,
    label: row.label,
    defaultPreference: row.default_preference,
    templatePreference: roleTemplatePreference(row.key),
    customPreference: row.custom_preference,
    updatedAt: row.updated_at,
  };
}

export const repo = {
  roles() {
    return (db.prepare('SELECT * FROM roles ORDER BY rowid').all() as any[]).map(mapRole);
  },
  updateRole(key: RoleKey, customPreference: string) {
    db.prepare('UPDATE roles SET custom_preference = ?, updated_at = ? WHERE key = ?').run(
      customPreference,
      now(),
      key,
    );
    return mapRole(db.prepare('SELECT * FROM roles WHERE key = ?').get(key));
  },
  contacts() {
    return (db.prepare('SELECT * FROM contacts ORDER BY active DESC, id ASC').all() as any[]).map(mapContact);
  },
  contact(id: number) {
    const row = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
    return row ? mapContact(row) : null;
  },
  createContact(input: Omit<Contact, 'id' | 'active' | 'createdAt' | 'updatedAt'> & { active?: boolean }) {
    const createdAt = now();
    const result = db.prepare(`
      INSERT INTO contacts (name, role_key, webhook_url, preference, active, created_at, updated_at)
      VALUES (@name, @roleKey, @webhookUrl, @preference, @active, @createdAt, @updatedAt)
    `).run({
      name: input.name,
      roleKey: input.roleKey,
      webhookUrl: input.webhookUrl,
      preference: input.preference,
      active: input.active === false ? 0 : 1,
      createdAt,
      updatedAt: createdAt,
    });
    return repo.contact(Number(result.lastInsertRowid));
  },
  updateContact(id: number, input: Partial<Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>>) {
    const existing = repo.contact(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    db.prepare(`
      UPDATE contacts SET
        name = @name,
        role_key = @roleKey,
        webhook_url = @webhookUrl,
        preference = @preference,
        active = @active,
        updated_at = @updatedAt
      WHERE id = @id
    `).run({
      ...next,
      active: next.active ? 1 : 0,
      updatedAt: now(),
    });
    return repo.contact(id);
  },
  deleteContact(id: number) {
    return db.prepare('DELETE FROM contacts WHERE id = ?').run(id).changes > 0;
  },
  createInputRecord(sourceType: string, filename: string, normalizedText: string) {
    const result = db.prepare(`
      INSERT INTO input_records (source_type, filename, normalized_text, created_at)
      VALUES (?, ?, ?, ?)
    `).run(sourceType, filename, normalizedText, now());
    return Number(result.lastInsertRowid);
  },
  createGenerationRecord(inputRecordId: number | null, contactId: number, roleKey: RoleKey, draftContent: string) {
    const result = db.prepare(`
      INSERT INTO generation_records (input_record_id, contact_id, role_key, draft_content, status, created_at)
      VALUES (?, ?, ?, ?, 'draft', ?)
    `).run(inputRecordId, contactId, roleKey, draftContent, now());
    return Number(result.lastInsertRowid);
  },
  createSendRecord(input: {
    generationRecordId: number | null;
    contactId: number;
    webhookUrl: string;
    payload: unknown;
    responseStatus?: number;
    responseBody?: string;
    error?: string;
  }) {
    const result = db.prepare(`
      INSERT INTO send_records (
        generation_record_id, contact_id, webhook_url, payload, response_status, response_body, error, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.generationRecordId,
      input.contactId,
      input.webhookUrl,
      JSON.stringify(input.payload),
      input.responseStatus ?? null,
      input.responseBody ?? '',
      input.error ?? '',
      now(),
    );
    return Number(result.lastInsertRowid);
  },
  records() {
    return {
      generations: db.prepare(`
        SELECT g.*, c.name AS contact_name
        FROM generation_records g
        LEFT JOIN contacts c ON c.id = g.contact_id
        ORDER BY g.id DESC
        LIMIT 30
      `).all(),
      sends: db.prepare(`
        SELECT s.*, c.name AS contact_name
        FROM send_records s
        LEFT JOIN contacts c ON c.id = s.contact_id
        ORDER BY s.id DESC
        LIMIT 30
      `).all(),
    };
  },
};
