/**
 * The block tree has exactly three structural operations — insert, move, remove.
 * Dragging, tap-then-place and the keyboard all go through them, so validation
 * (slot kind, capacity, locks, cycles) lives in one place. Trees are immutable.
 */
import { BLOCKS, slotDef } from './blocks';
import type { Block, FieldVal, Loc, Place } from './types';

export type OpResult = { ok: true; tree: Block } | { ok: false; reason: Loc };

let seq = 0;
export function newId(prefix = 'b'): string {
  seq = (seq + 1) % 1e6;
  return `${prefix}${Date.now().toString(36).slice(-4)}${seq.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export function makeBlock(type: string, fields: Record<string, FieldVal> = {}, slots: Record<string, Block[]> = {}, extra: Partial<Block> = {}): Block {
  const d = BLOCKS[type];
  const allSlots: Record<string, Block[]> = {};
  for (const sd of d?.slots ?? []) if (type.startsWith('root.') ? sd.name in slots : true) allSlots[sd.name] = [];
  return { id: newId(), type, fields: { ...fields }, slots: { ...allSlots, ...slots }, ...extra };
}

/** Deep copy with fresh ids (used when a palette preset or a hint block is placed). */
export function cloneFresh(b: Block): Block {
  const slots: Record<string, Block[]> = {};
  for (const [k, v] of Object.entries(b.slots)) slots[k] = v.map(cloneFresh);
  return { ...b, id: newId(), fields: { ...b.fields }, slots };
}

export function walk(b: Block, fn: (b: Block, parent: Block | null, slot: string | null, depth: number) => void, parent: Block | null = null, slot: string | null = null, depth = 0) {
  fn(b, parent, slot, depth);
  for (const [k, kids] of Object.entries(b.slots)) for (const c of kids) walk(c, fn, b, k, depth + 1);
}

export function find(root: Block, id: string): Block | null {
  if (root.id === id) return root;
  for (const kids of Object.values(root.slots)) {
    for (const c of kids) {
      const r = find(c, id);
      if (r) return r;
    }
  }
  return null;
}

export function locate(root: Block, id: string): Place | null {
  for (const [slot, kids] of Object.entries(root.slots)) {
    const index = kids.findIndex((k) => k.id === id);
    if (index >= 0) return { parentId: root.id, slot, index };
    for (const c of kids) {
      const r = locate(c, id);
      if (r) return r;
    }
  }
  return null;
}

/** Blocks the player placed (root and locked scaffolding don't count toward stars). */
export function countBlocks(root: Block): number {
  let n = 0;
  walk(root, (b) => {
    if (!b.type.startsWith('root.') && !b.locked) n++;
  });
  return n;
}

function mapBlock(root: Block, id: string, fn: (b: Block) => Block): Block {
  if (root.id === id) return fn(root);
  let changed = false;
  const slots: Record<string, Block[]> = {};
  for (const [k, kids] of Object.entries(root.slots)) {
    slots[k] = kids.map((c) => {
      const n = mapBlock(c, id, fn);
      if (n !== c) changed = true;
      return n;
    });
  }
  return changed ? { ...root, slots } : root;
}

const R = {
  noParent: { ar: 'ما لقيت المكان', en: 'That spot doesn’t exist' },
  noSlot: { ar: 'هذا المكان ما يقبل كتل', en: 'Nothing can go there' },
  kind: { ar: 'هذي الكتلة ما تركب هنا', en: 'That block doesn’t fit here' },
  full: { ar: 'هذا الفراغ فيه كتلة — شيلها أول', en: 'That hole is taken — remove the block first' },
  locked: { ar: 'هذي الكتلة مقفلة', en: 'That block is locked' },
  cycle: { ar: 'ما تقدر تحط الكتلة داخل نفسها', en: 'A block can’t go inside itself' },
  missing: { ar: 'الكتلة مو موجودة', en: 'That block isn’t there' },
};

/** Can `block` go at `place`? Pure check shared by drag highlighting and the ops. */
export function canPlace(root: Block, block: Pick<Block, 'type' | 'id'>, place: Place): { ok: true } | { ok: false; reason: Loc } {
  const parent = find(root, place.parentId);
  if (!parent) return { ok: false, reason: R.noParent };
  const sd = slotDef(parent.type, place.slot);
  if (!sd || !(place.slot in parent.slots)) return { ok: false, reason: R.noSlot };
  const bd = BLOCKS[block.type];
  if (!bd || !bd.fits.includes(sd.accepts)) return { ok: false, reason: R.kind };
  const kids = parent.slots[place.slot];
  const others = kids.filter((k) => k.id !== block.id);
  if (!sd.multiple && others.length > 0) return { ok: false, reason: R.full };
  if (place.index < 0 || place.index > kids.length) return { ok: false, reason: R.noSlot };
  if (block.id === place.parentId || (find(root, block.id) && find(find(root, block.id)!, place.parentId))) return { ok: false, reason: R.cycle };
  return { ok: true };
}

export function insert(root: Block, block: Block, place: Place): OpResult {
  const c = canPlace(root, block, place);
  if (!c.ok) return c;
  const tree = mapBlock(root, place.parentId, (p) => {
    const kids = p.slots[place.slot].slice();
    kids.splice(place.index, 0, block);
    return { ...p, slots: { ...p.slots, [place.slot]: kids } };
  });
  return { ok: true, tree };
}

export function remove(root: Block, id: string): OpResult {
  const b = find(root, id);
  const at = locate(root, id);
  if (!b || !at) return { ok: false, reason: R.missing };
  if (b.locked) return { ok: false, reason: R.locked };
  const tree = mapBlock(root, at.parentId, (p) => ({
    ...p,
    slots: { ...p.slots, [at.slot]: p.slots[at.slot].filter((k) => k.id !== id) },
  }));
  return { ok: true, tree };
}

/**
 * Move a placed block. `place.index` is the gap index in the target list as the
 * player sees it (before the block is lifted out).
 */
export function move(root: Block, id: string, place: Place): OpResult {
  const b = find(root, id);
  const from = locate(root, id);
  if (!b || !from) return { ok: false, reason: R.missing };
  if (b.locked) return { ok: false, reason: R.locked };
  const c = canPlace(root, b, place);
  if (!c.ok) return c;
  let index = place.index;
  if (from.parentId === place.parentId && from.slot === place.slot) {
    if (index === from.index || index === from.index + 1) return { ok: true, tree: root }; // no-op
    if (from.index < index) index -= 1;
  }
  const lifted = remove(root, id);
  if (!lifted.ok) return lifted;
  return insert(lifted.tree, b, { ...place, index });
}

/** Field edits are not structural; they are validated by the sanitizer at serialize time. */
export function setField(root: Block, id: string, field: string, value: FieldVal): Block {
  return mapBlock(root, id, (b) => ({ ...b, fields: { ...b.fields, [field]: value } }));
}
