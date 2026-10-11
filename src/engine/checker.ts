/**
 * Checks are data. The checker interprets them against the trace (and, for
 * `structure`, the block tree or the parsed code). Pure — no DOM needed: the
 * sandbox answers the "probes" (selectors, computed styles, events) up front.
 */
import { robotStateAt } from './robotSim';
import { BLOCK_NODES } from './instrument';
import { KNOWN_TAGS } from './serialize';
import { firstError, lastDom, logs } from './trace';
import type { Block, Check, CheckBody, CheckResult, DomSnapshot, Loc, RobotMap, Trace } from './types';

export interface Probes {
  selectors: string[];
  props: string[];
  norms: string[];
  events: Array<{ key: string; selector: string; event: string }>;
}

export const eventKey = (c: { selector: string; event: string }) => `${c.event}@${c.selector}`;

export function probesFor(checks: CheckBody[]): Probes {
  const p: Probes = { selectors: [], props: [], norms: [], events: [] };
  const add = (c: CheckBody) => {
    if (c.type === 'dom' || c.type === 'style') p.selectors.push(c.selector);
    if (c.type === 'style') {
      p.props.push(c.prop);
      p.norms.push(`${c.prop}:${c.value}`);
    }
    if (c.type === 'event') {
      p.selectors.push(c.selector);
      p.events.push({ key: eventKey(c), selector: c.selector, event: c.event });
      c.expect.forEach(add);
    }
  };
  checks.forEach(add);
  const uniq = (a: string[]) => [...new Set(a)];
  return { selectors: uniq(p.selectors), props: uniq(p.props), norms: uniq(p.norms), events: p.events };
}

export interface CheckCtx {
  trace: Trace;
  tree?: Block;
  /** parsed player code (code mode) */
  ast?: unknown;
  robot?: RobotMap;
}

const L = (ar: string, en: string): Loc => ({ ar, en });
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

function countOk(n: number, c: number | { min?: number; max?: number } | undefined, dflt = { min: 1 }) {
  const spec = c ?? dflt;
  if (typeof spec === 'number') return n === spec;
  return (spec.min === undefined || n >= spec.min) && (spec.max === undefined || n <= spec.max);
}

export function evaluate(checks: Check[], ctx: CheckCtx): CheckResult[] {
  return checks.map((c) => {
    const r = evalOne(c, ctx, lastDom(ctx.trace), Infinity);
    return r.pass ? r : { pass: false, reason: c.fail ?? r.reason };
  });
}

