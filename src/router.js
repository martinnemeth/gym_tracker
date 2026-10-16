import { useState, useEffect } from './lib.js';

// Hash router — funguje na GitHub Pages aj offline bez serverových pravidiel.

const DEFAULT_PATH = '/plans';
let internalDepth = 0; // koľko krokov späť vieme bezpečne urobiť cez history.back()

export function currentPath() {
  return location.hash.replace(/^#/, '').split('?')[0] || DEFAULT_PATH;
}

export function useRoute() {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const onChange = () => setPath(currentPath());
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

export function navigate(path, { replace = false } = {}) {
  if (replace) {
    history.replaceState(null, '', `#${path}`);
    dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    internalDepth++;
    location.hash = path;
  }
}

/** Prepnutie záložky — začína novú „hĺbku" navigácie. */
export function navigateRoot(path) {
  internalDepth = 0;
  navigate(path, { replace: true });
}

/** Späť v histórii, ak sme sem prišli v rámci aplikácie; inak na fallback. */
export function goBack(fallback) {
  if (internalDepth > 0) {
    internalDepth--;
    history.back();
  } else {
    navigate(fallback, { replace: true });
  }
}

/** match('/exercises/:id', '/exercises/abc') → { id: 'abc' } alebo null */
export function match(pattern, path) {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}
