/**
 * Every value the player types (or that arrives in a share link) is hostile until
 * it passes the sanitizer for its slot type. Sanitizers never "fix" dangerous input
 * silently into something else meaningful: they either accept a normalized value
 * or reject with a kid-friendly reason.
 */
import { parseExpressionAt } from 'acorn';
import type { FieldType, Loc } from './types';

export type San = { ok: true; value: string } | { ok: false; reason: Loc };

const ok = (value: string): San => ({ ok: true, value });
const no = (ar: string, en: string): San => ({ ok: false, reason: { ar, en } });

/* ---------------- HTML text & attributes ---------------- */

const HTML_ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape for HTML text and double-quoted attributes. `<script>` becomes plain text. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESC[c]);
}

/** Strip control characters (except none — text is single-line) and clamp length. */
export function cleanText(s: string, max = 200): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, ' ').slice(0, max);
}

/* ---------------- href / src ---------------- */

export function sanitizeHref(raw: string): San {
  const v = raw.trim();
  if (v === '') return no('الرابط فاضي — اكتب رابط يبدأ بـ https://', 'The link is empty — type a link that starts with https://');
  if (/^#[A-Za-z0-9_-]{0,40}$/.test(v)) return ok(v);
  if (!/^https:\/\//i.test(v)) {
    return no('الرابط لازم يبدأ بـ https:// (أو # لمكان داخل الصفحة)', 'Links must start with https:// (or # for a spot on the page)');
  }
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return no('هذا الرابط مكتوب بشكل غير صحيح', 'That link is not written correctly');
  }
  if (u.protocol !== 'https:' || u.username || u.password) return no('الرابط لازم يبدأ بـ https://', 'Links must start with https://');
  return ok(u.href);
}

/** Images the player may use. Keys are what the code shows; values are bundled art. */
export const GAME_IMAGES = ['house.svg', 'bit.svg', 'tree.svg', 'flower.svg', 'gem.svg', 'castle.svg'] as const;

export function sanitizeSrc(raw: string): San {
  const v = raw.trim();
  if ((GAME_IMAGES as readonly string[]).includes(v)) return ok(v);
  return no('اختر صورة من صور اللعبة فقط', 'Pick one of the game’s images');
}

/* ---------------- identifiers & selectors ---------------- */

const RESERVED = new Set(
  ('break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static enum await implements package protected interface private public ' +
    // names that would let code reach the outside world or the engine
    'eval Function constructor prototype __proto__ globalThis self window document parent top frames opener postMessage fetch importScripts XMLHttpRequest WebSocket localStorage sessionStorage indexedDB undefined NaN Infinity arguments')
    .split(' '),
);

export function isSafeIdent(v: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]{0,30}$/.test(v) && !RESERVED.has(v) && !v.startsWith('__');
}

export function sanitizeIdent(raw: string): San {
  const v = raw.trim();
  if (!v) return no('اكتب اسم', 'Type a name');
  if (/^[0-9]/.test(v)) return no('الاسم ما يبدأ برقم', 'A name can’t start with a number');
  if (!isSafeIdent(v)) return no('استخدم حروف إنجليزية وأرقام فقط، وبدون كلمات محجوزة', 'Use English letters and digits only, and no reserved words');
  return ok(v);
}

export function sanitizeClass(raw: string): San {
  const v = raw.trim();
  if (/^[A-Za-z][A-Za-z0-9_-]{0,30}$/.test(v)) return ok(v);
  return no('اسم الـ class: حروف إنجليزية وأرقام و - فقط، ويبدأ بحرف', 'A class name: English letters, digits and - only, starting with a letter');
}

const SELECTOR_TAGS = new Set(['body', 'h1', 'h2', 'h3', 'p', 'a', 'img', 'ul', 'ol', 'li', 'div', 'span', 'button', 'section', 'header', 'footer', 'main', 'nav', 'strong', 'em']);

