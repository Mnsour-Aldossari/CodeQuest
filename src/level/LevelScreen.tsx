/**
 * A level: story → goals (red) → build → run (goals flip green or stay red with a
 * reason) → win. Desktop: palette | workspace | result (always on the right).
 * Mobile: three tabs, a block drawer, a floating Run button, tap-then-place.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { DndContext, DragOverlay, MeasuringStrategy, MouseSensor, pointerWithin, TouchSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { BLOCKS } from '../engine/blocks';
import { compile, judge, type Compiled } from '../engine/judge';
import { probesFor } from '../engine/checker';
import { htmlSteps, serialize } from '../engine/serialize';
import { countBlocks, find } from '../engine/tree';
import { stars as starsFor, xpFor } from '../engine/stars';
import type { Level, Trace } from '../engine/types';
import { PageRunner } from '../runner/iframeRunner';
import { runInWorker } from '../runner/workerRunner';
import { useLevel, redo, undo, blockFromPalette } from '../state/level';
import { useProgress } from '../state/progress';
import { earnedBadges, BADGES } from '../state/badges';
import { go } from '../state/nav';
import { levelById, nextLevelId, worldOf } from '../levels';
import { useT, Rich } from '../i18n';
import { Icon, PlayIcon, StepIcon, Star } from '../components/Icon';
import { CodeView } from '../components/CodeView';
import { TopControls } from '../components/TopControls';
import { useIsMobile } from '../ui/useMedia';
import { sfx } from '../ui/sound';
import { HoldingCtx, LinesCtx, parseDrop, type DragData, type Holding } from './dnd';
import { RootView, markDragEnd, catClass } from './Workspace';
import { Palette, StaticBlock } from './Palette';
import { BrowserFrame, CodePane, ConsoleView, OutputTabs, RobotLocked, type OutTab } from './Output';
import { Goals, StoryBubble } from './Story';
import { WinSequence, type WinInfo } from './Win';
import { Tour } from './Tour';

/** Drop spots expand when a drag starts, so keep re-measuring them. */
const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } };

const NO_PROBES = { selectors: [], props: [], norms: [], events: [] };

function bodyCode(display: string): string {
  const lines = display.split('\n');
  const a = lines.findIndex((l) => l.trim() === '<body>');
  const b = lines.findIndex((l) => l.trim() === '</body>');
  if (a < 0 || b < 0) return display;
  return lines.slice(a + 1, b).map((l) => l.replace(/^ {2}/, '')).join('\n') || '';
}

export function LevelScreen({ id }: { id: string }) {
  const level = levelById(id);
  if (!level) return <ComingSoon />;
  return <LevelPlay key={level.id} level={level} />;
}

