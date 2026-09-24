/**
 * All retro board state lives here: the initial GET /retros/:id payload,
 * every WebSocket event, and every local optimistic update funnel through
 * this reducer. Centralizing it means WS handlers (bound once, on mount)
 * never read stale closed-over state — they just dispatch.
 *
 * Many cases are idempotent (upsert rather than append) because a client's
 * own API response and the WebSocket echo of the same change can both
 * arrive, in either order.
 */

/**
 * Combines what we already know about a note with a newer copy of it.
 * In a staged retro the room broadcast is a placeholder (hidden: true) for
 * everyone but the author, so a placeholder must never overwrite a note
 * whose text we already have — only its column can change.
 */
function mergeEntry(existing, incoming) {
  if (incoming.hidden && !existing.hidden) return { ...existing, column_id: incoming.column_id };
  return {
    ...existing,
    ...incoming,
    mine: existing.mine || incoming.mine,
    // A redacted count (null, while votes are hidden) never replaces a real one we hold locally
    votes: incoming.votes ?? existing.votes
  };
}

function findEntry(columns, entryId) {
  for (const col of columns) {
    const entry = col.entries.find(e => e.id === entryId);
    if (entry) return entry;
  }
  return null;
}

/** Puts `entry` into its column_id's list (removing it from any other). */
function placeEntry(columns, entry) {
  return columns.map(c => {
    const without = c.entries.filter(e => e.id !== entry.id);
    if (c.id !== entry.column_id) return without.length === c.entries.length ? c : { ...c, entries: without };
    const idx = c.entries.findIndex(e => e.id === entry.id);
    if (idx === -1) return { ...c, entries: [...without, entry] };
    const entries = [...c.entries];
    entries[idx] = entry;
    return { ...c, entries };
  });
}

function upsert(state, incoming) {
  const existing = findEntry(state.columns, incoming.id);
  const entry = existing ? mergeEntry(existing, incoming) : incoming;
  return { ...state, columns: placeEntry(state.columns, entry) };
}

export function retroReducer(state, action) {
  switch (action.type) {
    case 'refresh':
      return initialRetroState(action.retro);

    case 'entry:added':
    case 'entry:edited':
    case 'entry:moved':
      return upsert(state, action.entry);

    case 'entry:voted': {
      const existing = findEntry(state.columns, action.entry.id);
      if (!existing || action.entry.votes == null) return state;
      return { ...state, columns: placeEntry(state.columns, { ...existing, votes: action.entry.votes }) };
    }

    case 'entry:deleted':
      return {
        ...state,
        columns: state.columns.map(c => ({ ...c, entries: c.entries.filter(e => e.id !== action.entryId) })),
        votedEntryIds: state.votedEntryIds.filter(id => id !== action.entryId),
        focus_entry_id: state.focus_entry_id === action.entryId ? null : state.focus_entry_id
      };

    case 'column:renamed':
      return { ...state, columns: state.columns.map(c => (c.id === action.columnId ? { ...c, name: action.name } : c)) };

    case 'column:added':
      if (state.columns.some(c => c.id === action.column.id)) return state;
      return { ...state, columns: [...state.columns, { ...action.column, entries: action.column.entries || [] }] };

    case 'column:deleted':
      return { ...state, columns: state.columns.filter(c => c.id !== action.columnId) };

    case 'status':
      return { ...state, status: action.status };

    case 'phase':
      return { ...state, phase: action.phase, focus_entry_id: action.focusEntryId ?? null };

    case 'focus':
      return { ...state, focus_entry_id: action.entryId };

    case 'timer':
      return {
        ...state,
        timer_ends_at: action.endsAt,
        clockOffset: action.serverNow ? Date.parse(action.serverNow) - Date.now() : state.clockOffset
      };

    case 'voters':
      return { ...state, voter_count: action.voters };

    // Local, optimistic — fired the instant the vote button is pressed,
    // before the API call resolves. Only tracks "did I vote for this";
    // counts come from the server.
    case 'vote:optimistic': {
      const without = state.votedEntryIds.filter(id => id !== action.entryId);
      return { ...state, votedEntryIds: action.voted ? [...without, action.entryId] : without };
    }

    default:
      return state;
  }
}

export function initialRetroState(retro) {
  return {
    ...retro,
    votedEntryIds: [...(retro.voted_entry_ids || [])],
    // Server clock minus ours, so every client counts a timer down to the same second
    clockOffset: retro.server_now ? Date.parse(retro.server_now) - Date.now() : 0
  };
}
