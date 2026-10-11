/**
 * Pure robot world. This function is injected into the Worker as source text
 * (via Function.prototype.toString), so it must stay self-contained: no imports,
 * no references to anything outside its own body.
 *
 * Map legend: '.' floor · '#' wall · '*' gem · 'S' start · 'G' goal
 */
export interface RobotEvent {
  t: 'robot';
  op: 'move' | 'turn' | 'collect' | 'bump' | 'miss';
  x: number;
  y: number;
  dir: 'N' | 'E' | 'S' | 'W';
  gems: number;
}

export interface RobotState {
  x: number;
  y: number;
  dir: 'N' | 'E' | 'S' | 'W';
  gems: number;
  totalGems: number;
  goal: [number, number] | null;
  taken: string[];
}

export function robotSim(map: { rows: string[]; dir: 'N' | 'E' | 'S' | 'W' }, emit: (e: RobotEvent) => void) {
  const rows = map.rows;
  const h = rows.length;
  const w = rows[0].length;
  let x = 0;
  let y = 0;
  let goal: [number, number] | null = null;
  const gems: Record<string, boolean> = {};
  let total = 0;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const c = rows[j][i];
      if (c === 'S') { x = i; y = j; }
      if (c === 'G') goal = [i, j];
      if (c === '*') { gems[i + ',' + j] = true; total++; }
    }
  }
  let dir = map.dir;
  let got = 0;
  const order: Array<'N' | 'E' | 'S' | 'W'> = ['N', 'E', 'S', 'W'];
  const dx: Record<string, number> = { N: 0, E: 1, S: 0, W: -1 };
  const dy: Record<string, number> = { N: -1, E: 0, S: 1, W: 0 };
  const blocked = (i: number, j: number) => i < 0 || j < 0 || i >= w || j >= h || rows[j][i] === '#';
  const ev = (op: RobotEvent['op']) => emit({ t: 'robot', op, x, y, dir, gems: got });

  return {
    moveForward() {
      const nx = x + dx[dir];
      const ny = y + dy[dir];
      if (blocked(nx, ny)) { ev('bump'); return; }
      x = nx; y = ny;
      ev('move');
    },
    turnLeft() { dir = order[(order.indexOf(dir) + 3) % 4]; ev('turn'); },
    turnRight() { dir = order[(order.indexOf(dir) + 1) % 4]; ev('turn'); },
    collectGem() {
      const k = x + ',' + y;
      if (gems[k]) { gems[k] = false; got++; ev('collect'); } else ev('miss');
    },
    isWallAhead() { return blocked(x + dx[dir], y + dy[dir]); },
    isGemHere() { return gems[x + ',' + y] === true; },
    isAtGoal() { return goal !== null && goal[0] === x && goal[1] === y; },
    state(): RobotState {
      return { x, y, dir, gems: got, totalGems: total, goal, taken: Object.keys(gems).filter((k) => !gems[k]) };
    },
  };
}

/** Replay robot events from a trace onto the starting state (for rendering and checks). */
export function robotStateAt(map: { rows: string[]; dir: 'N' | 'E' | 'S' | 'W' }, events: Array<{ t: string }>): RobotState & { bumps: number } {
  const start = robotSim(map, () => {}).state();
  let s = { ...start, bumps: 0 };
  const taken = new Set<string>();
  for (const e of events) {
    if (e.t !== 'robot') continue;
    const r = e as RobotEvent;
    if (r.op === 'collect') taken.add(r.x + ',' + r.y);
    s = { ...s, x: r.x, y: r.y, dir: r.dir, gems: r.gems, bumps: s.bumps + (r.op === 'bump' ? 1 : 0) };
  }
  return { ...s, taken: [...taken] };
}
