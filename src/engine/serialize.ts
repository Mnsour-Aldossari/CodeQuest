/**
 * Block tree → real code.
 *  - `display`: the code the player reads in CodeView (and copies into the notebook)
 *  - `run`:     what the sandbox executes, with __step / __set / __guard / __enter hooks
 *  - `sourceMap`: blockId → display lines, so blocks and code highlight each other
 * Every typed field goes through its sanitizer here; a rejected value never reaches
 * `run` — a safe stand-in does, and a diagnostic points at the block.
 */
import { BLOCKS, ROBOT_FUNCS } from './blocks';
import { GAME_IMAGE_DATA } from './images';
import { cleanText, escapeHtml, sanitizeField, type ExprScope } from './sanitize';
import { walk } from './tree';
import type { Block, Diagnostic, Loc, Program, SourceMap } from './types';

export const KNOWN_TAGS = new Set([
  'html', 'head', 'body', 'title', 'style', 'script',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'img', 'ul', 'ol', 'li', 'div', 'span', 'button', 'section', 'header', 'footer',
  'main', 'nav', 'strong', 'em', 'b', 'i', 'u', 'br', 'hr', 'small', 'article', 'aside', 'figure', 'figcaption', 'table', 'tr', 'td',
  'th', 'thead', 'tbody', 'label', 'blockquote', 'code', 'pre', 'mark',
]);

const HOLE = '▢';
const IND = '  ';

class Emitter {
  lines: string[] = [];
  map: SourceMap = {};
  out(text: string, depth: number) {
    this.lines.push(IND.repeat(depth) + text);
    return this.lines.length;
  }
  mark(id: string, from: number) {
    this.map[id] = { from, to: this.lines.length };
  }
}

export interface SerializeOpts {
  /** HTML step-through: only the first `upTo` body elements (pre-order) are rendered */
  upTo?: number;
  lang?: 'ar' | 'en';
}

export function serialize(root: Block, opts: SerializeOpts = {}): Program {
  const diags: Diagnostic[] = [];
  const err = (blockId: string, message: Loc) => diags.push({ severity: 'error', message, blockId });
  const scope = collectScope(root);
  const ctx: Ctx = { diags, err, scope };

  if (root.type === 'root.page') return page(root, ctx, opts);

  const display = new Emitter();
  const run: string[] = [];
  for (const b of root.slots.main ?? []) jsStmt(b, 0, display, run, ctx);
  return {
    display: display.lines.join('\n'),
    sourceMap: display.map,
    run: { title: '', html: '', css: '', js: run.join('\n') },
    diagnostics: diags,
  };
}

interface Ctx {
  diags: Diagnostic[];
  err: (id: string, m: Loc) => void;
  scope: ExprScope;
}

/** Names the player declared, used to validate typed expressions. */
function collectScope(root: Block): ExprScope {
  const vars: string[] = [];
  const funcs: string[] = root.type === 'root.bot' ? [...ROBOT_FUNCS] : [];
  walk(root, (b) => {
    if (b.type === 'js.let' && typeof b.fields.name === 'string') vars.push(b.fields.name);
    if (b.type === 'js.func' && typeof b.fields.name === 'string') funcs.push(b.fields.name);
    if (b.type === 'js.for') vars.push('i');
  });
  return { vars, funcs };
}

/* ======================= HTML page ======================= */

function page(root: Block, ctx: Ctx, opts: SerializeOpts): Program {
  const e = new Emitter();
  const title = cleanText(String(root.fields.title ?? ''), 80);
  const lang = opts.lang ?? 'ar';
  e.out('<!DOCTYPE html>', 0);
  e.out(`<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`, 0);
  e.out('<head>', 0);
  e.out(`<title>${escapeHtml(title)}</title>`, 1);
  e.map[root.id] = { from: e.lines.length, to: e.lines.length };

  let css = '';
  if (root.slots.style) {
    e.out('<style>', 1);
    const cssLines: string[] = [];
    for (const r of root.slots.style) cssRule(r, 2, e, cssLines, ctx);
    css = cssLines.join('\n');
    e.out('</style>', 1);
  }
  e.out('</head>', 0);
  e.out('<body>', 0);

  const budget = { left: opts.upTo ?? Infinity };
  const html: string[] = [];
  for (const b of root.slots.body ?? []) htmlNode(b, 1, e, html, ctx, budget);

  const run: string[] = [];
  if (root.slots.script) {
    e.out('<script>', 1);
    for (const b of root.slots.script) jsStmt(b, 2, e, run, ctx);
    e.out('</script>', 1);
  }
  e.out('</body>', 0);
  e.out('</html>', 0);

  return {
    display: e.lines.join('\n'),
    sourceMap: e.map,
    run: { title, html: html.join('\n'), css, js: run.join('\n') },
    diagnostics: ctx.diags,
  };
}

