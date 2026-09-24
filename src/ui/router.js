import { useEffect, useState } from 'preact/hooks';

/** Current location.hash, re-rendering on change. Defaults to '#/'. */
export function useHash() {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

/** Go to a hash route. `replace` swaps the current history entry instead of adding one. */
export function navigate(to, { replace = false } = {}) {
  if (replace) window.location.replace(to);
  else window.location.hash = to;
}
