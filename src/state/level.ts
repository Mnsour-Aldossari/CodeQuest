/**
 * The level being played right now. Structural edits go through tree.ts; zundo
 * records the tree so Ctrl+Z / Ctrl+Shift+Z undo and redo any edit (drag, tap or keyboard).
 */
import { create } from 'zustand';
import { temporal } from 'zundo';
import { insert, makeBlock, move, remove, setField, cloneFresh, find, walk } from '../engine/tree';
import { applyOneStep, glowTarget, type HintTarget } from '../engine/hints';
import type { Block, FieldVal, Level, Loc, PaletteItem, Place, Trace } from '../engine/types';
import type { Verdict } from '../engine/judge';
import { sfx } from '../ui/sound';

export type Pick = { kind: 'palette'; index: number } | { kind: 'block'; id: string };
export type Phase = 'play' | 'running' | 'stepping' | 'fail' | 'error' | 'win';
export type BitMsg =
  | { kind: 'story' }
  | { kind: 'nice' }
  | { kind: 'running' }
  | { kind: 'step' }
  | { kind: 'text'; text: Loc; tone?: 'error' | 'hint' | 'win' };

interface State {
  level: Level | null;
  tree: Block | null;
  code: string;
  pick: Pick | null;
  phase: Phase;
  verdict: Verdict | null;
  trace: Trace | null;
  runs: number;
  failedRuns: number;
  hintLevel: number;
  hintsUsed: number;
  glow: HintTarget | null;
  step: number;
  /** block being executed in step-by-step mode */
  execId: string | null;
  hoverId: string | null;
  snapId: string | null;
  shake: string | null;
  msg: BitMsg;
  startedAt: number;
  /** bumps when goal results should animate in */
  runId: number;
}

interface Actions {
  load(level: Level, saved?: { tree?: Block; code?: string }): void;
  setPick(p: Pick | null): void;
  placeFromPalette(index: number, place: Place): boolean;
  moveBlock(id: string, place: Place): boolean;
  removeBlock(id: string): void;
  setField(id: string, field: string, v: FieldVal): void;
  setCode(code: string): void;
  placePicked(place: Place): boolean;
  reject(key: string, reason?: Loc): void;
  resetLevel(): void;
  hint(): void;
  setHover(id: string | null): void;
  set(p: Partial<State>): void;
}

const initial: State = {
  level: null, tree: null, code: '', pick: null, phase: 'play', verdict: null, trace: null, runs: 0, failedRuns: 0,
  hintLevel: 0, hintsUsed: 0, glow: null, step: -1, execId: null, hoverId: null, snapId: null, shake: null, msg: { kind: 'story' }, startedAt: Date.now(), runId: 0,
};

/** Copies of a palette item already in the tree (for count-limited palettes). */
export function usedCount(item: PaletteItem, tree: Block | null): number {
  if (!tree) return 0;
  let n = 0;
  walk(tree, (b) => {
    if (b.type !== item.type || b.locked) return;
    const f = item.fields ?? {};
    if (['tag', 'prop', 'fn', 'op'].every((k) => !(k in f) || f[k] === b.fields[k]) && (!item.fixed || b.fields.text === f.text)) n++;
  });
  return n;
}

export function blockFromPalette(item: PaletteItem): Block {
  const slots: Record<string, Block[]> = {};
  for (const [k, v] of Object.entries(item.slots ?? {})) slots[k] = v.map(cloneFresh);
  return makeBlock(item.type, { ...(item.fields ?? {}) }, slots, item.fixed ? { fixed: true } : {});
}

let shakeTimer: ReturnType<typeof setTimeout> | undefined;
let snapTimer: ReturnType<typeof setTimeout> | undefined;

