/** The block palette. Tap a block to pick it (then tap a glowing spot), or drag it. */
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { BLOCKS, type Part } from '../engine/blocks';
import type { Block, Level, PaletteItem } from '../engine/types';
import { useLevel, usedCount, blockFromPalette } from '../state/level';
import { useProgress } from '../state/progress';
import { useT } from '../i18n';
import { catClass } from './Workspace';
import { PALETTE_DROP } from './dnd';

export function StaticBlock({ block }: { block: Block }) {
  const d = BLOCKS[block.type];
  const render = (parts: Part[]) =>
    parts.map((p, i) => {
      if (typeof p === 'string') return <span key={i} className="tx">{p}</span>;
      if ('field' in p) {
        const v = block.fields[p.field];
        const fd = d.fields.find((f) => f.name === p.field);
        return (
          <bdi key={i} dir={fd?.type === 'text' || fd?.type === 'string' ? 'auto' : 'ltr'}>
            {v === undefined || v === '' ? <span className="slot" style={{ minWidth: 30, height: 24 }} /> : String(v)}
          </bdi>
        );
      }
      const child = block.slots[p.slot]?.[0];
      return child ? <StaticBlock key={i} block={child} /> : <span key={i} className="slot" aria-hidden="true" style={{ minWidth: 40, height: 26 }} />;
    });
  return (
    <>
      {block.type === 'text' && <span className="q">"</span>}
      {render(d.head(block))}
      {d.body && <span style={{ opacity: 0.7 }}>…</span>}
      {d.foot && render(d.foot(block))}
      {block.type === 'text' && <span className="q">"</span>}
    </>
  );
}

function PaletteBlock({ item, index, onPicked }: { item: PaletteItem; index: number; onPicked?: () => void }) {
  const { tl, t } = useT();
  const preview = blockFromPalette(item);
  const d = BLOCKS[item.type];
  const captions = useProgress((s) => s.settings.captions);
  const left = useLevel((s) => (item.count === undefined ? Infinity : item.count - usedCount(item, s.tree)));
  const selected = useLevel((s) => s.pick?.kind === 'palette' && s.pick.index === index);
  const glow = useLevel((s) => s.glow?.paletteIndex === index);
  const shake = useLevel((s) => s.shake === `pal:${index}`);
  const empty = left <= 0;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `pal|${index}`, data: { kind: 'palette', index, type: item.type }, disabled: empty });
  const cap = tl(d.caption(preview));
  return (
    <div className="pal-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
      <button
        ref={setNodeRef}
        type="button"
        className={`blk ${catClass[d.cat]} ${selected ? 'is-selected' : ''} ${isDragging ? 'is-dragging' : ''} ${glow ? 'is-exec' : ''} ${empty ? 'is-dim' : ''} ${shake ? 'shake' : ''}`}
        {...listeners}
        {...attributes}
        role="button"
        aria-pressed={selected}
        aria-disabled={empty || undefined}
        aria-label={`${cap}${empty ? ` — ${t('tooManyBlocks')}` : ''}`}
        data-palette={index}
        onClick={() => {
          if (empty) return useLevel.getState().reject(`pal:${index}`, { ar: 'استخدمت كل نسخ هذي الكتلة', en: 'You used every copy of this block' });
          useLevel.getState().setPick(selected ? null : { kind: 'palette', index });
          if (!selected) onPicked?.();
        }}
      >
        <StaticBlock block={preview} />
        {item.count !== undefined && (
          <span className="ltr" style={{ marginInlineStart: 4, padding: '0 6px', borderRadius: 999, background: 'rgba(0,0,0,.2)', fontSize: 12 }}>
            ×{Math.max(0, left)}
          </span>
        )}
      </button>
      {captions && <span className="blk-cap">{cap}</span>}
    </div>
  );
}

export function Palette({ level, onPicked, layout = 'column' }: { level: Level; onPicked?: () => void; layout?: 'column' | 'wrap' }) {
  const { t, tl } = useT();
  const { setNodeRef, isOver } = useDroppable({ id: PALETTE_DROP });
  const groups: Array<{ title: string; items: Array<[PaletteItem, number]> }> = [];
  const main = level.palette.map((p, i) => [p, i] as [PaletteItem, number]).filter(([p]) => BLOCKS[p.type].cat !== 'val');
  const vals = level.palette.map((p, i) => [p, i] as [PaletteItem, number]).filter(([p]) => BLOCKS[p.type].cat === 'val');
  if (main.length) groups.push({ title: level.world === 'html' ? t('tags') : t('blocks'), items: main });
  if (vals.length) groups.push({ title: t('values'), items: vals });
  return (
    <div ref={setNodeRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: '100%', borderRadius: 14, outline: isOver ? '3px dashed var(--err)' : undefined }}>
      {groups.length === 0 && (
        <p style={{ fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          {level.mode === 'parsons'
            ? tl({ ar: 'كل الكتل موجودة في منطقة البناء — رتّبها بالسحب أو بالضغط على الكتلة ثم على المكان الجديد.', en: 'All the blocks are already in the workspace — reorder them by dragging, or tap a block then its new spot.' })
            : tl({ ar: 'ما فيه كتل جديدة هنا — عبّي الفراغات البيضاء في منطقة البناء.', en: 'No new blocks here — fill the white blanks in the workspace.' })}
        </p>
      )}
      {groups.map((g) => (
        <div key={g.title} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-3)' }}>{g.title}</span>
          <div style={{ display: 'flex', flexDirection: layout === 'wrap' ? 'row' : 'column', flexWrap: 'wrap', gap: layout === 'wrap' ? '12px 10px' : 12, alignItems: 'flex-start' }}>
            {g.items.map(([item, i]) => (
              <PaletteBlock key={i} item={item} index={i} onPicked={onPicked} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