function ComingSoon() {
  const { t } = useT();
  return (
    <div className="cq" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--paper)', padding: 24 }}>
      <div className="panel" style={{ padding: 32, maxWidth: 440, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <h1 style={{ fontSize: 30 }}>{t('soon')}</h1>
        <p style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{t('soonBody')}</p>
        <button type="button" className="btn btn-primary" onClick={() => go({ name: 'map' })}>
          {t('map')}
        </button>
      </div>
    </div>
  );
}

function LevelPlay({ level }: { level: Level }) {
  const { lang, t, tl, dir } = useT();
  const isMobile = useIsMobile();
  const saved = useProgress((s) => s.levels[level.id]);
  const tourDone = useProgress((s) => s.tourDone);
  const reduce = useProgress((s) => s.settings.reducedMotion);
  const patchLevel = useProgress((s) => s.patchLevel);
  const tree = useLevel((s) => s.tree);
  const code = useLevel((s) => s.code);
  const phase = useLevel((s) => s.phase);
  const pick = useLevel((s) => s.pick);
  const step = useLevel((s) => s.step);
  const trace = useLevel((s) => s.trace);
  const [tab, setTab] = useState<OutTab>('browser');
  const [drag, setDrag] = useState<DragData | null>(null);
  const [win, setWin] = useState<WinInfo | null>(null);
  const [tour, setTour] = useState(() => !!level.tour && !useProgress.getState().tourDone);
  const [mobileTab, setMobileTab] = useState<'build' | 'result'>('build');
  const [drawer, setDrawer] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const runnerRef = useRef<PageRunner | null>(null);
  const loaded = useLevel((s) => s.level?.id === level.id);

  // load the level (resume a saved, unsolved attempt)
  useEffect(() => {
    useLevel.getState().load(level, saved && !saved.solved ? { tree: saved.tree, code: saved.code } : undefined);
    const started = Date.now();
    return () => {
      const p = useProgress.getState().levels[level.id];
      useProgress.getState().patchLevel(level.id, { timeMs: (p?.timeMs ?? 0) + (Date.now() - started) });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  const compiled: Compiled | null = useMemo(() => {
    if (!loaded) return null;
    if (level.mode !== 'code' && !tree) return null;
    return compile(level, { tree: tree ?? undefined, code }, lang);
  }, [loaded, level, tree, code, lang]);

  // autosave the attempt
  useEffect(() => {
    if (!loaded || phase === 'win') return;
    const h = setTimeout(() => patchLevel(level.id, level.mode === 'code' ? { code } : { tree: tree ?? undefined }), 600);
    return () => clearTimeout(h);
  }, [loaded, tree, code, level, phase, patchLevel]);

  const getRunner = useCallback(() => {
    const host = hostRef.current;
    if (!host) return null;
    if (!runnerRef.current || runnerRef.current.host !== host) {
      runnerRef.current?.dispose();
      runnerRef.current = new PageRunner(host);
    }
    return runnerRef.current;
  }, []);
  useEffect(() => () => runnerRef.current?.dispose(), []);

  // live preview while building (web levels)
  const liveRun = compiled?.program.run;
  useEffect(() => {
    if (level.output !== 'web' || !liveRun || phase === 'running' || phase === 'stepping' || phase === 'win') return;
    const h = setTimeout(() => void getRunner()?.run(liveRun, NO_PROBES, { lang }), 220);
    return () => clearTimeout(h);
  }, [liveRun, level.output, phase, lang, getRunner, isMobile]);

  /* ---------------- run & judge ---------------- */

  const finishWin = () => {
    const S = useLevel.getState();
    const prog = useProgress.getState();
    const prev = prog.levels[level.id];
    const blocks = tree ? countBlocks(tree) : 0;
    const earned = starsFor({ solved: true, mode: level.mode, blocks, optimalBlocks: level.optimalBlocks, runs: S.runs, hintsUsed: S.hintsUsed });
    const best = Math.max(prev?.stars ?? 0, earned);
    const xp = xpFor(Math.max(0, best - (prev?.stars ?? 0)), false);
    prog.patchLevel(level.id, {
      solved: true, stars: best, hints: (prev?.hints ?? 0) + S.hintsUsed,
      bestBlocks: Math.min(prev?.bestBlocks ?? Infinity, blocks) || undefined,
      ...(level.mode === 'code' ? { code } : { tree: tree ?? undefined }),
    });
    prog.addXp(xp);
    const after = useProgress.getState();
    const newBadges = earnedBadges(after, level, S.hintsUsed);
    newBadges.forEach((b) => after.award(b));
    const display = compiled?.program.display ?? '';
    const h1 = tree ? findText(tree) : '';
    setWin({
      stars: earned, xp, badge: newBadges[0] ? BADGES[newBadges[0]] : null,
      code: level.mode === 'code' ? bodyCode(display) : bodyCode(display),
      signText: h1 || tl(level.title),
    });
    S.set({ phase: 'win' });
  };

  const run = useCallback(async () => {
    const S = useLevel.getState();
    if (!compiled || S.phase === 'running' || S.phase === 'win') return;
    S.set({ phase: 'running', msg: { kind: 'running' }, pick: null, glow: null, verdict: null, execId: null, step: -1, runs: S.runs + 1, runId: S.runId + 1 });
    if (isMobile) setMobileTab('result');
    let tr: Trace;
    if (level.output === 'web') {
      const runner = getRunner();
      tr = runner ? await runner.run(compiled.program.run, probesFor(level.checks), { lang }) : { events: [], timedOut: true };
    } else {
      tr = await runInWorker(compiled.program.run.js, { robot: level.robot });
    }
    if (useLevel.getState().level?.id !== level.id) return;
    const v = judge(level, compiled, tr, tree ?? undefined);
    const prev = useProgress.getState().levels[level.id];
    patchLevel(level.id, { attempts: (prev?.attempts ?? 0) + 1, ...(v.problem ? { lastError: tl(v.problem.message).slice(0, 500) } : {}) });
    if (v.solved) {
      useLevel.getState().set({ phase: 'play', verdict: v, trace: tr, msg: { kind: 'text', text: { ar: 'ذاكرتي تعود! نجحت!', en: 'My memory is coming back! You did it!' }, tone: 'win' } });
      setTimeout(() => finishWin(), reduce ? 300 : 300 + level.checks.length * 280 + 500);
      return;
    }
    const failed = v.results.find((r) => !r.pass);
    const msg = v.problem?.message ?? failed?.reason ?? { ar: 'قربنا! شوف الأهداف الحمراء.', en: 'Almost! Check the red goals.' };
    if (v.problem) sfx.error();
    useLevel.getState().set({
      phase: v.problem ? 'error' : 'fail',
      verdict: v,
      trace: tr,
      failedRuns: useLevel.getState().failedRuns + 1,
      msg: { kind: 'text', text: msg, tone: 'error' },
    });
    if (v.problem && !v.problem.blockId && !isMobile) setTab('console');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compiled, level, lang, isMobile, tree, reduce]);

  /* ---------------- step by step (HTML) ---------------- */

  const steps = useMemo(() => (tree && level.output === 'web' && level.mode !== 'code' ? htmlSteps(tree) : []), [tree, level]);
  const stepTo = useCallback((k: number) => {
    const S = useLevel.getState();
    if (!tree || steps.length === 0) {
      S.set({ msg: { kind: 'text', text: { ar: 'لا يوجد شيء لأمشي عليه خطوة خطوة… ضع كتلة أولاً.', en: 'Nothing to step through yet… place a block first.' }, tone: 'hint' } });
      return;
    }
    if (k >= steps.length) {
      S.set({ phase: 'play', step: -1, execId: null });
      void run();
      return;
    }
    const i = Math.max(0, k);
    S.set({ phase: 'stepping', step: i, execId: steps[i], msg: { kind: 'step' }, pick: null, verdict: null });
    setTab('browser');
    if (isMobile) setMobileTab('result');
    const partial = serialize(tree, { upTo: i + 1, lang }).run;
    void getRunner()?.run(partial, NO_PROBES, { lang });
  }, [tree, steps, lang, run, getRunner, isMobile]);

  /* ---------------- drag & drop ---------------- */

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );
  const onDragStart = (e: DragStartEvent) => {
    setDrag(e.active.data.current as DragData);
    useLevel.getState().set({ pick: null });
    sfx.pick();
  };
  const onDragEnd = (e: DragEndEvent) => {
    const d = e.active.data.current as DragData | undefined;
    setDrag(null);
    markDragEnd();
    if (!d || !e.over) return;
    const target = parseDrop(String(e.over.id));
    const S = useLevel.getState();
    if (target === 'palette') {
      if (d.kind === 'block') S.removeBlock(d.id);
      return;
    }
    if (!target) return;
    if (d.kind === 'palette') S.placeFromPalette(d.index, target);
    else S.moveBlock(d.id, target);
  };
  const holding: Holding | null = useMemo(() => {
    if (drag) return { type: drag.type, id: drag.kind === 'block' ? drag.id : undefined, via: 'drag' };
    if (!pick || !level) return null;
    if (pick.kind === 'palette') return { type: level.palette[pick.index]?.type ?? '', via: 'pick' };
    const b = tree ? find(tree, pick.id) : null;
    return b ? { type: b.type, id: b.id, via: 'pick' } : null;
  }, [drag, pick, level, tree]);

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Escape') {
        useLevel.getState().set({ pick: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---------------- layout ---------------- */

  const w = worldOf(level.world);
  const program = compiled?.program;
  const outTabs: OutTab[] = level.mode === 'code' ? ['browser', 'console', 'robot'] : ['browser', 'console', 'robot', 'code'];
  const hasErr = (phase === 'error' || phase === 'fail') && !!(trace?.events.some((e) => e.t === 'error') || program?.diagnostics.some((d) => d.severity === 'error'));
  const pageEmpty = level.output === 'web' && !!program && program.run.html.trim() === '' && level.mode !== 'code';
  const title = program?.run.title ?? '';

  const workspace = level.mode === 'code' ? (
    <div style={{ flex: 1, minHeight: 0, borderRadius: 14, overflow: 'hidden', boxShadow: '0 0 0 1.5px #E2D6C3' }} data-tour="workspace">
      <CodeView code={code} lang={level.output === 'web' ? 'html' : 'js'} readOnly={false} onChange={(c) => useLevel.getState().setCode(c)} label={t('typeHere')} marks={{ err: phase === 'error' ? useLevel.getState().verdict?.problem?.line ?? null : null }} />
    </div>
  ) : tree ? (
    <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '6px 8px 110px' : '6px 24px 24px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }} data-tour="workspace" onClick={() => useLevel.getState().set({ pick: null })}>
      <LinesCtx.Provider value={program?.sourceMap ?? {}}>
        <RootView root={tree} />
      </LinesCtx.Provider>
    </div>
  ) : null;

  const output = program && (
    <>
      <BrowserFrame hostRef={hostRef} title={title} url={level.page?.url ?? 'bit.village/index.html'} running={phase === 'running'} empty={pageEmpty} visible={tab === 'browser'} />
      {tab === 'console' && <ConsoleView trace={trace} program={program} level={level} />}
      {tab === 'robot' && <RobotLocked />}
      {tab === 'code' && <CodePane program={program} lang={level.output === 'web' ? 'html' : 'js'} />}
    </>
  );

  const actions = (
    <ActionBar
      level={level}
      onRun={() => void run()}
      onStep={() => stepTo(phase === 'stepping' ? step + 1 : 0)}
      onStepBack={phase === 'stepping' && step > 0 ? () => stepTo(step - 1) : undefined}
      canStep={level.output === 'web' && level.mode !== 'code'}
      compact={isMobile}
    />
  );

  const overlay = drag && (
    <div className={`blk ${catClass[BLOCKS[drag.type].cat]} is-picked`} style={{ cursor: 'grabbing' }}>
      <StaticBlock block={drag.kind === 'palette' ? blockFromPalette(level.palette[drag.index]) : (tree && find(tree, drag.id)) || blockFromPalette({ type: drag.type })} />
    </div>
  );

  const winLayer = win && (
    <WinSequence
      level={level}
      info={win}
      nextLabel={t('next')}
      onNext={() => {
        const n = nextLevelId(level.id);
        go(n && levelById(n) ? { name: 'level', id: n } : { name: 'map' });
      }}
      onReplay={() => {
        setWin(null);
        useLevel.getState().load(level);
      }}
    />
  );

  const rm = reduce ? 'rm' : '';

  if (isMobile) {
    return (
      <DndContext sensors={sensors} collisionDetection={pointerWithin} measuring={MEASURING} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDrag(null)}>
        <HoldingCtx.Provider value={holding}>
          <div className={`cq ${rm}`} dir={dir} lang={lang} style={{ height: '100dvh', position: 'relative', overflow: 'hidden', background: w.id === 'html' ? '#F6E6CA' : 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
            <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 6px', minHeight: 60 }}>
              <button type="button" className="btn btn-secondary btn-icon" style={{ width: 44, minWidth: 44, minHeight: 44 }} onClick={() => go({ name: 'map' })} aria-label={t('map')}>
                <Icon name={dir === 'rtl' ? 'chevron' : 'chevronBack'} size={20} stroke={2.4} />
              </button>
              <span className="ltr" style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 13, background: w.color, color: '#fff', fontWeight: 800, fontSize: 15, boxShadow: `0 3px 0 ${w.dark}` }}>
                {WORLD_NUM[level.world]}-{level.num}
              </span>
              <h1 style={{ flex: 1, fontSize: 19, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tl(level.title)}</h1>
              <TopControls compact />
            </header>
            <section style={{ padding: '0 12px' }}>
              <StoryBubble level={level} compact />
              <Goals level={level} pills />
            </section>
            <main style={{ flex: 1, minHeight: 0, position: 'relative', padding: '0 12px 6px', display: 'flex', flexDirection: 'column' }}>
              <div className="panel dots-bg" style={{ flex: 1, minHeight: 0, display: mobileTab === 'result' ? 'none' : 'flex', flexDirection: 'column', overflow: 'hidden' }} aria-label={t('workspace')}>
                {pick && <span className="chip line-in" style={{ alignSelf: 'center', margin: '8px 0 0', background: '#FFF1D6', boxShadow: '0 0 0 1.5px #F2A93B inset', color: '#6B4300' }}>{t('tapToPlace')}</span>}
                {workspace}
              </div>
              <div className="panel" style={{ flex: 1, minHeight: 0, display: mobileTab === 'result' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden', padding: '10px 10px 90px', gap: 8 }} aria-label={t('output')}>
                <OutputTabs tab={tab} setTab={setTab} tabs={outTabs.filter((x) => x !== 'robot')} badge={hasErr ? 'console' : undefined} />
                {output}
              </div>
              {actions}
            </main>
            {drawer && (
              <>
                <div className="scrim" onClick={() => setDrawer(false)} aria-hidden="true" />
                <section className="drawer-up" role="dialog" aria-label={t('blocks')} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10, maxHeight: '70%', overflow: 'auto', padding: '10px 16px 96px', borderRadius: '28px 28px 0 0', background: '#fff', boxShadow: '0 -12px 30px rgba(31,26,46,.2)' }}>
                  <div style={{ width: 44, height: 5, borderRadius: 3, background: '#D8C9B0', margin: '0 auto 10px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h2 style={{ fontSize: 20 }}>{t('blocks')}</h2>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#625B78' }}>{t('tapToPlace')}</span>
                  </div>
                  <Palette level={level} layout="wrap" onPicked={() => { setDrawer(false); setMobileTab('build'); }} />
                </section>
              </>
            )}
            <nav role="tablist" aria-label={t('menu')} style={{ position: 'relative', zIndex: 11, display: 'flex', gap: 6, padding: '8px 10px 14px', background: '#fff', boxShadow: '0 -4px 16px rgba(31,26,46,.08)' }}>
              {(['blocks', 'build', 'result'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className="btab"
                  role="tab"
                  aria-selected={k === 'blocks' ? drawer : !drawer && mobileTab === k}
                  data-mtab={k}
                  onClick={() => {
                    if (k === 'blocks') {
                      setDrawer(!drawer);
                      setMobileTab('build');
                    } else {
                      setDrawer(false);
                      setMobileTab(k);
                    }
                  }}
                  data-tour={k === 'blocks' ? 'palette' : undefined}
                >
                  <Icon name={k === 'blocks' ? 'blocks' : k === 'build' ? 'build' : 'eye'} size={22} />
                  {k === 'blocks' ? t('blocks') : k === 'build' ? t('build') : t('output')}
                </button>
              ))}
            </nav>
            {winLayer}
            {tour && !tourDone && <Tour onDone={() => setTour(false)} />}
          </div>
          <DragOverlay dropAnimation={null}>{overlay}</DragOverlay>
        </HoldingCtx.Provider>
      </DndContext>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} measuring={MEASURING} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDrag(null)}>
      <HoldingCtx.Provider value={holding}>
        <div className={`cq ${rm}`} dir={dir} lang={lang} style={{ height: '100dvh', minHeight: 640, position: 'relative', overflow: 'hidden', background: w.id === 'html' ? '#F6E6CA' : 'var(--paper)', display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
          <svg aria-hidden="true" viewBox="0 0 1440 900" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <circle cx="1300" cy="40" r="160" fill="#FFE2A6" opacity=".55" />
            <path d="M0 860 Q360 800 720 850 T1440 830 V900 H0Z" fill="#EDD3A8" />
          </svg>
          {Array.from({ length: 8 }, (_, i) => (
            <i key={i} className="amb amb-dust" style={{ left: `${6 + i * 12}%`, bottom: `${4 + (i % 3) * 3}%`, animationDelay: `${i * 0.8}s` }} />
          ))}

          <header style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, height: 56, flex: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <button type="button" className="btn btn-secondary btn-icon" onClick={() => go({ name: 'map' })} aria-label={t('map')}>
                <Icon name={dir === 'rtl' ? 'chevron' : 'chevronBack'} size={22} stroke={2.4} />
              </button>
              <span className="ltr" style={{ display: 'grid', placeItems: 'center', width: 48, height: 48, borderRadius: 16, background: w.color, color: '#fff', fontFamily: 'var(--f-display)', fontWeight: 800, fontSize: 18, boxShadow: `0 4px 0 ${w.dark}` }}>
                {WORLD_NUM[level.world]}-{level.num}
              </span>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: 24 }}>{tl(level.title)}</h1>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#4A4360' }}>{t(level.world === 'html' ? 'wHtml' : level.world === 'css' ? 'wCss' : 'wJs')}</span>
              </div>
            </div>
            <TopControls />
          </header>

          <section style={{ position: 'relative', display: 'flex', gap: 12, minHeight: 108, maxHeight: 168, flex: 'none' }}>
            <StoryBubble level={level} />
            <Goals level={level} />
          </section>

          <div dir="ltr" style={{ position: 'relative', flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '290px minmax(0, 1fr) minmax(360px, 480px)', gap: 12 }}>
            <aside className="panel" dir={dir} aria-label={t('blocks')} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }} data-tour="palette">
              <div className="panel-h">
                <h2 className="panel-t">{level.mode === 'code' ? t('code') : t('blocks')}</h2>
                <span className="chip" style={{ background: w.tint, boxShadow: 'none', color: w.dark }}>
                  {level.world.toUpperCase()}
                </span>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '4px 16px 16px' }}>
                {level.mode === 'code' ? <CheatSheet level={level} /> : <Palette level={level} />}
              </div>
            </aside>

            <section className="panel dots-bg" dir={dir} aria-label={t('workspace')} style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              <div className="panel-h">
                <h2 className="panel-t">{t('workspace')}</h2>
                {pick && (
                  <span className="chip line-in" style={{ background: '#FFF1D6', boxShadow: '0 0 0 1.5px #F2A93B inset', color: '#6B4300' }}>
                    {t('tapToPlace')}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: level.mode === 'code' ? '0 12px 12px' : 0 }}>{workspace}</div>
            </section>

            <section className="panel" dir={dir} aria-label={t('output')} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 12px 8px' }}>
                <OutputTabs tab={tab} setTab={setTab} tabs={outTabs} badge={hasErr ? 'console' : undefined} />
              </div>
              <div style={{ flex: 1, minHeight: 0, padding: '0 12px 12px', display: 'flex', flexDirection: 'column' }}>{output}</div>
            </section>
          </div>

          {actions}
          {winLayer}
          {tour && !tourDone && <Tour onDone={() => setTour(false)} />}
        </div>
        <DragOverlay dropAnimation={null}>{overlay}</DragOverlay>
      </HoldingCtx.Provider>
    </DndContext>
  );
}

