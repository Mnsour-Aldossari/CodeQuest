/**
 * Runtime hooks that instrumented player code calls (__step, __set, __guard, …).
 * Shared by the Worker (injected as source text via toString) and the page
 * harness (bundled normally) — so this function must stay self-contained.
 */
export interface HookLimits {
  loop: number;
  events: number;
  depth: number;
}

export type Emit = (events: unknown[], final: boolean) => void;

export function createHooks(limits: HookLimits, emit: Emit) {
  const events: Array<Record<string, unknown>> = [];
  let sent = 0;
  let tripped: string | null = null;
  let current: string | undefined;
  let depth = 0;
  const counts: Record<string, number> = {};
  const STOP = new Error('__cq_stop');

  const flush = (final: boolean) => {
    emit(events.slice(sent), final);
    sent = events.length;
  };

  const trip = (what: 'loop' | 'log' | 'depth') => {
    if (!tripped) {
      tripped = what;
      events.push({ t: 'limit', what });
    }
    throw STOP;
  };

  const push = (e: Record<string, unknown>) => {
    if (tripped) throw STOP;
    if (events.length >= limits.events) {
      // Timeline bookkeeping is dropped quietly so loops still hit the clearer loop limit;
      // real output (logs, robot moves) beyond the cap stops the program.
      if (e.t === 'step' || e.t === 'set') return;
      trip('log');
    }
    events.push(e);
    if (events.length - sent >= 200) flush(false);
  };

  const fmt = (v: unknown, d = 0): string => {
    if (typeof v === 'string') return v;
    if (v === undefined) return 'undefined';
    if (typeof v === 'function') return 'function';
    if (typeof v === 'number' || typeof v === 'boolean' || v === null || typeof v === 'bigint') return String(v);
    if (d > 2) return '…';
    if (Array.isArray(v)) return '[' + v.slice(0, 50).map((x) => fmtInner(x, d + 1)).join(', ') + ']';
    try {
      const keys = Object.keys(v as object).slice(0, 30);
      return '{ ' + keys.map((k) => k + ': ' + fmtInner((v as Record<string, unknown>)[k], d + 1)).join(', ') + ' }';
    } catch {
      return String(v);
    }
  };
  const fmtInner = (v: unknown, d: number) => (typeof v === 'string' ? JSON.stringify(v) : fmt(v, d));
  const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  const log = (level: string) => (...args: unknown[]) => {
    push({ t: 'log', level, text: clip(args.map((a) => fmt(a)).join(' '), 1000) });
  };

  return {
    STOP,
    push,
    console: Object.freeze({ log: log('log'), info: log('info'), warn: log('warn'), error: log('error') }),
    __step(id: string) {
      if (tripped) throw STOP;
      current = String(id).slice(0, 60);
      push({ t: 'step', id: current });
    },
    __set(name: string, value: unknown) {
      push({ t: 'set', name: String(name).slice(0, 60), value: clip(fmt(value), 200) });
    },
    __guard(id: string) {
      if (tripped) throw STOP;
      counts[id] = (counts[id] || 0) + 1;
      if (counts[id] > limits.loop) trip('loop');
    },
    __enter() {
      if (tripped) throw STOP;
      depth++;
      if (depth > limits.depth) trip('depth');
    },
    __exit() {
      depth--;
    },
    /** Record an exception thrown by player code (our own STOP is not an error). */
    fail(e: unknown) {
      if (e === STOP) return;
      const err = e as { name?: unknown; message?: unknown } | null;
      const name = err && typeof err === 'object' && typeof err.name === 'string' ? err.name : 'Error';
      const message = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(e);
      try {
        events.push({ t: 'error', name: clip(name, 60), message: clip(message, 500), id: current });
      } catch {
        /* ignore */
      }
    },
    finish() {
      events.push({ t: 'done' });
      flush(true);
    },
    flush,
    get tripped() {
      return tripped;
    },
  };
}

export type Hooks = ReturnType<typeof createHooks>;
