import { useEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks';
import { html } from '../../ui/html.js';
import { Icon, BrandMark } from '../../ui/Icon.js';
import { IconButton, Chip } from '../../ui/controls.js';
import { Dialog, confirmDialog } from '../../ui/Dialog.js';
import { StageStrip, stageKey, stageLabel } from '../../ui/StageStrip.js';
import { ThemeToggle } from '../../ui/AppShell.js';
import { useCountdown, useMediaQuery, formatClock } from '../../ui/hooks.js';
import { api } from '../../api.js';
import { createRetroSocket } from '../../ws.js';
import { exportRetroToExcel } from '../../export.js';
import { showToast, spawnVoteCelebration, announce, getDisplayName } from '../../utils.js';
import { retroReducer, initialRetroState } from './reducer.js';
import { playRetroEndAnimation } from './retroEndAnimations.js';
import { Note } from './Note.js';
import { Composer } from './Composer.js';
import { NoteActions } from './NoteActions.js';
import { FacilitatorSheet } from './FacilitatorSheet.js';
import { ColumnsDialog } from './ColumnsDialog.js';
import { SetupView, DiscussView, SummaryView } from './StageViews.js';

const TYPING_EXPIRY_MS = 3000;

const STAGE_HINTS = {
  writing: 'Only you can see your notes until voting starts.',
  voting: 'Vote counts are revealed when discussion starts.',
  discussing: 'Notes are discussed in order of votes.'
};

export function Board({ initialRetro, user }) {
  const [retro, dispatch] = useReducer(retroReducer, initialRetro, initialRetroState);
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState([]);
  const [typing, setTyping] = useState({});
  const [activeLane, setActiveLane] = useState(initialRetro.columns[0]?.id);
  const [actionEntry, setActionEntry] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [view, setView] = useState('stage'); // 'stage' (discussion/summary) or 'board'
  const [busy, setBusy] = useState(false);
  const [dragOverLane, setDragOverLane] = useState(null);

  const socketRef = useRef(null);
  const typingTimers = useRef({});
  const lanesRef = useRef(null);
  // Whether this finish's ending has already played here — the facilitator
  // gets both its own API response and the WebSocket echo
  const endingPlayed = useRef(initialRetro.status === 'finished');
  const wide = useMediaQuery('(min-width: 768px)');

  const staged = !!retro.phase;
  const finished = retro.status === 'finished';
  const stage = staged ? stageKey(retro) : null;
  const canFacilitate = user?.role === 'admin' || !!retro.is_owner;
  const canWrite = !finished && (!staged || retro.phase === 'writing');
  const canVote = !finished && (!staged || retro.phase === 'voting');
  const countsHidden = !finished && retro.phase === 'voting';
  const notesHidden = !finished && (retro.phase === 'setup' || retro.phase === 'writing');
  const canManage = canFacilitate && !finished;
  const hasEntries = retro.columns.some(c => c.entries.length > 0);
  const votesLeft = Math.max(0, (retro.max_votes ?? 3) - retro.votedEntryIds.length);
  const sortByVotes = !countsHidden && !notesHidden;
  const timeLeft = useCountdown(finished ? null : retro.timer_ends_at, retro.clockOffset);

  // Keep the active lane valid as lanes come and go
  useEffect(() => {
    if (!retro.columns.some(c => c.id === activeLane)) setActiveLane(retro.columns[0]?.id);
  }, [retro.columns]);

  // A new stage starts on its own screen again
  useEffect(() => { setView('stage'); }, [retro.phase, retro.status]);

  const refetch = async () => {
    try {
      dispatch({ type: 'refresh', retro: await api.getRetro(retro.id) });
    } catch {
      // stale data is better than no data
    }
  };

  // Plays the retro-end animation once per finish, then loads the summary
  const playEnding = () => {
    if (endingPlayed.current) return;
    endingPlayed.current = true;
    announce('Retro finished.');
    playRetroEndAnimation(refetch);
  };

  // WebSocket — bound once on mount; handlers only dispatch, so they never
  // read stale state.
  useEffect(() => {
    const socket = createRetroSocket(retro.id, user?.username || getDisplayName() || null, {
      onEntryAdded(entry) { dispatch({ type: 'entry:added', entry }); },
      onEntryVoted(entry) { dispatch({ type: 'entry:voted', entry }); },
      onEntryEdited(entry) { dispatch({ type: 'entry:edited', entry }); },
      onEntryMoved(entry) { dispatch({ type: 'entry:moved', entry }); },
      onEntryDeleted(entryId) { dispatch({ type: 'entry:deleted', entryId }); },
      onColumnRenamed({ columnId, name }) { dispatch({ type: 'column:renamed', columnId, name }); },
      onColumnAdded(column) { dispatch({ type: 'column:added', column }); },
      onColumnDeleted(columnId) { dispatch({ type: 'column:deleted', columnId }); },
      onStatusChanged(status) {
        if (status === 'finished') {
          playEnding();
        } else {
          endingPlayed.current = false;
          dispatch({ type: 'status', status });
          refetch();
        }
      },
      onPhase({ phase, focusEntryId }) {
        dispatch({ type: 'phase', phase, focusEntryId });
        announce(`${stageLabel(phase)} stage started.`);
        // What each person may see changes with the stage
        refetch();
      },
      onFocus(entryId) { dispatch({ type: 'focus', entryId }); },
      onTimer({ endsAt, serverNow }) { dispatch({ type: 'timer', endsAt, serverNow }); },
      onVoteProgress(voters) { dispatch({ type: 'voters', voters }); },
      onPresenceUpdate(users) { setPresence(users); },
      onConnectionChange(isConnected) { setConnected(isConnected); },
      onTyping(columnId) {
        setTyping(prev => ({ ...prev, [columnId]: true }));
        clearTimeout(typingTimers.current[columnId]);
        typingTimers.current[columnId] = setTimeout(() => {
          setTyping(prev => ({ ...prev, [columnId]: false }));
        }, TYPING_EXPIRY_MS);
      },
      onReconnect: refetch
    });
    socketRef.current = socket;
    return () => {
      socket.close();
      Object.values(typingTimers.current).forEach(clearTimeout);
    };
    // Mount-only: retro.id is fixed for this component's lifetime
  }, []);

  // Say so once when a running timer hits zero
  const announcedEnd = useRef(null);
  useEffect(() => {
    if (timeLeft === 0 && announcedEnd.current !== retro.timer_ends_at) {
      announcedEnd.current = retro.timer_ends_at;
      announce("Time's up.");
    }
  }, [timeLeft]);

  /* ── Actions ─────────────────────────────────────────────── */

  const guard = async (fn) => {
    setBusy(true);
    try { await fn(); } catch (err) { showToast(err.message, 'error'); } finally { setBusy(false); }
  };

  const addEntry = async (columnId, text) => {
    const entry = await api.addEntry(retro.id, columnId, text);
    dispatch({ type: 'entry:added', entry });
  };

  const toggleVote = async (entry) => {
    const voted = retro.votedEntryIds.includes(entry.id);
    if (!voted && votesLeft === 0) {
      showToast("You've used all your votes. Take one back to vote for another note.", 'error');
      return;
    }
    dispatch({ type: 'vote:optimistic', entryId: entry.id, voted: !voted });
    if (!voted) spawnVoteCelebration();
    try {
      const updated = voted ? await api.unvoteEntry(retro.id, entry.id) : await api.voteEntry(retro.id, entry.id);
      dispatch({ type: 'entry:voted', entry: updated });
    } catch (err) {
      dispatch({ type: 'vote:optimistic', entryId: entry.id, voted });
      showToast(err.message, 'error');
    }
  };

  const setPhase = (phase) => guard(async () => {
    const res = await api.setPhase(retro.id, phase);
    dispatch({ type: 'phase', phase, focusEntryId: res.focus_entry_id });
    setSheetOpen(false);
    await refetch();
  });

  const finish = async () => {
    const ok = await confirmDialog({
      title: 'Finish the retro?',
      body: 'Adding notes and voting will close, and everyone will see the summary. You can reopen it later if needed.',
      confirmLabel: 'Finish retro'
    });
    if (!ok) return;
    await guard(async () => {
      await api.updateRetroStatus(retro.id, 'finished');
      setSheetOpen(false);
      // Usually the WebSocket echo has already played it; this covers a
      // facilitator whose connection is down or reconnecting
      playEnding();
    });
  };

  const reopen = async () => {
    const ok = await confirmDialog({
      title: 'Reopen the retro?',
      body: 'Participants can pick up from the stage you left off.',
      confirmLabel: 'Reopen'
    });
    if (!ok) return;
    await guard(async () => {
      await api.updateRetroStatus(retro.id, 'active');
      endingPlayed.current = false;
      setSheetOpen(false);
      await refetch();
    });
  };

  const setTimer = (seconds) => guard(async () => {
    const res = await api.setTimer(retro.id, seconds);
    dispatch({ type: 'timer', endsAt: res.timer_ends_at });
  });

  const focusOn = (entryId) => guard(async () => {
    await api.setFocus(retro.id, entryId);
    dispatch({ type: 'focus', entryId });
  });

  const exportExcel = async () => {
    try {
      await exportRetroToExcel(await api.getRetro(retro.id));
      showToast('Excel file downloaded.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const editEntry = async (entryId, text) => dispatch({ type: 'entry:edited', entry: await api.editEntry(retro.id, entryId, text) });
  const moveEntry = async (entryId, columnId) => dispatch({ type: 'entry:moved', entry: await api.moveEntry(retro.id, entryId, columnId) });
  const deleteEntry = async (entryId) => {
    await api.deleteEntry(retro.id, entryId);
    dispatch({ type: 'entry:deleted', entryId });
  };

  /* ── Lanes ───────────────────────────────────────────────── */

  // Phone: tapping a lane tab scrolls that lane into view…
  const showLane = (columnId) => {
    setActiveLane(columnId);
    const el = lanesRef.current?.querySelector(`[data-lane="${columnId}"]`);
    el?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', inline: 'start', block: 'nearest' });
  };

  // …and swiping between lanes updates the active tab (and the dock's target lane)
  useEffect(() => {
    if (wide || !lanesRef.current || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver((items) => {
      for (const item of items) {
        if (item.isIntersecting && item.intersectionRatio > 0.6) setActiveLane(item.target.dataset.lane);
      }
    }, { root: lanesRef.current, threshold: [0.6] });
    for (const el of lanesRef.current.querySelectorAll('[data-lane]')) observer.observe(el);
    return () => observer.disconnect();
  }, [wide, retro.columns.length, view, retro.phase, retro.status]);

  const dropOn = (columnId) => (e) => {
    e.preventDefault();
    setDragOverLane(null);
    const entryId = e.dataTransfer.getData('text/plain');
    const entry = retro.columns.flatMap(c => c.entries).find(x => x.id === entryId);
    if (entry && entry.column_id !== columnId) moveEntry(entryId, columnId).catch(err => showToast(err.message, 'error'));
  };

  const lanes = useMemo(() => retro.columns.map((c, i) => ({
    ...c,
    index: i,
    sorted: sortByVotes ? [...c.entries].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)) : c.entries
  })), [retro.columns, sortByVotes]);

  const activeColumn = lanes.find(c => c.id === activeLane) || lanes[0];
  const dragEnabled = canManage && !notesHidden && wide;

  const renderLane = (col) => html`
    <section
      key=${col.id}
      class=${`lane lane-${col.index % 4} ${dragOverLane === col.id ? 'is-drop-target' : ''}`}
      data-lane=${col.id}
      id=${`lane-${col.id}`}
      aria-label=${`${col.name}, ${col.entries.length} ${col.entries.length === 1 ? 'note' : 'notes'}`}
      onDragOver=${dragEnabled ? (e) => { e.preventDefault(); setDragOverLane(col.id); } : undefined}
      onDragLeave=${dragEnabled ? (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverLane(null); } : undefined}
      onDrop=${dragEnabled ? dropOn(col.id) : undefined}
    >
      <header class="lane__head">
        <i class="lane-dot"></i>
        <h2 class="lane__title">${col.name}</h2>
        <span class="lane__count tabular">${col.entries.length}</span>
      </header>
      ${wide && typing[col.id] ? html`<p class="typing lane__typing">Someone is typing…</p>` : null}
      <div class="lane__notes">
        ${col.sorted.length === 0 ? html`<p class="lane__empty">${canWrite ? 'Be the first to add a note.' : 'No notes in this column.'}</p>` : null}
        ${col.sorted.map(entry => html`
          <${Note}
            key=${entry.id}
            entry=${entry}
            laneIndex=${col.index}
            laneName=${col.name}
            canVote=${canVote}
            voted=${retro.votedEntryIds.includes(entry.id)}
            voteFull=${votesLeft === 0}
            countsHidden=${countsHidden || notesHidden}
            canManage=${canManage && !entry.hidden}
            onToggleVote=${toggleVote}
            onActions=${setActionEntry}
            draggable=${dragEnabled}
            focused=${retro.focus_entry_id === entry.id && retro.phase === 'discussing'}
          />
        `)}
      </div>
      ${wide && canWrite ? html`
        <${Composer} columnId=${col.id} columnName=${col.name} onSubmit=${addEntry}
          onTyping=${(id) => socketRef.current?.sendTyping(id)} />
      ` : null}
    </section>
  `;

  const lanesView = html`
    ${!wide && lanes.length > 1 ? html`
      <div class="lane-tabs" role="tablist" aria-label="Columns">
        ${lanes.map(col => html`
          <button type="button" role="tab" class=${`lane-tab lane-${col.index % 4} ${col.id === activeColumn?.id ? 'is-active' : ''}`}
            aria-selected=${col.id === activeColumn?.id ? 'true' : 'false'} aria-controls=${`lane-${col.id}`}
            onClick=${() => showLane(col.id)}>
            <i class="lane-dot"></i>${col.name}<span class="lane-tab__count tabular">${col.entries.length}</span>
          </button>
        `)}
      </div>
    ` : null}
    <div class="lanes" ref=${lanesRef} tabindex=${wide ? undefined : '0'} role=${wide ? undefined : 'region'}
      aria-label=${wide ? undefined : 'Columns — swipe to switch'}>${lanes.map(renderLane)}</div>
  `;

  /* ── Screen ──────────────────────────────────────────────── */

  let body;
  if (staged && retro.phase === 'setup' && !finished) {
    body = html`<${SetupView} columns=${retro.columns} canFacilitate=${canFacilitate} busy=${busy}
      onStart=${() => setPhase('writing')} onEditColumns=${() => setColumnsOpen(true)} />`;
  } else if (finished && view === 'stage') {
    body = html`<${SummaryView} retro=${retro} canFacilitate=${canFacilitate} onExport=${exportExcel} onReopen=${reopen} />`;
  } else if (staged && retro.phase === 'discussing' && view === 'stage') {
    body = html`<${DiscussView} columns=${retro.columns} focusId=${retro.focus_entry_id} timeLeft=${timeLeft}
      canFacilitate=${canFacilitate} onFocus=${focusOn} />`;
  } else {
    body = lanesView;
  }

  const hasStageScreen = finished || (staged && retro.phase === 'discussing');
  const showDock = !wide && (canWrite || (canVote && staged)) && !(staged && retro.phase === 'setup');
  const backHref = user ? '#/app' : '#/';
  const hint = finished ? null : (staged ? STAGE_HINTS[retro.phase] : null);

  return html`
    <div class=${`board-screen ${showDock ? 'has-dock' : ''}`}>
      <header class="board-bar">
        <div class="board-bar__row">
          ${user
            ? html`<a class="icon-btn icon-btn--ghost" href=${backHref} aria-label="Back to my retros" title="Back to my retros"><${Icon} name="arrow-left" /></a>`
            : html`<a class="board-bar__brand" href="#/" aria-label="Retro Runway home"><${BrandMark} size=${20} /></a>`}
          <h1 class="board-bar__title">${retro.title}</h1>
          <span class=${`conn-dot ${connected ? 'is-live' : ''}`} title=${connected ? 'Live' : 'Connecting…'}>
            <span class="sr-only">${connected ? 'Live connection' : 'Connecting'}</span>
          </span>
          ${timeLeft != null ? html`
            <span class=${`pill tabular ${timeLeft === 0 ? 'pill--danger' : 'pill--accent'}`} role="timer" aria-label=${`Time left ${formatClock(timeLeft)}`}>
              <${Icon} name="timer" size=${16} />${timeLeft === 0 ? "Time's up" : formatClock(timeLeft)}
            </span>
          ` : null}
          ${canVote && wide && !staged ? html`<span class="pill pill--vote tabular">Votes left: ${votesLeft}</span>` : null}
          <button type="button" class="pill board-bar__presence" onClick=${() => setPresenceOpen(true)} aria-label=${`${presence.length} ${presence.length === 1 ? 'person' : 'people'} here — show the list`}>
            <${Icon} name="users" size=${16} /><span class="tabular">${presence.length}</span>
          </button>
          ${canFacilitate
            ? html`<${IconButton} icon="sliders" label="Facilitator" variant="secondary" onClick=${() => setSheetOpen(true)} />`
            : html`<${ThemeToggle} />`}
        </div>
        ${staged || hint || hasStageScreen || (canVote && !staged && !wide) ? html`
          <div class="board-bar__stage">
            ${staged ? html`<${StageStrip} current=${stage} />` : null}
            <div class="board-bar__meta">
              ${hint ? html`<p class="stage-hint">${hint}</p>` : null}
              ${canVote && !wide && !staged ? html`<span class="pill pill--vote tabular">Votes left: ${votesLeft}</span>` : null}
              ${canVote && wide && staged ? html`<span class="pill pill--vote tabular">Votes left: ${votesLeft}</span>` : null}
              ${hasStageScreen ? html`
                <div class="segmented" role="group" aria-label="View">
                  <${Chip} selected=${view === 'stage'} onClick=${() => setView('stage')}>${finished ? 'Summary' : 'Discussion'}<//>
                  <${Chip} selected=${view === 'board'} onClick=${() => setView('board')}>Board<//>
                </div>
              ` : null}
            </div>
          </div>
        ` : null}
      </header>

      <main class="board-main" id="main">${body}</main>

      ${showDock ? html`
        <div class="dock" role="region" aria-label=${canWrite ? 'Add a note' : 'Your votes'}>
          ${canWrite && activeColumn ? html`
            <${Composer} docked columnId=${activeColumn.id} columnName=${activeColumn.name} onSubmit=${addEntry}
              someoneTyping=${!!typing[activeColumn.id]} onTyping=${(id) => socketRef.current?.sendTyping(id)} />
          ` : html`
            <div class="vote-meter" aria-live="polite">
              <div>
                <strong>Votes left</strong>
                <span class="vote-meter__sub">${votesLeft === 0 ? 'Take a vote back to give it to another note.' : 'Tap a note to vote for it.'}</span>
              </div>
              <div class="vote-meter__count">
                <span class="vote-meter__dots" aria-hidden="true">
                  ${Array.from({ length: retro.max_votes ?? 3 }, (_, i) => html`<i class=${i < retro.votedEntryIds.length ? 'is-used' : ''}></i>`)}
                </span>
                <b class="tabular">${votesLeft}</b>
              </div>
            </div>
          `}
        </div>
      ` : null}

      ${actionEntry ? html`
        <${NoteActions} key=${actionEntry.id} entry=${actionEntry} columns=${retro.columns}
          canFocus=${retro.phase === 'discussing' && !finished}
          onClose=${() => setActionEntry(null)} onEdit=${editEntry} onMove=${moveEntry} onDelete=${deleteEntry} onFocus=${focusOn} />
      ` : null}

      ${canFacilitate ? html`
        <${FacilitatorSheet} open=${sheetOpen} onClose=${() => setSheetOpen(false)} retro=${retro} stage=${stage}
          timeLeft=${timeLeft} presenceCount=${presence.length} hasEntries=${hasEntries} busy=${busy}
          onAdvance=${setPhase} onGoBack=${setPhase} onFinish=${finish} onReopen=${reopen} onTimer=${setTimer}
          onEditColumns=${() => { setSheetOpen(false); setColumnsOpen(true); }} onExport=${exportExcel} />
        <${ColumnsDialog} open=${columnsOpen} onClose=${() => setColumnsOpen(false)} columns=${retro.columns} locked=${hasEntries}
          onRename=${async (id, name) => { await api.renameColumn(retro.id, id, name); dispatch({ type: 'column:renamed', columnId: id, name }); }}
          onAdd=${async (name) => dispatch({ type: 'column:added', column: await api.addColumn(retro.id, name) })}
          onDelete=${async (id) => { await api.deleteColumn(retro.id, id); dispatch({ type: 'column:deleted', columnId: id }); }} />
      ` : null}

      <${Dialog} open=${presenceOpen} onClose=${() => setPresenceOpen(false)} title=${`${presence.length} ${presence.length === 1 ? 'person' : 'people'} here`} size="sm">
        <ul class="presence-list">
          ${presence.map((name, i) => html`
            <li key=${i}><span class="avatar" aria-hidden="true">${(name || '?')[0].toUpperCase()}</span>${name || 'Guest'}</li>
          `)}
        </ul>
        <p class="presence-note">Notes are always anonymous; this list only shows who is connected.</p>
      <//>
    </div>
  `;
}
