/**
 * First code that runs inside the Worker, before any player code.
 * Injected as source text, so it must be self-contained (no imports, no outer refs).
 */
import type { createHooks as CreateHooks } from './hooks';
import type { robotSim as RobotSim } from '../engine/robotSim';

export interface WorkerCfg {
  nonce: string;
  limits: { loop: number; events: number; depth: number };
  robot: { rows: string[]; dir: 'N' | 'E' | 'S' | 'W' } | null;
}

/** Globals the player code sees as `undefined` (passed as shadowing parameters). */
export const SHADOWED = [
  'self', 'globalThis', 'postMessage', 'fetch', 'XMLHttpRequest', 'importScripts', 'WebSocket', 'EventSource',
  'setTimeout', 'setInterval', 'queueMicrotask', 'close', 'location', 'navigator', 'indexedDB', 'caches',
  'BroadcastChannel', 'Worker', 'onmessage',
] as const;

export const ROBOT_API = ['moveForward', 'turnLeft', 'turnRight', 'collectGem', 'isWallAhead', 'isGemHere', 'isAtGoal'] as const;

export function workerPrelude(
  cfg: WorkerCfg,
  createHooks: typeof CreateHooks,
  robotSim: typeof RobotSim | null,
  player: (...args: unknown[]) => void,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = self;
  const post = g.postMessage.bind(g);

  // Cut every road out of the Worker before player code exists.
  const kill = ['fetch', 'XMLHttpRequest', 'importScripts', 'WebSocket', 'EventSource', 'WebTransport', 'indexedDB', 'caches', 'BroadcastChannel', 'Worker', 'SharedWorker', 'postMessage', 'setTimeout', 'setInterval'];
  for (const k of kill) {
    let o = g;
    while (o) {
      try {
        if (Object.prototype.hasOwnProperty.call(o, k)) Object.defineProperty(o, k, { value: undefined, writable: false, configurable: false });
      } catch {
        /* non-configurable already */
      }
      o = Object.getPrototypeOf(o);
    }
  }

  const hooks = createHooks(cfg.limits, (events, final) => post({ type: 'events', nonce: cfg.nonce, events, final }));
  const guardBot = <T,>(fn: () => T) => () => {
    if (hooks.tripped) throw hooks.STOP;
    return fn();
  };
  const args: unknown[] = [hooks.console, hooks.__step, hooks.__set, hooks.__guard, hooks.__enter, hooks.__exit];
  if (cfg.robot && robotSim) {
    const bot = robotSim(cfg.robot, (e) => hooks.push(e as unknown as Record<string, unknown>));
    args.push(
      guardBot(bot.moveForward), guardBot(bot.turnLeft), guardBot(bot.turnRight), guardBot(bot.collectGem),
      guardBot(bot.isWallAhead), guardBot(bot.isGemHere), guardBot(bot.isAtGoal),
    );
  }
  try {
    player(...args);
  } catch (e) {
    hooks.fail(e);
  }
  hooks.finish();
}
