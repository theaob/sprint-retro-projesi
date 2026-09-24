import { useEffect, useState } from 'preact/hooks';
import { html } from '../ui/html.js';
import { Dialog } from '../ui/Dialog.js';
import { Button, Chip, Field, Stepper, Switch } from '../ui/controls.js';
import { ColumnListEditor } from '../ui/ColumnListEditor.js';
import { navigate } from '../ui/router.js';
import { api } from '../api.js';
import { showToast } from '../utils.js';

const DEFAULT_COLUMNS = ['İyi Giden', 'Geliştirilmeli', 'Aksiyon'];

/** New retro: title, template or custom lanes, vote limit, and staged or simple mode. */
export function CreateRetroDialog({ open, onClose }) {
  const [title, setTitle] = useState('');
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState(null);
  const [maxVotes, setMaxVotes] = useState(3);
  // Stages are opt-in: a team shouldn't get a new way of working unasked
  const [staged, setStaged] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.listTemplates()
      .then(list => {
        setTemplates(list);
        if (list[0] && !templateId) { setTemplateId(list[0].id); setColumns(list[0].columns); }
      })
      .catch(err => showToast(`Şablonlar yüklenemedi: ${err.message}`, 'error'));
  }, [open]);

  const pickTemplate = (t) => {
    setTemplateId(t.id);
    setColumns(t.columns);
  };

  const submit = async (e) => {
    e?.preventDefault();
    const cleanTitle = title.trim();
    const cleanColumns = columns.map(c => c.trim()).filter(Boolean);
    if (!cleanTitle) { setError('Retroya bir başlık ver.'); return; }
    if (cleanColumns.length === 0) { setError('En az bir sütun gerekli.'); return; }
    setBusy(true);
    try {
      const created = await api.createRetro(cleanTitle, cleanColumns, maxVotes, staged);
      showToast('Retro oluşturuldu.', 'success');
      navigate(`#/retro/${created.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return html`
    <${Dialog} open=${open} onClose=${onClose} title="Yeni retro" size="lg"
      footer=${html`
        <${Button} variant="ghost" onClick=${onClose}>Vazgeç<//>
        <${Button} variant="primary" icon="sparkle" loading=${busy} onClick=${submit} id="create-retro-btn">Retroyu oluştur<//>
      `}>
      <form class="form" onSubmit=${submit} id="create-retro-form">
        <${Field} id="retro-title" label="Başlık" placeholder="ör. Sprint 43 · Ödeme Ekibi" maxlength="200"
          value=${title} data-autofocus onInput=${(e) => { setTitle(e.currentTarget.value); setError(''); }} />

        ${templates.length > 0 ? html`
          <div class="field">
            <span class="field__label">Şablon</span>
            <div class="chip-row">
              ${templates.map(t => html`<${Chip} key=${t.id} selected=${templateId === t.id} onClick=${() => pickTemplate(t)}>${t.name}<//>`)}
            </div>
          </div>
        ` : null}

        <${ColumnListEditor} idPrefix="retro-col" columns=${columns}
          onChange=${(next) => { setColumns(next); setTemplateId(null); }} />

        <${Stepper} id="retro-max-votes" label="Kişi başı oy hakkı" value=${maxVotes} min=${1} max=${20} onChange=${setMaxVotes} unit="oy" />

        <div class="card card--flat">
          <${Switch} id="retro-staged" checked=${staged} onChange=${setStaged}
            label="Aşamalı retro"
            description="Yaz → Oyla → Tartış adımlarını sen yönetirsin. Notlar oylamaya kadar sadece yazanına görünür." />
        </div>

        <p class="form-error" role="alert">${error}</p>
      </form>
    <//>
  `;
}
