/**
 * WebSocket client for real-time retro updates.
 * Usage:
 *   const ws = createRetroSocket(retroId, displayName, {
 *     onEntryAdded: (entry) => {},
 *     onEntryVoted: (entry) => {},
 *     onColumnRenamed: ({ columnId, name }) => {},
 *     onPresenceUpdate: (users) => {},      // users: array of (name | null)
 *     onTyping: (columnId, name) => {},
 *     onReconnect: () => {},
 *   });
 *   ws.sendTyping(columnId); // throttled client-side, safe to call on every keystroke
 *   ws.close(); // cleanup
 */

export function createRetroSocket(retroId, displayName, handlers = {}) {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const host = location.hostname;
  // In dev, Vite runs on 5173 but server is on 3000 — use server port
  const port = import.meta.env.DEV ? '3000' : location.port;
  
  // Cleanly handle ports — avoid trailing colons if port is empty
  const portSuffix = port ? `:${port}` : '';
  const url = `${protocol}://${host}${portSuffix}/ws`;

  let ws;
  let reconnectTimer;
  let closed = false;
  let hasConnectedBefore = false;

  function connect() {
    ws = new WebSocket(url);

    ws.onopen = () => {
      // Join the retro room
      ws.send(JSON.stringify({ type: 'join', retroId, name: displayName || null }));
      // If this is a reconnection, notify so the page can refresh stale data
      if (hasConnectedBefore) {
        handlers.onReconnect?.();
      }
      hasConnectedBefore = true;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'entry:added':
            handlers.onEntryAdded?.(msg.entry);
            break;
          case 'entry:voted':
            handlers.onEntryVoted?.(msg.entry);
            break;
          case 'entry:edited':
            handlers.onEntryEdited?.(msg.entry);
            break;
          case 'entry:moved':
            handlers.onEntryMoved?.(msg.entry);
            break;
          case 'entry:deleted':
            handlers.onEntryDeleted?.(msg.entryId, msg.columnId);
            break;
          case 'column:renamed':
            handlers.onColumnRenamed?.(msg);
            break;
          case 'column:added':
            handlers.onColumnAdded?.(msg.column);
            break;
          case 'column:deleted':
            handlers.onColumnDeleted?.(msg.columnId);
            break;
          case 'retro:status_changed':
            handlers.onStatusChanged?.(msg.status);
            break;
          case 'action:added':
            handlers.onActionAdded?.(msg.actionItem);
            break;
          case 'action:updated':
            handlers.onActionUpdated?.(msg.actionItem);
            break;
          case 'action:removed':
            handlers.onActionRemoved?.(msg.actionId, msg.retroId);
            break;
          case 'presence:update':
            handlers.onPresenceUpdate?.(msg.users);
            break;
          case 'typing':
            handlers.onTyping?.(msg.columnId, msg.name);
            break;
        }
      } catch (e) {
        // ignore
      }
    };

    ws.onclose = () => {
      if (!closed) {
        // Reconnect after 3 seconds
        reconnectTimer = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  connect();

  let lastTypingSentAt = 0;

  return {
    close() {
      closed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    },
    // Safe to call on every keystroke — throttled to at most once per 2s
    // so a fast typist doesn't flood the room with messages.
    sendTyping(columnId) {
      const now = Date.now();
      if (now - lastTypingSentAt < 2000) return;
      lastTypingSentAt = now;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'typing', retroId, columnId, name: displayName || null }));
      }
    }
  };
}
