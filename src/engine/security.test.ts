// @vitest-environment jsdom
/**
 * Pillar 1 — security. Every payload here must be refused or neutralized.
 */
import { describe, expect, it } from 'vitest';
import { sanitizeCssValue, sanitizeExpr, sanitizeHref, sanitizeIdent, sanitizeSelector, sanitizeSrc, escapeHtml } from './sanitize';
import { serialize } from './serialize';
import { makeBlock } from './tree';
import { compileHtmlCode } from './htmlCode';
import { instrumentJs } from './instrument';
import { runInWorker, type Spawn, type WorkerLike } from '../runner/workerRunner';
import { nodeSpawn } from '../runner/nodeSpawn';
import { limitHit, logs } from './trace';
import type { Block } from './types';

const page = (body: Block[], style?: Block[]): Block => ({ ...makeBlock('root.page', { title: 'x' }, { body, ...(style ? { style } : {}) }), id: 'root' });
const el = (tag: string, text?: string): Block => makeBlock('html.el', { tag }, { content: text === undefined ? [] : [makeBlock('text', { text })] });

describe('typed blanks reject injection payloads', () => {
  it.each(['javascript:alert(1)', 'JAVASCRIPT:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'http://example.com', '//evil.com', 'https://user:pw@evil.com', 'vbscript:x'])('href %s', (v) => {
    expect(sanitizeHref(v).ok).toBe(false);
  });
  it('href accepts https and #anchors', () => {
    expect(sanitizeHref('https://example.com/a?b=1')).toEqual({ ok: true, value: 'https://example.com/a?b=1' });
    expect(sanitizeHref('#top').ok).toBe(true);
  });
  it.each(['https://evil.com/x.png', '../secret.png', 'data:image/svg+xml,<svg onload=alert(1)>', 'house.svg"onerror="x'])('src %s', (v) => {
    expect(sanitizeSrc(v).ok).toBe(false);
  });
  it.each([
    ['color', 'red;}body{display:none'],
    ['color', 'red; background: url(https://evil.com)'],
    ['background', 'url(https://evil.com/x.png)'],
    ['color', 'expression(alert(1))'],
    ['color', '@import "x"'],
    ['font-size', '20px}*{color:red'],
    ['color', 'red\\3b'],
    ['display', 'flex !important'],
    ['color', '</style><script>alert(1)</script>'],
    ['width', '10'],
  ])('css %s: %s', (prop, v) => {
    expect(sanitizeCssValue(prop, v).ok).toBe(false);
  });
  it('css accepts allow-listed values', () => {
    for (const [p, v] of [['color', 'green'], ['color', '#1A7F53'], ['font-size', '20px'], ['display', 'flex'], ['padding', '10px 20px'], ['border', '2px solid tomato'], ['background-color', 'rgb(1, 2, 3)']]) {
      expect(sanitizeCssValue(p, v).ok, `${p}: ${v}`).toBe(true);
    }
  });
  it.each(['h1, body', 'h1 { color: red }', 'body *', 'a[href^="javascript"]', '*', 'h1:hover', '.x .y', '#a>b'])('selector %s', (v) => {
    expect(sanitizeSelector(v).ok).toBe(false);
  });
  it.each(['constructor', '__proto__', 'eval', 'window', 'fetch', 'let', '1abc', 'a-b', '__guard'])('identifier %s', (v) => {
    expect(sanitizeIdent(v).ok).toBe(false);
  });

  const scope = { vars: ['score'], funcs: ['isWallAhead'] };
  it.each([
    '(()=>{while(1){}})()',
    'fetch("https://evil.com")',
    'score = 5',
    'score++',
    'while(true){}',
    'console.log(1); score',
    'function(){}',
    'score.constructor',
    'this',
    '[].constructor.constructor("alert(1)")()',
    'import("x")',
    '`${fetch}`',
    'new Function("x")',
    'unknownVar + 1',
  ])('expression %s', (v) => {
    expect(sanitizeExpr(v, scope).ok).toBe(false);
  });
  it('expression accepts values, known vars, math, comparisons and known calls', () => {
    for (const v of ['10', '"مرحبا"', 'score + 10', 'score * 2 > 30', '!isWallAhead()', '(score - 1) % 3 === 0', 'true && score < 5']) {
      expect(sanitizeExpr(v, scope).ok, v).toBe(true);
    }
  });
});

