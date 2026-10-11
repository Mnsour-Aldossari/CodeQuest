import { describe, expect, it } from 'vitest';
import { serialize, htmlSteps } from './serialize';
import { evaluate, matchScore, probesFor } from './checker';
import { stars, playerLevel } from './stars';
import { explainError, traceProblem } from './errors';
import { frameState, frames } from './trace';
import { robotSim, robotStateAt } from './robotSim';
import type { Block, Check, Trace } from './types';

let k = 0;
const B = (type: string, fields: Block['fields'] = {}, slots: Block['slots'] = {}): Block => ({ id: `t${++k}`, type, fields, slots });

describe('serializer', () => {
  k = 0;
  const h1 = B('html.el', { tag: 'h1' }, { content: [B('text', { text: 'مرحبا يا بِت' })] });
  const ul = B('html.list', { tag: 'ul' }, { items: [B('html.li', {}, { content: [B('text', { text: 'ليلى' })] })] });
  const rule = B('css.rule', { selector: 'h1' }, { decls: [B('css.decl', { prop: 'color', value: 'green' })] });
  const root: Block = { id: 'root', type: 'root.page', fields: { title: 'بيتي' }, slots: { style: [rule], body: [h1, ul] } };

  it('produces real code and a line map for every block', () => {
    const p = serialize(root);
    expect(p.display).toMatchSnapshot();
    expect(p.sourceMap).toMatchSnapshot();
    const lines = p.display.split('\n');
    expect(lines[p.sourceMap[h1.id].from - 1].trim()).toBe('<h1>مرحبا يا بِت</h1>');
    expect(lines[p.sourceMap[ul.id].to - 1].trim()).toBe('</ul>');
    expect(p.run.css).toBe('h1 {\n  color: green;\n}');
    expect(p.diagnostics).toEqual([]);
  });

  it('steps through body elements in document order and can stop early', () => {
    expect(htmlSteps(root)).toEqual([h1.id, ul.id, ul.slots.items[0].id]);
    expect(serialize(root, { upTo: 1 }).run.html).toBe('<h1>مرحبا يا بِت</h1>');
  });

  it('emits instrumented JavaScript with steps, variables and loop guards', () => {
    const prog: Block = {
      id: 'r', type: 'root.js', fields: {}, slots: {
        main: [
          B('js.let', { name: 'score' }, { value: [B('val.num', { v: 0 })] }),
          B('js.for', { times: 3 }, { body: [B('js.set', { name: 'score' }, { value: [B('val.op', { op: '+' }, { a: [B('val.var', { name: 'score' })], b: [B('val.num', { v: 10 })] })] })] }),
          B('js.log', {}, { value: [B('val.var', { name: 'score' })] }),
        ],
      },
    };
    const p = serialize(prog);
    expect(p.display).toMatchSnapshot();
    expect(p.run.js).toContain('__guard(');
    expect(p.run.js).toContain('__set("score", score)');
  });

  it('flags empty holes in JS', () => {
    const prog: Block = { id: 'r', type: 'root.js', fields: {}, slots: { main: [B('js.log')] } };
    expect(serialize(prog).diagnostics[0].severity).toBe('error');
  });
});

