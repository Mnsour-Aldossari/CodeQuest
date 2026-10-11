/** Win sequence: the world rebuilds, stars fly in, XP counts up, then the "تعلّمت" card. */
import { useEffect, useRef, useState } from 'react';
import type { Level, Loc } from '../engine/types';
import { useT, Rich } from '../i18n';
import { Bit } from '../components/Bit';
import { Icon, Star } from '../components/Icon';
import { useProgress } from '../state/progress';
import { sfx } from '../ui/sound';

const CONFETTI = ['#C24E2B', '#F2A93B', '#1A7F53', '#6A3FD6', '#3FE0E8', '#D6457F', '#FFC53D'];

export function Confetti({ n = 40 }: { n?: number }) {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${((i * 13) % 20) / 10}s`, animationDuration: `${(2.4 + (i % 5) * 0.3).toFixed(1)}s` }} />
      ))}
    </div>
  );
}

/** HTML Village restoration: the house builds itself and its sign swings into place. */
function HouseRebuild({ sign }: { sign: string }) {
  return (
    <svg viewBox="0 0 540 230" aria-hidden="true" style={{ display: 'block', width: '100%', height: 'auto', background: 'linear-gradient(#FFE7C2, #F6E6CA)' }}>
      <circle cx="440" cy="60" r="34" fill="#FFD27A" className="glow-on" style={{ animationDelay: '.2s' }} />
      <path d="M0 200 Q270 170 540 196 V230 H0Z" fill="#EDD3A8" />
      <g className="build-in" style={{ animationDelay: '.2s' }}><rect x="170" y="186" width="200" height="16" rx="4" fill="#9C6B4A" /></g>
      <g className="build-in" style={{ animationDelay: '.45s' }}><rect x="186" y="110" width="168" height="78" fill="#E3A274" stroke="#7A2E1F" strokeWidth="4" /></g>
      <g className="build-in" style={{ animationDelay: '.75s' }}><path d="M170 114 L270 46 L370 114Z" fill="#C24E2B" stroke="#7A2E1F" strokeWidth="4" strokeLinejoin="round" /></g>
      <g className="build-in" style={{ animationDelay: '1s' }}><rect x="254" y="140" width="32" height="48" rx="4" fill="#7A2E1F" /><circle cx="280" cy="166" r="2.5" fill="#FFD27A" /></g>
      <g className="glow-on" style={{ animationDelay: '1.2s' }}>
        <rect x="204" y="128" width="30" height="26" rx="4" fill="#FFD27A" stroke="#7A2E1F" strokeWidth="3" />
        <rect x="306" y="128" width="30" height="26" rx="4" fill="#FFD27A" stroke="#7A2E1F" strokeWidth="3" />
      </g>
      <g className="sign-swing">
        <line x1="232" y1="84" x2="232" y2="96" stroke="#7A2E1F" strokeWidth="3" />
        <line x1="308" y1="84" x2="308" y2="96" stroke="#7A2E1F" strokeWidth="3" />
        <rect x="214" y="94" width="112" height="28" rx="7" fill="#FFF6E4" stroke="#7A2E1F" strokeWidth="3" />
        <text x="270" y="114" textAnchor="middle" direction="rtl" fontFamily="Baloo Bhaijaan 2, sans-serif" fontWeight="800" fontSize="15" fill="#C24E2B">{sign.slice(0, 14)}</text>
      </g>
      <g className="build-in" style={{ animationDelay: '1.7s' }}>
        <line x1="270" y1="48" x2="270" y2="14" stroke="#7A2E1F" strokeWidth="3" />
        <path className="flag" d="M270 14 h26 l-6 7 6 7 h-26z" fill="#F2A93B" />
      </g>
      <circle cx="180" cy="196" r="14" fill="#fff" className="puff" style={{ animationDelay: '.3s' }} />
      <circle cx="360" cy="196" r="12" fill="#fff" className="puff" style={{ animationDelay: '.5s' }} />
      <foreignObject x="396" y="104" width="110" height="114">
        <Bit mood="celebrate" size={96} shadow={false} />
      </foreignObject>
    </svg>
  );
}

/** Minimal HTML token colouring for the code card (text only, never markup). */
export function CodeLines({ code, dark = true }: { code: string; dark?: boolean }) {
  const lines = code.split('\n');
  return (
    <div className={`codeview ${dark ? 'dark-code' : ''}`} style={{ borderRadius: 14, background: dark ? '#1F1A2E' : '#FFFDF9', padding: '10px 0', fontSize: 13.5, overflow: 'auto', maxHeight: 220 }}>
      {lines.map((l, i) => (
        <span key={i} className={`ln ${dark ? 'dark-code' : ''}`} style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
          {l.split(/(<\/?[a-zA-Z0-9]+(?:\s[^>]*)?>)/).map((part, j) =>
            part.startsWith('<') && part.endsWith('>') ? <span key={j} className="tok-tag">{part}</span> : <span key={j} className="tok-txt" dir="auto">{part}</span>,
          )}
        </span>
      ))}
    </div>
  );
}

export interface WinInfo {
  stars: number;
  xp: number;
  badge: Loc | null;
  code: string;
  signText: string;
}

export function WinSequence({ level, info, onNext, onReplay, nextLabel }: { level: Level; info: WinInfo; onNext: () => void; onReplay: () => void; nextLabel: string }) {
  const { t, tl, dir } = useT();
  const reduce = useProgress((s) => s.settings.reducedMotion);
  const [xp, setXp] = useState(reduce ? info.xp : 0);
  const [learned, setLearned] = useState(reduce);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    nextRef.current?.focus();
    sfx.win();
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    for (let i = 0; i < info.stars; i++) timers.push(setTimeout(() => sfx.star(i), 600 + i * 280));
    if (!reduce) {
      timers.push(setTimeout(() => {
        const start = performance.now();
        const tick = (now: number) => {
          const k = Math.min(1, (now - start) / 900);
          setXp(Math.round(info.xp * k));
          if (k < 1) raf = requestAnimationFrame(tick);
        };
        let raf = requestAnimationFrame(tick);
        timers.push(raf as unknown as ReturnType<typeof setTimeout>);
      }, 1300));
      timers.push(setTimeout(() => setLearned(true), 2300));
    }
    return () => timers.forEach((x) => clearTimeout(x));
  }, [info, reduce]);

  return (
    <div className="ov" dir={dir} role="dialog" aria-modal="true" aria-labelledby="win-title" style={{ flexWrap: 'wrap', overflowY: 'auto', padding: 16 }}>
      <Confetti />
      <section className="panel pop-in" style={{ width: 'min(540px, 100%)', overflow: 'hidden', textAlign: 'center', paddingBottom: 26, position: 'relative' }}>
        <HouseRebuild sign={info.signText} />
        <div style={{ padding: '18px 28px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <h2 id="win-title" className="fade-up" style={{ fontSize: 32, animationDelay: '.3s' }}>
            {t('winTitle')}
          </h2>
          <p className="fade-up" style={{ fontSize: 17, color: '#4A4360', fontWeight: 500, animationDelay: '.4s' }}>
            {t('winSub')}
          </p>
          <div dir="ltr" style={{ display: 'flex', gap: 10, margin: '4px 0' }} aria-label={`${info.stars} / 3`} role="img">
            {[0, 1, 2].map((k) => (
              <Star key={k} on={k < info.stars} size={64} className="star-fly" style={{ animationDelay: `${0.5 + k * 0.28}s` }} />
            ))}
          </div>
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12 }}>
            <strong className="ltr pop-in" style={{ fontFamily: 'var(--f-display)', fontSize: 28, color: '#C24E2B', minWidth: 120, animationDelay: '1.3s' }} data-testid="win-xp">
              +{xp} XP
            </strong>
            <div className="xp" style={{ flex: 1, height: 16 }}>
              <i className="xp-grow" style={{ width: `${Math.min(100, (xp / Math.max(1, info.xp)) * 100)}%`, animation: 'none' }} />
            </div>
          </div>
          {info.badge && (
            <div className="badge-pop" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 16, background: '#FFF1D6', fontWeight: 800, fontSize: 15, color: '#6B4300' }}>
              <svg width="30" height="30" viewBox="0 0 40 40" aria-hidden="true">
                <path d="M20 3 34 11v18L20 37 6 29V11z" fill="#F2A93B" stroke="#8A5A00" strokeWidth="2.5" />
                <path d="m14 17-3 3 3 3M26 17l3 3-3 3M22 15l-4 10" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('newBadge')}: {tl(info.badge)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button ref={nextRef} type="button" className="btn btn-primary" onClick={onNext} data-testid="win-next">
              {nextLabel}
              <Icon name={dir === 'rtl' ? 'chevronBack' : 'chevron'} size={20} stroke={2.6} />
            </button>
            <button type="button" className="btn btn-secondary" onClick={onReplay}>
              {t('replay')}
            </button>
          </div>
        </div>
      </section>
      {learned && (
        <section className="panel slide-in-x" aria-label={t('learnedT')} style={{ width: 'min(440px, 100%)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', overflow: 'hidden', textAlign: 'start' }} data-testid="learned-card">
          <div style={{ position: 'absolute', insetBlockStart: 0, insetInline: 0, height: 8, background: 'repeating-linear-gradient(90deg, #C24E2B 0 18px, #F2A93B 18px 36px)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 14, background: '#EDE6FC', color: '#6A3FD6' }}>
                <Icon name="book" size={24} />
              </span>
              <h2 style={{ fontSize: 28 }}>{t('learnedT')}</h2>
            </div>
            <span className="chip" style={{ background: '#FBE3D6', boxShadow: 'none', color: '#8E3219' }}>
              {t('wHtml')}
            </span>
          </div>
          <p style={{ fontFamily: 'var(--f-display)', fontSize: 22, fontWeight: 700, lineHeight: 1.5 }}>
            <Rich text={tl(level.concept.one)} />
          </p>
          <div style={{ padding: '12px 14px', borderRadius: 14, background: '#FFF6E6' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#8E3219' }}>{t('inRealLife')}</span>
            <p style={{ fontSize: 16, fontWeight: 500, color: '#4A4360', marginTop: 2 }}>
              <Rich text={tl(level.concept.real)} />
            </p>
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#625B78' }}>{t('yourCode')}</span>
          <CodeLines code={info.code} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#6A3FD6', minHeight: 44 }}>
            <Icon name="check" size={18} stroke={2.6} />
            {t('learnedSaved')}
          </span>
        </section>
      )}
    </div>
  );
}
