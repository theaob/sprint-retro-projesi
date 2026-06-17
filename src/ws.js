/**
 * WebSocket client for real-time retro updates.
 * Usage:
 *   const ws = createRetroSocket(retroId, {
 *     onEntryAdded: (entry) => {},
 *     onEntryVoted: (entry) => {},
 *     onColumnRenamed: ({ columnId, name }) => {},
 *     onReconnect: () => {},
 *   });
 *   ws.close(); // cleanup
 */

export function createRetroSocket(retroId, handlers = {}) {
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
      ws.send(JSON.stringify({ type: 'join', retroId }));
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
          case 'entry:deleted':
            handlers.onEntryDeleted?.(msg.entryId, msg.columnId);
            break;
          case 'column:renamed':
            handlers.onColumnRenamed?.(msg);
            break;
          case 'retro:status_changed':
            handlers.onStatusChanged?.(msg.status);
            break;
          case 'action:added':
            handlers.onActionAdded?.(msg.actionItem);
            break;
          case 'action:removed':
            handlers.onActionRemoved?.(msg.actionId, msg.retroId);
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

  return {
    close() {
      closed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    }
  };
}