describe('checker', () => {
  const snap = {
    title: 't',
    els: [
      { tag: 'body', parent: -1, text: 'hi', attrs: {}, style: { color: 'rgb(0, 0, 0)' } },
      { tag: 'h1', parent: 0, text: 'hi', attrs: { class: 'x' }, style: { color: 'rgb(0, 128, 0)' } },
    ],
    q: { h1: [1], p: [] },
    norm: { 'color:green': 'rgb(0, 128, 0)' },
  };
  const trace: Trace = { events: [{ t: 'log', level: 'log', text: '30' }, { t: 'dom', snap }, { t: 'done' }], timedOut: false };
  const L = { ar: 'x', en: 'x' };
  const checks: Check[] = [
    { type: 'dom', selector: 'h1', text: 'hi', label: L },
    { type: 'dom', selector: 'p', label: L, weight: 2 },
    { type: 'style', selector: 'h1', prop: 'color', value: 'green', label: L },
    { type: 'console', text: '30', label: L },
    { type: 'no-error', label: L },
  ];
  it('interprets declarative checks against a trace', () => {
    const r = evaluate(checks, { trace });
    expect(r.map((x) => x.pass)).toEqual([true, false, true, true, true]);
    expect(r[1].reason?.en).toContain('can’t find');
    expect(matchScore(checks, r)).toBe(67);
  });
  it('collects probes for the sandbox', () => {
    expect(probesFor(checks)).toEqual({ selectors: ['h1', 'p'], props: ['color'], norms: ['color:green'], events: [] });
  });
  it('checks structure on the block tree', () => {
    const tree: Block = { id: 'r', type: 'root.bot', fields: {}, slots: { main: [B('js.for', { times: 2 }, { body: [B('bot.move')] })] } };
    const c: Check[] = [{ type: 'structure', block: 'js.for', label: L }, { type: 'structure', block: 'bot.move', inside: 'js.for', label: L }, { type: 'structure', block: 'js.if', label: L }];
    expect(evaluate(c, { trace, tree }).map((x) => x.pass)).toEqual([true, true, false]);
  });
});

describe('stars, xp, errors, timeline, robot', () => {
  it('awards stars by the plan rules', () => {
    expect(stars({ solved: false, mode: 'build', blocks: 1, optimalBlocks: 2, runs: 1, hintsUsed: 0 })).toBe(0);
    expect(stars({ solved: true, mode: 'build', blocks: 2, optimalBlocks: 2, runs: 9, hintsUsed: 0 })).toBe(3);
    expect(stars({ solved: true, mode: 'build', blocks: 3, optimalBlocks: 2, runs: 1, hintsUsed: 0 })).toBe(2);
    expect(stars({ solved: true, mode: 'build', blocks: 2, optimalBlocks: 2, runs: 1, hintsUsed: 1 })).toBe(2);
    expect(stars({ solved: true, mode: 'code', blocks: 0, runs: 4, hintsUsed: 1 })).toBe(1);
    expect(playerLevel(0)).toEqual({ level: 1, into: 0, need: 100 });
    expect(playerLevel(130).level).toBe(2);
  });
  it('explains errors in plain Arabic', () => {
    expect(explainError('ReferenceError', 'score is not defined').ar).toContain('score');
    expect(explainError('RangeError', 'Maximum call stack size exceeded').ar).toContain('نفسها');
    expect(traceProblem({ events: [], timedOut: true })?.message.ar).toContain('3 ثواني');
  });
  it('builds timeline frames from step events', () => {
    const t: Trace = { timedOut: false, events: [{ t: 'step', id: 'a' }, { t: 'set', name: 'x', value: '1' }, { t: 'step', id: 'b' }, { t: 'set', name: 'x', value: '2' }, { t: 'done' }] };
    expect(frames(t)).toEqual([0, 2]);
    expect(frameState(t, 0)).toMatchObject({ blockId: 'a', vars: { x: { value: '1', changed: true } } });
    expect(frameState(t, 1)).toMatchObject({ blockId: 'b', vars: { x: { value: '2', changed: true } } });
  });
  it('simulates the robot deterministically', () => {
    const ev: Array<{ t: string }> = [];
    const r = robotSim({ rows: ['S.*', '#.G'], dir: 'E' }, (e) => ev.push(e));
    r.moveForward(); r.moveForward(); r.collectGem(); r.turnRight(); r.moveForward(); r.moveForward();
    expect(r.state()).toMatchObject({ x: 2, y: 1, gems: 1 });
    expect(r.isAtGoal()).toBe(true);
    expect(robotStateAt({ rows: ['S.*', '#.G'], dir: 'E' }, ev)).toMatchObject({ x: 2, y: 1, gems: 1, bumps: 1 });
  });
});