/** Body elements in the order the browser builds them — the HTML "steps". */
export function htmlSteps(root: Block): string[] {
  const ids: string[] = [];
  const visit = (b: Block) => {
    ids.push(b.id);
    for (const k of ['children', 'items']) for (const c of b.slots[k] ?? []) visit(c);
  };
  for (const b of root.slots.body ?? []) visit(b);
  return ids;
}

function field(b: Block, name: string, ctx: Ctx, extra: { prop?: string } = {}): string | null {
  const d = BLOCKS[b.type]?.fields.find((f) => f.name === name);
  const raw = b.fields[name];
  if (!d) return null;
  if (raw === undefined || raw === '') {
    if (d.type === 'text' || d.type === 'string') return '';
    ctx.err(b.id, { ar: 'فيه فراغ لازم تعبّيه', en: 'There’s a blank to fill in' });
    return null;
  }
  const r = sanitizeField(d.type, raw, { prop: extra.prop, scope: ctx.scope, min: d.min, max: d.max, options: d.options });
  if (!r.ok) {
    ctx.err(b.id, r.reason);
    return null;
  }
  return r.value;
}

function textOf(b: Block, ctx: Ctx): string {
  const chip = b.slots.content?.[0];
  if (!chip) return '';
  return escapeHtml(field(chip, 'text', ctx) ?? '');
}

function attrs(b: Block, ctx: Ctx): string {
  let s = '';
  for (const [name, attr] of [['cls', 'class'], ['id', 'id']] as const) {
    if (name in b.fields) {
      const v = field(b, name, ctx);
      if (v !== null) s += ` ${attr}="${escapeHtml(v)}"`;
    }
  }
  return s;
}

function htmlNode(b: Block, depth: number, e: Emitter, run: string[], ctx: Ctx, budget: { left: number }) {
  if (budget.left <= 0) return;
  budget.left--;
  const from = e.lines.length + 1;
  const pad = IND.repeat(depth - 1);
  switch (b.type) {
    case 'html.el':
    case 'html.li': {
      const tag = b.type === 'html.li' ? 'li' : tagOf(b, ctx);
      const a = b.type === 'html.el' ? attrs(b, ctx) : '';
      const line = `<${tag}${a}>${textOf(b, ctx)}</${tag}>`;
      e.out(line, depth);
      run.push(pad + line);
      break;
    }
    case 'html.box':
    case 'html.list': {
      const tag = tagOf(b, ctx);
      const a = b.type === 'html.box' ? attrs(b, ctx) : '';
      e.out(`<${tag}${a}>`, depth);
      run.push(`${pad}<${tag}${a}>`);
      for (const c of b.slots.children ?? b.slots.items ?? []) htmlNode(c, depth + 1, e, run, ctx, budget);
      e.out(`</${tag}>`, depth);
      run.push(`${pad}</${tag}>`);
      break;
    }
    case 'html.img': {
      const src = field(b, 'src', ctx);
      const alt = escapeHtml(field(b, 'alt', ctx) ?? '');
      e.out(`<img src="${escapeHtml(String(b.fields.src ?? ''))}" alt="${alt}">`, depth);
      run.push(`${pad}<img src="${src ? GAME_IMAGE_DATA[src] : ''}" alt="${alt}">`);
      break;
    }
    case 'html.a': {
      const href = field(b, 'href', ctx);
      const t = textOf(b, ctx);
      e.out(`<a href="${escapeHtml(String(b.fields.href ?? ''))}">${t}</a>`, depth);
      run.push(`${pad}<a href="${escapeHtml(href ?? '#')}">${t}</a>`);
      break;
    }
    default:
      ctx.err(b.id, { ar: 'هذي الكتلة ما تنحط في الصفحة', en: 'This block can’t go in the page' });
  }
  e.mark(b.id, from);
}