export const useLevel = create<State & Actions>()(
  temporal(
    (set, get) => {
      /** After any edit: leave error/fail/step states, as the design does. */
      const edited = (tree: Block, extra: Partial<State> = {}) => {
        const p = get().phase;
        const reset = p === 'fail' || p === 'error' || p === 'stepping' ? { phase: 'play' as Phase, step: -1, execId: null, verdict: null } : {};
        set({ tree, pick: null, glow: null, ...reset, ...extra });
      };
      const snapped = (id: string) => {
        sfx.snap();
        clearTimeout(snapTimer);
        snapTimer = setTimeout(() => set({ snapId: null }), 700);
        return { snapId: id, msg: { kind: 'nice' } as BitMsg };
      };

      return {
        ...initial,
        load(level, saved) {
          set({
            ...initial,
            level,
            tree: saved?.tree ?? (level.initial ? structuredClone(level.initial) : null),
            code: saved?.code ?? level.initialCode ?? '',
            startedAt: Date.now(),
          });
          useLevel.temporal.getState().clear();
        },
        setPick(p) {
          if (p) sfx.pick();
          set({ pick: p });
        },
        placeFromPalette(index, place) {
          const { level, tree } = get();
          if (!level || !tree) return false;
          const item = level.palette[index];
          if (item.count !== undefined && usedCount(item, tree) >= item.count) {
            get().reject(`pal:${index}`, { ar: 'استخدمت كل نسخ هذي الكتلة', en: 'You used every copy of this block' });
            return false;
          }
          const b = blockFromPalette(item);
          const r = insert(tree, b, place);
          if (!r.ok) {
            get().reject(`${place.parentId}:${place.slot}:${place.index}`, r.reason);
            return false;
          }
          edited(r.tree, snapped(b.id));
          return true;
        },
        moveBlock(id, place) {
          const { tree } = get();
          if (!tree) return false;
          const r = move(tree, id, place);
          if (!r.ok) {
            get().reject(`${place.parentId}:${place.slot}:${place.index}`, r.reason);
            return false;
          }
          if (r.tree !== tree) edited(r.tree, snapped(id));
          else set({ pick: null });
          return true;
        },
        removeBlock(id) {
          const { tree } = get();
          if (!tree) return;
          const r = remove(tree, id);
          if (!r.ok) return get().reject(`blk:${id}`, r.reason);
          sfx.remove();
          edited(r.tree);
        },
        setField(id, field, v) {
          const { tree } = get();
          if (!tree || !find(tree, id)) return;
          edited(setField(tree, id, field, v));
        },
        setCode(code) {
          const p = get().phase;
          set({ code, ...(p === 'fail' || p === 'error' ? { phase: 'play' as Phase, verdict: null } : {}) });
        },
        placePicked(place) {
          const pk = get().pick;
          if (!pk) return false;
          return pk.kind === 'palette' ? get().placeFromPalette(pk.index, place) : get().moveBlock(pk.id, place);
        },
        reject(key, reason) {
          sfx.bad();
          clearTimeout(shakeTimer);
          shakeTimer = setTimeout(() => set({ shake: null }), 480);
          set({ shake: key, ...(reason ? { msg: { kind: 'text', text: reason, tone: 'error' } } : {}) });
        },
        resetLevel() {
          const { level } = get();
          if (!level) return;
          set({
            tree: level.initial ? structuredClone(level.initial) : null,
            code: level.initialCode ?? '',
            pick: null, phase: 'play', verdict: null, trace: null, step: -1, glow: null, msg: { kind: 'story' },
          });
        },
        hint() {
          const { level, tree, hintLevel } = get();
          if (!level) return;
          const next = Math.min(3, hintLevel + 1);
          const used = { hintLevel: next, hintsUsed: get().hintsUsed + 1 };
          const textHint = (i: number) => level.hints[Math.min(i, level.hints.length - 1)];
          if (level.mode === 'code' || !tree || !level.solution) {
            set({ ...used, msg: { kind: 'text', text: textHint(next - 1), tone: 'hint' } });
            return;
          }
          if (next === 1) {
            set({ ...used, msg: { kind: 'text', text: textHint(0), tone: 'hint' } });
          } else if (next === 2) {
            const g = glowTarget(level.solution, tree, level.palette);
            set({ ...used, glow: g, msg: { kind: 'text', text: g ? { ar: 'شوف الكتلة اللي تتوهج — هي اللي تحتاجها الآن.', en: 'See the glowing block — that’s the one you need now.' } : { ar: 'كل الكتل في مكانها — جرّب تشغيل!', en: 'Every block is in place — try Run!' }, tone: 'hint' } });
          } else {
            const r = applyOneStep(level.solution, tree);
            if (!r) {
              set({ ...used, msg: { kind: 'text', text: { ar: 'كل الكتل في مكانها — جرّب تشغيل!', en: 'Every block is in place — try Run!' }, tone: 'hint' } });
              return;
            }
            edited(r.tree, { ...used, ...snapped(r.placedId), msg: { kind: 'text', text: { ar: 'ركّبت لك كتلة من الحل. كمّل الباقي!', en: 'I placed one block from the solution for you. Finish the rest!' }, tone: 'hint' } });
            // keep level 3 available for the next click
            set({ hintLevel: 2 });
          }
        },
        setHover(id) {
          if (get().hoverId !== id) set({ hoverId: id });
        },
        set(p) {
          set(p);
        },
      };
    },
    {
      partialize: (s) => ({ tree: s.tree }),
      equality: (a, b) => a.tree === b.tree,
      limit: 100,
    },
  ),
);

export const undo = () => {
  useLevel.temporal.getState().undo();
  useLevel.setState({ pick: null, glow: null });
};
export const redo = () => {
  useLevel.temporal.getState().redo();
  useLevel.setState({ pick: null, glow: null });
};
