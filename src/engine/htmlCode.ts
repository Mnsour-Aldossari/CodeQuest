/**
 * Free-code HTML (boss levels): the player types a whole page. We parse it with an
 * inert DOMParser (nothing runs, nothing loads), then rebuild the page from scratch
 * from an allow-list — tags by name, a handful of attributes, every value through its
 * sanitizer. The parsed DOM itself is never inserted anywhere.
 */
import { GAME_IMAGE_DATA } from './images';
import { escapeHtml, sanitizeClass, sanitizeHref, sanitizeSrc } from './sanitize';
import { KNOWN_TAGS } from './serialize';
import type { Diagnostic, Program } from './types';

const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math', 'link', 'meta', 'base', 'frame', 'frameset', 'form', 'input', 'textarea', 'select', 'video', 'audio', 'source', 'canvas', 'title', 'head']);
const VOID = new Set(['img', 'br', 'hr']);
const TAG_RE = /^[a-z][a-z0-9-]{0,15}$/;

export function lineOfTag(code: string, tag: string): number | undefined {
  const i = code.toLowerCase().search(new RegExp(`<${tag}[\\s>/]`));
  return i < 0 ? undefined : code.slice(0, i).split('\n').length;
}

export function compileHtmlCode(code: string): Program {
  const diags: Diagnostic[] = [];
  const doc = new DOMParser().parseFromString(code, 'text/html');
  const removed = new Set<string>();
  const out: string[] = [];

  const visit = (n: Node, depth: number) => {
    if (n.nodeType === 3) {
      const t = n.textContent ?? '';
      if (t.trim()) out.push(escapeHtml(t.replace(/\s+/g, ' ')));
      return;
    }
    if (n.nodeType !== 1) return;
    const el = n as Element;
    const tag = el.tagName.toLowerCase();
    if (DROP_WITH_CONTENT.has(tag) || !TAG_RE.test(tag)) {
      removed.add(tag);
      return;
    }
    if (!KNOWN_TAGS.has(tag)) {
      diags.push({
        severity: 'error',
        line: lineOfTag(code, tag),
        message: {
          ar: `ما أعرف الوسم \`<${tag}>\`… ${tag.startsWith('h') ? 'العناوين من `<h1>` إلى `<h6>` فقط.' : 'تأكد من اسمه.'}`,
          en: `I don’t know the tag \`<${tag}>\`… ${tag.startsWith('h') ? 'Headings only go from `<h1>` to `<h6>`.' : 'Check its name.'}`,
        },
      });
    }
    let attrs = '';
    for (const a of Array.from(el.attributes)) {
      const name = a.name.toLowerCase();
      if (name === 'class' || name === 'id') {
        const parts = a.value.trim().split(/\s+/).filter(Boolean).slice(0, 5);
        const good = parts.filter((p) => sanitizeClass(p).ok);
        if (good.length) attrs += ` ${name}="${escapeHtml(good.join(' '))}"`;
      } else if (name === 'alt' || name === 'title') {
        attrs += ` ${name}="${escapeHtml(a.value.slice(0, 200))}"`;
      } else if (name === 'href' && tag === 'a') {
        const r = sanitizeHref(a.value);
        attrs += ` href="${escapeHtml(r.ok ? r.value : '#')}"`;
        if (!r.ok) diags.push({ severity: 'error', line: lineOfTag(code, 'a'), message: r.reason });
      } else if (name === 'src' && tag === 'img') {
        const r = sanitizeSrc(a.value);
        attrs += ` src="${r.ok ? GAME_IMAGE_DATA[r.value] : ''}"`;
        if (!r.ok) diags.push({ severity: 'error', line: lineOfTag(code, 'img'), message: r.reason });
      } else {
        removed.add(`${tag} ${name}=`);
      }
    }
    out.push(`<${tag}${attrs}>`);
    if (VOID.has(tag)) return;
    if (depth < 40) el.childNodes.forEach((c) => visit(c, depth + 1));
    out.push(`</${tag}>`);
  };
  doc.body.childNodes.forEach((c) => visit(c, 0));

  for (const r of removed) {
    diags.push({
      severity: 'warning',
      message: { ar: `شلت \`${r.includes('=') ? r.split(' ')[1] : `<${r}>`}\` — هذا غير مسموح في هذي المرحلة`, en: `Removed \`${r.includes('=') ? r.split(' ')[1] : `<${r}>`}\` — not allowed in this level` },
    });
  }
  const title = (doc.title || '').slice(0, 80);
  return { display: code, sourceMap: {}, run: { title, html: out.join(''), css: '', js: '' }, diagnostics: diags };
}
