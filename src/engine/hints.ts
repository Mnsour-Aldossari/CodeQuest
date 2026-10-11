/**
 * Hint levels 2 and 3 compare the player's tree with the reference solution:
 * find the first place where they differ, glow the block that belongs there (2),
 * or put it there (3).
 */
import { slotDef } from './blocks';
import { cloneFresh, find, insert, locate, move, remove, setField, walk } from './tree';
import type { Block, PaletteItem } from './types';

const KEY_FIELDS = ['tag', 'prop', 'text', 'fn', 'op', 'selector'];

function sameKind(a: Block, b: Block): boolean {
  if (a.type !== b.type) return false;
  return KEY_FIELDS.every((k) => (k in b.fields ? a.fields[k] === b.fields[k] : true));
}

function fieldsMatch(a: Block, b: Block): boolean {
  return Object.entries(b.fields).every(([k, v]) => String(a.fields[k] ?? '').trim() === String(v).trim());
}

export type Gap =
  | { kind: 'missing'; want: Block; parentId: string; slot: string; index: number; wrong?: Block }
  | { kind: 'field'; blockId: string; field: string; value: string | number | boolean };

/** First difference between the player's tree and the solution (pre-order). */
export function firstGap(solution: Block, tree: Block): Gap | null {
  for (const [slot, want] of Object.entries(solution.slots)) {
    const have = tree.slots[slot] ?? [];
    for (let i = 0; i < want.length; i++) {
      const w = want[i];
      const h = have[i];
      if (!h || !sameKind(h, w)) return { kind: 'missing', want: w, parentId: tree.id, slot, index: i, wrong: h };
      if (!h.fixed && !fieldsMatch(h, w)) {
        const f = Object.keys(w.fields).find((k) => String(h.fields[k] ?? '').trim() !== String(w.fields[k]).trim())!;
        return { kind: 'field', blockId: h.id, field: f, value: w.fields[f] };
      }
      const deeper = firstGap(w, h);
      if (deeper) return deeper;
    }
    if (have.length > want.length) {
      const extra = have[want.length];
      return { kind: 'missing', want: extra, parentId: tree.id, slot, index: want.length, wrong: extra };
    }
  }
  if (!solution.fixed) {
    for (const [k, v] of Object.entries(solution.fields)) {
      if (tree.type.startsWith('root.')) continue;
      if (String(tree.fields[k] ?? '').trim() !== String(v).trim()) return { kind: 'field', blockId: tree.id, field: k, value: v };
    }
  }
  return null;
}

/** Which palette item makes this block (for the glow). */
export function paletteIndexFor(palette: PaletteItem[], b: Block): number {
  return palette.findIndex((p) => p.type === b.type && KEY_FIELDS.every((k) => (p.fields && k in p.fields ? p.fields[k] === b.fields[k] : true)));
}

/** A block already in the tree (not in place) that could fill the gap — for reordering levels. */
function findReusable(tree: Block, want: Block, avoidParent: string, avoidIndex: number): Block | null {
  let hit: Block | null = null;
  walk(tree, (b) => {
    if (hit || !sameKind(b, want) || b.locked) return;
    const at = locate(tree, b.id);
    if (at && !(at.parentId === avoidParent && at.index === avoidIndex)) hit = b;
  });
  return hit;
}

export interface HintTarget {
  paletteIndex?: number;
  blockId?: string;
}

export function glowTarget(solution: Block, tree: Block, palette: PaletteItem[]): HintTarget | null {
  const g = firstGap(solution, tree);
  if (!g) return null;
  if (g.kind === 'field') return { blockId: g.blockId };
  const reuse = findReusable(tree, g.want, g.parentId, g.index);
  if (reuse) return { blockId: reuse.id };
  const pi = paletteIndexFor(palette, g.want);
  return pi >= 0 ? { paletteIndex: pi } : g.wrong ? { blockId: g.wrong.id } : null;
}

/** Hint 3: make one step toward the solution. Returns the new tree (or null if solved). */
export function applyOneStep(solution: Block, tree: Block): { tree: Block; placedId: string } | null {
  const g = firstGap(solution, tree);
  if (!g) return null;
  if (g.kind === 'field') return { tree: setField(tree, g.blockId, g.field, g.value), placedId: g.blockId };
  const reuse = findReusable(tree, g.want, g.parentId, g.index);
  if (reuse && find(tree, reuse.id)) {
    const r = move(tree, reuse.id, { parentId: g.parentId, slot: g.slot, index: g.index });
    if (r.ok) return { tree: r.tree, placedId: reuse.id };
  }
  let t = tree;
  if (g.wrong && g.wrong === g.want) {
    // an extra block the solution doesn't have
    const r = remove(t, g.wrong.id);
    return r.ok ? { tree: r.tree, placedId: g.parentId } : null;
  }
  const parent = find(t, g.parentId);
  if (g.wrong && parent && !slotDef(parent.type, g.slot)?.multiple) {
    const r = remove(t, g.wrong.id); // a single hole holds one block: swap it
    if (r.ok) t = r.tree;
  }
  const fresh = cloneFresh(g.want);
  const r = insert(t, fresh, { parentId: g.parentId, slot: g.slot, index: g.index });
  return r.ok ? { tree: r.tree, placedId: fresh.id } : null;
}
