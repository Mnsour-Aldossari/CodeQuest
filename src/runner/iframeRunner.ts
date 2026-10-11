/**
 * Page levels (HTML/CSS/DOM events) run in a fresh sandboxed iframe per run:
 * sandbox="allow-scripts" only — no allow-same-origin, popups, forms or top navigation.
 *
 * Why a static runner page instead of srcdoc: a srcdoc document inherits the app's
 * CSP (script-src 'self'), which would block the harness. /runner/index.html has its
 * own stricter CSP (default-src 'none') and loads a classic same-origin script.
 */
import { RunnerMessage } from '../engine/schema';
import { LIMITS } from '../engine/trace';
import type { Probes } from '../engine/checker';
import type { Program, Trace, TraceEvent } from '../engine/types';
import { newNonce } from './workerRunner';

export const RUNNER_URL = `${import.meta.env.BASE_URL}runner/index.html`;

export interface PageRunOpts {
  lang: 'ar' | 'en';
  timeoutMs?: number;
}

export class PageRunner {
  private iframe: HTMLIFrameElement | null = null;
  private cancel: (() => void) | null = null;
  private host: HTMLElement;
  constructor(host: HTMLElement) {
    this.host = host;
  }

  /** Render and run a page. Any previous run is abandoned (its messages are ignored). */
  run(program: Program['run'], probes: Probes, opts: PageRunOpts): Promise<Trace> {
    this.cancel?.();
    const nonce = newNonce();
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.setAttribute('title', opts.lang === 'ar' ? 'معاينة الصفحة' : 'Page preview');
    iframe.className = 'cq-preview-frame';
    iframe.src = RUNNER_URL;
    this.host.replaceChildren(iframe);
    this.iframe = iframe;

    return new Promise<Trace>((resolve) => {
      const events: TraceEvent[] = [];
      let done = false;
      const finish = (timedOut: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        window.removeEventListener('message', onMsg);
        if (this.cancel === abort) this.cancel = null;
        resolve({ events, timedOut });
      };
      const abort = () => finish(true);
      this.cancel = abort;
      const onMsg = (e: MessageEvent) => {
        if (e.source !== iframe.contentWindow) return; // only the iframe we just made
        const m = RunnerMessage.safeParse(e.data);
        if (!m.success) return;
        if (m.data.type === 'ready') {
          iframe.contentWindow?.postMessage(
            { type: 'run', nonce, lang: opts.lang, ...program, limits: { loop: LIMITS.loop, events: LIMITS.events, depth: LIMITS.depth }, probes },
            '*',
          );
          return;
        }
        if (m.data.nonce !== nonce) return; // stale run
        for (const ev of m.data.events) if (events.length <= LIMITS.events) events.push(ev);
        if (m.data.final) finish(false);
      };
      window.addEventListener('message', onMsg);
      const timer = setTimeout(() => {
        // Drop a page that never answered.
        if (this.iframe === iframe) iframe.src = 'about:blank';
        finish(true);
      }, opts.timeoutMs ?? LIMITS.timeoutMs);
    });
  }

  dispose() {
    this.cancel?.();
    this.host.replaceChildren();
    this.iframe = null;
  }
}
