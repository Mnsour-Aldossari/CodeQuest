// @vitest-environment jsdom
/**
 * Every level: valid by zod; its starting state fails; its reference solution passes
 * using no more than optimalBlocks blocks.
 */
import { describe, expect, it } from 'vitest';
import { LevelSchema } from '../engine/schema';
import { probesFor } from '../engine/checker';
import { compile, judge } from '../engine/judge';
import { countBlocks } from '../engine/tree';
import { snapshot } from '../runner/snapshot';
import { runInWorker } from '../runner/workerRunner';
import { nodeSpawn } from '../runner/nodeSpawn';
import type { Block, Level, Trace } from '../engine/types';
import { LEVELS } from './index';

/** Render a web program into a fresh jsdom document and snapshot it like the sandbox does. */
function runWebInJsdom(level: Level, run: { title: string; html: string; css: string }): Trace {
  const doc = document.implementation.createHTMLDocument(run.title);
  const style = doc.createElement('style');
  style.textContent = run.css;
  doc.head.appendChild(style);
  doc.body.innerHTML = run.html;
  const snap = snapshot(probesFor(level.checks), doc);
  return { events: [{ t: 'dom', snap }, { t: 'done' }], timedOut: false };
}

async function play(level: Level, input: { tree?: Block; code?: string }) {
  const compiled = compile(level, input);
  const trace = level.output === 'web'
    ? runWebInJsdom(level, compiled.program.run)
    : await runInWorker(compiled.program.run.js, { spawn: nodeSpawn, robot: level.robot });
  return judge(level, compiled, trace, input.tree);
}

describe.each(LEVELS.map((l) => [l.id, l] as const))('level %s', (_id, level) => {
  it('is valid level data', () => {
    expect(LevelSchema.safeParse(level).success).toBe(true);
  });
  it('starts unsolved', async () => {
    const v = await play(level, { tree: level.initial, code: level.initialCode });
    expect(v.solved).toBe(false);
  });
  it('is solved by its reference solution', async () => {
    const v = await play(level, { tree: level.solution, code: level.solutionCode });
    expect(v.problem).toBeNull();
    expect(v.results.map((r) => r.reason?.en ?? 'pass')).toEqual(level.checks.map(() => 'pass'));
    expect(v.solved).toBe(true);
  });
  it.runIf(level.mode !== 'code')('solution fits in optimalBlocks', () => {
    expect(countBlocks(level.solution!)).toBeLessThanOrEqual(level.optimalBlocks!);
  });
});