const WORLD_NUM = { html: 1, css: 2, js: 3 } as const;

function findText(tree: import('../engine/types').Block): string {
  let s = '';
  const visit = (b: import('../engine/types').Block) => {
    if (s) return;
    if (b.type === 'html.el' && /^h[1-6]$/.test(String(b.fields.tag))) s = String(b.slots.content?.[0]?.fields.text ?? '');
    Object.values(b.slots).forEach((k) => k.forEach(visit));
  };
  visit(tree);
  return s;
}

/** Code levels: a reminder of the tags learned so far, instead of a palette. */
function CheatSheet({ level }: { level: Level }) {
  const { tl } = useT();
  const items = ['<h1>…</h1>', '<p>…</p>', '<ul>\n  <li>…</li>\n</ul>', '<a href="https://…">…</a>', '<img src="house.svg" alt="…">'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.6 }}>
        <Rich text={tl({ ar: 'هذي المرة تكتب بنفسك! هذي الوسوم اللي تعلّمتها:', en: 'This time you type it yourself! Here are the tags you learned:' })} />
      </p>
      {items.map((c) => (
        <pre key={c} className="code" style={{ margin: 0, padding: '8px 12px', borderRadius: 12, background: '#FBEAE3', color: '#8E3219', fontSize: 13.5, fontWeight: 600, textAlign: 'left', whiteSpace: 'pre' }}>
          {c}
        </pre>
      ))}
      <span className="chip" style={{ alignSelf: 'flex-start' }}>{tl(level.concept.title)}</span>
    </div>
  );
}

