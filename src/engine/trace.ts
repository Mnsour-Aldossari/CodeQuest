/**
 * The trace is the single source of truth for a run. The robot view, the variable
 * boxes, the console, the step-by-step timeline and the checker all read from it.
 */
import type { Trace, TraceEvent } from './types';

export const LIMITS = {
  /** __guard throws after this many iterations of one loop */
  loop: 10_000,
  /** events kept per run */
  events: 2_000,
  /** nested calls before we stop the program */
  depth: 200,
  /** wall-clock budget before the Worker is terminated / iframe dropped */
  timeoutMs: 3_000,
} as const;

export type LogEvent = Extract<TraceEvent, { t: 'log' }>;
export type ErrorEvent = Extract<TraceEvent, { t: 'error' }>;
export type RobotTraceEvent = Extract<TraceEvent, { t: 'robot' }>;

export function logs(trace: Trace, upTo = Infinity): LogEvent[] {
  return trace.events.slice(0, upTo).filter((e): e is LogEvent => e.t === 'log');
}

export function firstError(trace: Trace): ErrorEvent | undefined {
  return trace.events.find((e): e is ErrorEvent => e.t === 'error');
}

export function limitHit(trace: Trace) {
  const e = trace.events.find((x) => x.t === 'limit');
  return e && e.t === 'limit' ? e.what : undefined;
}

export function lastDom(trace: Trace) {
  for (let i = trace.events.length - 1; i >= 0; i--) {
    const e = trace.events[i];
    if (e.t === 'dom') return e.snap;
  }
  return undefined;
}

/**
 * Timeline frames: one per executed block (a `step` event). Frame k includes every
 * event up to (not including) step k+1, so a frame shows the effect of its block.
 */
export function frames(trace: Trace): number[] {
  const idx: number[] = [];
  trace.events.forEach((e, i) => {
    if (e.t === 'step') idx.push(i);
  });
  return idx;
}

export interface FrameState {
  blockId?: string;
  /** events visible at this frame (exclusive end index) */
  end: number;
  vars: Record<string, { value: string; changed: boolean }>;
}

export function frameState(trace: Trace, k: number): FrameState {
  const f = frames(trace);
  if (f.length === 0) return { end: trace.events.length, vars: varsUpTo(trace, trace.events.length) };
  const i = Math.max(0, Math.min(k, f.length - 1));
  const end = i + 1 < f.length ? f[i + 1] : trace.events.length;
  const e = trace.events[f[i]];
  return { blockId: e.t === 'step' ? e.id : undefined, end, vars: varsUpTo(trace, end, f[i]) };
}

function varsUpTo(trace: Trace, end: number, changedFrom = Infinity) {
  const vars: FrameState['vars'] = {};
  for (let i = 0; i < end; i++) {
    const e = trace.events[i];
    if (e.t === 'set') vars[e.name] = { value: e.value, changed: i >= changedFrom };
  }
  return vars;
}
