import { LevelSchema } from '../engine/schema';
import type { Level, Loc } from '../engine/types';
import { HTML_LEVELS } from './html';

export type WorldId = 'html' | 'css' | 'js';

export interface WorldInfo {
  id: WorldId;
  color: string;
  dark: string;
  tint: string;
  /** every planned level in this world; ones without content yet show as "coming soon" */
  plan: Loc[];
}

export const WORLDS: WorldInfo[] = [
  {
    id: 'html', color: '#C24E2B', dark: '#8E3219', tint: '#FBE3D6',
    plan: [{ ar: 'أول وسم', en: 'First tag' }, { ar: 'لافتة البيت', en: 'The house sign' }, { ar: 'قائمة أصدقائي', en: 'My friends list' }, { ar: 'الرابط السحري', en: 'The magic link' }, { ar: 'الصفحة المكسورة', en: 'The broken page' }],
  },
  {
    id: 'css', color: '#1A7F53', dark: '#0F5A3A', tint: '#DDF2E3',
    plan: [{ ar: 'لون النص', en: 'Text color' }, { ar: 'حجم وخلفية', en: 'Size & background' }, { ar: 'الشجرة المختارة', en: 'The chosen tree' }, { ar: 'غابة مرنة', en: 'Flex forest' }, { ar: 'طابق الهدف', en: 'Match the target' }],
  },
  {
    id: 'js', color: '#6A3FD6', dark: '#43249A', tint: '#EDE6FC',
    plan: [{ ar: 'اطبع رسالة', en: 'Print a message' }, { ar: 'المتغيرات', en: 'Variables' }, { ar: 'أوامر بِت', en: 'Bit’s commands' }, { ar: 'طريق الجواهر', en: 'The gem road' }, { ar: 'إذا… وإلا', en: 'If… else' }, { ar: 'الدالة السحرية', en: 'The magic function' }, { ar: 'زر يتكلم', en: 'A talking button' }, { ar: 'المتاهة', en: 'The maze' }],
  },
];

/** Every level is parsed by zod at load time — a broken level file fails loudly. */
export const LEVELS: Level[] = HTML_LEVELS.map((l) => LevelSchema.parse(l) as Level);

export const levelById = (id: string) => LEVELS.find((l) => l.id === id);

/** All planned slots in play order (implemented or not). */
export const PLAN = WORLDS.flatMap((w) => w.plan.map((title, i) => ({ world: w, num: i + 1, id: `${w.id}-${i + 1}`, title })));

export function nextLevelId(id: string): string | undefined {
  const i = PLAN.findIndex((p) => p.id === id);
  return PLAN[i + 1]?.id;
}

export const worldOf = (id: WorldId) => WORLDS.find((w) => w.id === id)!;
