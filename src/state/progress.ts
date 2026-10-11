/**
 * Everything the game remembers between visits. Stored in localStorage, parsed with
 * zod on load (with a version + migrate step). Damaged data never crashes the game:
 * it starts fresh instead.
 */
import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { ProgressSchema } from '../engine/schema';
import type { Lang, LevelProgress, Progress } from '../engine/types';

export const STORAGE_KEY = 'code-quest:v1';

export function freshProgress(): Progress {
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    version: 1,
    xp: 0,
    levels: {},
    badges: [],
    settings: { lang: 'ar', sound: true, captions: true, reducedMotion: reduce },
    tourDone: false,
  };
}

/** Parse whatever is in storage; anything invalid → a clean slate. */
export function loadProgress(raw: unknown): Progress {
  const r = ProgressSchema.safeParse(migrate(raw));
  return r.success ? r.data : freshProgress();
}

function migrate(raw: unknown): unknown {
  // v1 is the first version. Future versions add steps here: if (raw.version === 1) raw = {...raw, version: 2, ...}.
  return raw;
}

const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode / quota — keep playing in memory */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

interface Actions {
  setLang(l: Lang): void;
  toggleSound(): void;
  setSetting<K extends keyof Progress['settings']>(k: K, v: Progress['settings'][K]): void;
  patchLevel(id: string, patch: Partial<LevelProgress>): void;
  addXp(n: number): void;
  award(badge: string): boolean;
  finishTour(): void;
  resetAll(): void;
}

const emptyLevel = (): LevelProgress => ({ solved: false, stars: 0, attempts: 0, timeMs: 0, hints: 0 });

export const useProgress = create<Progress & Actions>()(
  persist(
    (set, get) => ({
      ...freshProgress(),
      setLang: (lang) => set((s) => ({ settings: { ...s.settings, lang } })),
      toggleSound: () => set((s) => ({ settings: { ...s.settings, sound: !s.settings.sound } })),
      setSetting: (k, v) => set((s) => ({ settings: { ...s.settings, [k]: v } })),
      patchLevel: (id, patch) =>
        set((s) => ({ levels: { ...s.levels, [id]: { ...emptyLevel(), ...s.levels[id], ...patch } } })),
      addXp: (n) => set((s) => ({ xp: s.xp + n })),
      award: (badge) => {
        if (get().badges.includes(badge)) return false;
        set((s) => ({ badges: [...s.badges, badge] }));
        return true;
      },
      finishTour: () => set({ tourDone: true }),
      resetAll: () => set(freshProgress()),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ version: s.version, xp: s.xp, levels: s.levels, badges: s.badges, settings: s.settings, tourDone: s.tourDone }),
      merge: (persisted, current) => ({ ...current, ...loadProgress(persisted) }),
    },
  ),
);

export const useLang = () => useProgress((s) => s.settings.lang);
