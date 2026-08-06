import { createClient, type InStatement, type Row } from '@libsql/client';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { roleDefinitions, roleTemplatePreference, type RoleKey } from './roles.js';

export type DeliveryType = 'generic_webhook' | 'dingtalk_robot';

export type Contact = {
  id: number;
  name: string;
  roleKey: RoleKey;
  deliveryType: DeliveryType;
  webhookUrl: string;
  dingtalkSecret: string;
  dingtalkKeyword: string;
  preference: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicContact = Omit<Contact, 'dingtalkSecret'> & {
  dingtalkSecretConfigured: boolean;
};

type ContactInput = {
  name: string;
  roleKey: RoleKey;
  deliveryType?: DeliveryType;
  webhookUrl?: string;
  dingtalkSecret?: string;
  dingtalkKeyword?: string;
  preference?: string;
  active?: boolean;
};

type ContactUpdateInput = Partial<Omit<ContactInput, 'active'>> & {
  active?: boolean;
  clearDingtalkSecret?: boolean;
};

export type RoleRow = {
  key: RoleKey;
  label: string;
  defaultPreference: string;
  templatePreference: string;
  customPreference: string;
  updatedAt: string;
};

const useTurso = process.env.NODE_ENV !== 'test' && Boolean(config.tursoDatabaseUrl && config.tursoAuthToken);
const databaseUrl = useTurso ? config.tursoDatabaseUrl : process.env.NODE_ENV === 'test'
  ? 'file::memory:'
  : pathToFileURL(config.sqlitePath).href;

export const db = createClient({
  url: databaseUrl,
  ...(useTurso ? { authToken: config.tursoAuthToken } : {}),
});

function now() {
  return new Date().toISOString();
}

function value<T>(row: Row, key: string) {
  return row[key] as T;
}

function rowObject(row: Row, columns: string[]) {
  return Object.fromEntries(columns.map((column) => [column, row[column]]));
}

async function ensureColumn(tableName: string, columnName: string, definition: string) {
  const columns = await db.execute(`PRAGMA table_info(${tableName})`);
  if (!columns.rows.some((column) => value<string>(column, 'name') === columnName)) {
    await db.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

let migrationPromise: Promise<void> | undefined;

async function runMigrations() {
  await db.executeMultiple(`
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
      delivery_type TEXT NOT NULL DEFAULT 'generic_webhook',
      webhook_url TEXT NOT NULL DEFAULT '',
      dingtalk_secret TEXT NOT NULL DEFAULT '',
      dingtalk_keyword TEXT NOT NULL DEFAULT '',
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
      delivery_type TEXT NOT NULL DEFAULT 'generic_webhook',
      webhook_url TEXT NOT NULL,
      payload TEXT NOT NULL,
      response_status INTEGER,
      response_body TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);

  await ensureColumn('contacts', 'delivery_type', "TEXT NOT NULL DEFAULT 'generic_webhook'");
  await ensureColumn('contacts', 'dingtalk_secret', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn('contacts', 'dingtalk_keyword', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn('send_records', 'delivery_type', "TEXT NOT NULL DEFAULT 'generic_webhook'");

  await db.batch(roleDefinitions.map((role): InStatement => ({
    sql: `
      INSERT INTO roles (key, label, default_preference, custom_preference, updated_at)
      VALUES (?, ?, ?, '', ?)
      ON CONFLICT(key) DO UPDATE SET
        label = excluded.label,
        default_preference = excluded.default_preference
    `,
    args: [role.key, role.label, role.defaultPreference, now()],
  })), 'write');

  const countResult = await db.execute('SELECT COUNT(*) AS count FROM contacts');
  if (Number(value<number | bigint>(countResult.rows[0]!, 'count')) === 0) {
    const createdAt = now();
    const defaults: ContactInput[] = [
      { name: '产品同学', roleKey: 'product', webhookUrl: '', preference: '' },
      { name: '测试同学', roleKey: 'qa', webhookUrl: '', preference: '' },
      { name: '研发组长', roleKey: 'tech_lead', webhookUrl: '', preference: '' },
    ];
    await db.batch(defaults.map((contact): InStatement => ({
      sql: `
        INSERT INTO contacts (
          name, role_key, delivery_type, webhook_url, dingtalk_secret, dingtalk_keyword,
          preference, active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `,
      args: [
        contact.name,
        contact.roleKey,
        contact.deliveryType ?? 'generic_webhook',
        contact.webhookUrl ?? '',
        contact.dingtalkSecret ?? '',
        contact.dingtalkKeyword ?? '',
        contact.preference ?? '',
        createdAt,
        createdAt,
      ],
    })), 'write');
  }
}

export function migrate() {
  migrationPromise ??= runMigrations();
  return migrationPromise;
}

function mapContact(row: any): Contact {
  return {
    id: row.id,
    name: row.name,
    roleKey: row.role_key,
    deliveryType: row.delivery_type ?? 'generic_webhook',
    webhookUrl: row.webhook_url,
    dingtalkSecret: row.dingtalk_secret ?? '',
    dingtalkKeyword: row.dingtalk_keyword ?? '',
    preference: row.preference,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicContact(contact: Contact): PublicContact {
  const { dingtalkSecret, ...publicContact } = contact;
  return {
    ...publicContact,
    dingtalkSecretConfigured: Boolean(dingtalkSecret),
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
  async roles() {
    const result = await db.execute('SELECT * FROM roles ORDER BY rowid');
    return result.rows.map((row) => mapRole(rowObject(row, result.columns)));
  },
  async updateRole(key: RoleKey, customPreference: string) {
    await db.execute({
      sql: 'UPDATE roles SET custom_preference = ?, updated_at = ? WHERE key = ?',
      args: [customPreference, now(), key],
    });
    const result = await db.execute({ sql: 'SELECT * FROM roles WHERE key = ?', args: [key] });
    return mapRole(rowObject(result.rows[0]!, result.columns));
  },
  async contacts() {
    const result = await db.execute('SELECT * FROM contacts ORDER BY active DESC, id ASC');
    return result.rows.map((row) => mapContact(rowObject(row, result.columns)));
  },
  async contact(id: number) {
    const result = await db.execute({ sql: 'SELECT * FROM contacts WHERE id = ?', args: [id] });
    return result.rows[0] ? mapContact(rowObject(result.rows[0], result.columns)) : null;
  },
  async createContact(input: ContactInput) {
    const createdAt = now();
    const result = await db.execute({ sql: `
      INSERT INTO contacts (
        name, role_key, delivery_type, webhook_url, dingtalk_secret, dingtalk_keyword,
        preference, active, created_at, updated_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`, args: [
      input.name,
      input.roleKey,
      input.deliveryType ?? 'generic_webhook',
      input.webhookUrl ?? '',
      input.dingtalkSecret ?? '',
      input.dingtalkKeyword ?? '',
      input.preference ?? '',
      input.active === false ? 0 : 1,
      createdAt,
      createdAt,
    ] });
    return repo.contact(Number(result.lastInsertRowid));
  },
  async updateContact(id: number, input: ContactUpdateInput) {
    const existing = await repo.contact(id);
    if (!existing) return null;
    const next = {
      name: input.name ?? existing.name,
      roleKey: input.roleKey ?? existing.roleKey,
      deliveryType: input.deliveryType ?? existing.deliveryType,
      webhookUrl: input.webhookUrl ?? existing.webhookUrl,
      dingtalkSecret: input.clearDingtalkSecret ? '' : input.dingtalkSecret ?? existing.dingtalkSecret,
      dingtalkKeyword: input.dingtalkKeyword ?? existing.dingtalkKeyword,
      preference: input.preference ?? existing.preference,
      active: input.active ?? existing.active,
    };
    await db.execute({ sql: `
      UPDATE contacts SET
        name = ?, role_key = ?, delivery_type = ?, webhook_url = ?, dingtalk_secret = ?,
        dingtalk_keyword = ?, preference = ?, active = ?, updated_at = ?
      WHERE id = ?
    `, args: [
      next.name,
      next.roleKey,
      next.deliveryType,
      next.webhookUrl,
      next.dingtalkSecret,
      next.dingtalkKeyword,
      next.preference,
      next.active ? 1 : 0,
      now(),
      id,
    ] });
    return repo.contact(id);
  },
  async updateContactsActive(ids: number[], active: boolean) {
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(', ');
    await db.execute({
      sql: `UPDATE contacts SET active = ?, updated_at = ? WHERE id IN (${placeholders})`,
      args: [active ? 1 : 0, now(), ...ids],
    });
    const result = await db.execute({
      sql: `SELECT * FROM contacts WHERE id IN (${placeholders})`,
      args: ids,
    });
    const contacts = result.rows.map((row) => mapContact(rowObject(row, result.columns)));
    const contactMap = new Map(contacts.map((contact) => [contact.id, contact]));
    return ids.flatMap((id) => {
      const contact = contactMap.get(id);
      return contact ? [contact] : [];
    });
  },
  async deleteContact(id: number) {
    const result = await db.execute({ sql: 'DELETE FROM contacts WHERE id = ?', args: [id] });
    return result.rowsAffected > 0;
  },
  async deleteInactiveContacts(ids: number[]) {
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const matching = await db.execute({
      sql: `SELECT id FROM contacts WHERE active = 0 AND id IN (${placeholders})`,
      args: ids,
    });
    const deletedIds = matching.rows.map((row) => Number(value(row, 'id')));
    if (!deletedIds.length) return [];
    const deletedPlaceholders = deletedIds.map(() => '?').join(', ');
    await db.execute({
      sql: `DELETE FROM contacts WHERE active = 0 AND id IN (${deletedPlaceholders})`,
      args: deletedIds,
    });
    return deletedIds;
  },
  async createInputRecord(sourceType: string, filename: string, normalizedText: string) {
    const result = await db.execute({ sql: `
      INSERT INTO input_records (source_type, filename, normalized_text, created_at)
      VALUES (?, ?, ?, ?)
    `, args: [sourceType, filename, normalizedText, now()] });
    return Number(result.lastInsertRowid);
  },
  async createGenerationRecord(inputRecordId: number | null, contactId: number, roleKey: RoleKey, draftContent: string) {
    const result = await db.execute({ sql: `
      INSERT INTO generation_records (input_record_id, contact_id, role_key, draft_content, status, created_at)
      VALUES (?, ?, ?, ?, 'draft', ?)
    `, args: [inputRecordId, contactId, roleKey, draftContent, now()] });
    return Number(result.lastInsertRowid);
  },
  async createSendRecord(input: {
    generationRecordId: number | null;
    contactId: number;
    deliveryType?: DeliveryType;
    webhookUrl: string;
    payload: unknown;
    responseStatus?: number;
    responseBody?: string;
    error?: string;
  }) {
    const result = await db.execute({ sql: `
      INSERT INTO send_records (
        generation_record_id, contact_id, delivery_type, webhook_url, payload, response_status, response_body, error, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, args: [
      input.generationRecordId,
      input.contactId,
      input.deliveryType ?? 'generic_webhook',
      input.webhookUrl,
      JSON.stringify(input.payload),
      input.responseStatus ?? null,
      input.responseBody ?? '',
      input.error ?? '',
      now(),
    ] });
    return Number(result.lastInsertRowid);
  },
  async records() {
    const [generations, sends] = await Promise.all([
      db.execute(`
        SELECT g.*, c.name AS contact_name
        FROM generation_records g
        LEFT JOIN contacts c ON c.id = g.contact_id
        ORDER BY g.id DESC
        LIMIT 30
      `),
      db.execute(`
        SELECT s.*, c.name AS contact_name
        FROM send_records s
        LEFT JOIN contacts c ON c.id = s.contact_id
        ORDER BY s.id DESC
        LIMIT 30
      `),
    ]);
    return {
      generations: generations.rows.map((row) => rowObject(row, generations.columns)),
      sends: sends.rows.map((row) => rowObject(row, sends.columns)),
    };
  },
};
