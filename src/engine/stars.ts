/**
 * ⭐   the level is solved
 * ⭐⭐  with ≤ optimalBlocks blocks (code mode: solved within 3 runs)
 * ⭐⭐⭐ without any hint
 */
export interface StarInput {
  solved: boolean;
  mode: string;
  blocks: number;
  optimalBlocks?: number;
  runs: number;
  hintsUsed: number;
}

export function stars(i: StarInput): 0 | 1 | 2 | 3 {
  if (!i.solved) return 0;
  const lean = i.mode === 'code' ? i.runs <= 3 : i.optimalBlocks === undefined || i.blocks <= i.optimalBlocks;
  return (1 + (lean ? 1 : 0) + (i.hintsUsed === 0 ? 1 : 0)) as 1 | 2 | 3;
}

export const XP = { perStar: 10, perPrediction: 5 } as const;

export function xpFor(earnedStars: number, predictedRight: boolean): number {
  return earnedStars * XP.perStar + (predictedRight ? XP.perPrediction : 0);
}

/** Player level from total XP: 100 XP per level, growing slowly. */
export function playerLevel(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let need = 100;
  let left = xp;
  while (left >= need) {
    left -= need;
    level++;
    need = 100 + (level - 1) * 20;
  }
  return { level, into: left, need };
}
