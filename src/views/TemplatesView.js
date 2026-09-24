import { useEffect, useState } from 'preact/hooks';
import { html } from '../ui/html.js';
import { AppShell, PageHeader } from '../ui/AppShell.js';
import { Button, IconButton, Field, Spinner, EmptyState } from '../ui/controls.js';
import { Dialog, confirmDialog } from '../ui/Dialog.js';
import { ColumnListEditor } from '../ui/ColumnListEditor.js';
import { api } from '../api.js';
import { showToast } from '../utils.js';

/** Create or edit a template (admin). `template` null means create. */
function TemplateDialog({ template, onClose, onSaved }) {
  const [name, setName] = useState(template?.name || '');
  const [columns, setColumns] = useState(template?.columns || ['']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e?.preventDefault();
    const cleanName = name.trim();
    const cleanColumns = columns.map(c => c.trim()).filter(Boolean);
    if (!cleanName) { setError('Şablona bir ad ver.'); return; }
    if (cleanColumns.length === 0) { setError('En az bir sütun gerekli.'); return; }
    setBusy(true);
    try {
      const saved = template
        ? await api.updateTemplate(template.id, cleanName, cleanColumns)
        : await api.createTemplate(cleanName, cleanColumns);
      onSaved(saved, !template);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return html`
    <${Dialog} open onClose=${onClose} title=${template ? 'Şablonu düzenle' : 'Yeni şablon'}
      footer=${html`
        <${Button} variant="ghost" onClick=${onClose}>Vazgeç<//>
        <${Button} variant="primary" loading=${busy} onClick=${save}>${template ? 'Kaydet' : 'Şablonu ekle'}<//>
      `}>
      <form class="form" onSubmit=${save}>
        <${Field} id="template-name-input" label="Şablon adı" maxlength="100" value=${name} data-autofocus
          placeholder="ör. Start / Stop / Continue" onInput=${(e) => { setName(e.currentTarget.value); setError(''); }} />
        <${ColumnListEditor} idPrefix="template-col" columns=${columns} onChange=${setColumns} />
        <p class="form-error" role="alert">${error}</p>
      </form>
    <//>
  `;
}

export function TemplatesView() {
  const [templates, setTemplates] = useState(null);
  const [editing, setEditing] = useState(undefined); // undefined: closed, null: new, object: edit

  useEffect(() => {
    api.listTemplates().then(setTemplates).catch(err => { showToast(err.message, 'error'); setTemplates([]); });
  }, []);

  const saved = (template, isNew) => {
    setTemplates(list => (isNew ? [...list, template] : list.map(t => (t.id === template.id ? template : t))));
    setEditing(undefined);
    showToast(isNew ? 'Şablon eklendi.' : 'Şablon kaydedildi.', 'success');
  };

  const remove = async (t) => {
    const ok = await confirmDialog({ title: `"${t.name}" silinsin mi?`, body: 'Bu şablonla oluşturulmuş retrolar etkilenmez.', confirmLabel: 'Şablonu sil', danger: true });
    if (!ok) return;
    try {
      await api.deleteTemplate(t.id);
      setTemplates(list => list.filter(x => x.id !== t.id));
      showToast('Şablon silindi.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return html`
    <${AppShell} active="templates">
      <${PageHeader} title="Şablonlar" subtitle="Yeni retro oluştururken herkesin seçebildiği hazır sütun setleri."
        actions=${html`<${Button} variant="primary" icon="plus" onClick=${() => setEditing(null)}>Yeni şablon<//>`} />
      ${templates === null ? html`<${Spinner} />` : templates.length === 0 ? html`
        <${EmptyState} icon="columns" title="Şablon yok">İlk şablonu ekleyerek başla.<//>
      ` : html`
        <ul class="template-list">
          ${templates.map(t => html`
            <li class="template-card" key=${t.id}>
              <div class="template-card__body">
                <h2 class="template-card__name">${t.name}</h2>
                <ul class="template-card__cols">
                  ${t.columns.map((c, i) => html`<li class=${`lane-${i % 4}`}><i class="lane-dot"></i>${c}</li>`)}
                </ul>
              </div>
              <div class="template-card__actions">
                <${IconButton} icon="pencil" label=${`${t.name} şablonunu düzenle`} onClick=${() => setEditing(t)} />
                <${IconButton} icon="trash" label=${`${t.name} şablonunu sil`} onClick=${() => remove(t)} />
              </div>
            </li>
          `)}
        </ul>
      `}
      ${editing !== undefined ? html`<${TemplateDialog} template=${editing} onClose=${() => setEditing(undefined)} onSaved=${saved} />` : null}
    <//>
  `;
}
