/** Tiny hash router: #/map, #/level/html-1, #/share/<lz> … */
import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'map' }
  | { name: 'level'; id: string }
  | { name: 'album' }
  | { name: 'notebook' }
  | { name: 'sandbox' }
  | { name: 'stats' }
  | { name: 'share'; data: string };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  const [head, ...rest] = h.split('/');
  const arg = rest.join('/');
  switch (head) {
    case 'map':
      return { name: 'map' };
    case 'level':
      return /^[a-z]+-\d{1,2}$/.test(arg) ? { name: 'level', id: arg } : { name: 'map' };
    case 'album':
    case 'notebook':
    case 'sandbox':
    case 'stats':
      return { name: head };
    case 'share':
      return arg.length > 0 && arg.length < 20_000 ? { name: 'share', data: arg } : { name: 'home' };
    default:
      return { name: 'home' };
  }
}

export function href(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/';
    case 'level':
      return `#/level/${r.id}`;
    case 'share':
      return `#/share/${r.data}`;
    default:
      return `#/${r.name}`;
  }
}

export function go(r: Route) {
  location.hash = href(r);
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash, () => '');
  return parseHash(hash);
}
