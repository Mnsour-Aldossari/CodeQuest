/** Small builders so level files read like the code they teach. */
import type { Block, FieldVal, PaletteItem } from '../engine/types';

let n = 0;
const id = (p: string) => `${p}${(++n).toString(36)}`;

export function blk(type: string, fields: Record<string, FieldVal> = {}, slots: Record<string, Block[]> = {}, extra: Partial<Block> = {}): Block {
  return { id: id('L'), type, fields, slots, ...extra };
}

/** a text chip (fixed = came from the level, not editable) */
export const txt = (text: string, fixed = true): Block => blk('text', { text }, {}, fixed ? { fixed: true } : {});
export const el = (tag: string, text?: string | Block): Block =>
  blk('html.el', { tag }, { content: text === undefined ? [] : [typeof text === 'string' ? txt(text) : text] });
export const li = (text?: string): Block => blk('html.li', {}, { content: text === undefined ? [] : [txt(text)] });
export const list = (tag: 'ul' | 'ol', items: Block[]): Block => blk('html.list', { tag }, { items });
export const box = (tag: string, children: Block[], fields: Record<string, FieldVal> = {}): Block => blk('html.box', { tag, ...fields }, { children });
export const img = (src: string, alt: string): Block => blk('html.img', { src, alt });
export const link = (href: string, text?: Block): Block => blk('html.a', { href }, { content: text ? [text] : [] });

export function page(title: string, body: Block[], more: { style?: Block[]; script?: Block[] } = {}): Block {
  return { id: 'root', type: 'root.page', locked: true, fields: { title }, slots: { ...(more.style ? { style: more.style } : {}), body, ...(more.script ? { script: more.script } : {}) } };
}

export const P = {
  el: (tag: string, count?: number): PaletteItem => ({ type: 'html.el', fields: { tag }, ...(count ? { count } : {}) }),
  text: (text: string, count?: number): PaletteItem => ({ type: 'text', fields: { text }, fixed: true, ...(count ? { count } : {}) }),
  li: (count?: number): PaletteItem => ({ type: 'html.li', ...(count ? { count } : {}) }),
  list: (tag: 'ul' | 'ol', count?: number): PaletteItem => ({ type: 'html.list', fields: { tag }, ...(count ? { count } : {}) }),
  img: (src: string, alt: string, count?: number): PaletteItem => ({ type: 'html.img', fields: { src, alt }, ...(count ? { count } : {}) }),
  link: (href: string, count?: number): PaletteItem => ({ type: 'html.a', fields: { href }, ...(count ? { count } : {}) }),
};
