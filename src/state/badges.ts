/** The six badges. Awarded from progress after each win. */
import type { Level, Loc, Progress } from '../engine/types';
import { LEVELS } from '../levels';

export const BADGES: Record<string, Loc> = {
  'first-program': { ar: 'أول برنامج', en: 'First program' },
  'bug-hunter': { ar: 'صياد أخطاء', en: 'Bug hunter' },
  'no-help': { ar: 'بدون مساعدة', en: 'No help needed' },
  prophet: { ar: 'المتنبئ', en: 'The prophet' },
  'full-stars': { ar: 'نجوم كاملة', en: 'Full stars' },
  engineer: { ar: 'المهندس', en: 'The engineer' },
};

/** Badges earned now that `level` was just won (progress already includes this win). */
export function earnedBadges(p: Progress, level: Level, hintsUsed: number): string[] {
  const out: string[] = [];
  const solved = Object.values(p.levels).filter((l) => l.solved);
  if (solved.length >= 1) out.push('first-program');
  if ((level.mode === 'debug' || (level.mode === 'code' && level.boss)) && hintsUsed === 0) out.push('bug-hunter');
  if (solved.filter((l) => l.hints === 0).length >= 3) out.push('no-help');
  const world = LEVELS.filter((l) => l.world === level.world);
  if (world.length > 0 && world.every((l) => p.levels[l.id]?.stars === 3)) out.push('full-stars');
  return out.filter((b) => !p.badges.includes(b));
}
