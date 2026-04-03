/**
 * WebSocket client for real-time retro updates.
 * Usage:
 *   const ws = createRetroSocket(retroId, {
 *     onEntryAdded: (entry) => {},
 *     onEntryVoted: (entry) => {},
 *     onColumnRenamed: ({ columnId, name }) => {},
 *   });
 *   ws.close(); // cleanup
 */

export function createRetroSocket(retroId, handlers = {}) {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const host = location.hostname;
  // In dev, Vite runs on 5173 but server is on 3000 — use server port
  const port = import.meta.env.DEV ? '3000' : location.port;
  const url = `${protocol}://${host}:${port}/ws`;

  let ws;
  let reconnectTimer;
  let closed = false;

  function connect() {
    ws = new WebSocket(url);

    ws.onopen = () => {
      // Join the retro room
      ws.send(JSON.stringify({ type: 'join', retroId }));
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
          case 'column:renamed':
            handlers.onColumnRenamed?.(msg);
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
