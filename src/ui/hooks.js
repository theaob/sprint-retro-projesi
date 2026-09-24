import { useEffect, useState } from 'preact/hooks';

/** Whether a media query currently matches, updating live. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/**
 * Seconds left until `endsAt` (ISO string), ticking once a second, or null
 * with no timer. `clockOffset` is server time minus local time, so every
 * client counts down to the same moment even with a skewed clock.
 */
export function useCountdown(endsAt, clockOffset = 0) {
  const compute = () => (endsAt ? Math.max(0, Math.ceil((Date.parse(endsAt) - (Date.now() + clockOffset)) / 1000)) : null);
  const [left, setLeft] = useState(compute);
  useEffect(() => {
    setLeft(compute());
    if (!endsAt) return undefined;
    const t = setInterval(() => setLeft(compute()), 1000);
    return () => clearInterval(t);
  }, [endsAt, clockOffset]);
  return left;
}

/** 185 → "03:05" */
export function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
