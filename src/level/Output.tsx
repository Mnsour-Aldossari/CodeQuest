/** Result panel: Browser (sandboxed iframe) · Console · Robot · Code. */
import { useMemo, type ReactNode, type RefObject } from 'react';
import type { Level, Program, Trace } from '../engine/types';
import { useLevel } from '../state/level';
import { useT, Rich } from '../i18n';
import { Icon, type IconName } from '../components/Icon';
import { CodeView, type LineMarks } from '../components/CodeView';
import { traceProblem } from '../engine/errors';

export type OutTab = 'browser' | 'console' | 'robot' | 'code';

export function OutputTabs({ tab, setTab, tabs, badge }: { tab: OutTab; setTab: (t: OutTab) => void; tabs: OutTab[]; badge?: OutTab }) {
  const { t } = useT();
  const meta: Record<OutTab, [string, IconName]> = { browser: [t('browser'), 'globe'], console: [t('console'), 'terminal'], robot: [t('robot'), 'robot'], code: [t('code'), 'code'] };
  return (
    <div className="tabs" role="tablist" aria-label={t('output')}>
      {tabs.map((k) => (
        <button key={k} type="button" className="tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} style={{ fontSize: 14, padding: '0 8px', gap: 6, position: 'relative' }} data-tab={k}>
          <Icon name={meta[k][1]} size={18} />
          {meta[k][0]}
          {badge === k && tab !== k && (
            <span className="pop-in" style={{ position: 'absolute', top: 4, insetInlineEnd: 6, width: 10, height: 10, borderRadius: '50%', background: '#D23B3B', boxShadow: '0 0 0 2px #fff' }} />
          )}
        </button>
      ))}
    </div>
  );
}

export function BrowserFrame({ hostRef, title, url, running, empty, visible }: { hostRef: RefObject<HTMLDivElement | null>; title: string; url: string; running: boolean; empty: boolean; visible: boolean }) {
  const { t } = useT();
  return (
    <div className="fade-up" style={{ flex: 1, display: visible ? 'flex' : 'none', flexDirection: 'column', borderRadius: 14, overflow: 'hidden', boxShadow: '0 0 0 1.5px #E2D6C3', background: '#fff', minHeight: 0 }}>
      <div dir="ltr" style={{ display: 'flex', alignItems: 'flex-end', gap: 6, padding: '8px 10px 0', background: '#EFE6D8' }}>
        <span style={{ display: 'flex', gap: 5, padding: '0 6px 10px' }} aria-hidden="true">
          <i style={{ width: 10, height: 10, borderRadius: '50%', background: '#E46C5A' }} />
          <i style={{ width: 10, height: 10, borderRadius: '50%', background: '#F2B63D' }} />
          <i style={{ width: 10, height: 10, borderRadius: '50%', background: '#58B86B' }} />
        </span>
        <span className="iso" dir="auto" data-testid="tab-title" style={{ padding: '7px 14px', borderRadius: '10px 10px 0 0', background: '#fff', fontSize: 13, fontWeight: 700, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title || '—'}
        </span>
      </div>
      <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid #EFE6D8' }}>
        <span className={running ? 'reload-spin' : ''} style={{ display: 'inline-flex', color: '#625B78' }}>
          <Icon name="reset" size={16} stroke={2.4} />
        </span>
        <span className="code" style={{ flex: 1, padding: '5px 12px', borderRadius: 999, background: '#F6F1E9', fontSize: 12.5, color: '#4A4360' }}>
          {url}
        </span>
      </div>
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} data-testid="preview-host" />
        {empty && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', color: '#625B78', fontWeight: 700, background: '#fff', padding: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#CDBEA6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <path d="M8 8h8M8 12h5" />
              </svg>
              <span>
                <Rich text={t('emptyPage')} />
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ConsoleView({ trace, program, level }: { trace: Trace | null; program: Program; level: Level }) {
  const { t, tl } = useT();
  const lines = useMemo(() => {
    const out: Array<{ p: string; text: ReactNode; cls: string; msg?: boolean }> = [];
    if (!trace) return out;
    out.push({ p: '▶', text: level.output === 'web' ? 'index.html' : 'main.js', cls: '' });
    for (const d of program.diagnostics) {
      out.push({ p: d.severity === 'error' ? '✕' : '!', text: <Rich text={tl(d.message) + (d.line ? ` — ${tl({ ar: 'سطر', en: 'line' })} ${d.line}` : '')} />, cls: d.severity === 'error' ? 'err' : '', msg: true });
    }
    for (const e of trace.events) {
      if (e.t === 'log') out.push({ p: '›', text: e.text, cls: e.level === 'error' ? 'err' : '' });
    }
    const pr = traceProblem(trace);
    if (pr) out.push({ p: '✕', text: <Rich text={tl(pr.message)} />, cls: 'err', msg: true });
    return out;
  }, [trace, program, level, tl]);
  return (
    <div className="con fade-up" role="log" aria-live="polite" style={{ flex: 1, borderRadius: 14, overflow: 'auto', boxShadow: '0 0 0 1.5px #E2D6C3', background: '#FFFDF9' }}>
      {lines.length === 0 ? (
        <div className="cl" style={{ color: '#625B78' }}>
          <span>›</span>
          <span dir="auto">{t('noLogs')}</span>
        </div>
      ) : (
        lines.map((l, i) => (
          <div key={i} className={`cl ${l.cls}`} style={{ animationDelay: `${i * 0.06}s` }}>
            <span style={{ opacity: 0.55 }}>{l.p}</span>
            <span className={`iso ${l.msg ? 'msg' : ''}`} dir="auto">{l.text}</span>
          </div>
        ))
      )}
    </div>
  );
}

export function RobotLocked() {
  const { t } = useT();
  return (
    <div className="fade-up dots-dark" style={{ flex: 1, borderRadius: 14, display: 'grid', placeItems: 'center', textAlign: 'center', color: '#F3EEFF', padding: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Icon name="lock" size={72} stroke={1.5} style={{ color: '#B9B0E6' }} />
        <strong style={{ fontFamily: 'var(--f-display)', fontSize: 20 }}>{t('robotLocked')}</strong>
      </div>
    </div>
  );
}

/** Read-only code with block ↔ line highlighting. */
export function CodePane({ program, lang }: { program: Program; lang: 'html' | 'js' }) {
  const { t } = useT();
  const hoverId = useLevel((s) => s.hoverId);
  const execId = useLevel((s) => s.execId);
  const errId = useLevel((s) => (s.phase === 'error' || s.phase === 'fail' ? s.verdict?.problem?.blockId ?? null : null));
  const map = program.sourceMap;
  const marks: LineMarks = {
    hl: hoverId && map[hoverId] ? [map[hoverId].from, map[hoverId].to] : null,
    exec: execId && map[execId] ? map[execId].from : null,
    err: errId && map[errId] ? map[errId].from : null,
  };
  const onHoverLine = (line: number | null) => {
    if (line === null) return useLevel.getState().setHover(null);
    // innermost block covering the line
    let best: string | null = null;
    let size = Infinity;
    for (const [id, r] of Object.entries(map)) {
      if (line >= r.from && line <= r.to && r.to - r.from < size && id !== 'root') {
        best = id;
        size = r.to - r.from;
      }
    }
    useLevel.getState().setHover(best);
  };
  return (
    <div className="fade-up" style={{ flex: 1, borderRadius: 14, overflow: 'hidden', boxShadow: '0 0 0 1.5px #E2D6C3', minHeight: 0 }}>
      <CodeView code={program.display} lang={lang} marks={marks} onHoverLine={onHoverLine} label={t('code')} />
    </div>
  );
}
