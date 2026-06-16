import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Check,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { api, type Contact, type Draft, type Role } from './api';

type DraftState = Draft & { selected: boolean; editedContent: string; sendStatus?: string };

const blankContact = (roleKey = 'product'): Omit<Contact, 'id'> => ({
  name: '',
  roleKey,
  webhookUrl: '',
  preference: '',
  active: true,
});

export function App() {
  const [health, setHealth] = useState<{ deepseekConfigured: boolean; model: string } | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [sourceText, setSourceText] = useState('');
  const [inputRecordId, setInputRecordId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<DraftState[]>([]);
  const [contactDraft, setContactDraft] = useState<Omit<Contact, 'id'>>(blankContact());
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [roleEditKey, setRoleEditKey] = useState('');

  const roleMap = useMemo(() => new Map(roles.map((role) => [role.key, role])), [roles]);

  async function load() {
    setError('');
    const [healthData, roleData, contactData] = await Promise.all([api.health(), api.roles(), api.contacts()]);
    setHealth(healthData);
    setRoles(roleData);
    setContacts(contactData);
    setSelectedContactIds((current) => current.length ? current : contactData.filter((c) => c.active).map((c) => c.id));
    setContactDraft(blankContact(roleData[0]?.key ?? 'product'));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function parseTextOrFile(file?: File) {
    setBusy('parse');
    setError('');
    try {
      const form = new FormData();
      if (file) form.append('file', file);
      else form.append('text', sourceText);
      const parsed = await api.parseInput(form);
      setSourceText(parsed.text);
      setInputRecordId(parsed.inputRecordId);
      setStatus(`已解析 ${parsed.filename || '手动输入'}，来源类型：${parsed.sourceType}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('');
    }
  }

  async function generate() {
    setBusy('generate');
    setError('');
    setDrafts([]);
    try {
      const result = await api.generate(sourceText, inputRecordId, selectedContactIds);
      setDrafts(result.drafts.map((draft) => ({ ...draft, selected: true, editedContent: draft.content })));
      setStatus(`已生成 ${result.drafts.length} 条角色化草稿`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('');
    }
  }

  async function sendSelected() {
    setBusy('send');
    setError('');
    const messages = drafts
      .filter((draft) => draft.selected)
      .map((draft) => ({
        generationRecordId: draft.generationRecordId,
        contactId: draft.contact.id,
        content: draft.editedContent,
      }));
    try {
      const result = await api.send(messages);
      setDrafts((current) =>
        current.map((draft) => {
          const matched = result.results.find((item) => item.contactId === draft.contact.id);
          if (!matched) return draft;
          return {
            ...draft,
            sendStatus: matched.ok ? `已发送 HTTP ${matched.status}` : `发送失败：${matched.error ?? '未知错误'}`,
          };
        }),
      );
      setStatus(`发送完成：${result.results.filter((item) => item.ok).length}/${result.results.length} 成功`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('');
    }
  }

  async function saveContact() {
    if (!contactDraft.name.trim()) return setError('联系人姓名不能为空');
    setBusy('contact');
    setError('');
    try {
      await api.createContact(contactDraft);
      setContactDraft(blankContact(roles[0]?.key ?? 'product'));
      await load();
      setStatus('联系人已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('');
    }
  }

  async function updateContact(id: number, patch: Partial<Contact>) {
    const updated = await api.updateContact(id, patch);
    setContacts((current) => current.map((contact) => (contact.id === id ? updated : contact)));
  }

  async function removeContact(id: number) {
    await api.deleteContact(id);
    setContacts((current) => current.filter((contact) => contact.id !== id));
    setSelectedContactIds((current) => current.filter((contactId) => contactId !== id));
  }

  async function saveRole(role: Role) {
    const updated = await api.updateRole(role.key, role.customPreference);
    setRoles((current) => current.map((item) => (item.key === updated.key ? updated : item)));
    setStatus(`${role.label} 角色偏好已保存`);
  }

  const selectedCount = selectedContactIds.length;
  const canGenerate = sourceText.trim() && selectedCount > 0 && busy !== 'generate';
  const selectedDraftCount = drafts.filter((draft) => draft.selected).length;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI team relay</p>
          <h1>Interchange</h1>
        </div>
        <div className="status-strip">
          <span className={health?.deepseekConfigured ? 'dot ok' : 'dot warn'} />
          <span>{health?.deepseekConfigured ? `DeepSeek ${health.model}` : 'DeepSeek key 未配置'}</span>
          <button className="icon-button" onClick={() => load().catch((err) => setError(err.message))} title="刷新">
            <RefreshCw size={17} />
          </button>
        </div>
      </header>

      {(error || status) && (
        <section className={`notice ${error ? 'error' : ''}`}>
          {error || status}
        </section>
      )}

      <section className="workspace">
        <section className="panel source-panel">
          <div className="panel-title">
            <FileText size={20} />
            <h2>客观信息</h2>
          </div>
          <textarea
            value={sourceText}
            onChange={(event) => {
              setSourceText(event.target.value);
              setInputRecordId(null);
            }}
            placeholder="粘贴项目变更、会议记录、缺陷说明、发布备注，或上传 Word / PDF / Excel / 截图..."
          />
          <div className="tool-row">
            <label className="file-button">
              <Upload size={17} />
              <span>上传文件</span>
              <input
                type="file"
                accept=".txt,.md,.markdown,.docx,.pdf,.xlsx,.xls,.xlsm,.csv,.png,.jpg,.jpeg,.webp,.bmp,.gif"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) parseTextOrFile(file);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            <button onClick={() => parseTextOrFile()} disabled={!sourceText.trim() || busy === 'parse'}>
              {busy === 'parse' ? <Loader2 className="spin" size={17} /> : <Check size={17} />}
              标准化文本
            </button>
          </div>
        </section>

        <section className="panel contact-panel">
          <div className="panel-title">
            <Users size={20} />
            <h2>收件人与角色</h2>
          </div>
          <div className="contact-list">
            {contacts.map((contact) => {
              const role = roleMap.get(contact.roleKey);
              const selected = selectedContactIds.includes(contact.id);
              return (
                <div className="contact-row" key={contact.id}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => {
                      setSelectedContactIds((current) =>
                        event.target.checked
                          ? [...current, contact.id]
                          : current.filter((id) => id !== contact.id),
                      );
                    }}
                  />
                  <input value={contact.name} onChange={(event) => updateContact(contact.id, { name: event.target.value })} />
                  <select value={contact.roleKey} onChange={(event) => updateContact(contact.id, { roleKey: event.target.value })}>
                    {roles.map((item) => (
                      <option key={item.key} value={item.key}>{item.label}</option>
                    ))}
                  </select>
                  <input
                    value={contact.webhookUrl}
                    placeholder="Webhook URL"
                    onChange={(event) => updateContact(contact.id, { webhookUrl: event.target.value })}
                  />
                  <button className="icon-button danger" onClick={() => removeContact(contact.id)} title="删除联系人">
                    <Trash2 size={16} />
                  </button>
                  <small>{role?.defaultPreference}</small>
                </div>
              );
            })}
          </div>

          <div className="new-contact">
            <input
              value={contactDraft.name}
              placeholder="新增收件人"
              onChange={(event) => setContactDraft({ ...contactDraft, name: event.target.value })}
            />
            <select
              value={contactDraft.roleKey}
              onChange={(event) => setContactDraft({ ...contactDraft, roleKey: event.target.value })}
            >
              {roles.map((role) => (
                <option key={role.key} value={role.key}>{role.label}</option>
              ))}
            </select>
            <input
              value={contactDraft.webhookUrl}
              placeholder="Webhook URL"
              onChange={(event) => setContactDraft({ ...contactDraft, webhookUrl: event.target.value })}
            />
            <button onClick={saveContact} disabled={busy === 'contact'}>
              <Plus size={17} />
              添加
            </button>
          </div>
        </section>

        <section className="panel role-panel">
          <div className="panel-title">
            <Settings2 size={20} />
            <h2>角色说话习惯</h2>
          </div>
          <div className="role-tabs">
            {roles.map((role) => (
              <button
                key={role.key}
                className={roleEditKey === role.key || (!roleEditKey && role.key === roles[0]?.key) ? 'active' : ''}
                onClick={() => setRoleEditKey(role.key)}
              >
                {role.label}
              </button>
            ))}
          </div>
          {roles
            .filter((role) => role.key === (roleEditKey || roles[0]?.key))
            .map((role) => (
              <div className="role-editor" key={role.key}>
                <p>{role.defaultPreference}</p>
                <textarea
                  value={role.customPreference}
                  placeholder="补充你自己的表达偏好，例如：更口语、先说结论、必须列风险..."
                  onChange={(event) =>
                    setRoles((current) =>
                      current.map((item) =>
                        item.key === role.key ? { ...item, customPreference: event.target.value } : item,
                      ),
                    )
                  }
                />
                <button onClick={() => saveRole(role)}>
                  <Save size={17} />
                  保存偏好
                </button>
              </div>
            ))}
        </section>

        <section className="panel action-panel">
          <div className="panel-title">
            <Sparkles size={20} />
            <h2>转换与发送</h2>
          </div>
          <div className="metrics">
            <strong>{sourceText.trim().length}</strong>
            <span>字符</span>
            <strong>{selectedCount}</strong>
            <span>收件人</span>
            <strong>{drafts.length}</strong>
            <span>草稿</span>
          </div>
          <button className="primary" disabled={!canGenerate} onClick={generate}>
            {busy === 'generate' ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
            面向角色生成
          </button>
          <button disabled={!selectedDraftCount || busy === 'send'} onClick={sendSelected}>
            {busy === 'send' ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
            确认发送 {selectedDraftCount || ''}
          </button>
        </section>
      </section>

      <section className="draft-board">
        <div className="board-heading">
          <Bell size={20} />
          <h2>待确认消息</h2>
        </div>
        {drafts.length === 0 ? (
          <div className="empty-state">生成后，每个收件人的消息会在这里独立编辑和确认。</div>
        ) : (
          <div className="draft-grid">
            {drafts.map((draft) => (
              <article className="draft-item" key={draft.generationRecordId}>
                <div className="draft-head">
                  <label>
                    <input
                      type="checkbox"
                      checked={draft.selected}
                      onChange={(event) =>
                        setDrafts((current) =>
                          current.map((item) =>
                            item.generationRecordId === draft.generationRecordId
                              ? { ...item, selected: event.target.checked }
                              : item,
                          ),
                        )
                      }
                    />
                    <span>{draft.contact.name}</span>
                  </label>
                  <small>{draft.role.label}</small>
                </div>
                <textarea
                  value={draft.editedContent}
                  onChange={(event) =>
                    setDrafts((current) =>
                      current.map((item) =>
                        item.generationRecordId === draft.generationRecordId
                          ? { ...item, editedContent: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                {draft.sendStatus && <p className={draft.sendStatus.startsWith('已') ? 'sent ok-text' : 'sent'}>{draft.sendStatus}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

