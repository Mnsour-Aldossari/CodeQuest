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

/** Centers of the village houses, kept clear of the level nodes. */
const HOUSES: Array<[number, number]> = [[1150, 770], [1400, 640], [1390, 400], [1100, 360], [1230, 862]];
const TREES: Array<[number, number, number, string]> = [
  [540, 420, 120, '#2E8A57'], [610, 400, 150, '#1F7A4A'], [720, 380, 110, '#3E9C62'], [810, 400, 160, '#1F7A4A'],
  [920, 390, 110, '#2E8A57'], [990, 410, 140, '#3E9C62'], [560, 900, 90, '#2E8A57'], [940, 900, 100, '#1F7A4A'],
];

function gradientFor(left: number, cw: number) {
  const s = (p: number) => `${Math.round(left + cw * p)}px`;
  return `linear-gradient(90deg, #1E1750 0px, #1E1750 ${s(0)}, #352A78 ${s(0.24)}, #6E9D84 ${s(0.36)}, #B9D9AE ${s(0.56)}, #EBD9AE ${s(0.7)}, #F7E6C6 ${s(1)}, #F7E6C6 100%)`;
}

/** Sky life across the whole viewport: clouds, stars, birds, a shooting star. */
function Sky() {
  const stars = useMemo(() => Array.from({ length: 34 }, (_, i) => ({ x: (i * 7.3) % 34, y: (i * 13.7) % 46, d: (i % 9) * 0.45, s: 2 + (i % 3) })), []);
  const clouds = [
    { top: 6, scale: 1, dur: 70, delay: -10, op: 0.55 },
    { top: 15, scale: 0.7, dur: 95, delay: -60, op: 0.4 },
    { top: 3, scale: 1.3, dur: 120, delay: -90, op: 0.35 },
    { top: 22, scale: 0.85, dur: 80, delay: -35, op: 0.45 },
  ];
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {stars.map((s, i) => (
        <i key={i} className="mp-twinkle" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${s.d}s` }} />
      ))}
      <i className="mp-shoot" />
      {clouds.map((c, i) => (
        <svg key={i} className="mp-cloud" width="260" height="80" viewBox="0 0 200 72" style={{ top: `${c.top}%`, opacity: c.op, transform: `scale(${c.scale})`, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}>
          <path d="M30 70 Q10 70 14 52 Q18 36 40 40 Q48 14 80 20 Q104 2 130 24 Q160 14 170 40 Q196 36 196 58 Q196 72 176 72 Z" fill="#FFF6EA" />
        </svg>
      ))}
      {[0, 1].map((f) => (
        <svg key={f} className="mp-birds" width="90" height="40" viewBox="0 0 90 40" style={{ top: `${18 + f * 14}%`, animationDuration: `${26 + f * 9}s`, animationDelay: `${-f * 11}s` }}>
          {[[0, 14], [26, 4], [50, 18]].map(([x, y], j) => (
            <path key={j} className="mp-wing" d={`M${x} ${y} q6 -7 12 0 q6 -7 12 0`} fill="none" stroke="#3A2A55" strokeWidth="2.4" strokeLinecap="round" style={{ animationDelay: `${j * 0.15}s` }} />
          ))}
        </svg>
      ))}
    </div>
  );
}

function House({ cx, cy, built, fresh, i }: { cx: number; cy: number; built: boolean; fresh: boolean; i: number }) {
  const x = cx - 32;
  const y = cy - 44;
  if (!built) {
    return (
      <g transform={`translate(${x} ${y})`} fill="none" stroke="#9C6B4A" strokeWidth="2.5" strokeDasharray="6 5" opacity=".6" className="mp-ghost">
        <rect x="0" y="34" width="64" height="50" rx="4" />
        <path d="M-8 38 L32 4 L72 38" />
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={fresh ? 'build-in' : ''} style={{ animationDelay: '.9s' }}>
        <rect x="44" y="6" width="10" height="22" fill="#7A2E1F" />
        {[0, 1, 2].map((k) => (
          <circle key={k} className="mp-smoke" cx="49" cy="2" r={5 + k} fill="#fff" style={{ animationDelay: `${i * 0.7 + k * 1.1}s` }} />
        ))}
        <rect x="0" y="34" width="64" height="50" rx="4" fill="#D98C5F" stroke="#7A2E1F" strokeWidth="3" />
        <path d="M-8 38 L32 4 L72 38Z" fill="#C24E2B" stroke="#7A2E1F" strokeWidth="3" strokeLinejoin="round" />
        <rect x="24" y="56" width="16" height="28" rx="3" fill="#7A2E1F" />
        <rect x="8" y="46" width="12" height="12" rx="2" fill="#FFD27A" className="mp-window" style={{ animationDelay: `${i * 0.9}s` }} />
        <rect x="46" y="46" width="12" height="12" rx="2" fill="#FFD27A" className="mp-window" style={{ animationDelay: `${i * 0.9 + 1.7}s` }} />
      </g>
    </g>
  );
}

function DesktopMap({ nodes }: { nodes: MapNode[] }) {
  const { t, tl, dir, lang } = useT();
  const reduce = useProgress((s) => s.settings.reducedMotion);
  const layers = useRef<Array<HTMLDivElement | null>>([]);
  const segRefs = useRef<Array<SVGPathElement | null>>([]);
  const [box, setBox] = useState({ k: 1, left: 0, top: 0 });
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const cur = nodes.findIndex((n) => n.state === 'cur');
  const fresh = useFreshSegment(cur);
  const done = nodes.filter((n) => n.state === 'done').length;
  const vDone = nodes.slice(0, 5).filter((n) => n.state === 'done').length;
  const fDone = nodes.slice(5, 10).filter((n) => n.state === 'done').length;
  const jDone = nodes.slice(10).filter((n) => n.state === 'done').length;
  const home = cur >= 0 ? cur : Math.max(0, done - 1);
  const [bit, setBit] = useState<{ x: number; y: number; walking: boolean }>(() => {
    const from = fresh >= 0 && !reduce ? fresh : home;
    return { x: P[from][0] + 40, y: P[from][1] + 40, walking: false };
  });

  useLayoutEffect(() => {
    const fit = () => {
      const k = Math.max(0.55, Math.min(window.innerWidth / 1440, window.innerHeight / 900));
      setBox({ k, left: (window.innerWidth - 1440 * k) / 2, top: (window.innerHeight - 900 * k) / 2 });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // Bit walks the newly opened stretch of road, then waits at the next level.
  useEffect(() => {
    if (fresh < 0 || reduce) return;
    const path = segRefs.current[fresh];
    if (!path) return;
    const len = path.getTotalLength();
    let raf = 0;
    let start = 0;
    const step = (now: number) => {
      start ||= now;
      const k = Math.min(1, (now - start) / 1800);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const p = path.getPointAtLength(len * e);
      setBit({ x: p.x + 40, y: p.y + 40, walking: k < 1 });
      if (k < 1) raf = requestAnimationFrame(step);
    };
    const h = setTimeout(() => (raf = requestAnimationFrame(step)), 900);
    return () => {
      clearTimeout(h);
      cancelAnimationFrame(raf);
    };
  }, [fresh, reduce]);

  const onMove = (e: React.MouseEvent) => {
    if (reduce) return;
    const mx = (e.clientX / window.innerWidth) * 2 - 1;
    const my = (e.clientY / window.innerHeight) * 2 - 1;
    requestAnimationFrame(() => {
      [10, 22, 40].forEach((f, i) => {
        const el = layers.current[i];
        if (el) el.style.transform = `translate(${(-mx * f).toFixed(1)}px, ${(-my * f * 0.6).toFixed(1)}px)`;
      });
    });
  };

  const enter = (e: React.MouseEvent, i: number, id: string) => {
    if (reduce || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    setZoom({ x: P[i][0] + 40, y: P[i][1] + 40 });
    setTimeout(() => go({ name: 'level', id }), 520);
  };

  const layer = { position: 'absolute' as const, inset: -40, transition: 'transform .5s cubic-bezier(.22,1,.36,1)' };
  const parts = useMemo(() => {
    const p: Array<{ cls: string; x: number; y: number; d: number }> = [];
    for (let i = 0; i < 12; i++) p.push({ cls: 'amb-dust', x: 1080 + ((i * 47) % 340), y: 300 + ((i * 83) % 560), d: i * 0.7 });
    for (let i = 0; i < 14; i++) p.push({ cls: 'amb-fly', x: 500 + ((i * 61) % 520), y: 330 + ((i * 97) % 560), d: i * 0.45 });
    for (let i = 0; i < 12; i++) p.push({ cls: 'amb-spark', x: 30 + ((i * 53) % 420), y: 380 + ((i * 71) % 480), d: i * 0.4 });
    return p;
  }, []);

  return (
    <div className={`cq ${reduce ? 'rm' : ''}`} dir={dir} lang={lang} onMouseMove={onMove} style={{ height: '100dvh', overflow: 'hidden', position: 'relative', background: gradientFor(box.left, 1440 * box.k) }}>
      <Sky />
      <div
        className="mp-canvas"
        style={{
          position: 'absolute', left: box.left, top: box.top, width: 1440, height: 900, transformOrigin: '0 0',
          transform: `scale(${box.k})`,
        }}
      >
        <div
          className="mp-zoom"
          style={{
            position: 'absolute', inset: 0,
            transformOrigin: zoom ? `${zoom.x}px ${zoom.y}px` : '50% 50%',
            transform: zoom ? 'scale(2.6)' : 'none', opacity: zoom ? 0 : 1,
          }}
        >
          {/* far layer: the three regions */}
          <div ref={(el) => { layers.current[0] = el; }} style={layer}>
            <svg width="1520" height="980" viewBox="-40 -40 1520 980" aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
              {/* castle */}
              <circle cx="120" cy="180" r="46" fill="#F3EEFF" opacity=".9" className="mp-moon" />
              <circle cx="104" cy="168" r="44" fill="#2A2163" />
              <g fill="#17123A">
                <rect x="40" y="260" width="70" height="300" /><path d="M40 260 L75 214 L110 260Z" />
                <rect x="130" y="200" width="90" height="360" /><path d="M130 200 L175 140 L220 200Z" />
                <rect x="240" y="280" width="70" height="280" /><path d="M240 280 L275 236 L310 280Z" />
                <rect x="90" y="330" width="200" height="230" />
              </g>
              <line x1="175" y1="140" x2="175" y2="104" stroke="#17123A" strokeWidth="4" />
              <path className="flag" d="M175 104 h30 l-7 8 7 8 h-30z" fill={jDone > 0 ? '#6A3FD6' : '#3A3070'} />
              <rect x="164" y="250" width="22" height="34" rx="11" fill="#3FE0E8" className="mp-window" opacity={jDone > 0 ? 0.95 : 0.45} />
              <rect x="62" y="300" width="16" height="24" rx="8" fill="#FFB547" className="mp-window" style={{ animationDelay: '1.3s' }} opacity=".7" />
              <rect x="262" y="320" width="16" height="24" rx="8" fill="#FFB547" className="mp-window" style={{ animationDelay: '2.1s' }} opacity=".6" />
              <g style={{ transformOrigin: '190px 410px' }} className={jDone > 0 ? 'spin' : 'mp-spin-slow'}>
                <circle cx="190" cy="410" r="34" fill="none" stroke="#4A4280" strokeWidth="12" strokeDasharray="10 8" />
                <circle cx="190" cy="410" r="12" fill="#4A4280" />
              </g>
              <g style={{ transformOrigin: '252px 456px' }} className={jDone > 0 ? 'spin-r' : 'mp-spin-slow-r'}>
                <circle cx="252" cy="456" r="22" fill="none" stroke="#4A4280" strokeWidth="9" strokeDasharray="7 6" />
              </g>
              {/* forest: greys out until CSS levels are restored; every tree sways */}
              <g style={{ filter: `grayscale(${(1 - fDone / 5).toFixed(2)})`, transition: 'filter 1.6s ease' }}>
                <path d="M480 900 V320 Q760 250 1040 320 V900Z" fill="#7DBB7C" opacity=".5" />
                {TREES.map(([x, y, h, c], i) => (
                  <g key={i} className="mp-sway" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${-i * 0.6}s`, animationDuration: `${3.2 + (i % 3) * 0.7}s` }}>
                    <rect x={x - 4} y={y - 8} width="8" height="16" fill="#5A3E2B" />
                    <path d={`M${x - h * 0.33} ${y - 4} L${x} ${y - h} L${x + h * 0.33} ${y - 4}Z`} fill={c} />
                    <path d={`M${x - h * 0.24} ${y - h * 0.38} L${x} ${y - h * 1.05} L${x + h * 0.24} ${y - h * 0.38}Z`} fill={c} opacity=".85" />
                  </g>
                ))}
                {[[600, 790, '#E85D9A'], [640, 800, '#FFD25A'], [900, 820, '#E85D9A'], [930, 806, '#FFD25A'], [740, 860, '#E85D9A'], [820, 760, '#FFD25A']].map(([x, y, c], i) => (
                  <circle key={i} cx={x as number} cy={y as number} r="8" fill={c as string} className="mp-bloom" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${i * 0.4}s` }} />
                ))}
              </g>
              {/* the river between forest and village */}
              <path d="M1052 290 Q1010 420 1046 540 T1030 760 T1050 960" fill="none" stroke="#8FD3E8" strokeWidth="22" strokeLinecap="round" opacity=".75" />
              <path d="M1052 290 Q1010 420 1046 540 T1030 760 T1050 960" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeDasharray="10 26" className="mp-flow" opacity=".9" />
              {/* village */}
              <path d="M1068 940 V300 Q1270 240 1480 300 V940Z" fill="#F2D59E" opacity=".55" />
              {HOUSES.map(([x, y], i) => (
                <House key={i} cx={x} cy={y} i={i} built={i < vDone} fresh={i === vDone - 1 && fresh === vDone - 1} />
              ))}
            </svg>
          </div>

          {/* mid layer: road + level nodes + Bit */}
          <div ref={(el) => { layers.current[1] = el; }} style={layer}>
            <svg width="1520" height="980" viewBox="-40 -40 1520 980" aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
              {P.slice(0, -1).map((a, i) => (
                <path key={i} ref={(el) => { segRefs.current[i] = el; }} d={seg(a, P[i + 1], i, 0)} fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="6" strokeLinecap="round" strokeDasharray="1 14" />
              ))}
              {P.slice(0, -1).map((a, i) =>
                i < Math.max(done, cur) ? (
                  <g key={`d${i}`}>
                    <path d={seg(a, P[i + 1], i, 0)} fill="none" stroke="rgba(31,26,46,.22)" strokeWidth="20" strokeLinecap="round" pathLength={1} className={i === fresh ? 'draw' : ''} />
                    <path d={seg(a, P[i + 1], i, 0)} fill="none" stroke="#FFF6E4" strokeWidth="12" strokeLinecap="round" pathLength={1} className={i === fresh ? 'draw' : ''} />
                    <path d={seg(a, P[i + 1], i, 0)} fill="none" stroke="#F2A93B" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.02 0.03" pathLength={1} className="mp-road" />
                  </g>
                ) : null,
              )}
            </svg>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label={t('mapTitle')}>
              {nodes.map((n, i) => (
                <li
                  key={n.id}
                  className={`map-node mp-node-${n.state}`}
                  style={{ position: 'absolute', left: P[i][0] + 40, top: P[i][1] + 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transform: `translate(-50%, -${n.state === 'cur' ? 40 : n.state === 'done' ? 31 : 26}px)`, zIndex: n.state === 'cur' ? 3 : 2 }}
                >
                  <div className="mp-pop" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, animationDelay: `${0.15 + i * 0.05}s` }}>
                    {n.state === 'done' && (
                      <div className="thumb mp-thumb" aria-hidden="true">
                        <div className="tbar"><i /><i /><i /></div>
                        <div style={{ padding: '6px 8px 8px', fontFamily: 'var(--f-body)' }}>
                          <div dir="auto" style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.thumb}</div>
                          <div style={{ height: 4, width: '80%', borderRadius: 2, background: '#E8DCCB', marginTop: 5 }} />
                          <div style={{ height: 4, width: '55%', borderRadius: 2, background: '#E8DCCB', marginTop: 3 }} />
                        </div>
                      </div>
                    )}
                    {n.state === 'lock' ? (
                      <span className="nd lock" role="img" aria-label={`${n.num} ${n.name} — ${n.ready ? t('locked') : t('soon')}`}>
                        <Icon name="lock" size={20} stroke={2.6} />
                      </span>
                    ) : (
                      <a
                        href={href({ name: 'level', id: n.id })}
                        onClick={(e) => enter(e, i, n.id)}
                        className={`nd ${n.state}`}
                        style={{ background: n.color }}
                        aria-label={`${n.num} ${n.name}${n.state === 'cur' ? ` — ${t('playIt')}` : ''}`}
                        data-node={n.id}
                      >
                        {n.state === 'cur' && <span className="pulse-ring" />}
                        {n.state === 'cur' && <span className="pulse-ring" style={{ animationDelay: '.8s' }} />}
                        <span className="ltr">{n.num}</span>
                      </a>
                    )}
                    {n.state === 'done' && (
                      <div dir="ltr" className="mp-stars" style={{ display: 'flex', gap: 1, marginTop: 2 }} role="img" aria-label={`${n.stars}/3`}>
                        {[0, 1, 2].map((s) => <Star key={s} on={s < n.stars} size={20} style={{ animationDelay: `${i * 0.3 + s * 0.2}s` }} />)}
                      </div>
                    )}
                    {(n.state === 'cur' || (n.state === 'lock' && !n.ready && (i === 5 || i === 10))) && <span className="nlabel">{n.state === 'cur' ? n.name : t('soon')}</span>}
                  </div>
                </li>
              ))}
            </ul>
            {/* Bit: walks the new road, then hops beside the next level */}
            <div aria-hidden="true" className={bit.walking ? '' : 'mp-bit-wait'} style={{ position: 'absolute', left: bit.x, top: bit.y, transform: 'translate(-50%, -128px)', zIndex: 4, pointerEvents: 'none' }}>
              <Bit mood={bit.walking ? 'running' : cur >= 0 ? 'wave' : 'celebrate'} size={70} />
            </div>
          </div>

          {/* near layer */}
          <div ref={(el) => { layers.current[2] = el; }} style={{ ...layer, pointerEvents: 'none' }}>
            {parts.map((p, i) => <i key={i} className={`amb ${p.cls}`} style={{ left: p.x, top: p.y, animationDelay: `${p.d}s` }} />)}
            <svg width="1520" height="980" viewBox="-40 -40 1520 980" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
              <path d="M1380 940 Q1420 860 1500 850 V940Z" fill="#E7C48C" />
              <path d="M-40 820 Q30 780 60 940 H-40Z" fill="#120E30" />
              <g className="mp-sway" style={{ transformOrigin: '740px 940px' }}>
                <path d="M700 940 Q720 880 760 870 Q770 910 800 940Z" fill="#5E9B6E" opacity=".8" />
              </g>
            </svg>
          </div>

          {/* world banners */}
          {([[0, 1230, '#FFF6E6', 'house', vDone, 'wHtml', 'wHtmlSub'], [1, 770, '#F1FAF0', 'tree', fDone, 'wCss', 'wCssSub'], [2, 250, '#2A2163', 'gear', jDone, 'wJs', 'wJsSub']] as const).map(([wi, left, bg, icon, n, name, sub]) => (
            <div key={wi} className="banner mp-banner" style={{ left, background: bg, color: wi === 2 ? '#F3EEFF' : undefined, animationDelay: `${wi * 0.15}s, ${wi * 0.9}s` }}>
              <span className="bi" style={{ background: WORLDS[wi].color, color: '#fff' }}><Icon name={icon} size={24} /></span>
              <div>
                <h2 style={{ fontSize: 20 }}>{t(name)}</h2>
                <p style={{ fontSize: 13, fontWeight: 700, color: wi === 2 ? '#B9B0E6' : '#4A4360' }}>
                  {t(sub)} · <span className="ltr">{n}/{WORLDS[wi].plan.length}</span>
                </p>
                <div className="xp" style={{ height: 6, marginTop: 4, width: 140 }}>
                  <i style={{ width: `${(n / WORLDS[wi].plan.length) * 100}%`, background: WORLDS[wi].color }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Header nodes={nodes} />
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
      <Sky />
      <div ref={sc} style={{ position: 'absolute', inset: 0, overflowY: 'auto', scrollbarWidth: 'none' }}>
        <div style={{ position: 'relative', width: 375, height: H, margin: '0 auto' }}>
          <div style={{ position: 'absolute', left: -400, right: -400, top: 0, height: H * 0.42, background: 'linear-gradient(#17123A, #2B2370)' }} />
          <div style={{ position: 'absolute', left: -400, right: -400, top: H * 0.4, height: H * 0.3, background: 'linear-gradient(#5E9B78, #BFE0B5)', filter: `grayscale(${(1 - fDone / 5).toFixed(2)})` }} />
          <div style={{ position: 'absolute', left: -400, right: -400, top: H * 0.7, bottom: 0, background: 'linear-gradient(#EBD9AE, #F7E6C6)' }} />
          <svg width="375" height={H} viewBox={`0 0 375 ${H}`} aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
            {pts.slice(0, -1).map((a, i) => (
              <g key={i}>
                <path d={seg2(a, pts[i + 1], i)} fill="none" stroke={i < cur ? '#FFF6E4' : 'rgba(255,255,255,.7)'} strokeWidth={i < cur ? 10 : 5} strokeLinecap="round" strokeDasharray={i < cur ? undefined : '1 12'} />
                {i < cur && <path d={seg2(a, pts[i + 1], i)} fill="none" stroke="#F2A93B" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.02 0.03" pathLength={1} className="mp-road" />}
              </g>
            ))}
          </svg>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {nodes.map((n, i) => (
              <li key={n.id} className="mp-pop" style={{ position: 'absolute', left: pts[i][0], top: pts[i][1], marginLeft: n.state === 'cur' ? -33 : n.state === 'done' ? -26 : -22, marginTop: n.state === 'cur' ? -33 : n.state === 'done' ? -26 : -22, animationDelay: `${i * 0.04}s` }}>
                {n.state === 'cur' && (
                  <span className="mp-bit-wait" style={{ position: 'absolute', bottom: '100%', left: '50%', marginLeft: -28 }}>
                    <Bit size={56} mood="wave" />
                  </span>
                )}
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
                  <span className="ltr" style={{ position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)', fontSize: 12, fontWeight: 800, color: '#8A5A00', whiteSpace: 'nowrap' }}>
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
