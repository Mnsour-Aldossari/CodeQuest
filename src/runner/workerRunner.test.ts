import { describe, expect, it } from 'vitest';
import { nodeSpawn } from './nodeSpawn';
import { runInWorker } from './workerRunner';
import { logs, firstError, limitHit } from '../engine/trace';

const run = (js: string, robot?: { rows: string[]; dir: 'E' }) => runInWorker(js, { spawn: nodeSpawn, robot });

describe('worker runner', () => {
  it('captures console output and finishes', async () => {
    const t = await run('console.log("مرحبا", 1 + 2);');
    expect(logs(t).map((l) => l.text)).toEqual(['مرحبا 3']);
    expect(t.events.at(-1)).toEqual({ t: 'done' });
    expect(t.timedOut).toBe(false);
  });

  it('has no network or escape hatches', async () => {
    const t = await run('console.log(typeof fetch, typeof XMLHttpRequest, typeof importScripts, typeof WebSocket, typeof self, typeof globalThis, typeof postMessage, typeof setTimeout);');
    expect(logs(t)[0].text).toBe('undefined undefined undefined undefined undefined undefined undefined undefined');
  });

  it('stops a guarded infinite loop at the loop limit', async () => {
    const t = await run('let n = 0; while (true) { __guard("w"); n++; }');
    expect(limitHit(t)).toBe('loop');
    expect(t.timedOut).toBe(false);
  });

  it('terminates frozen code (no loop to guard) within 3 seconds', async () => {
    const start = Date.now();
    const t = await run('/^(a+)+$/.test("a".repeat(40) + "b"); console.log("never");');
    expect(t.timedOut).toBe(true);
    expect(Date.now() - start).toBeLessThan(3600);
    expect(logs(t)).toHaveLength(0);
  });

  it('caps the trace at 2000 events', async () => {
    const t = await run('for (let i = 0; i < 5000; i++) { __guard("f"); console.log(i); }');
    expect(limitHit(t)).toBe('log');
    expect(t.events.length).toBeLessThanOrEqual(2002);
  });

  it('reports errors with the block that was running', async () => {
    const t = await run('__step("b1"); console.log(score);');
    expect(firstError(t)).toMatchObject({ name: 'ReferenceError', id: 'b1' });
  });

  it('runs the robot simulation inside the worker so sensors answer during the run', async () => {
    const t = await run('while (!isWallAhead()) { __guard("w"); moveForward(); } collectGem(); console.log(isAtGoal());', { rows: ['S..*#'], dir: 'E' });
    const moves = t.events.filter((e) => e.t === 'robot');
    expect(moves.map((e) => e.t === 'robot' && e.op)).toEqual(['move', 'move', 'move', 'collect']);
    expect(logs(t)[0].text).toBe('false');
  });
});
