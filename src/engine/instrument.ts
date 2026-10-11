/**
 * Free-code mode (boss levels): parse the player's JavaScript with acorn, then
 * inject the same hooks the block serializer emits:
 *   - __step("L<line>") before every statement (timeline + error location)
 *   - __guard("L<line>") at the top of every loop body (10,000 iteration cap)
 *   - __enter()/__exit() around every function body (call-depth cap)
 * and print it back with astring.
 */
import { parse, type Node } from 'acorn';
import { generate } from 'astring';
import type { Loc } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

export type Instrumented =
  | { ok: true; code: string; ast: Node }
  | { ok: false; error: { message: Loc; line: number } };

const call = (name: string, arg?: string): N => ({
  type: 'ExpressionStatement',
  expression: {
    type: 'CallExpression',
    optional: false,
    callee: { type: 'Identifier', name },
    arguments: arg === undefined ? [] : [{ type: 'Literal', value: arg, raw: JSON.stringify(arg) }],
  },
});

const LOOPS = new Set(['ForStatement', 'WhileStatement', 'DoWhileStatement', 'ForInStatement', 'ForOfStatement']);
const FUNCS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const FORBIDDEN: Record<string, Loc> = {
  WithStatement: { ar: '`with` غير مسموح', en: '`with` isn’t allowed' },
  ImportExpression: { ar: '`import` غير مسموح', en: '`import` isn’t allowed' },
  MetaProperty: { ar: 'هذا غير مسموح', en: 'That isn’t allowed' },
  AwaitExpression: { ar: '`await` غير مسموح هنا', en: '`await` isn’t allowed here' },
  YieldExpression: { ar: '`yield` غير مسموح هنا', en: '`yield` isn’t allowed here' },
};

const lineOf = (n: N) => (n.loc ? n.loc.start.line : 0);

export function instrumentJs(code: string): Instrumented {
  let ast: N;
  try {
    ast = parse(code, { ecmaVersion: 2022, sourceType: 'script', locations: true });
  } catch (e) {
    const err = e as { message?: string; loc?: { line: number } };
    return { ok: false, error: { message: syntaxMessage(err.message ?? ''), line: err.loc?.line ?? 1 } };
  }
  const original = structuredClone(ast) as Node;
  let bad: { message: Loc; line: number } | null = null;

  const visit = (n: N): void => {
    if (!n || typeof n.type !== 'string' || bad) return;
    if (FORBIDDEN[n.type]) {
      bad = { message: FORBIDDEN[n.type], line: lineOf(n) };
      return;
    }
    if (n.type === 'Identifier' && (n.name === 'eval' || n.name === 'Function' || n.name.startsWith('__'))) {
      bad = { message: { ar: `الاسم ${n.name} محجوز للعبة`, en: `The name ${n.name} is reserved by the game` }, line: lineOf(n) };
      return;
    }
    if (n.type === 'MemberExpression' && !n.computed && ['constructor', '__proto__', 'prototype'].includes(n.property?.name)) {
      bad = { message: { ar: 'هذا غير مسموح في اللعبة', en: 'That isn’t allowed in the game' }, line: lineOf(n) };
      return;
    }
    if (FUNCS.has(n.type)) {
      if (n.async || n.generator) {
        bad = { message: { ar: 'الدوال async وgenerator غير مسموحة هنا', en: 'async and generator functions aren’t allowed here' }, line: lineOf(n) };
        return;
      }
      if (n.body.type !== 'BlockStatement') {
        n.body = { type: 'BlockStatement', body: [{ type: 'ReturnStatement', argument: n.body, loc: n.body.loc }] };
        n.expression = false;
      }
    }
    if (LOOPS.has(n.type) && n.body.type !== 'BlockStatement') {
      n.body = { type: 'BlockStatement', body: [n.body] };
    }
    for (const k of Object.keys(n)) {
      if (k === 'loc') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === 'object' && typeof v.type === 'string') visit(v);
    }
    // post-order: add hooks after children were processed
    if (n.type === 'Program' || n.type === 'BlockStatement') n.body = withSteps(n.body);
    if (n.type === 'SwitchCase') n.consequent = withSteps(n.consequent);
    if (LOOPS.has(n.type)) n.body.body.unshift(call('__guard', `L${lineOf(n)}`));
    if (FUNCS.has(n.type)) {
      n.body = {
        type: 'BlockStatement',
        body: [call('__enter'), { type: 'TryStatement', block: { type: 'BlockStatement', body: n.body.body }, handler: null, finalizer: { type: 'BlockStatement', body: [call('__exit')] } }],
      };
    }
  };
  visit(ast);
  if (bad) return { ok: false, error: bad };
  return { ok: true, code: generate(ast), ast: original };
}

function withSteps(body: N[]): N[] {
  const out: N[] = [];
  for (const s of body) {
    if (s.type !== 'FunctionDeclaration' && s.loc) out.push(call('__step', `L${lineOf(s)}`));
    out.push(s);
  }
  return out;
}

function syntaxMessage(msg: string): Loc {
  if (/Unexpected token/.test(msg)) return { ar: 'فيه رمز في غير مكانه — تأكد من الأقواس والفواصل', en: 'Something is out of place — check brackets and commas' };
  if (/Unterminated string/.test(msg)) return { ar: 'نص ما انقفل — نسيت علامة "؟', en: 'A string isn’t closed — missing a quote?' };
  if (/Unexpected character/.test(msg)) return { ar: 'فيه حرف غريب في الكود', en: 'There’s a strange character in the code' };
  if (/already been declared/.test(msg)) return { ar: 'هذا الاسم معرّف مرتين', en: 'That name is declared twice' };
  return { ar: 'الكود فيه خطأ في الكتابة', en: 'The code has a typing mistake' };
}

/** AST node types that count as a given block for `structure` checks in code mode. */
export const BLOCK_NODES: Record<string, string[]> = {
  'js.for': ['ForStatement', 'ForOfStatement', 'ForInStatement'],
  'js.while': ['WhileStatement', 'DoWhileStatement'],
  'js.if': ['IfStatement'],
  'js.func': ['FunctionDeclaration'],
  'js.let': ['VariableDeclaration'],
  'js.log': ['CallExpression:console.log'],
};