function ActionBar({ level, onRun, onStep, onStepBack, canStep, compact }: { level: Level; onRun: () => void; onStep: () => void; onStepBack?: () => void; canStep: boolean; compact: boolean }) {
  const { t, dir } = useT();
  const phase = useLevel((s) => s.phase);
  const failedRuns = useLevel((s) => s.failedRuns);
  const hintLevel = useLevel((s) => s.hintLevel);
  const runs = useLevel((s) => s.runs);
  const hintsUsed = useLevel((s) => s.hintsUsed);
  const blocks = useLevel((s) => (s.tree ? countBlocks(s.tree) : 0));
  const canUndo = useStore(useLevel.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useLevel.temporal, (s) => s.futureStates.length > 0);
  const expected = starsFor({ solved: true, mode: level.mode, blocks, optimalBlocks: level.optimalBlocks, runs: Math.max(1, runs), hintsUsed });
  const hintPulse = failedRuns >= 3 && hintLevel === 0 ? 'hint-pulse' : '';
  const flip = dir === 'rtl';
  const running = phase === 'running';

  if (compact) {
    return (
      <>
        <button type="button" className="fab btn-run" onClick={onRun} aria-label={t('run')} data-tour="run" data-testid="run" disabled={running} style={{ left: 26, bottom: 18, boxShadow: '0 6px 0 #0C5530, 0 14px 26px rgba(21,122,68,.4)', color: '#fff' }}>
          <PlayIcon size={30} flip={flip} />
        </button>
        <div style={{ position: 'absolute', right: 24, bottom: 22, display: 'flex', gap: 8, zIndex: 8 }}>
          <button type="button" className="btn btn-secondary btn-icon" onClick={undo} disabled={!canUndo} aria-label={t('undo')} style={{ borderRadius: 999 }}>
            <Icon name="undo" size={20} />
          </button>
          <button type="button" className={`btn btn-hint btn-icon ${hintPulse}`} onClick={() => useLevel.getState().hint()} aria-label={`${t('hint')} — ${t('hintCost')}`} style={{ borderRadius: 999 }} data-testid="hint">
            <Icon name="bulb" size={20} />
          </button>
        </div>
      </>
    );
  }

  return (
    <footer style={{ position: 'relative', flex: 'none', minHeight: 76, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 16px', borderRadius: 22, background: '#fff', boxShadow: 'var(--sh-2)', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" className="btn btn-run btn-lg" onClick={onRun} disabled={running} style={{ minHeight: 56, minWidth: 170 }} data-tour="run" data-testid="run">
          <PlayIcon size={22} flip={flip} />
          {t('run')}
        </button>
        {canStep && (
          <>
            {onStepBack && (
              <button type="button" className="btn btn-secondary btn-icon" onClick={onStepBack} aria-label={t('stepBack')}>
                <StepIcon size={20} flip={!flip} />
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onStep} data-testid="step">
              <StepIcon size={20} flip={flip} />
              {t('step')}
            </button>
          </>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => useLevel.getState().resetLevel()}>
          <Icon name="reset" size={20} stroke={2.4} />
          {t('reset')}
        </button>
        <button type="button" className={`btn btn-hint ${hintPulse}`} onClick={() => useLevel.getState().hint()} title={t('hintCost')} data-testid="hint">
          <Icon name="bulb" size={20} />
          {t('hint')}
        </button>
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <button type="button" className="btn btn-ghost btn-icon" onClick={undo} disabled={!canUndo} aria-label={`${t('undo')} (Ctrl+Z)`}>
            <Icon name="undo" size={20} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={redo} disabled={!canRedo} aria-label={`${t('redo')} (Ctrl+Shift+Z)`}>
            <Icon name="redo" size={20} />
          </button>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#4A4360' }}>
          {t('tries')}: <span className="ltr">{runs}</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#4A4360' }}>{t('expected')}</span>
          <div dir="ltr" style={{ display: 'flex', gap: 2 }} role="img" aria-label={`${expected}/3`}>
            {[0, 1, 2].map((k) => (
              <Star key={k} on={k < expected} />
            ))}
          </div>
        </div>
        <span className="chip ltr" style={{ height: 40, fontSize: 16, background: '#2A2163', color: '#fff', boxShadow: 'none' }}>
          +{expected * 10} XP
        </span>
      </div>
    </footer>
  );
}
