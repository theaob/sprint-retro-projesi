import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import { showToast } from '../../utils.js';

const html = htm.bind(h);

function AddActionForm({ entryId, onAdd }) {
  const [content, setContent] = useState('');
  const [assignee, setAssignee] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await onAdd(entryId, content.trim(), assignee.trim());
      setContent('');
      setAssignee('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return html`
    <form class="add-action-form" onSubmit=${handleSubmit}>
      <input type="text" class="input add-action-input" placeholder="Aksiyon planı..." required
        value=${content} onInput=${(e) => setContent(e.currentTarget.value)} />
      <input type="text" class="input add-assignee-input" placeholder="Kişi (opsiyonel)"
        value=${assignee} onInput=${(e) => setAssignee(e.currentTarget.value)} />
      <button type="submit" class="btn btn-primary btn-sm" disabled=${submitting}>Ekle</button>
    </form>
  `;
}

export function ActionPlan({ columns, actionItems, isAdminOrOwner, onAdd, onDelete }) {
  const [filter, setFilter] = useState('all');

  let entries = columns.flatMap(c => c.entries).filter(e => e.votes > 0);
  entries.sort((a, b) => b.votes - a.votes);
  if (filter === 'top3') entries = entries.slice(0, 3);
  else if (filter === 'top5') entries = entries.slice(0, 5);

  const handleDelete = async (actionId) => {
    try {
      await onDelete(actionId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return html`
    <div class="action-plan-section">
      <div class="action-plan-header">
        <h2>🎯 Aksiyon Planı</h2>
        <select class="input" style="width: auto; padding: 4px 10px; min-height: 32px;"
          value=${filter} onChange=${(e) => setFilter(e.currentTarget.value)}>
          <option value="all">Tümü (>0 oy)</option>
          <option value="top3">Top 3</option>
          <option value="top5">Top 5</option>
        </select>
      </div>
      <div class="action-plan-list">
        ${entries.length === 0
          ? html`<p class="text-muted" style="text-align:center;padding:16px;">Oylanan madde bulunamadı.</p>`
          : entries.map(entry => {
              const actions = (actionItems || []).filter(a => a.entry_id === entry.id);
              return html`
                <div class="action-plan-item glass-card" key=${entry.id}>
                  <div class="action-plan-entry-text">
                    <span class="vote-badge badge-vote-limit" style="margin-right:8px;">👍 ${entry.votes}</span>
                    ${entry.text}
                  </div>
                  <div class="action-list">
                    ${actions.map(a => html`
                      <div class="action-item" key=${a.id}>
                        <span class="action-content">🎯 ${a.content}</span>
                        ${a.assignee ? html`<span class="action-assignee">@${a.assignee}</span>` : null}
                        ${isAdminOrOwner ? html`<button type="button" class="btn btn-ghost btn-icon-sm" onClick=${() => handleDelete(a.id)}>✕</button>` : null}
                      </div>
                    `)}
                  </div>
                  ${isAdminOrOwner ? html`<${AddActionForm} entryId=${entry.id} onAdd=${onAdd} />` : null}
                </div>
              `;
            })}
      </div>
    </div>
  `;
}
