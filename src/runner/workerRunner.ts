/**
 * Console + robot programs run in a throwaway Web Worker built from a blob.
 * Hard stop: worker.terminate() after LIMITS.timeoutMs, even if the code is frozen.
 */
import { robotSim } from '../engine/robotSim';
import { RunnerMessage } from '../engine/schema';
import { LIMITS } from '../engine/trace';
import type { RobotMap, Trace, TraceEvent } from '../engine/types';
import { createHooks } from './hooks';
import { ROBOT_API, SHADOWED, workerPrelude, type WorkerCfg } from './workerPrelude';

export interface WorkerLike {
  onmessage: ((e: { data: unknown }) => void) | null;
  onerror: ((e: { message?: string }) => void) | null;
  terminate(): void;
}
export type Spawn = (script: string) => WorkerLike;

export const browserSpawn: Spawn = (script) => {
  const url = URL.createObjectURL(new Blob([script], { type: 'text/javascript' }));
  const w = new Worker(url);
  const terminate = w.terminate.bind(w);
  w.terminate = () => {
    terminate();
    URL.revokeObjectURL(url);
  };
  return w as unknown as WorkerLike;
};

export function composeWorkerScript(js: string, cfg: WorkerCfg): string {
  const params = ['console', '__step', '__set', '__guard', '__enter', '__exit', ...(cfg.robot ? ROBOT_API : []), ...SHADOWED];
  return [
    '"use strict";',
    `(${workerPrelude.toString()})(`,
    `${JSON.stringify(cfg)},`,
    `(${createHooks.toString()}),`,
    `${cfg.robot ? `(${robotSim.toString()})` : 'null'},`,
    `function (${params.join(', ')}) {"use strict";`,
    js,
    '\n});',
  ].join('\n');
}

export function newNonce(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface WorkerRunOpts {
  robot?: RobotMap | null;
  timeoutMs?: number;
  spawn?: Spawn;
  nonce?: string;
}

/** Run instrumented JS. Always resolves with a trace (never rejects). */
export function runInWorker(js: string, opts: WorkerRunOpts = {}): Promise<Trace> {
  const nonce = opts.nonce ?? newNonce();
  const cfg: WorkerCfg = {
    nonce,
    limits: { loop: LIMITS.loop, events: LIMITS.events, depth: LIMITS.depth },
    robot: opts.robot ? { rows: opts.robot.rows, dir: opts.robot.dir } : null,
  };
  const spawn = opts.spawn ?? browserSpawn;
  return new Promise((resolve) => {
    const events: TraceEvent[] = [];
    let settled = false;
    const w = spawn(composeWorkerScript(js, cfg));
    const finish = (timedOut: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      w.onmessage = null;
      w.onerror = null;
      w.terminate();
      resolve({ events, timedOut });
    };
    const timer = setTimeout(() => finish(true), opts.timeoutMs ?? LIMITS.timeoutMs);
    w.onmessage = (e) => {
      const m = RunnerMessage.safeParse(e.data);
      if (!m.success || m.data.type !== 'events' || m.data.nonce !== nonce) return; // stale or malformed
      for (const ev of m.data.events) if (events.length <= LIMITS.events) events.push(ev);
      if (m.data.final) finish(false);
    };
    w.onerror = (e) => {
      events.push({ t: 'error', name: 'SyntaxError', message: String(e?.message ?? 'error').slice(0, 500) });
      finish(false);
    };
  });
}
