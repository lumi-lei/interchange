export type Role = {
  key: string;
  label: string;
  defaultPreference: string;
  customPreference: string;
};

export type Contact = {
  id: number;
  name: string;
  roleKey: string;
  webhookUrl: string;
  preference: string;
  active: boolean;
};

export type Draft = {
  generationRecordId: number;
  contact: Contact;
  role: Role;
  content: string;
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.error ?? `Request failed: ${response.status}`);
  }
  return data as T;
}

export const api = {
  health: () => request<{ ok: boolean; deepseekConfigured: boolean; model: string }>('/api/health'),
  roles: () => request<Role[]>('/api/roles'),
  updateRole: (key: string, customPreference: string) =>
    request<Role>(`/api/roles/${key}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ customPreference }),
    }),
  contacts: () => request<Contact[]>('/api/contacts'),
  createContact: (contact: Omit<Contact, 'id'>) =>
    request<Contact>('/api/contacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(contact),
    }),
  updateContact: (id: number, contact: Partial<Contact>) =>
    request<Contact>(`/api/contacts/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(contact),
    }),
  deleteContact: (id: number) => request<void>(`/api/contacts/${id}`, { method: 'DELETE' }),
  parseInput: (formData: FormData) =>
    request<{ inputRecordId: number; sourceType: string; filename: string; text: string }>('/api/inputs/parse', {
      method: 'POST',
      body: formData,
    }),
  generate: (sourceText: string, inputRecordId: number | null, contactIds: number[]) =>
    request<{ drafts: Draft[] }>('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceText, inputRecordId, contactIds }),
    }),
  send: (messages: Array<{ generationRecordId: number | null; contactId: number; content: string }>) =>
    request<{ results: Array<{ contactId: number; sendRecordId?: number; ok: boolean; status?: number; error?: string }> }>(
      '/api/send',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages }),
      },
    ),
};

