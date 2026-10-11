/**
 * The build area. Every block is real code; fields are inline inputs, holes take
 * other blocks. Drop spots (gaps) light up when the held block fits there — the same
 * spots work for dragging, tap-then-place and the keyboard.
 */
import { memo, useContext, useMemo, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { motion } from 'motion/react';
import { spring } from '../ui/motion';
import { BLOCKS, type FieldDef, type Part } from '../engine/blocks';
import { canPlace, find } from '../engine/tree';
import { sanitizeField } from '../engine/sanitize';
import type { Block, Place } from '../engine/types';
import { useLevel } from '../state/level';
import { useProgress } from '../state/progress';
import { useT } from '../i18n';
import { Icon } from '../components/Icon';
import { gapId, useHolding, LinesCtx } from './dnd';

export const catClass: Record<string, string> = { html: 'blk-html', css: 'blk-css', js: 'blk-js', bot: 'blk-bot', val: 'blk-val', root: 'blk-html' };

let lastDragEnd = 0;
export const markDragEnd = () => {
  lastDragEnd = Date.now();
};

/* ---------------- drop spots ---------------- */

function useFits(place: Place) {
  const holding = useHolding();
  const tree = useLevel((s) => s.tree);
  return useMemo(() => {
    if (!holding || !tree) return false;
    return canPlace(tree, { type: holding.type, id: holding.id ?? '__new__' }, place).ok;
  }, [holding, tree, place]);
}

export const DropGap = memo(function DropGap({ place, empty, dark }: { place: Place; empty: boolean; dark?: boolean }) {
  const { t } = useT();
  const holding = useHolding();
  const fits = useFits(place);
  const id = gapId(place);
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !fits });
  const shake = useLevel((s) => s.shake === `${place.parentId}:${place.slot}:${place.index}`);
  const placePicked = useLevel((s) => s.placePicked);
  const lit = !!holding && fits;
  if (!lit && !empty) {
    return <div ref={setNodeRef} className="drop-gap" data-gap={id} aria-hidden="true" />;
  }
  const label = lit ? t('placeHere') : t('dropHere');
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-gap={id}
      className={`drop-line ${dark ? 'dark' : ''} ${lit ? 'is-target' : holding ? 'is-dim' : ''} ${isOver ? 'over' : ''} ${shake ? 'shake' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        if (holding?.via === 'pick') placePicked(place);
        else useLevel.getState().set({ msg: { kind: 'text', text: { ar: 'اضغط كتلة من اللوحة أولاً، ثم اضغط هنا.', en: 'Tap a block in the palette first, then tap here.' }, tone: 'hint' } });
      }}
      aria-label={label}
    >
      <Icon name="plus" size={16} stroke={2.6} />
      {label}
    </button>
  );
});

function Hole({ parent, slot, accepts }: { parent: Block; slot: string; accepts: string }) {
  const { t } = useT();
  const child = parent.slots[slot]?.[0];
  const place = useMemo(() => ({ parentId: parent.id, slot, index: 0 }), [parent.id, slot]);
  const holding = useHolding();
  const fits = useFits(place);
  const { setNodeRef, isOver } = useDroppable({ id: gapId(place), disabled: !fits || !!child });
  const shake = useLevel((s) => s.shake === `${parent.id}:${slot}:0`);
  const placePicked = useLevel((s) => s.placePicked);
  if (child) return <BlockView block={child} inline />;
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-gap={gapId(place)}
      className={`slot ${holding ? (fits ? 'is-target' : 'is-dim') : ''} ${isOver ? 'over' : ''} ${shake ? 'shake' : ''}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (holding?.via === 'pick') placePicked(place);
      }}
      aria-label={`${t('emptyHole')} (${accepts})`}
    />
  );
}

/* ---------------- fields ---------------- */

