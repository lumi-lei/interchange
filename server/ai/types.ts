import type { Contact, RoleRow } from '../db.js';

export type DraftRequest = {
  sourceText: string;
  contact: Contact;
  role: RoleRow;
};

export type DraftResponse = {
  content: string;
};

export type DraftMessage = {
  role: 'system' | 'user';
  content: string;
};

export type TextModelProvider = {
  generateDraft(input: DraftRequest): Promise<DraftResponse>;
};
