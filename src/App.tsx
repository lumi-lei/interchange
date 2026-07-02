import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import {
  Bell,
  Check,
  Copy,
  Download,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings2,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { api, type Contact, type Draft, type Role } from './api';

type DraftState = Draft & { selected: boolean; editedContent: string; sendStatus?: string };
type ContactStatusFilter = 'active' | 'inactive' | 'all';

type AceternityCardProps = {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'article';
};

const blankContact = (roleKey = 'product'): Omit<Contact, 'id'> => ({
  name: '',
  roleKey,
  webhookUrl: '',
  preference: '',
  active: true,
});

function AceternityCard({ children, className = '', as = 'section' }: AceternityCardProps) {
  const Component = as;

  function updateSpotlight(event: MouseEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--spotlight-x', `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty('--spotlight-y', `${event.clientY - bounds.top}px`);
  }

  return (
    <Component className={`aceternity-card ${className}`} onMouseMove={updateSpotlight}>
      <span className="card-spotlight" aria-hidden="true" />
      <div className="card-content">{children}</div>
    </Component>
  );
}

export function App() {
  const [health, setHealth] = useState<{ deepseekConfigured: boolean; model: string } | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [sourceText, setSourceText] = useState('');
  const [markdownDownload, setMarkdownDownload] = useState<{ filename: string; text: string } | null>(null);
  const [inputRecordId, setInputRecordId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<DraftState[]>([]);
  const [copiedDraftId, setCopiedDraftId] = useState<number | null>(null);
  const [contactDraft, setContactDraft] = useState<Omit<Contact, 'id'>>(blankContact());
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [roleEditKey, setRoleEditKey] = useState('');
  const [dirtyRoleKeys, setDirtyRoleKeys] = useState<Set<string>>(new Set());
  const [contactSearch, setContactSearch] = useState('');
  const [contactRoleFilter, setContactRoleFilter] = useState('all');
  const [contactStatusFilter, setContactStatusFilter] = useState<ContactStatusFilter>('active');

  const roleMap = useMemo(() => new Map(roles.map((role) => [role.key, role])), [roles]);
  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLocaleLowerCase();
    return contacts.filter((contact) => {
      const matchesStatus =
        contactStatusFilter === 'all'
          || (contactStatusFilter === 'active' ? contact.active : !contact.active);
      const matchesRole = contactRoleFilter === 'all' || contact.roleKey === contactRoleFilter;
      const matchesSearch =
        !query
        || contact.name.toLocaleLowerCase().includes(query)
        || contact.webhookUrl.toLocaleLowerCase().includes(query);
      return matchesStatus && matchesRole && matchesSearch;
    });
  }, [contactRoleFilter, contactSearch, contactStatusFilter, contacts]);

  async function load() {
    setError('');
    const [healthData, roleData, contactData] = await Promise.all([api.health(), api.roles(), api.contacts()]);
    setHealth(healthData);
    setRoles(roleData);
    setContacts(contactData);
    setSelectedContactIds((current) => current.length ? current : contactData.filter((c) => c.active).map((c) => c.id));
    setContactDraft(blankContact(roleData[0]?.key ?? 'product'));
    setDirtyRoleKeys(new Set());
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
      setMarkdownDownload(parsed.markdownFilename ? { filename: parsed.markdownFilename, text: parsed.text } : null);
      setInputRecordId(parsed.inputRecordId);
      setStatus(`已解析 ${parsed.filename || '手动输入'}，来源类型：${parsed.sourceType}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('');
    }
  }

  function downloadConvertedMarkdown() {
    if (!markdownDownload) return;

    const blob = new Blob([markdownDownload.text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = markdownDownload.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function writeClipboard(text: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    textArea.remove();
  }

  async function copyDraftContent(draft: DraftState) {
    if (!draft.editedContent.trim()) {
      setError('待确认消息内容为空，无法复制');
      return;
    }

    try {
      await writeClipboard(draft.editedContent);
      setError('');
      setCopiedDraftId(draft.generationRecordId);
      setStatus(`${draft.contact.name} 的待确认消息已复制`);
      window.setTimeout(() => {
        setCopiedDraftId((current) => (current === draft.generationRecordId ? null : current));
      }, 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : '复制失败，请手动选择内容复制');
    }
  }

  async function generate() {
    setBusy('generate');
    setError('');
    setDrafts([]);
    try {
      await saveDirtyRolesBeforeGenerate();
      const activeIds = selectedContactIds.filter((id) => contacts.some((contact) => contact.id === id && contact.active));
      const result = await api.generate(sourceText, inputRecordId, activeIds);
      setDrafts(result.drafts.map((draft) => ({ ...draft, selected: true, editedContent: draft.content })));
      setStatus(`已生成 ${result.drafts.length} 条角色化草稿`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('');
    }
  }

  async function saveDirtyRolesBeforeGenerate() {
    const dirtyRoles = roles.filter((role) => dirtyRoleKeys.has(role.key));
    if (!dirtyRoles.length) return;

    setStatus(`正在保存 ${dirtyRoles.length} 个角色说话习惯...`);
    const updatedRoles = await Promise.all(
      dirtyRoles.map((role) => api.updateRole(role.key, role.customPreference)),
    );
    const updatedMap = new Map(updatedRoles.map((role) => [role.key, role]));
    setRoles((current) => current.map((role) => updatedMap.get(role.key) ?? role));
    setDirtyRoleKeys((current) => {
      const next = new Set(current);
      for (const role of updatedRoles) next.delete(role.key);
      return next;
    });
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
    if (patch.active === false) {
      setSelectedContactIds((current) => current.filter((contactId) => contactId !== id));
    }
  }

  async function removeContact(id: number) {
    const contact = contacts.find((item) => item.id === id);
    if (contact?.active) {
      setError('请先停用收件人，再执行删除');
      return;
    }
    if (!window.confirm(`确定永久删除「${contact?.name || '未命名联系人'}」吗？`)) return;
    await api.deleteContact(id);
    setContacts((current) => current.filter((contact) => contact.id !== id));
    setSelectedContactIds((current) => current.filter((contactId) => contactId !== id));
    setStatus('联系人已删除');
  }

  async function updateFilteredContacts(active: boolean) {
    if (!filteredContacts.length) return;
    setBusy('contacts-batch');
    setError('');
    try {
      const updatedContacts = await Promise.all(
        filteredContacts.map((contact) => api.updateContact(contact.id, { active })),
      );
      const updatedMap = new Map(updatedContacts.map((contact) => [contact.id, contact]));
      setContacts((current) => current.map((contact) => updatedMap.get(contact.id) ?? contact));
      if (!active) {
        const updatedIds = new Set(updatedContacts.map((contact) => contact.id));
        setSelectedContactIds((current) => current.filter((id) => !updatedIds.has(id)));
      }
      setStatus(`已${active ? '启用' : '停用'} ${updatedContacts.length} 位当前筛选收件人`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('');
    }
  }

  async function deleteFilteredContacts() {
    if (!filteredContacts.length || filteredContacts.some((contact) => contact.active)) return;
    if (!window.confirm(`确定永久删除当前筛选出的 ${filteredContacts.length} 位停用收件人吗？`)) return;
    setBusy('contacts-batch');
    setError('');
    try {
      await Promise.all(filteredContacts.map((contact) => api.deleteContact(contact.id)));
      const deletedIds = new Set(filteredContacts.map((contact) => contact.id));
      setContacts((current) => current.filter((contact) => !deletedIds.has(contact.id)));
      setSelectedContactIds((current) => current.filter((id) => !deletedIds.has(id)));
      setStatus(`已删除 ${deletedIds.size} 位停用收件人`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('');
    }
  }

  async function saveRole(role: Role) {
    const updated = await api.updateRole(role.key, role.customPreference);
    setRoles((current) => current.map((item) => (item.key === updated.key ? updated : item)));
    setDirtyRoleKeys((current) => {
      const next = new Set(current);
      next.delete(updated.key);
      return next;
    });
    setStatus(`${role.label} 角色偏好已保存`);
  }

  const selectedCount = selectedContactIds.filter((id) => contacts.some((contact) => contact.id === id && contact.active)).length;
  const canGenerate = sourceText.trim() && selectedCount > 0 && busy !== 'generate';
  const selectedDraftCount = drafts.filter((draft) => draft.selected).length;
  const activeContactCount = contacts.filter((contact) => contact.active).length;
  const inactiveContactCount = contacts.length - activeContactCount;
  const currentRoleKey = roleEditKey || roles[0]?.key;
  const canDeleteFilteredContacts = filteredContacts.length > 0 && filteredContacts.every((contact) => !contact.active);
  const dirtyRoleCount = dirtyRoleKeys.size;

  return (
    <main className="shell">
      <div className="aceternity-beams" aria-hidden="true" />
      <header className="topbar">
        <div className="brand-block">
          <p className="eyebrow">AI team relay</p>
          <h1>Interchange</h1>
          <p className="hero-copy">把同一份事实，转换成每个岗位都愿意读、读得懂、能行动的团队消息。</p>
        </div>
        <div className="status-strip">
          <span className={health?.deepseekConfigured ? 'dot ok' : 'dot warn'} />
          <span>{health?.deepseekConfigured ? `DeepSeek ${health.model}` : 'DeepSeek key 未配置'}</span>
          <button className="icon-button" onClick={() => load().catch((err) => setError(err.message))} title="刷新">
            <RefreshCw size={17} />
          </button>
        </div>
      </header>

      <section className="overview-grid" aria-label="工作台概览">
        <div className="overview-card">
          <span>输入内容</span>
          <strong>{sourceText.trim().length}</strong>
          <small>字符已准备</small>
        </div>
        <div className="overview-card">
          <span>当前收件人</span>
          <strong>{selectedCount}</strong>
          <small>{activeContactCount} 位启用</small>
        </div>
        <div className="overview-card">
          <span>待确认草稿</span>
          <strong>{drafts.length}</strong>
          <small>{selectedDraftCount} 条已勾选</small>
        </div>
      </section>

      {(error || status) && (
        <section className={`notice ${error ? 'error' : ''}`}>
          {error || status}
        </section>
      )}

      <section className="workspace">
        <AceternityCard className="panel source-panel">
          <div className="panel-title">
            <FileText size={20} />
            <div>
              <h2>客观信息</h2>
              <p>先放事实，再交给 AI 转译</p>
            </div>
          </div>
          <textarea
            aria-label="客观信息输入"
            value={sourceText}
            onChange={(event) => {
              setSourceText(event.target.value);
              setMarkdownDownload(null);
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
                accept=".txt,.md,.markdown,.json,.log,.docx,.pdf,.xlsx,.xls,.xlsm,.csv,.html,.htm,.pptx,.png,.jpg,.jpeg,.webp,.bmp,.gif"
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
            {markdownDownload && (
              <button onClick={downloadConvertedMarkdown} title="下载已转换的 Markdown 文件">
                <Download size={17} />
                <span>下载 Markdown</span>
              </button>
            )}
          </div>
        </AceternityCard>

        <AceternityCard className="panel contact-panel">
          <div className="panel-title">
            <Users size={20} />
            <div>
              <h2>收件人与角色</h2>
              <p>每个人收到适合自己岗位的版本</p>
            </div>
          </div>
          <div className="contact-toolbar">
            <label className="search-field">
              <Search size={16} />
              <input
                aria-label="搜索收件人姓名或 Webhook"
                value={contactSearch}
                placeholder="搜索姓名 / Webhook"
                onChange={(event) => setContactSearch(event.target.value)}
              />
            </label>
            <select
              aria-label="按角色筛选收件人"
              value={contactRoleFilter}
              onChange={(event) => setContactRoleFilter(event.target.value)}
            >
              <option value="all">全部角色</option>
              {roles.map((role) => (
                <option key={role.key} value={role.key}>{role.label}</option>
              ))}
            </select>
            <div className="segmented-control" aria-label="按启用状态筛选收件人">
              <button
                className={contactStatusFilter === 'active' ? 'active' : ''}
                onClick={() => setContactStatusFilter('active')}
              >
                启用
              </button>
              <button
                className={contactStatusFilter === 'inactive' ? 'active' : ''}
                onClick={() => setContactStatusFilter('inactive')}
              >
                停用
              </button>
              <button
                className={contactStatusFilter === 'all' ? 'active' : ''}
                onClick={() => setContactStatusFilter('all')}
              >
                全部
              </button>
            </div>
          </div>
          <div className="contact-summary">
            <span>当前 {filteredContacts.length} 位</span>
            <span>{activeContactCount} 启用</span>
            <span>{inactiveContactCount} 停用</span>
          </div>
          <div className="bulk-actions">
            <button onClick={() => updateFilteredContacts(true)} disabled={!filteredContacts.length || busy === 'contacts-batch'}>
              <ToggleRight size={17} />
              启用当前筛选
            </button>
            <button onClick={() => updateFilteredContacts(false)} disabled={!filteredContacts.length || busy === 'contacts-batch'}>
              <ToggleLeft size={17} />
              停用当前筛选
            </button>
            <button
              className="danger-action"
              onClick={deleteFilteredContacts}
              disabled={!canDeleteFilteredContacts || busy === 'contacts-batch'}
            >
              <Trash2 size={17} />
              删除停用项
            </button>
          </div>
          <div className="contact-list">
            {filteredContacts.length === 0 ? (
              <div className="empty-state compact">当前筛选下没有收件人。</div>
            ) : filteredContacts.map((contact) => {
              const role = roleMap.get(contact.roleKey);
              const selected = selectedContactIds.includes(contact.id);
              return (
                <div className={`contact-row ${contact.active ? '' : 'inactive'}`} key={contact.id}>
                  <input
                    aria-label={`选择 ${contact.name || '未命名联系人'}`}
                    type="checkbox"
                    checked={selected}
                    disabled={!contact.active}
                    onChange={(event) => {
                      setSelectedContactIds((current) =>
                        event.target.checked
                          ? [...current, contact.id]
                          : current.filter((id) => id !== contact.id),
                      );
                    }}
                  />
                  <input aria-label="联系人姓名" value={contact.name} onChange={(event) => updateContact(contact.id, { name: event.target.value })} />
                  <select aria-label="联系人角色" value={contact.roleKey} onChange={(event) => updateContact(contact.id, { roleKey: event.target.value })}>
                    {roles.map((item) => (
                      <option key={item.key} value={item.key}>{item.label}</option>
                    ))}
                  </select>
                  <input
                    aria-label="Webhook URL"
                    value={contact.webhookUrl}
                    placeholder="Webhook URL"
                    onChange={(event) => updateContact(contact.id, { webhookUrl: event.target.value })}
                  />
                  <button
                    className={`icon-button ${contact.active ? 'enabled' : ''}`}
                    onClick={() => updateContact(contact.id, { active: !contact.active })}
                    title={contact.active ? '停用收件人' : '启用收件人'}
                  >
                    {contact.active ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}
                  </button>
                  {!contact.active && (
                    <button className="icon-button danger" onClick={() => removeContact(contact.id)} title="删除联系人">
                      <Trash2 size={16} />
                    </button>
                  )}
                  <small>{role?.defaultPreference}</small>
                </div>
              );
            })}
          </div>

          <div className="new-contact">
            <input
              aria-label="新增收件人姓名"
              value={contactDraft.name}
              placeholder="新增收件人"
              onChange={(event) => setContactDraft({ ...contactDraft, name: event.target.value })}
            />
            <select
              aria-label="新增收件人角色"
              value={contactDraft.roleKey}
              onChange={(event) => setContactDraft({ ...contactDraft, roleKey: event.target.value })}
            >
              {roles.map((role) => (
                <option key={role.key} value={role.key}>{role.label}</option>
              ))}
            </select>
            <input
              aria-label="新增收件人 Webhook URL"
              value={contactDraft.webhookUrl}
              placeholder="Webhook URL"
              onChange={(event) => setContactDraft({ ...contactDraft, webhookUrl: event.target.value })}
            />
            <button onClick={saveContact} disabled={busy === 'contact'}>
              <Plus size={17} />
              添加
            </button>
          </div>
        </AceternityCard>

        <AceternityCard className="panel role-panel">
          <div className="panel-title">
            <Settings2 size={20} />
            <div>
              <h2>角色说话习惯</h2>
              <p>保留岗位差异，也保留人的语气</p>
            </div>
          </div>
          <div className="role-tabs">
            {roles.map((role) => (
              <button
                key={role.key}
                className={currentRoleKey === role.key ? 'active' : ''}
                onClick={() => setRoleEditKey(role.key)}
              >
                {role.label}
              </button>
            ))}
          </div>
          {roles
            .filter((role) => role.key === currentRoleKey)
            .map((role) => (
              <div className="role-editor" key={role.key}>
                <p>{role.defaultPreference}</p>
                {role.templatePreference && (
                  <div className="role-template">
                    <strong>推荐提示词模板</strong>
                    <pre>{role.templatePreference}</pre>
                  </div>
                )}
                <textarea
                  aria-label={`${role.label} 角色说话习惯`}
                  value={role.customPreference}
                  placeholder="补充你自己的表达偏好，例如：更口语、先说结论、必须列风险..."
                  onChange={(event) => {
                    const customPreference = event.target.value;
                    setRoles((current) =>
                      current.map((item) =>
                        item.key === role.key ? { ...item, customPreference } : item,
                      ),
                    );
                    setDirtyRoleKeys((current) => {
                      const next = new Set(current);
                      next.add(role.key);
                      return next;
                    });
                  }}
                />
                {dirtyRoleKeys.has(role.key) && <small>有未保存修改，生成前会自动保存。</small>}
                <button onClick={() => saveRole(role)}>
                  <Save size={17} />
                  保存偏好
                </button>
              </div>
            ))}
        </AceternityCard>

        <AceternityCard className="panel action-panel">
          <div className="panel-title">
            <Sparkles size={20} />
            <div>
              <h2>转换与发送</h2>
              <p>先生成、再人工确认、最后发送</p>
            </div>
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
            {dirtyRoleCount ? `保存偏好并生成 ${dirtyRoleCount}` : '面向角色生成'}
          </button>
          <button disabled={!selectedDraftCount || busy === 'send'} onClick={sendSelected}>
            {busy === 'send' ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
            确认发送 {selectedDraftCount || ''}
          </button>
        </AceternityCard>
      </section>

      <AceternityCard className="draft-board">
        <div className="board-heading">
          <Bell size={20} />
          <div>
            <h2>待确认消息</h2>
            <p>这里是最后一道温和但必要的人工把关</p>
          </div>
        </div>
        {drafts.length === 0 ? (
          <div className="empty-state">生成后，每个收件人的消息会在这里独立编辑和确认。</div>
        ) : (
          <div className="draft-grid">
            {drafts.map((draft) => (
              <AceternityCard className="draft-item" as="article" key={draft.generationRecordId}>
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
                  <div className="draft-meta">
                    <small>{draft.role.label}</small>
                    <button
                      className="copy-button"
                      onClick={() => copyDraftContent(draft)}
                      title="复制这条待确认消息的全部内容"
                      aria-label={`复制 ${draft.contact.name} 的待确认消息全部内容`}
                    >
                      {copiedDraftId === draft.generationRecordId ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copiedDraftId === draft.generationRecordId ? '已复制' : '复制'}</span>
                    </button>
                  </div>
                </div>
                <textarea
                  aria-label={`${draft.contact.name} 的待发送消息`}
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
              </AceternityCard>
            ))}
          </div>
        )}
      </AceternityCard>
    </main>
  );
}