function tagOf(b: Block, ctx: Ctx): string {
  const t = field(b, 'tag', ctx) ?? 'span';
  if (!KNOWN_TAGS.has(t)) {
    ctx.err(b.id, {
      ar: `ما أعرف الوسم \`<${t}>\`… ${t.startsWith('h') ? 'العناوين في HTML من `<h1>` إلى `<h6>` فقط.' : 'تأكد من اسمه.'}`,
      en: `I don’t know the tag \`<${t}>\`… ${t.startsWith('h') ? 'HTML headings only go from `<h1>` to `<h6>`.' : 'Check its name.'}`,
    });
  }
  return t;
}

/* ======================= CSS ======================= */

function cssRule(r: Block, depth: number, e: Emitter, run: string[], ctx: Ctx) {
  const from = e.lines.length + 1;
  if (r.type !== 'css.rule') {
    ctx.err(r.id, { ar: 'هذي الكتلة مكانها مو هنا', en: 'This block doesn’t belong here' });
    return;
  }
  const sel = field(r, 'selector', ctx);
  e.out(`${String(r.fields.selector ?? HOLE)} {`, depth);
  const decls: string[] = [];
  for (const d of r.slots.decls ?? []) {
    const dFrom = e.lines.length + 1;
    const prop = field(d, 'prop', ctx);
    const val = prop ? field(d, 'value', ctx, { prop }) : null;
    e.out(`${String(d.fields.prop ?? '')}: ${String(d.fields.value ?? '') || HOLE};`, depth + 1);
    e.mark(d.id, dFrom);
    if (prop && val !== null) decls.push(`  ${prop}: ${val};`);
  }
  e.out('}', depth);
  e.mark(r.id, from);
  if (sel) run.push(`${sel} {`, ...decls, '}');
}

/* ======================= JavaScript ======================= */

function q(s: string) {
  return JSON.stringify(s);
}

function jsStmt(b: Block, depth: number, e: Emitter, run: string[], ctx: Ctx) {
  const from = e.lines.length + 1;
  const pad = IND.repeat(depth);
  const R = (s: string) => run.push(pad + s);
  R(`__step(${q(b.id)});`);
  const body = (slot: string, prelude: string[] = []) => {
    for (const p of prelude) run.push(pad + IND + p);
    for (const c of b.slots[slot] ?? []) jsStmt(c, depth + 1, e, run, ctx);
  };
  const ex = (slot: string) => expr(b, slot, ctx);
  switch (b.type) {
    case 'js.log': {
      const v = ex('value');
      e.out(`console.log(${v.display});`, depth);
      R(`console.log(${v.run});`);
      break;
    }
    case 'js.let':
    case 'js.set': {
      const name = field(b, 'name', ctx);
      const v = ex('value');
      const kw = b.type === 'js.let' ? 'let ' : '';
      e.out(`${kw}${String(b.fields.name ?? HOLE)} = ${v.display};`, depth);
      if (name) R(`${kw}${name} = ${v.run}; __set(${q(name)}, ${name});`);
      break;
    }
    case 'js.for': {
      const n = field(b, 'times', ctx) ?? '0';
      e.out(`for (let i = 0; i < ${String(b.fields.times ?? HOLE)}; i++) {`, depth);
      R(`for (let i = 0; i < ${n}; i++) {`);
      body('body', [`__guard(${q(b.id)}); __set("i", i);`]);
      e.out('}', depth);
      R('}');
      break;
    }
    case 'js.while':
    case 'js.if': {
      const c = ex('cond');
      const kw = b.type === 'js.while' ? 'while' : 'if';
      e.out(`${kw} (${c.display}) {`, depth);
      R(`${kw} (${c.run}) {`);
      body('body', kw === 'while' ? [`__guard(${q(b.id)});`] : []);
      e.out('}', depth);
      R('}');
      break;
    }
    case 'js.func': {
      const name = field(b, 'name', ctx) ?? '__bad';
      e.out(`function ${String(b.fields.name ?? HOLE)}() {`, depth);
      R(`function ${name}() { __enter(); try {`);
      body('body');
      e.out('}', depth);
      R('} finally { __exit(); } }');
      break;
    }
    case 'js.call': {
      const name = field(b, 'name', ctx);
      e.out(`${String(b.fields.name ?? HOLE)}();`, depth);
      if (name) R(`${name}();`);
      break;
    }
    case 'js.on': {
      const sel = field(b, 'selector', ctx) ?? 'body';
      const ev = field(b, 'event', ctx) ?? 'click';
      e.out(`document.querySelector("${String(b.fields.selector ?? '')}").addEventListener("${String(b.fields.event ?? '')}", () => {`, depth);
      R(`__on(${q(sel)}, ${q(ev)}, () => { __enter(); try {`);
      body('body');
      e.out('});', depth);
      R('} finally { __exit(); } });');
      break;
    }
    case 'js.settext': {
      const sel = field(b, 'selector', ctx) ?? 'body';
      const v = ex('value');
      e.out(`document.querySelector("${String(b.fields.selector ?? '')}").textContent = ${v.display};`, depth);
      R(`__text(${q(sel)}, ${v.run});`);
      break;
    }
    case 'bot.move':
    case 'bot.left':
    case 'bot.right':
    case 'bot.collect': {
      const fn = { 'bot.move': 'moveForward', 'bot.left': 'turnLeft', 'bot.right': 'turnRight', 'bot.collect': 'collectGem' }[b.type];
      e.out(`${fn}();`, depth);
      R(`${fn}();`);
      break;
    }
    default:
      ctx.err(b.id, { ar: 'هذي الكتلة ما تنحط هنا', en: 'This block can’t go here' });
  }
  e.mark(b.id, from);
}

