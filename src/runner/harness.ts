/**
 * Runs inside /runner/index.html — a sandboxed iframe (allow-scripts only, opaque
 * origin, CSP default-src 'none'). Receives one program from the parent, renders it,
 * answers the checker's probes, and reports a trace. Built as a classic IIFE.
 */
import { createHooks } from './hooks';
import { snapshot } from './snapshot';

interface Payload {
  type: 'run';
  nonce: string;
  lang: 'ar' | 'en';
  title: string;
  html: string;
  css: string;
  js: string;
  limits: { loop: number; events: number; depth: number };
  probes: { selectors: string[]; props: string[]; norms: string[]; events: Array<{ key: string; selector: string; event: string }> };
}

const parentWin = window.parent;
let started = false;

const isStrArr = (a: unknown): a is string[] => Array.isArray(a) && a.length < 200 && a.every((x) => typeof x === 'string' && x.length < 200);

function valid(d: unknown): d is Payload {
  if (!d || typeof d !== 'object') return false;
  const p = d as Record<string, unknown>;
  const pr = p.probes as Record<string, unknown> | undefined;
  return (
    p.type === 'run' && typeof p.nonce === 'string' && (p.lang === 'ar' || p.lang === 'en') &&
    typeof p.title === 'string' && typeof p.html === 'string' && typeof p.css === 'string' && typeof p.js === 'string' &&
    p.html.length < 200_000 && p.css.length < 50_000 && p.js.length < 200_000 &&
    !!p.limits && typeof p.limits === 'object' &&
    !!pr && isStrArr(pr.selectors) && isStrArr(pr.props) && isStrArr(pr.norms) && Array.isArray(pr.events)
  );
}

window.addEventListener('message', (e) => {
  if (e.source !== parentWin || started || !valid(e.data)) return;
  started = true;
  void run(e.data);
});

// Links and forms never leave the sandbox.
document.addEventListener('click', (e) => {
  const t = e.target as Element | null;
  if (t && t.closest && t.closest('a')) e.preventDefault();
}, true);
document.addEventListener('submit', (e) => e.preventDefault(), true);

parentWin.postMessage({ type: 'ready' }, '*');

const tick = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms));

async function run(p: Payload) {
  const hooks = createHooks(p.limits, (events, final) => parentWin.postMessage({ type: 'events', nonce: p.nonce, events, final }, '*'));
  const safePush = (ev: Record<string, unknown>) => {
    try {
      hooks.push(ev);
    } catch {
      /* limit reached */
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  for (const k of ['log', 'info', 'warn', 'error'] as const) w.console[k] = hooks.console[k];
  w.onerror = (_m: unknown, _s: unknown, _l: unknown, _c: unknown, err: unknown) => {
    hooks.fail(err ?? new Error(String(_m)));
    return true;
  };
  const q = (sel: string) => {
    const el = document.querySelector(sel);
    if (!el) throw new TypeError(`Cannot read properties of null (no element matches "${sel}")`);
    return el;
  };
  Object.assign(w, {
    __step: hooks.__step, __set: hooks.__set, __guard: hooks.__guard, __enter: hooks.__enter, __exit: hooks.__exit, __fail: hooks.fail,
    __on: (sel: string, ev: string, fn: () => void) => q(sel).addEventListener(ev, () => {
      try {
        fn();
      } catch (err) {
        hooks.fail(err);
      }
    }),
    __text: (sel: string, v: unknown) => {
      q(sel).textContent = String(v);
    },
  });

  document.documentElement.lang = p.lang;
  document.documentElement.dir = p.lang === 'ar' ? 'rtl' : 'ltr';
  document.title = p.title;
  const style = document.createElement('style');
  style.textContent = p.css;
  document.head.appendChild(style);
  document.body.innerHTML = p.html;

  if (p.js.trim()) {
    const src = `(function(){"use strict";\ntry {\n${p.js}\n} catch (e) { __fail(e); }\n})();`;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    await new Promise<void>((resolve) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
    URL.revokeObjectURL(url);
  }

  await tick();
  safePush({ t: 'dom', snap: snapshot(p.probes) });
  for (const ev of p.probes.events) {
    let el: Element | null = null;
    try {
      el = document.querySelector(ev.selector);
    } catch {
      el = null;
    }
    if (!el) continue;
    el.dispatchEvent(new MouseEvent(ev.event, { bubbles: true, cancelable: true }));
    await tick(20);
    safePush({ t: 'event', key: ev.key, snap: snapshot(p.probes) });
  }
  hooks.finish();
}
