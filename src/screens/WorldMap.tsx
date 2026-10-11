/**
 * Kingdom map. The village rebuilds, the forest regains color and the castle's gears
 * turn as worlds are restored. Desktop: a parallax canvas; mobile: a scrolling path.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PLAN, WORLDS, levelById } from '../levels';
import { useProgress } from '../state/progress';
import { go, href } from '../state/nav';
import { useT } from '../i18n';
import { Icon, Star } from '../components/Icon';
import { Bit } from '../components/Bit';
import { LangSwitch, SoundToggle } from '../components/TopControls';
import { useIsMobile } from '../ui/useMedia';
import type { Block, Progress } from '../engine/types';

const P: Array<[number, number]> = [
  [1350, 760], [1250, 640], [1340, 520], [1210, 420], [1090, 520],
  [1000, 650], [880, 560], [780, 680], [660, 580], [600, 440],
  [480, 520], [370, 640], [250, 560], [160, 430], [290, 330], [430, 240], [270, 205], [110, 280],
];

export type NodeState = 'done' | 'cur' | 'lock';

export interface MapNode {
  id: string;
  num: string;
  name: string;
  color: string;
  state: NodeState;
  ready: boolean;
  stars: number;
  thumb: string;
}

function firstHeading(tree?: Block): string {
  if (!tree) return '';
  let s = '';
  const visit = (b: Block) => {
    if (s) return;
    if ((b.type === 'html.el' || b.type === 'html.li') && b.slots.content?.[0]) s = String(b.slots.content[0].fields.text ?? '');
    Object.values(b.slots).forEach((k) => k.forEach(visit));
  };
  visit(tree);
  return s;
}

export function useMapNodes(): MapNode[] {
  const { tl } = useT();
  const levels = useProgress((s) => s.levels);
  return useMemo(() => buildNodes(levels, tl), [levels, tl]);
}

export function buildNodes(levels: Progress['levels'], tl: (l: { ar: string; en: string }) => string): MapNode[] {
  let curFound = false;
  return PLAN.map((p, i) => {
    const solved = !!levels[p.id]?.solved;
    const prevSolved = i === 0 || !!levels[PLAN[i - 1].id]?.solved;
    const ready = !!levelById(p.id);
    let state: NodeState = 'lock';
    if (solved) state = 'done';
    else if (prevSolved && ready && !curFound) {
      state = 'cur';
      curFound = true;
    }
    return {
      id: p.id,
      num: `${WORLDS.indexOf(p.world) + 1}-${p.num}`,
      name: tl(p.title),
      color: p.world.color,
      state,
      ready,
      stars: levels[p.id]?.stars ?? 0,
      thumb: firstHeading(levels[p.id]?.tree) || tl(p.title),
    };
  });
}

function seg(a: [number, number], b: [number, number], i: number, off = 40) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const s = i % 2 ? 1 : -1;
  const cx = mx + (-dy / len) * 46 * s;
  const cy = my + (dx / len) * 46 * s;
  return `M${a[0] + off} ${a[1] + off} Q${cx + off} ${cy + off} ${b[0] + off} ${b[1] + off}`;
}

/** Which path segment was just unlocked (to draw it once). */
function useFreshSegment(curIndex: number) {
  const [fresh] = useState(() => {
    try {
      const seen = Number(sessionStorage.getItem('cq-map-cur') ?? '-1');
      return curIndex > seen && seen >= 0 ? curIndex - 1 : -1;
    } catch {
      return -1;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem('cq-map-cur', String(curIndex));
    } catch {
      /* storage blocked */
    }
  }, [curIndex]);
  return fresh;
}

export function WorldMap() {
  const isMobile = useIsMobile();
  const nodes = useMapNodes();
  return isMobile ? <MobileMap nodes={nodes} /> : <DesktopMap nodes={nodes} />;
}

function Header({ nodes, light = false }: { nodes: MapNode[]; light?: boolean }) {
  const { t, dir } = useT();
  const xp = useProgress((s) => s.xp);
  const starTotal = nodes.reduce((s, n) => s + n.stars, 0);
  return (
    <header style={{ position: 'absolute', top: 20, insetInline: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, zIndex: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href={href({ name: 'home' })} className="btn btn-secondary btn-icon" aria-label={t('home')}>
          <Icon name={dir === 'rtl' ? 'chevron' : 'chevronBack'} size={22} stroke={2.4} />
        </a>
        <h1 style={{ fontSize: 26, color: light ? '#fff' : '#1F1A2E', textShadow: light ? 'none' : '0 2px 0 rgba(255,255,255,.6)' }}>{t('mapTitle')}</h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 6, borderRadius: 999, background: 'rgba(255,255,255,.9)', boxShadow: '0 8px 20px rgba(23,18,58,.25)' }}>
        <span className="chip" style={{ height: 40, fontSize: 16 }}>
          <Star on size={22} />
          <span className="ltr">{starTotal} / {nodes.length * 3}</span>
        </span>
        <span className="chip" style={{ height: 40, fontSize: 16, background: '#2A2163', color: '#fff', boxShadow: 'none' }}>
          <span className="ltr">{xp} XP</span>
        </span>
        <LangSwitch />
        <SoundToggle />
      </div>
    </header>
  );
}

