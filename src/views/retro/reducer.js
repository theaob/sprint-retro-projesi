/**
 * All retro board state lives here: the initial GET /retros/:id payload,
 * every WebSocket event, and every local optimistic update funnel through
 * this reducer. Centralizing it means WS handlers (bound once, on mount)
 * never read stale closed-over state — they just dispatch.
 */
export function retroReducer(state, action) {
  switch (action.type) {
    case 'entry:added': {
      const entry = action.entry;
      // Idempotent: guards against the WS broadcast arriving for an entry
      // this same client just optimistically added from its own POST.
      const alreadyExists = state.columns.some(c => c.entries.some(e => e.id === entry.id));
      if (alreadyExists) return state;
      return {
        ...state,
        columns: state.columns.map(c =>
          c.id === entry.column_id ? { ...c, entries: [...c.entries, entry] } : c
        ),
        flashColumnId: entry.column_id
      };
    }

    case 'entry:voted': {
      const entry = action.entry;
      return {
        ...state,
        columns: state.columns.map(c => ({
          ...c,
          entries: c.entries.map(e => (e.id === entry.id ? { ...e, votes: entry.votes } : e))
        }))
      };
    }

    case 'entry:edited': {
      const entry = action.entry;
      return {
        ...state,
        columns: state.columns.map(c => ({
          ...c,
          entries: c.entries.map(e => (e.id === entry.id ? { ...e, text: entry.text } : e))
        }))
      };
    }

    case 'entry:moved': {
      const entry = action.entry;
      // Filter-then-add per column, keyed on the entry's *current* column_id —
      // naturally idempotent (unlike an append), so no separate dedup guard is
      // needed against the local dispatch + WS echo landing twice.
      return {
        ...state,
        columns: state.columns.map(c => {
          const withoutEntry = c.entries.filter(e => e.id !== entry.id);
          return c.id === entry.column_id
            ? { ...c, entries: [...withoutEntry, entry] }
            : { ...c, entries: withoutEntry };
        })
      };
    }

    case 'entry:deleted': {
      const { entryId } = action;
      return {
        ...state,
        columns: state.columns.map(c => ({
          ...c,
          entries: c.entries.filter(e => e.id !== entryId)
        }))
      };
    }

    case 'column:renamed': {
      const { columnId, name } = action;
      return {
        ...state,
        columns: state.columns.map(c => (c.id === columnId ? { ...c, name } : c))
      };
    }

    case 'status:changed':
      return { ...state, status: action.status };

    case 'action:added': {
      // Same idempotency concern as entry:added — the adder's own dispatch
      // (fired right after the API call resolves) and the WS echo of that
      // same broadcast (servers don't exclude the sender) would otherwise
      // both append it.
      const exists = (state.action_items || []).some(a => a.id === action.actionItem.id);
      if (exists) return state;
      return { ...state, action_items: [...(state.action_items || []), action.actionItem] };
    }

    case 'action:removed':
      return { ...state, action_items: (state.action_items || []).filter(a => a.id !== action.actionId) };

    // Local, optimistic — fired the instant the vote button is clicked, before
    // the API call resolves. The authoritative *count* still only ever comes
    // from the entry:voted broadcast; this only tracks "did I vote for this".
    case 'vote:optimistic': {
      const { entryId, voted } = action;
      const votedEntryIds = voted
        ? [...state.votedEntryIds, entryId]
        : state.votedEntryIds.filter(id => id !== entryId);
      return { ...state, votedEntryIds };
    }

    case 'vote:rollback':
      return { ...state, votedEntryIds: action.votedEntryIds };

    case 'flash:clear':
      return { ...state, flashColumnId: null };

    // Full replace — used after an onReconnect re-fetch to catch up on
    // anything missed while the socket was down.
    case 'refresh':
      return { ...state, columns: action.retro.columns, action_items: action.retro.action_items };

    default:
      return state;
  }
}

export function initialRetroState(retro) {
  return {
    ...retro,
    votedEntryIds: [...(retro.voted_entry_ids || [])],
    flashColumnId: null
  };
}