function evalOne(c: CheckBody, ctx: CheckCtx, snap: DomSnapshot | undefined, logEnd: number): CheckResult {
  switch (c.type) {
    case 'dom': {
      if (!snap) return { pass: false, reason: L('الصفحة ما اشتغلت', 'The page didn’t run') };
      const els = (snap.q[c.selector] ?? []).map((i) => snap.els[i]).filter(Boolean);
      if (!countOk(els.length, c.count)) {
        return els.length === 0
          ? { pass: false, reason: L(`ما لقيت \`${c.selector}\` في الصفحة`, `I can’t find \`${c.selector}\` on the page`) }
          : { pass: false, reason: L(`عدد \`${c.selector}\` في الصفحة ${els.length} — مو العدد المطلوب`, `There are ${els.length} \`${c.selector}\` — not the number needed`) };
      }
      if (c.text !== undefined && !els.some((e) => norm(e.text) === norm(c.text!))) {
        return { pass: false, reason: L(`\`${c.selector}\` موجود، بس النص مو «${c.text}»`, `\`${c.selector}\` is there, but its text isn’t “${c.text}”`) };
      }
      if (c.textIncludes !== undefined && !els.some((e) => e.text.includes(c.textIncludes!))) {
        return { pass: false, reason: L(`نص \`${c.selector}\` لازم يحتوي «${c.textIncludes}»`, `\`${c.selector}\` should contain “${c.textIncludes}”`) };
      }
      if (c.nonEmpty && !els.every((e) => norm(e.text) !== '')) {
        return { pass: false, reason: L(`\`${c.selector}\` فاضي — اكتب فيه شي`, `\`${c.selector}\` is empty — put something in it`) };
      }
      if (c.attr) {
        const a = c.attr;
        const good = els.some((e) => {
          const v = e.attrs[a.name];
          if (v === undefined) return false;
          if (a.equals !== undefined && v !== a.equals) return false;
          if (a.startsWith !== undefined && !v.startsWith(a.startsWith)) return false;
          return true;
        });
        if (!good) return { pass: false, reason: L(`الصفة \`${a.name}\` في \`${c.selector}\` مو صحيحة`, `The \`${a.name}\` attribute on \`${c.selector}\` isn’t right`) };
      }
      return { pass: true };
    }
    case 'known-tags': {
      if (!snap) return { pass: false, reason: L('الصفحة ما اشتغلت', 'The page didn’t run') };
      const unknown = snap.els.find((e) => !KNOWN_TAGS.has(e.tag));
      return unknown ? { pass: false, reason: L(`ما أعرف الوسم \`<${unknown.tag}>\``, `I don’t know the tag \`<${unknown.tag}>\``) } : { pass: true };
    }
    case 'style': {
      if (!snap) return { pass: false, reason: L('الصفحة ما اشتغلت', 'The page didn’t run') };
      const els = (snap.q[c.selector] ?? []).map((i) => snap.els[i]).filter(Boolean);
      if (els.length === 0) return { pass: false, reason: L(`ما لقيت \`${c.selector}\``, `I can’t find \`${c.selector}\``) };
      const want = snap.norm[`${c.prop}:${c.value}`] ?? c.value;
      if (els.some((e) => e.style[c.prop] === want)) return { pass: true };
      return { pass: false, reason: L(`\`${c.prop}\` في \`${c.selector}\` مو ${c.value}`, `\`${c.prop}\` on \`${c.selector}\` isn’t ${c.value}`) };
    }
    case 'console': {
      const ls = logs(ctx.trace, logEnd).map((l) => l.text);
      if (c.count !== undefined && !countOk(ls.length, c.count)) return { pass: false, reason: L(`عدد الأسطر في الكونسول ${ls.length}`, `The console has ${ls.length} lines`) };
      const pool = c.index !== undefined ? [ls.at(c.index)].filter((x): x is string => x !== undefined) : ls;
      if (c.text !== undefined && !pool.includes(c.text)) return { pass: false, reason: L(`الكونسول ما طبع «${c.text}»`, `The console didn’t print “${c.text}”`) };
      if (c.includes !== undefined && !pool.some((x) => x.includes(c.includes!))) return { pass: false, reason: L(`الكونسول ما طبع شي فيه «${c.includes}»`, `The console didn’t print anything with “${c.includes}”`) };
      if (c.text === undefined && c.includes === undefined && c.count === undefined && pool.length === 0) return { pass: false, reason: L('الكونسول فاضي', 'The console is empty') };
      return { pass: true };
    }
    case 'robot': {
      if (!ctx.robot) return { pass: false, reason: L('ما فيه عالم روبوت', 'There is no robot world') };
      const s = robotStateAt(ctx.robot, ctx.trace.events);
      if (c.at && (s.x !== c.at[0] || s.y !== c.at[1])) return { pass: false, reason: L('بِت ما وصل للمكان المطلوب', 'Bit didn’t reach the spot') };
      if (c.gems !== undefined) {
        const want = c.gems === 'all' ? s.totalGems : c.gems;
        if (s.gems < want) return { pass: false, reason: L(`جمعت ${s.gems} من ${want} جواهر`, `You collected ${s.gems} of ${want} gems`) };
      }
      if (c.noBump && s.bumps > 0) return { pass: false, reason: L('بِت اصطدم بجدار', 'Bit bumped into a wall') };
      return { pass: true };
    }
    case 'structure': {
      const n = ctx.tree ? countInTree(ctx.tree, c.block, c.inside) : ctx.ast ? countInAst(ctx.ast, c.block) : 0;
      if (countOk(n, c.count)) return { pass: true };
      return { pass: false, reason: L(`البرنامج لازم يستخدم كتلة \`${c.block.split('.')[1]}\``, `The program should use a \`${c.block.split('.')[1]}\` block`) };
    }
    case 'no-error': {
      if (ctx.trace.timedOut) return { pass: false, reason: L('البرنامج أخذ وقت طويل', 'The program took too long') };
      return firstError(ctx.trace) ? { pass: false, reason: L('صار خطأ أثناء التشغيل', 'Something went wrong while running') } : { pass: true };
    }
    case 'event': {
      const idx = ctx.trace.events.findIndex((e) => e.t === 'event' && e.key === eventKey(c));
      const ev = idx >= 0 ? ctx.trace.events[idx] : undefined;
      if (!ev || ev.t !== 'event') return { pass: false, reason: L(`ما قدرت أضغط على \`${c.selector}\``, `I couldn’t ${c.event} \`${c.selector}\``) };
      for (const x of c.expect) {
        const r = evalOne(x, ctx, ev.snap, idx);
        if (!r.pass) return { pass: false, reason: L(`بعد ${c.event === 'click' ? 'الضغط' : 'الحدث'}: ${r.reason?.ar}`, `After the ${c.event}: ${r.reason?.en}`) };
      }
      return { pass: true };
    }
  }
}

function countInTree(tree: Block, type: string, inside?: string): number {
  let n = 0;
  const visit = (b: Block, within: boolean) => {
    if (b.type === type && (!inside || within)) n++;
    const now = within || b.type === inside;
    for (const kids of Object.values(b.slots)) for (const k of kids) visit(k, now);
  };
  visit(tree, false);
  return n;
}

function countInAst(ast: unknown, block: string): number {
  const want = BLOCK_NODES[block] ?? [];
  let n = 0;
  const visit = (x: unknown) => {
    if (!x || typeof x !== 'object') return;
    const node = x as Record<string, unknown> & { type?: string };
    if (typeof node.type === 'string') {
      if (want.includes(node.type)) n++;
      if (node.type === 'CallExpression' && want.includes('CallExpression:console.log')) {
        const cal = node.callee as { type?: string; object?: { name?: string }; property?: { name?: string } };
        if (cal?.type === 'MemberExpression' && cal.object?.name === 'console' && cal.property?.name === 'log') n++;
      }
    }
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === 'object') visit(v);
    }
  };
  visit(ast);
  return n;
}

/** Match mode: how close is the player to the target, by check weights (0–100). */
export function matchScore(checks: Check[], results: CheckResult[]): number {
  const total = checks.reduce((s, c) => s + (c.weight ?? 1), 0);
  const got = checks.reduce((s, c, i) => s + (results[i]?.pass ? c.weight ?? 1 : 0), 0);
  return total === 0 ? 0 : Math.round((got / total) * 100);
}