describe('serializer never lets typed text become markup', () => {
  it('escapes <script> in text and title', () => {
    const t = { ...page([el('h1', '<script>alert(1)</script>'), el('p', '<img src=x onerror=alert(1)>')]), fields: { title: '</title><script>alert(1)</script>' } };
    const p = serialize(t);
    expect(p.run.html).not.toMatch(/<script|<img/i);
    expect(p.run.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(p.display).toContain('<title>&lt;/title&gt;&lt;script&gt;');
  });
  it('replaces a rejected href with # and flags the block', () => {
    const a = makeBlock('html.a', { href: 'javascript:alert(1)' }, { content: [makeBlock('text', { text: 'x' })] });
    const p = serialize(page([a]));
    expect(p.run.html).toContain('href="#"');
    expect(p.run.html).not.toContain('javascript');
    expect(p.diagnostics.some((d) => d.blockId === a.id && d.severity === 'error')).toBe(true);
  });
  it('drops rejected CSS from what runs, keeps it visible in the code', () => {
    const decl = makeBlock('css.decl', { prop: 'color', value: 'red;}body{display:none' });
    const rule = makeBlock('css.rule', { selector: 'h1' }, { decls: [decl] });
    const p = serialize(page([el('h1', 'x')], [rule]));
    expect(p.run.css).not.toContain('display');
    expect(p.diagnostics[0].blockId).toBe(decl.id);
  });
  it('class attribute cannot break out of quotes', () => {
    const b = makeBlock('html.el', { tag: 'p', cls: 'x" onclick="alert(1)' }, { content: [] });
    const p = serialize(page([b]));
    expect(p.run.html).toBe('<p></p>');
  });
});

describe('free-code HTML is rebuilt from an allow-list', () => {
  it('removes scripts, handlers, frames, styles and bad links', () => {
    const p = compileHtmlCode(`<h1 onclick="alert(1)">hi</h1><script>alert(1)</script><iframe src="https://evil.com"></iframe>
<a href="javascript:alert(1)">x</a><img src="https://evil.com/t.png" onerror="alert(1)"><style>body{display:none}</style>
<meta http-equiv="refresh" content="0;url=https://evil.com"><svg onload="alert(1)"></svg><p style="background:url(https://evil.com)">ok</p>`);
    expect(p.run.html).not.toMatch(/script|onclick|onerror|onload|iframe|evil|style|meta|svg|javascript/i);
    expect(p.run.html).toContain('<h1>hi</h1>');
    expect(p.run.html).toContain('<a href="#">x</a>');
    expect(p.diagnostics.some((d) => d.severity === 'error')).toBe(true);
  });
  it('reports unknown tags with their line', () => {
    const p = compileHtmlCode('<h1>a</h1>\n<h7>b</h7>');
    expect(p.diagnostics[0]).toMatchObject({ severity: 'error', line: 2 });
  });
});

describe('free-code JavaScript is instrumented', () => {
  it('guards every loop, even without braces', async () => {
    const r = instrumentJs('let n = 0;\nwhile (true) n++;');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain('__guard("L2")');
    const t = await runInWorker(r.code, { spawn: nodeSpawn });
    expect(limitHit(t)).toBe('loop');
    expect(t.timedOut).toBe(false);
  });
  it('stops infinite recursion with a depth limit', async () => {
    const r = instrumentJs('function f() { return f(); }\nf();');
    if (!r.ok) throw new Error('parse');
    const t = await runInWorker(r.code, { spawn: nodeSpawn });
    expect(limitHit(t)).toBe('depth');
  });
  it('a caught guard error cannot keep the loop alive', async () => {
    const r = instrumentJs('let i = 0;\nwhile (true) { try { while (true) { i++; } } catch (e) {} }');
    if (!r.ok) throw new Error('parse');
    const t = await runInWorker(r.code, { spawn: nodeSpawn });
    expect(limitHit(t)).toBe('loop');
    expect(t.timedOut).toBe(false);
  });
  it.each(['eval("1")', '__guard = () => {}', 'x.constructor', 'with (Math) {}', 'async function f() {}', 'import("x")'])('rejects %s', (code) => {
    expect(instrumentJs(code).ok).toBe(false);
  });
  it('maps console output and steps to source lines', async () => {
    const r = instrumentJs('const a = 2;\nconsole.log(a * 21);');
    if (!r.ok) throw new Error('parse');
    const t = await runInWorker(r.code, { spawn: nodeSpawn });
    expect(logs(t)[0].text).toBe('42');
    expect(t.events.filter((e) => e.t === 'step').map((e) => e.t === 'step' && e.id)).toEqual(['L1', 'L2']);
  });
});

describe('runner messages', () => {
  it('drops messages from an old run (stale nonce) and malformed messages', async () => {
    const fake: Spawn = () => {
      const w: WorkerLike = { onmessage: null, onerror: null, terminate: () => {} };
      setTimeout(() => {
        w.onmessage?.({ data: { type: 'events', nonce: 'old-run', events: [{ t: 'log', level: 'log', text: 'stale' }], final: true } });
        w.onmessage?.({ data: { type: 'events', nonce: 'now', events: [{ t: 'log', level: 'log', text: 'x'.repeat(5000) }], final: true } });
        w.onmessage?.({ data: { type: 'events', nonce: 'now', events: [{ t: 'evil', html: '<script>' }], final: true } });
        w.onmessage?.({ data: { type: 'events', nonce: 'now', events: [{ t: 'log', level: 'log', text: 'fresh' }], final: true } });
      }, 5);
      return w;
    };
    const t = await runInWorker('', { spawn: fake, nonce: 'now' });
    expect(logs(t).map((l) => l.text)).toEqual(['fresh']);
  });
});

describe('escapeHtml', () => {
  it('escapes all five characters', () => expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;'));
});