function FieldInput({ block, def }: { block: Block; def: FieldDef }) {
  const { tl } = useT();
  const setField = useLevel((s) => s.setField);
  const value = block.fields[def.name];
  const str = value === undefined ? '' : String(value);
  const fixedType = def.type === 'tag' || def.type === 'prop';
  if (block.fixed || fixedType || (block.locked && def.name !== 'title')) {
    return def.type === 'text' || def.type === 'string' ? <bdi dir="auto">{str}</bdi> : <span>{str}</span>;
  }
  const check = str === '' ? null : sanitizeField(def.type, str, { prop: String(block.fields.prop ?? ''), options: def.options, min: def.min, max: def.max, scope: { vars: [], funcs: [] } });
  // typed expressions are validated with the real scope at run time; don't show them red here
  const bad = check && !check.ok && def.type !== 'expr' ? check : null;
  const stop = (e: { stopPropagation(): void }) => e.stopPropagation();
  if (def.options) {
    return (
      <select className="fld" value={str} onChange={(e) => setField(block.id, def.name, e.target.value)} onPointerDown={stop} onKeyDown={stop} aria-label={def.name}>
        {def.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  const isText = def.type === 'text' || def.type === 'string';
  return (
    <input
      className={`fld ${isText ? 'iso' : ''} ${bad ? 'bad' : ''}`}
      dir={isText ? 'auto' : 'ltr'}
      value={str}
      placeholder={def.hint}
      size={Math.max(3, Math.min(28, (str || def.hint || '').length + 1))}
      spellCheck={false}
      autoComplete="off"
      inputMode={def.type === 'number' ? 'decimal' : undefined}
      onChange={(e) => setField(block.id, def.name, def.type === 'number' && e.target.value !== '' && !isNaN(Number(e.target.value)) ? Number(e.target.value) : e.target.value)}
      onPointerDown={stop}
      onKeyDown={stop}
      onClick={stop}
      aria-label={def.hint ?? def.name}
      aria-invalid={bad ? true : undefined}
      title={bad && !bad.ok ? tl(bad.reason) : undefined}
    />
  );
}

/* ---------------- blocks ---------------- */

function Parts({ block, parts }: { block: Block; parts: Part[] }) {
  const d = BLOCKS[block.type];
  return (
    <>
      {parts.map((p, i) => {
        if (typeof p === 'string') return <span key={i} className="tx">{p}</span>;
        if ('field' in p) {
          const fd = d.fields.find((f) => f.name === p.field)!;
          return <FieldInput key={i} block={block} def={fd} />;
        }
        const sd = d.slots.find((s) => s.name === p.slot)!;
        return <Hole key={i} parent={block} slot={p.slot} accepts={sd.accepts} />;
      })}
    </>
  );
}

function useBlockClass(id: string) {
  return useLevel((s) => {
    const c: string[] = [];
    if (s.hoverId === id) c.push('is-hover');
    if (s.snapId === id) c.push('is-snap');
    if (s.glow?.blockId === id || s.execId === id) c.push('is-exec');
    if (s.pick?.kind === 'block' && s.pick.id === id) c.push('is-selected');
    if (s.shake === `blk:${id}`) c.push('shake');
    if ((s.phase === 'error' || s.phase === 'fail') && s.verdict?.problem?.blockId === id) c.push('is-error');
    return c.join(' ');
  });
}

export const BlockView = memo(function BlockView({ block, inline = false }: { block: Block; inline?: boolean }) {
  const { tl, t } = useT();
  const d = BLOCKS[block.type];
  const captions = useProgress((s) => s.settings.captions);
  const lines = useContext(LinesCtx);
  const cls = useBlockClass(block.id);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `blk|${block.id}`,
    data: { kind: 'block', id: block.id, type: block.type },
    disabled: !!block.locked,
  });
  const { setPick, removeBlock, setHover } = useLevel.getState();

  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (Date.now() - lastDragEnd < 200 || block.locked) return;
    const pk = useLevel.getState().pick;
    setPick(pk?.kind === 'block' && pk.id === block.id ? null : { kind: 'block', id: block.id });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e as unknown as MouseEvent);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && !block.locked) {
      e.preventDefault();
      removeBlock(block.id);
    }
  };
  const hover = {
    onMouseEnter: () => setHover(block.id),
    onMouseLeave: () => setHover(null),
  };
  const cat = catClass[d.cat];
  const label = `${tl(d.caption(block))}`;
  const removeBtn = !block.locked && (
    <button type="button" className="rm-x" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }} aria-label={t('removeBlk')}>
      <Icon name="x" size={11} stroke={4} />
    </button>
  );
  const dragProps = block.locked ? {} : { ...listeners, ...attributes, role: 'button', tabIndex: 0, 'aria-roledescription': 'block' };
  const ln = lines[block.id]?.from;

  if (d.body) {
    const slot = d.slots.find((s) => s.name === d.body)!;
    return (
      <div className="blk-wrap" style={{ alignItems: 'stretch' }}>
        <div
          ref={setNodeRef}
          className={`blk-c ${cat} ${cls} ${isDragging ? 'is-dragging' : ''}`}
          data-block={block.id}
          {...hover}
        >
          <div
            className="ch"
            style={{ borderRadius: '14px 14px 0 0', background: `var(--c-${d.cat === 'bot' ? 'bot' : d.cat})`, cursor: block.locked ? 'default' : 'grab' }}
            {...dragProps}
            onClick={onClick}
            onKeyDown={onKey}
            aria-label={label}
          >
            {ln !== undefined && <span className="sr-only">{ln}</span>}
            <Parts block={block} parts={d.head(block)} />
            {removeBtn}
          </div>
          <ListSlot parent={block} slot={slot.name} />
          <div className="cf" style={{ background: `var(--c-${d.cat === 'bot' ? 'bot' : d.cat})` }}>
            <Parts block={block} parts={d.foot!(block)} />
          </div>
        </div>
        {captions && <span className="blk-cap">{label}</span>}
      </div>
    );
  }

  const isChip = d.cat === 'val';
  const body = (
    <div
      ref={setNodeRef}
      className={`blk ${cat} ${isChip && inline ? 'vchip' : ''} ${cls} ${isDragging ? 'is-dragging' : ''}`}
      data-block={block.id}
      {...dragProps}
      onClick={onClick}
      onKeyDown={onKey}
      aria-label={label}
      {...hover}
      style={isChip && inline ? { minHeight: 32, padding: '2px 8px', fontSize: 14 } : undefined}
    >
      {block.type === 'text' && <span className="q">"</span>}
      <Parts block={block} parts={d.head(block)} />
      {block.type === 'text' && <span className="q">"</span>}
      {removeBtn}
      {cls.includes('is-snap') && (
        <span className="sparks" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => <i key={i} />)}
        </span>
      )}
    </div>
  );
  if (inline) return body;
  return (
    <div className="blk-wrap">
      {body}
      {captions && <span className="blk-cap">{label}</span>}
    </div>
  );
});

