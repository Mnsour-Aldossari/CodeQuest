# مغامرة الكود · Code Quest

لعبة لتعليم المبتدئين HTML وCSS وJavaScript: تركّب بلوكات **كود حقيقي** بالسحب أو بالضغط، وتشوف النتيجة حيّة على اليمين، وتتدرّج من البلوكات إلى كتابة الكود بيدك — مع الروبوت «بِت».

A game where beginners snap together blocks of **real code**, see the result live, and grow from blocks to typing code themselves — with Bit the robot. Arabic (RTL) first, with an English switch. No server.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # Vitest: engine, security payloads, every level
npm run test:e2e     # Playwright against the production build (1280px + 375px)
npm run build && npm run lint
```

Playwright uses the browsers it installs; to point it at an existing Chromium set `PW_CHROMIUM=/path/to/chrome`.

## Status

| Milestone | State |
|---|---|
| D — design in Claude Design | ✅ approved canvas; tokens and kit ported to `src/styles/kit.css` |
| M0 — foundation + drag/tap | ✅ |
| M1 — safe engine | ✅ |
| M2 — HTML Village (levels 1–5) | ✅ — next: playtest with 3 beginners |
| M3 — CSS Forest, album, match mode | ⏳ |
| M4 — JS Castle (console, robot, timeline, predict) | ⏳ engine pieces (Worker, robot sim, trace frames) are in place |
| M5 — sandbox, sharing, badges UI, notebook, stats | ⏳ |

## How it's built

```
src/engine/      pure, tested core
  schema.ts      zod schemas: blocks, levels, checks, trace, runner messages, saved progress
  blocks.ts      block registry — each block is real code (head/body/foot with fields and holes)
  tree.ts        insert / move / remove — the only structural operations (drag, tap, keyboard, undo)
  sanitize.ts    one sanitizer per blank type (href, src, CSS values, selectors, idents, expressions)
  serialize.ts   tree → display code + source map + instrumented run code
  htmlCode.ts    typed HTML (boss levels) → parsed inertly and rebuilt from an allow-list
  instrument.ts  typed JS → acorn → loop guards, step hooks, call-depth hooks → astring
  checker.ts     declarative checks (dom, style, console, robot, event, structure) read the trace
  judge.ts · stars.ts · errors.ts · hints.ts · trace.ts · robotSim.ts
src/runner/      sandboxes
  iframeRunner.ts  page levels: fresh <iframe sandbox="allow-scripts"> per run, nonce-checked messages
  harness.ts       runs inside /runner/index.html (CSP default-src 'none'); answers the checker's probes
  workerRunner.ts  console/robot levels: blob Worker, network globals removed, terminate() after 3 s
  hooks.ts         __step / __set / __guard (10,000 loop cap) / __enter (depth cap), 2,000-event cap
src/levels/      level data (validated by zod at load and in tests)
src/level/       level screen: palette, workspace, output, goals, story, win, tour
src/screens/     home, world map
```

### Security notes

- Player code never runs in the app's origin. Pages run in a sandboxed iframe without `allow-same-origin`;
  the runner page has its own CSP (`default-src 'none'`), so there is no network and no storage.
  The plan called for `srcdoc`; a srcdoc document inherits the app's CSP (`script-src 'self'`), which would
  block the harness, so the runner is a static page loaded with the same sandbox flags instead.
- Every runner message is checked for its source window, the current run's nonce, and its shape (zod).
- The app CSP is injected into `index.html` at build time (`vite.config.ts`) and also shipped as headers in
  `public/_headers` together with `frame-ancestors 'none'` and `Referrer-Policy: no-referrer`.
- `localStorage` is parsed with zod on load; damaged data starts a fresh game instead of crashing.
