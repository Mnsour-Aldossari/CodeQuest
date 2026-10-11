import { describe, expect, it } from 'vitest';
import { canPlace, countBlocks, find, insert, locate, makeBlock, move, remove } from './tree';
import type { Block } from './types';

function page(): Block {
  return { ...makeBlock('root.page', { title: 'x' }, { body: [] }), id: 'root', locked: true };
}

function ok(r: ReturnType<typeof insert>): Block {
  if (!r.ok) throw new Error(r.reason.en);
  return r.tree;
}

describe('tree ops', () => {
  it('inserts an h1 into a div (the M0 gate) and keeps the original tree untouched', () => {
    const root = page();
    const div = { ...makeBlock('html.box', { tag: 'div' }), id: 'div' };
    const h1 = { ...makeBlock('html.el', { tag: 'h1' }), id: 'h1' };
    const t1 = ok(insert(root, div, { parentId: 'root', slot: 'body', index: 0 }));
    const t2 = ok(insert(t1, h1, { parentId: 'div', slot: 'children', index: 0 }));
    expect(find(t2, 'div')!.slots.children.map((b) => b.id)).toEqual(['h1']);
    expect(root.slots.body).toHaveLength(0);
    expect(t1.slots.body[0].slots.children).toHaveLength(0);
  });

  it('moves a block out of a container and reorders within a list', () => {
    let t = page();
    const a = { ...makeBlock('html.el', { tag: 'h1' }), id: 'a' };
    const b = { ...makeBlock('html.el', { tag: 'p' }), id: 'b' };
    const c = { ...makeBlock('html.el', { tag: 'p' }), id: 'c' };
    for (const [i, x] of [a, b, c].entries()) t = ok(insert(t, x, { parentId: 'root', slot: 'body', index: i }));
    t = ok(move(t, 'a', { parentId: 'root', slot: 'body', index: 3 })); // to the end
    expect(t.slots.body.map((x) => x.id)).toEqual(['b', 'c', 'a']);
    t = ok(move(t, 'a', { parentId: 'root', slot: 'body', index: 0 }));
    expect(t.slots.body.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    t = ok(move(t, 'a', { parentId: 'root', slot: 'body', index: 1 })); // same spot → no-op
    expect(t.slots.body.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('rejects wrong slot kinds, full single slots, locks and cycles', () => {
    let t = page();
    const div = { ...makeBlock('html.box', { tag: 'div' }), id: 'div' };
    const inner = { ...makeBlock('html.box', { tag: 'div' }), id: 'inner' };
    const h1 = { ...makeBlock('html.el', { tag: 'h1' }), id: 'h1' };
    t = ok(insert(t, div, { parentId: 'root', slot: 'body', index: 0 }));
    t = ok(insert(t, inner, { parentId: 'div', slot: 'children', index: 0 }));
    t = ok(insert(t, h1, { parentId: 'root', slot: 'body', index: 1 }));

    // text chip can't go into the body; h1 can't go into an h1's text hole
    expect(insert(t, makeBlock('text', { text: 'hi' }), { parentId: 'root', slot: 'body', index: 0 }).ok).toBe(false);
    expect(insert(t, makeBlock('html.el', { tag: 'p' }), { parentId: 'h1', slot: 'content', index: 0 }).ok).toBe(false);
    // single hole capacity
    t = ok(insert(t, makeBlock('text', { text: 'one' }), { parentId: 'h1', slot: 'content', index: 0 }));
    expect(insert(t, makeBlock('text', { text: 'two' }), { parentId: 'h1', slot: 'content', index: 0 }).ok).toBe(false);
    // a block can't go inside itself or its descendants
    expect(move(t, 'div', { parentId: 'inner', slot: 'children', index: 0 }).ok).toBe(false);
    expect(canPlace(t, find(t, 'div')!, { parentId: 'div', slot: 'children', index: 0 }).ok).toBe(false);
    // locked root can't be removed
    expect(remove(t, 'root').ok).toBe(false);
  });

  it('removes a block with its children and counts placed blocks', () => {
    let t = page();
    const div = { ...makeBlock('html.box', { tag: 'div' }), id: 'div' };
    t = ok(insert(t, div, { parentId: 'root', slot: 'body', index: 0 }));
    t = ok(insert(t, makeBlock('html.el', { tag: 'h1' }), { parentId: 'div', slot: 'children', index: 0 }));
    expect(countBlocks(t)).toBe(2);
    const r = remove(t, 'div');
    expect(r.ok && r.tree.slots.body.length).toBe(0);
    expect(locate(t, 'div')).toEqual({ parentId: 'root', slot: 'body', index: 0 });
  });
});