/** Plan rule: selectors are a tag, a .class or an #id — nothing else. */
export function sanitizeSelector(raw: string): San {
  const v = raw.trim();
  if (SELECTOR_TAGS.has(v.toLowerCase())) return ok(v.toLowerCase());
  if (/^[.#][A-Za-z][A-Za-z0-9_-]{0,30}$/.test(v)) return ok(v);
  return no('المحدِّد يكون اسم وسم مثل h1، أو .class، أو #id', 'A selector is a tag like h1, a .class, or an #id');
}

/* ---------------- numbers ---------------- */

export function sanitizeNumber(raw: string | number, min = -1_000_000, max = 1_000_000): San {
  const s = String(raw).trim();
  if (!/^-?\d{1,7}(\.\d{1,4})?$/.test(s)) return no('اكتب رقم', 'Type a number');
  const n = Number(s);
  if (n < min || n > max) return no(`الرقم لازم يكون بين ${min} و ${max}`, `The number must be between ${min} and ${max}`);
  return ok(String(n));
}

/* ---------------- CSS values ---------------- */

export const NAMED_COLORS = new Set(
  ('black white red green blue yellow orange purple pink brown gray grey silver gold navy teal olive maroon lime aqua cyan magenta fuchsia ' +
    'tomato coral salmon crimson orchid violet indigo plum lavender khaki beige ivory honeydew mintcream azure aliceblue mistyrose seashell linen ' +
    'seagreen forestgreen darkgreen lightgreen limegreen springgreen olivedrab darkolivegreen mediumseagreen palegreen ' +
    'skyblue lightblue steelblue royalblue dodgerblue deepskyblue cornflowerblue midnightblue darkblue slateblue cadetblue powderblue ' +
    'darkorange orangered goldenrod darkgoldenrod chocolate sienna peru tan wheat moccasin peachpuff papayawhip lightyellow lemonchiffon ' +
    'hotpink deeppink lightpink palevioletred mediumvioletred rebeccapurple darkviolet darkorchid mediumpurple thistle ' +
    'darkred firebrick indianred lightcoral darkgray darkgrey lightgray lightgrey dimgray dimgrey slategray gainsboro whitesmoke snow ' +
    'turquoise aquamarine darkcyan lightseagreen mediumturquoise darkturquoise transparent').split(' '),
);

const LEN = '(?:0|\\d{1,4}(?:\\.\\d{1,2})?(?:px|em|rem|%|vh|vw))';
const RE_LEN = new RegExp(`^${LEN}$`);
const RE_LEN_1_4 = new RegExp(`^${LEN}(?: ${LEN}){0,3}$`);
const RE_HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RE_RGB = /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/;

function isColor(v: string) {
  return NAMED_COLORS.has(v.toLowerCase()) || RE_HEX.test(v) || RE_RGB.test(v);
}

const KEYWORDS: Record<string, string[]> = {
  display: ['block', 'inline', 'inline-block', 'flex', 'grid', 'none'],
  'text-align': ['left', 'right', 'center', 'start', 'end', 'justify'],
  'justify-content': ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly', 'start', 'end'],
  'align-items': ['flex-start', 'flex-end', 'center', 'stretch', 'baseline', 'start', 'end'],
  'flex-direction': ['row', 'column', 'row-reverse', 'column-reverse'],
  'flex-wrap': ['wrap', 'nowrap'],
  'font-weight': ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
  'font-style': ['normal', 'italic'],
  'font-family': ['serif', 'sans-serif', 'monospace', 'cursive', 'system-ui'],
  'text-decoration': ['none', 'underline', 'line-through', 'overline'],
  'border-style': ['solid', 'dashed', 'dotted', 'double', 'none'],
  'list-style': ['none', 'disc', 'circle', 'square', 'decimal'],
};

const COLOR_PROPS = new Set(['color', 'background-color', 'background', 'border-color']);
const LEN_PROPS = new Set(['font-size', 'width', 'height', 'max-width', 'min-height', 'border-radius', 'gap', 'border-width', 'line-height', 'letter-spacing']);
const BOX_PROPS = new Set(['padding', 'margin']);

export const CSS_PROPS = [...COLOR_PROPS, ...LEN_PROPS, ...BOX_PROPS, ...Object.keys(KEYWORDS), 'border', 'opacity'];

/**
 * Accept a CSS value only if it matches the allow-list for that property.
 * Anything that could break out of the declaration (; } { url( @import expression \ < >)
 * fails the character gate before we even look at the property.
 */
export function sanitizeCssValue(prop: string, raw: string): San {
  const v = raw.trim().replace(/\s+/g, ' ');
  if (v === '') return no('اكتب قيمة', 'Type a value');
  if (v.length > 60 || !/^[A-Za-z0-9#%., ()-]+$/.test(v) || /url\(|expression|@import|\\/i.test(v)) {
    return no('هذي القيمة فيها رموز غير مسموحة', 'That value has characters that aren’t allowed');
  }
  if (!CSS_PROPS.includes(prop)) return no(`الخاصية ${prop} غير متاحة هنا`, `The property ${prop} isn’t available here`);
  if (COLOR_PROPS.has(prop)) {
    return isColor(v) ? ok(v.toLowerCase().startsWith('#') ? v : v.toLowerCase()) : no('اكتب لون مثل green أو #1A7F53', 'Type a color like green or #1A7F53');
  }
  if (LEN_PROPS.has(prop)) {
    if (prop === 'line-height' && /^\d(\.\d{1,2})?$/.test(v)) return ok(v);
    return RE_LEN.test(v) ? ok(v) : no('اكتب رقم مع وحدة مثل 20px', 'Type a number with a unit, like 20px');
  }
  if (BOX_PROPS.has(prop)) return RE_LEN_1_4.test(v) ? ok(v) : no('اكتب مقاس مثل 10px أو 10px 20px', 'Type a size like 10px or 10px 20px');
  if (prop === 'opacity') return /^(0|1|0?\.\d{1,2})$/.test(v) ? ok(v) : no('اكتب رقم من 0 إلى 1', 'Type a number from 0 to 1');
  if (prop === 'border') {
    const parts = v.split(' ');
    const good = parts.length >= 1 && parts.length <= 3 && parts.every((p) => RE_LEN.test(p) || KEYWORDS['border-style'].includes(p) || isColor(p));
    return good ? ok(v) : no('مثال: 2px solid green', 'Example: 2px solid green');
  }
  const kw = KEYWORDS[prop];
  if (kw && kw.includes(v.toLowerCase())) return ok(v.toLowerCase());
  return no(`القيم المسموحة: ${kw?.join('، ') ?? ''}`, `Allowed values: ${kw?.join(', ') ?? ''}`);
}

/* ---------------- typed JS expressions ---------------- */

export interface ExprScope {
  vars: string[];
  funcs: string[];
}

const BIN_OPS = new Set(['+', '-', '*', '/', '%', '<', '>', '<=', '>=', '===', '!==', '==', '!=']);

interface AnyNode { type: string; [k: string]: unknown }

/**
 * A blank in "fill" mode takes one small expression: a value, a known variable,
 * arithmetic, a comparison, or a call to a known function. Statements, function
 * literals, member access, assignments and loops are all rejected.
 */
export function sanitizeExpr(raw: string, scope: ExprScope): San {
  const src = raw.trim();
  if (!src) return no('اكتب قيمة', 'Type a value');
  if (src.length > 120) return no('القيمة طويلة جداً', 'That’s too long');
  let node: AnyNode;
  try {
    node = parseExpressionAt(src, 0, { ecmaVersion: 2022 }) as unknown as AnyNode;
  } catch {
    return no('هذي ليست قيمة صحيحة في JavaScript', 'That isn’t a valid JavaScript value');
  }
  if ((node as unknown as { end: number }).end !== src.length) {
    return no('اكتب قيمة واحدة فقط، مو جملة كاملة', 'Type just one value, not a whole statement');
  }
  const bad = walkExpr(node, scope);
  return bad ?? ok(src);
}

function walkExpr(n: AnyNode, scope: ExprScope): San | null {
  switch (n.type) {
    case 'Literal':
      if ('regex' in n && n.regex) return no('هذا النوع من القيم غير مسموح هنا', 'That kind of value isn’t allowed here');
      return null;
    case 'Identifier': {
      const name = n.name as string;
      if (scope.vars.includes(name) || scope.funcs.includes(name)) return null;
      return no(`ما أعرف شي اسمه ${name}`, `I don’t know anything called ${name}`);
    }
    case 'BinaryExpression':
      if (!BIN_OPS.has(n.operator as string)) return no('هذي العملية غير مسموحة', 'That operator isn’t allowed');
      return walkExpr(n.left as AnyNode, scope) ?? walkExpr(n.right as AnyNode, scope);
    case 'LogicalExpression':
      if (n.operator !== '&&' && n.operator !== '||') return no('هذي العملية غير مسموحة', 'That operator isn’t allowed');
      return walkExpr(n.left as AnyNode, scope) ?? walkExpr(n.right as AnyNode, scope);
    case 'UnaryExpression':
      if (n.operator !== '!' && n.operator !== '-') return no('هذي العملية غير مسموحة', 'That operator isn’t allowed');
      return walkExpr(n.argument as AnyNode, scope);
    case 'CallExpression': {
      const callee = n.callee as AnyNode;
      if (callee.type !== 'Identifier' || !scope.funcs.includes(callee.name as string)) {
        return no('تقدر تنادي الدوال المعروفة فقط', 'You can only call functions you know');
      }
      for (const a of n.arguments as AnyNode[]) {
        const r = walkExpr(a, scope);
        if (r) return r;
      }
      return null;
    }
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return no('ما نكتب دالة كاملة هنا — بس قيمة', 'No whole functions here — just a value');
    case 'AssignmentExpression':
    case 'UpdateExpression':
      return no('ما نغيّر متغيرات هنا — بس نقرأها', 'No changing variables here — just reading them');
    default:
      return no('هذا غير مسموح في هذا الفراغ', 'That isn’t allowed in this blank');
  }
}

/* ---------------- dispatcher ---------------- */

export interface FieldCtx {
  prop?: string;
  scope?: ExprScope;
  min?: number;
  max?: number;
  options?: readonly string[];
}

/** Validate one field value by its type. Raw text fields are cleaned, not rejected. */
export function sanitizeField(type: FieldType, value: string | number | boolean, ctx: FieldCtx = {}): San {
  const s = String(value);
  switch (type) {
    case 'text':
    case 'string':
      return ok(cleanText(s));
    case 'number':
      return sanitizeNumber(s, ctx.min, ctx.max);
    case 'boolean':
      return s === 'true' || s === 'false' ? ok(s) : no('اختر true أو false', 'Pick true or false');
    case 'ident':
      return sanitizeIdent(s);
    case 'cls':
      return sanitizeClass(s);
    case 'selector':
      return sanitizeSelector(s);
    case 'css-value':
      return sanitizeCssValue(ctx.prop ?? '', s);
    case 'url':
      return sanitizeHref(s);
    case 'src':
      return sanitizeSrc(s);
    case 'tag':
      return /^[a-z][a-z0-9]{0,9}$/.test(s) ? ok(s) : no('وسم غير معروف', 'Unknown tag');
    case 'prop':
      return CSS_PROPS.includes(s) ? ok(s) : no('خاصية غير متاحة', 'Property not available');
    case 'op':
      return ctx.options?.includes(s) ? ok(s) : no('عملية غير معروفة', 'Unknown operator');
    case 'expr':
      return sanitizeExpr(s, ctx.scope ?? { vars: [], funcs: [] });
  }
}