/** A list slot: gap, block, gap, block, …, gap. */
export function ListSlot({ parent, slot, dark, children }: { parent: Block; slot: string; dark?: boolean; children?: ReactNode }) {
  const kids = parent.slots[slot] ?? [];
  const lines = useContext(LinesCtx);
  return (
    <div className="cb" style={{ gap: 0 }}>
      {children}
      {kids.map((k, i) => (
        <div key={k.id} style={{ display: 'contents' }}>
          <DropGap place={{ parentId: parent.id, slot, index: i }} empty={false} dark={dark} />
          <motion.div layout="position" transition={spring.layout} className="ws-line" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="lnum" aria-hidden="true">{lines[k.id]?.from ?? ''}</span>
            <BlockView block={k} />
          </motion.div>
        </div>
      ))}
      <DropGap place={{ parentId: parent.id, slot, index: kids.length }} empty={kids.length === 0} dark={dark} />
    </div>
  );
}

/* ---------------- roots ---------------- */

function LockedContainer({ open, close, caption, color, children }: { open: string; close: string; caption: string; color: string; children: ReactNode }) {
  return (
    <div className="blk-c blk-html" style={{ minWidth: 'min(520px, 100%)', alignSelf: 'stretch' }}>
      <div className="ch is-locked" style={{ borderRadius: '14px 14px 0 0', backgroundColor: color }}>
        <span className="lock-badge" aria-hidden="true">
          <Icon name="lock" size={12} stroke={3} style={{ color: '#fff' }} />
        </span>
        <span>{open}</span>
        <span className="iso" style={{ fontFamily: 'var(--f-body)', fontSize: 13, fontWeight: 700, opacity: 0.85, marginInlineStart: 'auto' }}>
          {caption}
        </span>
      </div>
      {children}
      <div className="cf is-locked" style={{ backgroundColor: color }}>
        {close}
      </div>
    </div>
  );
}

export function RootView({ root }: { root: Block }) {
  const { t } = useT();
  const lines = useContext(LinesCtx);
  if (root.type !== 'root.page') {
    return (
      <div className="blk-c blk-js dark" style={{ alignSelf: 'stretch', boxShadow: 'none', minWidth: 0 }}>
        <ListSlot parent={root} slot="main" />
      </div>
    );
  }
  const titleDef = BLOCKS['root.page'].fields[0];
  return (
    <>
      <div className="ws-line" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="lnum" aria-hidden="true">{lines[root.id]?.from ?? ''}</span>
        <div className="blk-wrap">
          <div className="blk blk-html is-locked" style={{ cursor: 'default' }}>
            <span className="lock-badge" aria-hidden="true">
              <Icon name="lock" size={12} stroke={3} style={{ color: '#fff' }} />
            </span>
            <span>&lt;title&gt;</span>
            <FieldInput block={{ ...root, locked: false }} def={titleDef} />
            <span>&lt;/title&gt;</span>
          </div>
          <span className="blk-cap">{t('titleCap')}</span>
        </div>
      </div>
      {root.slots.style && (
        <LockedContainer open="<style>" close="</style>" caption={t('styleCap')} color="#1A7F53">
          <ListSlot parent={root} slot="style" />
        </LockedContainer>
      )}
      <LockedContainer open="<body>" close="</body>" caption={t('bodyCap')} color="#C24E2B">
        <ListSlot parent={root} slot="body" />
      </LockedContainer>
      {root.slots.script && (
        <LockedContainer open="<script>" close="</script>" caption={t('scriptCap')} color="#6A3FD6">
          <ListSlot parent={root} slot="script" />
        </LockedContainer>
      )}
    </>
  );
}

export function blockExists(tree: Block | null, id: string) {
  return !!tree && !!find(tree, id);
}