interface Ex { display: string; run: string }

function expr(parent: Block, slot: string, ctx: Ctx): Ex {
  const b = parent.slots[slot]?.[0];
  if (!b) {
    ctx.err(parent.id, { ar: 'فيه فراغ فاضي — ضع فيه قيمة', en: 'There’s an empty hole — put a value in it' });
    return { display: HOLE, run: 'undefined' };
  }
  return exprOf(b, ctx);
}

function exprOf(b: Block, ctx: Ctx): Ex {
  const raw = (k: string) => String(b.fields[k] ?? HOLE);
  switch (b.type) {
    case 'val.str': {
      const v = field(b, 'v', ctx) ?? '';
      return { display: q(String(b.fields.v ?? '')), run: q(v) };
    }
    case 'val.num': {
      const v = field(b, 'v', ctx);
      return { display: raw('v'), run: v ?? '0' };
    }
    case 'val.bool': {
      const v = field(b, 'v', ctx);
      return { display: raw('v'), run: v ?? 'false' };
    }
    case 'val.var': {
      const v = field(b, 'name', ctx);
      return { display: raw('name'), run: v ?? 'undefined' };
    }
    case 'val.expr': {
      const v = field(b, 'v', ctx);
      return { display: raw('v'), run: v !== null ? `(${v})` : 'undefined' };
    }
    case 'bot.sense': {
      const v = field(b, 'fn', ctx);
      return { display: `${raw('fn')}()`, run: v ? `${v}()` : 'false' };
    }
    case 'val.not': {
      const a = expr(b, 'a', ctx);
      return { display: `!${wrap(b.slots.a?.[0], a.display)}`, run: `!(${a.run})` };
    }
    case 'val.op': {
      const op = field(b, 'op', ctx) ?? '+';
      const a = expr(b, 'a', ctx);
      const c = expr(b, 'b', ctx);
      return {
        display: `${wrap(b.slots.a?.[0], a.display)} ${raw('op')} ${wrap(b.slots.b?.[0], c.display)}`,
        run: `(${a.run} ${op} ${c.run})`,
      };
    }
    default:
      ctx.err(b.id, { ar: 'هذي مو قيمة', en: 'That isn’t a value' });
      return { display: HOLE, run: 'undefined' };
  }
}

function wrap(child: Block | undefined, s: string) {
  return child?.type === 'val.op' ? `(${s})` : s;
}
