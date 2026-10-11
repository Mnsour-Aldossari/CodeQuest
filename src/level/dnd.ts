/** Drag ids and the "what is being placed right now" context (drag or tap-pick). */
import { createContext, useContext } from 'react';
import type { Place } from '../engine/types';

export const gapId = (p: Place) => `gap|${p.parentId}|${p.slot}|${p.index}`;
export const PALETTE_DROP = 'palette';

export function parseDrop(id: string): Place | 'palette' | null {
  if (id === PALETTE_DROP) return 'palette';
  const [k, parentId, slot, index] = id.split('|');
  if (k !== 'gap') return null;
  return { parentId, slot, index: Number(index) };
}

export type DragData = { kind: 'palette'; index: number; type: string } | { kind: 'block'; id: string; type: string };

/** The block currently held (dragged or tap-picked), so drop spots can glow if it fits. */
export interface Holding {
  type: string;
  id?: string;
  via: 'drag' | 'pick';
}

export const HoldingCtx = createContext<Holding | null>(null);
export const useHolding = () => useContext(HoldingCtx);

/** Display line numbers for blocks (from the serializer's source map). */
export const LinesCtx = createContext<Record<string, { from: number; to: number }>>({});
