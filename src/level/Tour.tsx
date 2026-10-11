/** First-level tour: four coach marks over palette, workspace, goals and Run. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { useProgress } from '../state/progress';
import { Bit } from '../components/Bit';
import type { StrKey } from '../i18n/strings';

const STEPS: Array<{ target: string; text: StrKey }> = [
  { target: 'palette', text: 'tour1' },
  { target: 'workspace', text: 'tour2' },
  { target: 'goals', text: 'tour3' },
  { target: 'run', text: 'tour4' },
];

export function Tour({ onDone }: { onDone: () => void }) {
  const { t, dir } = useT();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const finishTour = useProgress((s) => s.finishTour);

  useLayoutEffect(() => {
    const measure = () => {
      const el = [...document.querySelectorAll<HTMLElement>(`[data-tour="${STEPS[i].target}"]`)].find((e) => e.offsetParent !== null);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [i]);
  useEffect(() => btn.current?.focus(), [i]);

  const last = i === STEPS.length - 1;
  const next = () => {
    if (last) {
      finishTour();
      onDone();
    } else setI(i + 1);
  };
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const below = rect ? rect.bottom + 200 < vh : true;
  const top = rect ? (below ? rect.bottom + 16 : Math.max(12, rect.top - 190)) : vh / 2 - 90;
  const left = rect ? Math.min(Math.max(12, rect.left + rect.width / 2 - 170), vw - 352) : vw / 2 - 170;

  return (
    <div role="dialog" aria-modal="true" aria-label={t(STEPS[i].text)} dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 59 }} onKeyDown={(e) => e.key === 'Escape' && (finishTour(), onDone())}>
      {rect && <div className="tour-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />}
      <div className="bubble" style={{ position: 'fixed', zIndex: 61, top, left, width: 340, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Bit mood="wave" size={56} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.55 }}>{t(STEPS[i].text)}</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="ltr" style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-3)' }}>
              {i + 1}/{STEPS.length}
            </span>
            <button ref={btn} type="button" className="btn btn-primary btn-sm" onClick={next} data-testid="tour-next">
              {last ? t('tourDone') : t('tourNext')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
