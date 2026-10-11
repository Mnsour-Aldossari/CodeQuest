/** Bit's story bubble and the goal list (red until each check passes). */
import { useEffect, useState } from 'react';
import type { Level } from '../engine/types';
import { useLevel, type BitMsg, type Phase } from '../state/level';
import { useT, Rich } from '../i18n';
import { Bit, type Mood } from '../components/Bit';
import { Icon } from '../components/Icon';
import { sfx } from '../ui/sound';

export function moodFor(phase: Phase, msg: BitMsg, flash: boolean): Mood {
  if (phase === 'running') return 'thinking';
  if (phase === 'stepping') return 'running';
  if (phase === 'error' || phase === 'fail') return 'sad';
  if (phase === 'win') return 'celebrate';
  if (msg.kind === 'text' && msg.tone === 'hint') return 'thinking';
  if (msg.kind === 'text' && msg.tone === 'error') return 'sad';
  if (flash || msg.kind === 'nice') return 'happy';
  return 'idle';
}

export function useBitText(level: Level) {
  const { t, tl } = useT();
  const msg = useLevel((s) => s.msg);
  switch (msg.kind) {
    case 'story':
      return tl(level.story);
    case 'nice':
      return t('nice');
    case 'running':
      return t('running');
    case 'step':
      return t('stepMsg');
    case 'text':
      return tl(msg.text);
  }
}

export function StoryBubble({ level, compact = false }: { level: Level; compact?: boolean }) {
  const { t } = useT();
  const phase = useLevel((s) => s.phase);
  const msg = useLevel((s) => s.msg);
  const snap = useLevel((s) => s.snapId);
  const text = useBitText(level);
  const err = phase === 'error' || phase === 'fail' || (msg.kind === 'text' && msg.tone === 'error');
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: compact ? 'flex-start' : 'center', gap: compact ? 8 : 14, padding: compact ? '8px 10px' : '6px 12px', borderRadius: compact ? 20 : 22, background: compact ? '#fff' : 'rgba(255,255,255,.55)', boxShadow: compact ? (err ? '0 0 0 2px #D23B3B' : 'var(--sh-1)') : '0 0 0 1.5px rgba(194,78,43,.15) inset' }} data-tour="story">
      <Bit mood={moodFor(phase, msg, !!snap)} size={compact ? 52 : 88} />
      <div
        className={compact ? '' : 'bubble'}
        key={text}
        style={{ flex: 1, minWidth: 0, fontSize: compact ? 15 : 17, fontWeight: 700, lineHeight: 1.55, paddingTop: compact ? 4 : undefined, ...(err && !compact ? { boxShadow: '0 0 0 2px #D23B3B, 0 12px 28px rgba(210,59,59,.18)' } : {}) }}
        aria-live="polite"
        data-testid="bit-says"
      >
        {!compact && <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#C24E2B', marginBottom: 2 }}>{t('bitName')}</span>}
        <span className={compact ? '' : 'line-in'}>
          <Rich text={text} />
        </span>
      </div>
    </div>
  );
}

/** Goals reveal one by one after each run, with a pop and a rising tone. */
export function useShownGoals() {
  const runId = useLevel((s) => s.runId);
  const verdict = useLevel((s) => s.verdict);
  const [st, setSt] = useState({ runId: -1, n: 0 });
  useEffect(() => {
    if (!verdict) return;
    const timers = verdict.results.map((r, i) =>
      setTimeout(() => {
        setSt({ runId, n: i + 1 });
        if (r.pass) sfx.goal(i);
      }, (i + 1) * 280),
    );
    return () => timers.forEach(clearTimeout);
  }, [runId, verdict]);
  return { shown: verdict && st.runId === runId ? st.n : 0, verdict };
}

export function Goals({ level, pills = false }: { level: Level; pills?: boolean }) {
  const { t, tl } = useT();
  const { shown, verdict } = useShownGoals();
  const states = level.checks.map((_, i) => !!verdict?.results[i]?.pass && i < shown);
  const done = states.filter(Boolean).length;
  if (pills) {
    return (
      <div style={{ display: 'flex', gap: 6, padding: '8px 0 6px', overflowX: 'auto', scrollbarWidth: 'none' }} aria-label={t('goals')} data-tour="goals">
        {level.checks.map((c, i) => (
          <span key={i} className={`gp ${states[i] ? 'on' : 'off'}`} data-goal={states[i] ? 'on' : 'off'}>
            <span className="gi">
              <Icon name={states[i] ? 'check' : 'x'} size={12} stroke={3.5} />
            </span>
            <Rich text={tl(c.label)} />
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="panel" style={{ width: 400, flex: 'none', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, overflow: 'auto' }} data-tour="goals">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: 4 }}>
        <h2 style={{ fontSize: 16 }}>{t('goals')}</h2>
        <span className="ltr" style={{ fontSize: 13, fontWeight: 800, color: '#4A4360' }}>
          {done}/{level.checks.length}
        </span>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {level.checks.map((c, i) => {
          const r = verdict?.results[i];
          const firstFail = verdict?.results.findIndex((x) => !x.pass) ?? -1;
          const failedShown = !!r && !r.pass && i < shown && i === firstFail;
          return (
            <li key={i} className={`goal ${states[i] ? 'on' : 'off'}`} style={{ minHeight: 26, paddingBlock: 1, fontSize: 14 }} data-goal={states[i] ? 'on' : 'off'}>
              <span className="gi" style={{ width: 22, height: 22 }}>
                <Icon name={states[i] ? 'check' : 'x'} size={states[i] ? 14 : 12} stroke={3.5} />
              </span>
              <span className="gl" style={{ display: 'flex', flexDirection: 'column' }}>
                <span>
                  <Rich text={tl(c.label)} />
                </span>
                {failedShown && r.reason && (
                  <span className="line-in" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--err-d)' }}>
                    <Rich text={tl(r.reason)} />
                  </span>
                )}
              </span>
              <span className="sr-only">{states[i] ? '✓' : '✗'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
