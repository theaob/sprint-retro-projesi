import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import htm from 'htm';

const html = htm.bind(h);

export function BoardTabs({ columns, boardRef, getColumnEl }) {
  const [activeColId, setActiveColId] = useState(columns[0]?.id ?? null);
  const isScrollingTimeout = useRef(null);

  // Scroll sync: as the board scrolls (user swipe on mobile), figure out
  // which column is closest to center and highlight that tab.
  useEffect(() => {
    const boardEl = boardRef.current;
    if (!boardEl) return;

    const onScroll = () => {
      clearTimeout(isScrollingTimeout.current);
      isScrollingTimeout.current = setTimeout(() => {
        const boardRect = boardEl.getBoundingClientRect();
        const boardCenter = boardRect.left + boardRect.width / 2;
        let closestId = null;
        let minDistance = Infinity;
        for (const col of columns) {
          const colEl = getColumnEl(col.id);
          if (!colEl) continue;
          const rect = colEl.getBoundingClientRect();
          const colCenter = rect.left + rect.width / 2;
          const distance = Math.abs(colCenter - boardCenter);
          if (distance < minDistance) {
            minDistance = distance;
            closestId = col.id;
          }
        }
        if (closestId) setActiveColId(closestId);
      }, 100);
    };

    boardEl.addEventListener('scroll', onScroll);
    return () => {
      boardEl.removeEventListener('scroll', onScroll);
      clearTimeout(isScrollingTimeout.current);
    };
  }, [columns, boardRef, getColumnEl]);

  const handleTabClick = (colId) => {
    const colEl = getColumnEl(colId);
    if (colEl) {
      // No `behavior: 'smooth'` — combined with the board's CSS
      // scroll-snap-type, Chrome/Safari silently no-op the scroll instead
      // of animating it.
      colEl.scrollIntoView({ block: 'nearest', inline: 'center' });
      setActiveColId(colId);
    }
  };

  return html`
    <div class="board-tabs-container">
      <div class="board-tabs">
        ${columns.map(col => html`
          <button
            key=${col.id}
            class="board-tab${col.id === activeColId ? ' active' : ''}"
            onClick=${() => handleTabClick(col.id)}
          >
            <span class="tab-name-text">${col.name}</span>
            <span class="tab-count">${col.entries.length}</span>
          </button>
        `)}
      </div>
    </div>
  `;
}
