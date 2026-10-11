import { useSyncExternalStore } from 'react';

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

export const useIsMobile = () => useMedia('(max-width: 767px)');
export const usePrefersReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)');
