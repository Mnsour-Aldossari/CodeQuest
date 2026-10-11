/** Home: the kingdom at dusk, Bit on his island, and the way in. */
import { useMemo } from 'react';
import { useProgress } from '../state/progress';
import { href, go } from '../state/nav';
import { playerLevel } from '../engine/stars';
import { useT } from '../i18n';
import { Bit } from '../components/Bit';
import { Icon, type IconName } from '../components/Icon';
import { LangSwitch, MotionToggle, SoundToggle } from '../components/TopControls';
import { useMapNodes } from './WorldMap';
import { WORLDS } from '../levels';
import type { StrKey } from '../i18n/strings';

export function Home() {
  const { t, dir, lang } = useT();
  const xp = useProgress((s) => s.xp);
  const reduce = useProgress((s) => s.settings.reducedMotion);
  const nodes = useMapNodes();
  const lv = playerLevel(xp);
  const cur = nodes.find((n) => n.state === 'cur');
  const started = nodes.some((n) => n.state === 'done');
  const vDone = nodes.slice(0, 5).filter((n) => n.state === 'done').length;
  const stars = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ x: ((i * 197) % 1400) / 14 + 1, y: ((i * 89) % 380) + 20, d: (i % 7) * 0.7, t: 4 + (i % 4) })), []);
  const glyphs = [
    { t: '</>', x: 60, y: 110, s: 30, d: 0 }, { t: '{ }', x: 90, y: 300, s: 26, d: 2 }, { t: ';', x: 53, y: 380, s: 34, d: 4 },
    { t: '#', x: 94, y: 120, s: 24, d: 1 }, { t: '( )', x: 4, y: 120, s: 24, d: 3 }, { t: '=>', x: 43, y: 70, s: 22, d: 5 }, { t: '<h1>', x: 3, y: 470, s: 18, d: 2.5 },
  ];
  const tiles: Array<{ key: StrKey; icon: IconName; bg: string; fg: string; to?: string }> = [
    { key: 'map', icon: 'map', bg: '#FBE3D6', fg: '#C24E2B', to: href({ name: 'map' }) },
    { key: 'album', icon: 'album', bg: '#DDF2E3', fg: '#1A7F53' },
    { key: 'notebook', icon: 'book', bg: '#EDE6FC', fg: '#6A3FD6' },
    { key: 'sandbox', icon: 'grid', bg: '#FFF1D6', fg: '#8A5A00' },
  ];

  return (
    <div className={`cq ${reduce ? 'rm' : ''}`} dir={dir} lang={lang} style={{ minHeight: '100dvh', position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, #2E2463 0%, #6B4C9A 34%, #E58E7A 66%, #FFD7A0 100%)' }}>
      <div className="sun" style={{ position: 'absolute', left: '50%', top: '52%', width: 520, height: 520, marginLeft: -260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,226,150,.95) 0%, rgba(255,190,110,.55) 38%, rgba(255,170,110,0) 70%)' }} />
      {stars.map((s, i) => <i key={i} className="amb amb-spark" style={{ left: `${s.x}%`, top: s.y, animationDelay: `${s.d}s`, animationDuration: `${s.t}s` }} />)}
      {glyphs.map((g, i) => <span key={i} className="amb amb-glyph" aria-hidden="true" style={{ left: `${g.x}%`, top: g.y, fontSize: g.s, animationDelay: `${g.d}s` }}>{g.t}</span>)}

      {/* kingdom silhouette: castle, grey forest, village rebuilt by progress */}
      <svg aria-hidden="true" viewBox="0 0 1440 330" preserveAspectRatio="xMidYMax slice" style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: 330 }}>
        <path d="M0 150 Q180 90 360 140 T720 130 T1080 120 T1440 140 V330 H0 Z" fill="#9C6C9E" opacity=".55" />
        <g fill="#2B2156">
          <rect x="120" y="70" width="60" height="140" /><rect x="200" y="30" width="70" height="180" /><rect x="290" y="80" width="56" height="130" />
          <path d="M120 70 L150 30 L180 70 Z M200 30 L235 -10 L270 30 Z M290 80 L318 44 L346 80 Z" />
          <rect x="160" y="120" width="150" height="90" />
        </g>
        <rect x="226" y="60" width="18" height="24" rx="9" fill="#3FE0E8" className="win-lit" opacity=".9" />
        <g fill="#4C5E57">
          <path d="M520 200 L560 80 L600 200 Z" /><path d="M580 200 L630 60 L680 200 Z" /><path d="M660 200 L700 100 L740 200 Z" /><path d="M720 200 L770 70 L820 200 Z" /><path d="M800 200 L840 110 L880 200 Z" />
        </g>
        {[[1010, 130, 90, 80], [1150, 110, 110, 100], [1300, 140, 80, 70]].map(([x, y, w, h], i) =>
          i < Math.max(1, Math.ceil(vDone * 0.6)) ? (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill="#8E3F2E" />
              <path d={`M${x - 14} ${y + 2} L${x + w / 2} ${y - 46} L${x + w + 14} ${y + 2} Z`} fill="#6E2B1E" />
              <rect x={x + w / 2 - 11} y={y + 30} width="22" height="22" rx="4" fill="#FFD27A" className="win-lit" style={{ animationDelay: `${i}s` }} />
            </g>
          ) : (
            <g key={i} fill="none" stroke="#6E2B1E" strokeWidth="3" strokeDasharray="8 6">
              <rect x={x} y={y} width={w} height={h} />
              <path d={`M${x - 10} ${y + 2} L${x + w / 2} ${y - 36} L${x + w + 10} ${y + 2}`} />
            </g>
          ),
        )}
        <path d="M0 220 Q240 190 480 214 T960 206 T1440 214 V330 H0 Z" fill="#3A2A55" />
        <path d="M0 262 Q300 236 620 258 T1440 250 V330 H0 Z" fill="#241A3C" />
      </svg>

      <header style={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: 'clamp(14px, 2.5vw, 28px) clamp(14px, 3.3vw, 48px) 0', flexWrap: 'wrap' }}>
        <div className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 18px 10px 10px', borderRadius: 22, background: 'rgba(255,255,255,.92)', boxShadow: '0 10px 28px rgba(23,18,58,.25)', minWidth: 'min(340px, 100%)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: '#E4DEFF', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
            <Bit size={52} shadow={false} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <strong style={{ fontFamily: 'var(--f-display)', fontSize: 18 }}>{t('appName')}</strong>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#4A4360' }}>
                {t('level')} <span className="ltr">{lv.level}</span>
              </span>
            </div>
            <div className="xp" role="progressbar" aria-label="XP" aria-valuemin={0} aria-valuemax={lv.need} aria-valuenow={lv.into}>
              <i style={{ width: `${(lv.into / lv.need) * 100}%` }} />
            </div>
            <span className="ltr" style={{ fontSize: 12, fontWeight: 700, color: '#4A4360', textAlign: 'end' }}>
              {lv.into} / {lv.need} XP
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LangSwitch dark />
          <SoundToggle dark />
          <MotionToggle dark />
        </div>
      </header>

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: 'clamp(20px, 4vw, 48px) clamp(16px, 6.6vw, 96px) 240px' }}>
        <main style={{ flex: '1 1 520px', maxWidth: 700, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 18 }}>
          <span className="chip fade-up" style={{ background: 'rgba(255,255,255,.18)', color: '#FFF3DD', boxShadow: '0 0 0 1.5px rgba(255,255,255,.35) inset', animationDelay: '.1s' }}>
            {t('kicker')}
          </span>
          <h1 className="logo-ar" style={{ margin: '4px 0 0' }}>{t('appName')}</h1>
          <div className="logo-en code" aria-hidden="true" style={{ display: 'flex', gap: 6, fontSize: 26, fontWeight: 700, color: '#FFE3B0', letterSpacing: 6 }}>
            {'CODE QUEST'.split('').map((c, i) => <span key={i} style={{ animationDelay: `${0.5 + i * 0.06}s` }}>{c === ' ' ? ' ' : c}</span>)}
          </div>
          <p className="fade-up" style={{ fontSize: 'clamp(17px, 1.6vw, 21px)', fontWeight: 500, color: '#FFF3E6', maxWidth: 560, lineHeight: 1.6, animationDelay: '.7s' }}>
            {t('tag')}
          </p>
          <div className="fade-up" style={{ position: 'relative', marginTop: 10, animationDelay: '.9s' }}>
            <div className="cta-glow" />
            <button type="button" className="btn btn-primary btn-lg" style={{ minWidth: 'min(300px, 80vw)' }} onClick={() => go(cur && started ? { name: 'level', id: cur.id } : started ? { name: 'map' } : { name: 'level', id: 'html-1' })} data-testid="start">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ transform: dir === 'rtl' ? undefined : 'scaleX(-1)' }}>
                <path d="M17 5.5v13a1 1 0 0 1-1.5.9L5 13a1.2 1.2 0 0 1 0-2l10.5-6.4a1 1 0 0 1 1.5.9z" />
              </svg>
              {started ? t('continue') : t('start')}
            </button>
          </div>
          <nav aria-label={t('menu')} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14, width: 'min(620px, 100%)', marginTop: 14 }}>
            {tiles.map((tile, i) =>
              tile.to ? (
                <a key={tile.key} href={tile.to} className="menu-tile pop-in" style={{ animationDelay: `${1.05 + i * 0.1}s` }}>
                  <span className="ic" style={{ background: tile.bg, color: tile.fg }}><Icon name={tile.icon} size={26} /></span>
                  {t(tile.key)}
                </a>
              ) : (
                <button key={tile.key} type="button" className="menu-tile pop-in" aria-disabled="true" style={{ animationDelay: `${1.05 + i * 0.1}s` }} title={t('soon')}>
                  <span className="ic" style={{ background: tile.bg, color: tile.fg }}><Icon name={tile.icon} size={26} /></span>
                  {t(tile.key)}
                  <span className="chip" style={{ position: 'absolute', top: -10, insetInlineEnd: -6, height: 24, fontSize: 12, background: '#2A2163', color: '#fff', boxShadow: 'none' }}>{t('soon')}</span>
                </button>
              ),
            )}
          </nav>
        </main>

        <div className="bob" style={{ flex: '0 1 380px', display: 'flex', flexDirection: 'column', alignItems: 'center', animationDuration: '4.5s', margin: '0 auto' }}>
          <div className="bubble" style={{ alignSelf: 'center', marginBottom: 10, maxWidth: 320, fontWeight: 700, fontSize: 17, animationDelay: '1.4s' }}>
            {t('bitHello')}
          </div>
          <Bit mood="wave" size={230} />
          <svg width="300" height="98" viewBox="0 0 340 110" aria-hidden="true" style={{ marginTop: -24 }}>
            <path d="M20 26 Q170 2 320 26 Q300 70 230 92 Q170 110 110 92 Q40 70 20 26 Z" fill="#5A3E6E" />
            <path d="M20 26 Q170 2 320 26 Q290 44 170 44 Q50 44 20 26 Z" fill="#8FC89A" />
            <rect x="250" y="-6" width="6" height="34" fill="#7A4A2A" />
            <rect x="226" y="-4" width="56" height="20" rx="5" fill="#F6E6CA" stroke="#7A4A2A" strokeWidth="2.5" />
            <text x="254" y="11" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="700" fill="#C24E2B">&lt;/&gt;</text>
          </svg>
        </div>
      </div>

      <div className="fade-up" style={{ position: 'absolute', bottom: 30, insetInlineStart: 'clamp(16px, 6.6vw, 96px)', display: 'flex', gap: 12, zIndex: 3, flexWrap: 'wrap', animationDelay: '1.5s' }}>
        {WORLDS.map((w, i) => {
          const ns = nodes.filter((n) => n.id.startsWith(w.id + '-'));
          const d = ns.filter((n) => n.state === 'done').length;
          const open = ns.some((n) => n.state !== 'lock');
          return (
            <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px 8px 10px', borderRadius: 16, background: `rgba(255,249,240,${[0.94, 0.72, 0.55][i]})`, fontWeight: 700, fontSize: 15 }}>
              {open ? <span style={{ width: 12, height: 12, borderRadius: '50%', background: w.color }} /> : <Icon name="lock" size={14} stroke={2.6} />}
              {t(w.id === 'html' ? 'wHtml' : w.id === 'css' ? 'wCss' : 'wJs')}
              <span className="ltr" style={{ color: '#4A4360' }}>{d}/{ns.length}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