function DesktopMap({ nodes }: { nodes: MapNode[] }) {
  const { t, tl, dir, lang } = useT();
  const reduce = useProgress((s) => s.settings.reducedMotion);
  const wrap = useRef<HTMLDivElement>(null);
  const layers = useRef<Array<HTMLDivElement | null>>([]);
  const [k, setK] = useState(1);
  const cur = nodes.findIndex((n) => n.state === 'cur');
  const fresh = useFreshSegment(cur);
  const done = nodes.filter((n) => n.state === 'done').length;
  const vDone = nodes.slice(0, 5).filter((n) => n.state === 'done').length;
  const fDone = nodes.slice(5, 10).filter((n) => n.state === 'done').length;
  const jDone = nodes.slice(10).filter((n) => n.state === 'done').length;

  useLayoutEffect(() => {
    const fit = () => setK(Math.min(window.innerWidth / 1440, window.innerHeight / 900));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const onMove = (e: React.MouseEvent) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const my = ((e.clientY - r.top) / r.height) * 2 - 1;
    requestAnimationFrame(() => {
      [10, 22, 40].forEach((f, i) => {
        const el = layers.current[i];
        if (el) el.style.transform = `translate(${(-mx * f).toFixed(1)}px, ${(-my * f * 0.6).toFixed(1)}px)`;
      });
    });
  };

  const houses: Array<[number, number]> = [[1090, 560], [1200, 620], [1300, 700], [1150, 760], [1340, 560]];
  const layer = { position: 'absolute' as const, inset: -40, transition: 'transform .5s cubic-bezier(.22,1,.36,1)' };
  const parts = useMemo(() => {
    const p: Array<{ cls: string; x: number; y: number; d: number }> = [];
    for (let i = 0; i < 9; i++) p.push({ cls: 'amb-dust', x: 1080 + ((i * 47) % 340), y: 300 + ((i * 83) % 520), d: i * 0.9 });
    for (let i = 0; i < 9; i++) p.push({ cls: 'amb-fly', x: 520 + ((i * 61) % 480), y: 330 + ((i * 97) % 520), d: i * 0.6 });
    for (let i = 0; i < 9; i++) p.push({ cls: 'amb-spark', x: 40 + ((i * 53) % 400), y: 420 + ((i * 71) % 440), d: i * 0.5 });
    return p;
  }, []);

  return (
    <div className={`cq ${reduce ? 'rm' : ''}`} dir={dir} lang={lang} style={{ height: '100dvh', overflow: 'hidden', position: 'relative', background: '#1E1750' }}>
      <div ref={wrap} onMouseMove={onMove} style={{ position: 'absolute', left: '50%', top: '50%', width: 1440, height: 900, transform: `translate(-50%, -50%) scale(${Math.max(k, 0.55)})`, overflow: 'hidden', background: 'linear-gradient(90deg, #1E1750 0%, #352A78 24%, #6E9D84 36%, #B9D9AE 56%, #EBD9AE 70%, #F7E6C6 100%)' }}>
        {/* far layer: regions */}
        <div ref={(el) => { layers.current[0] = el; }} style={layer}>
          <svg width="1520" height="980" viewBox="-40 -40 1520 980" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
            <circle cx="120" cy="180" r="46" fill="#F3EEFF" opacity=".9" />
            <circle cx="104" cy="168" r="44" fill="#2A2163" />
            <g fill="#17123A">
              <rect x="40" y="260" width="70" height="300" /><path d="M40 260 L75 214 L110 260Z" />
              <rect x="130" y="200" width="90" height="360" /><path d="M130 200 L175 140 L220 200Z" />
              <rect x="240" y="280" width="70" height="280" /><path d="M240 280 L275 236 L310 280Z" />
              <rect x="90" y="330" width="200" height="230" />
            </g>
            <rect x="164" y="250" width="22" height="34" rx="11" fill="#3FE0E8" opacity={jDone > 0 ? 0.95 : 0.35} />
            <g style={{ transformOrigin: '190px 410px' }} className={jDone > 0 ? 'spin' : ''}>
              <circle cx="190" cy="410" r="34" fill="none" stroke="#4A4280" strokeWidth="12" strokeDasharray="10 8" />
              <circle cx="190" cy="410" r="12" fill="#4A4280" />
            </g>
            <g style={{ transformOrigin: '252px 456px' }} className={jDone > 0 ? 'spin-r' : ''}>
              <circle cx="252" cy="456" r="22" fill="none" stroke="#4A4280" strokeWidth="9" strokeDasharray="7 6" />
            </g>
            <g style={{ filter: `grayscale(${(1 - fDone / 5).toFixed(2)})`, transition: 'filter 1.6s ease' }}>
              <path d="M480 900 V320 Q760 250 1040 320 V900Z" fill="#7DBB7C" opacity=".5" />
              <path d="M500 420 L540 300 L580 420Z" fill="#2E8A57" /><path d="M560 400 L610 250 L660 400Z" fill="#1F7A4A" />
              <path d="M680 380 L720 270 L760 380Z" fill="#3E9C62" /><path d="M760 400 L810 240 L860 400Z" fill="#1F7A4A" />
              <path d="M880 390 L920 280 L960 390Z" fill="#2E8A57" /><path d="M940 410 L990 270 L1040 410Z" fill="#3E9C62" />
              <circle cx="600" cy="790" r="9" fill="#E85D9A" /><circle cx="640" cy="800" r="7" fill="#FFD25A" />
              <circle cx="900" cy="820" r="9" fill="#E85D9A" /><circle cx="740" cy="860" r="8" fill="#E85D9A" />
            </g>
            <path d="M1040 900 V300 Q1260 240 1480 300 V900Z" fill="#F2D59E" opacity=".55" />
            {houses.map(([x, y], i) => (
              <g key={i} transform={`translate(${x} ${y})`}>
                {i < vDone ? (
                  <g className={i === vDone - 1 && fresh === vDone - 1 ? 'build-in' : ''}>
                    <rect x="0" y="34" width="64" height="50" rx="4" fill="#D98C5F" stroke="#7A2E1F" strokeWidth="3" />
                    <path d="M-8 38 L32 4 L72 38Z" fill="#C24E2B" stroke="#7A2E1F" strokeWidth="3" strokeLinejoin="round" />
                    <rect x="24" y="56" width="16" height="28" rx="3" fill="#7A2E1F" />
                    <rect x="8" y="46" width="12" height="12" rx="2" fill="#FFD27A" /><rect x="46" y="46" width="12" height="12" rx="2" fill="#FFD27A" />
                  </g>
                ) : (
                  <g fill="none" stroke="#9C6B4A" strokeWidth="2.5" strokeDasharray="6 5" opacity=".7">
                    <rect x="0" y="34" width="64" height="50" rx="4" /><path d="M-8 38 L32 4 L72 38" />
                  </g>
                )}
              </g>
            ))}
          </svg>
        </div>

        {/* mid layer: path + nodes */}
        <div ref={(el) => { layers.current[1] = el; }} style={layer}>
          <svg width="1520" height="980" viewBox="-40 -40 1520 980" aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            {P.slice(0, -1).map((a, i) => (
              <path key={i} d={seg(a, P[i + 1], i)} fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="6" strokeLinecap="round" strokeDasharray="1 14" />
            ))}
            {P.slice(0, -1).map((a, i) =>
              i < Math.max(done, cur) ? (
                <g key={`d${i}`}>
                  <path d={seg(a, P[i + 1], i)} fill="none" stroke="rgba(31,26,46,.22)" strokeWidth="20" strokeLinecap="round" pathLength={1} className={i === fresh ? 'draw' : ''} />
                  <path d={seg(a, P[i + 1], i)} fill="none" stroke="#FFF6E4" strokeWidth="12" strokeLinecap="round" pathLength={1} className={i === fresh ? 'draw' : ''} />
                  <path d={seg(a, P[i + 1], i)} fill="none" stroke="#F2A93B" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.02 0.03" pathLength={1} />
                </g>
              ) : null,
            )}
          </svg>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label={t('mapTitle')}>
            {nodes.map((n, i) => (
              <li key={n.id} className="map-node" style={{ position: 'absolute', left: P[i][0] + 40, top: P[i][1] + 40, transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                {n.state === 'done' && (
                  <div className="thumb" aria-hidden="true">
                    <div className="tbar"><i /><i /><i /></div>
                    <div style={{ padding: '6px 8px 8px', fontFamily: 'var(--f-body)' }}>
                      <div className="iso" dir="auto" style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.thumb}</div>
                      <div style={{ height: 4, width: '80%', borderRadius: 2, background: '#E8DCCB', marginTop: 5 }} />
                      <div style={{ height: 4, width: '55%', borderRadius: 2, background: '#E8DCCB', marginTop: 3 }} />
                    </div>
                  </div>
                )}
                {n.state === 'cur' && (
                  <span className="bob" style={{ position: 'absolute', bottom: 'calc(100% + 26px)' }}>
                    <Bit size={64} />
                  </span>
                )}
                {n.state === 'lock' ? (
                  <span className="nd lock" role="img" aria-label={`${n.num} ${n.name} — ${n.ready ? t('locked') : t('soon')}`}>
                    <Icon name="lock" size={20} stroke={2.6} />
                  </span>
                ) : (
                  <a href={href({ name: 'level', id: n.id })} className={`nd ${n.state} ${n.state === 'cur' ? 'pop-in' : ''}`} style={{ background: n.color }} aria-label={`${n.num} ${n.name}${n.state === 'cur' ? ` — ${t('playIt')}` : ''}`} data-node={n.id}>
                    {n.state === 'cur' && <span className="pulse-ring" />}
                    <span className="ltr">{n.num}</span>
                  </a>
                )}
                {n.state === 'done' && (
                  <div dir="ltr" style={{ display: 'flex', gap: 1, marginTop: 2 }} role="img" aria-label={`${n.stars}/3`}>
                    {[0, 1, 2].map((s) => <Star key={s} on={s < n.stars} size={20} />)}
                  </div>
                )}
                {(n.state === 'cur' || (n.state === 'lock' && !n.ready && (i === 5 || i === 10))) && <span className="nlabel">{n.state === 'cur' ? n.name : t('soon')}</span>}
              </li>
            ))}
          </ul>
        </div>

        {/* near layer */}
        <div ref={(el) => { layers.current[2] = el; }} style={{ ...layer, pointerEvents: 'none' }}>
          {parts.map((p, i) => <i key={i} className={`amb ${p.cls}`} style={{ left: p.x, top: p.y, animationDelay: `${p.d}s` }} />)}
          <svg width="1520" height="980" viewBox="-40 -40 1520 980" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
            <path d="M1380 940 Q1420 860 1500 850 V940Z" fill="#E7C48C" />
            <path d="M-40 820 Q30 780 60 940 H-40Z" fill="#120E30" />
            <path d="M700 940 Q720 880 760 870 Q770 910 800 940Z" fill="#5E9B6E" opacity=".8" />
          </svg>
        </div>

        {/* world banners */}
        {([[0, 1230, '#FFF6E6', 'house', vDone, 'wHtml', 'wHtmlSub'], [1, 770, '#F1FAF0', 'tree', fDone, 'wCss', 'wCssSub'], [2, 250, '#2A2163', 'gear', jDone, 'wJs', 'wJsSub']] as const).map(([wi, left, bg, icon, n, name, sub]) => (
          <div key={wi} className="banner fade-up" style={{ left, background: bg, color: wi === 2 ? '#F3EEFF' : undefined, animationDelay: `${wi * 0.15}s` }}>
            <span className="bi" style={{ background: WORLDS[wi].color, color: '#fff' }}><Icon name={icon} size={24} /></span>
            <div>
              <h2 style={{ fontSize: 20 }}>{t(name)}</h2>
              <p style={{ fontSize: 13, fontWeight: 700, color: wi === 2 ? '#B9B0E6' : '#4A4360' }}>
                {t(sub)} · <span className="ltr">{n}/{WORLDS[wi].plan.length}</span>
              </p>
            </div>
          </div>
        ))}
        <Header nodes={nodes} />
      </div>
      {cur >= 0 && (
        <button type="button" className="sr-only" onClick={() => go({ name: 'level', id: nodes[cur].id })}>
          {tl({ ar: 'العب المرحلة التالية', en: 'Play the next level' })}
        </button>
      )}
    </div>
  );
}

function MobileMap({ nodes }: { nodes: MapNode[] }) {
  const { t, dir, lang } = useT();
  const reduce = useProgress((s) => s.settings.reducedMotion);
  const xs = [190, 290, 200, 90, 180, 280, 190, 85, 170, 280, 200, 90, 180, 285, 190, 90, 190, 280];
  const H = 260 + nodes.length * 92;
  const pts: Array<[number, number]> = xs.map((x, i) => [x, H - 140 - i * 92]);
  const cur = Math.max(0, nodes.findIndex((n) => n.state === 'cur'));
  const fDone = nodes.slice(5, 10).filter((n) => n.state === 'done').length;
  const sc = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sc.current;
    if (el) el.scrollTop = Math.max(0, pts[cur][1] - el.clientHeight / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const seg2 = (a: [number, number], b: [number, number], i: number) => `M${a[0]} ${a[1]} Q${(a[0] + b[0]) / 2 + 40 * (i % 2 ? 1 : -1)} ${(a[1] + b[1]) / 2} ${b[0]} ${b[1]}`;
  const next = nodes[cur];
  return (
    <div className={`cq ${reduce ? 'rm' : ''}`} dir={dir} lang={lang} style={{ height: '100dvh', position: 'relative', overflow: 'hidden', background: '#F7E6C6' }}>
      <div ref={sc} style={{ position: 'absolute', inset: 0, overflowY: 'auto', scrollbarWidth: 'none' }}>
        <div style={{ position: 'relative', width: 375, height: H, margin: '0 auto' }}>
          <div style={{ position: 'absolute', left: -400, right: -400, top: 0, height: H * 0.42, background: 'linear-gradient(#17123A, #2B2370)' }} />
          <div style={{ position: 'absolute', left: -400, right: -400, top: H * 0.4, height: H * 0.3, background: 'linear-gradient(#5E9B78, #BFE0B5)', filter: `grayscale(${(1 - fDone / 5).toFixed(2)})` }} />
          <div style={{ position: 'absolute', left: -400, right: -400, top: H * 0.7, bottom: 0, background: 'linear-gradient(#EBD9AE, #F7E6C6)' }} />
          <svg width="375" height={H} viewBox={`0 0 375 ${H}`} aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
            {pts.slice(0, -1).map((a, i) => (
              <path key={i} d={seg2(a, pts[i + 1], i)} fill="none" stroke={i < cur ? '#FFF6E4' : 'rgba(255,255,255,.7)'} strokeWidth={i < cur ? 10 : 5} strokeLinecap="round" strokeDasharray={i < cur ? undefined : '1 12'} />
            ))}
          </svg>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {nodes.map((n, i) => (
              <li key={n.id} style={{ position: 'absolute', left: pts[i][0], top: pts[i][1], transform: 'translate(-50%,-50%)' }}>
                {n.state === 'lock' ? (
                  <span className="nd lock" style={{ width: 44, height: 44 }} role="img" aria-label={`${n.num} ${n.name} — ${n.ready ? t('locked') : t('soon')}`}>
                    <Icon name="lock" size={18} stroke={2.6} />
                  </span>
                ) : (
                  <a href={href({ name: 'level', id: n.id })} className={`nd ${n.state}`} style={{ background: n.color, ...(n.state === 'done' ? { width: 52, height: 52 } : { width: 66, height: 66 }) }} aria-label={`${n.num} ${n.name}`} data-node={n.id}>
                    {n.state === 'cur' && <span className="pulse-ring" />}
                    <span className="ltr">{n.num}</span>
                  </a>
                )}
                {n.state === 'done' && (
                  <span className="ltr" style={{ position: 'absolute', top: 36, left: '50%', transform: 'translateX(-50%)', fontSize: 12, fontWeight: 800, color: '#8A5A00', whiteSpace: 'nowrap' }}>
                    {'★'.repeat(n.stars)}{'☆'.repeat(3 - n.stars)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <header style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 6px 6px 12px', borderRadius: 20, background: 'rgba(255,255,255,.94)', boxShadow: '0 8px 20px rgba(31,26,46,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <a href={href({ name: 'home' })} className="btn btn-ghost btn-icon" aria-label={t('home')}>
            <Icon name={dir === 'rtl' ? 'chevron' : 'chevronBack'} size={20} stroke={2.4} />
          </a>
          <h1 style={{ fontSize: 20 }}>{t('map')}</h1>
        </div>
        <LangSwitch />
      </header>
      {next && (
        <div style={{ position: 'absolute', left: 12, right: 12, bottom: 14, display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 22, background: '#fff', boxShadow: '0 12px 28px rgba(31,26,46,.22)' }}>
          <Bit size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#625B78' }}>{t('next')}</span>
            <strong style={{ display: 'block', fontFamily: 'var(--f-display)', fontSize: 18 }}>
              <span className="ltr">{next.num}</span> · {next.name}
            </strong>
          </div>
          {next.state !== 'lock' && (
            <a href={href({ name: 'level', id: next.id })} className="btn btn-primary btn-sm">
              {t('playIt')}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
