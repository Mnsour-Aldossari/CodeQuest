/**
 * zod schemas — every piece of data that crosses a trust boundary is parsed here:
 * level files, block trees (share links / localStorage), runner messages, saved progress.
 */
import { z } from 'zod';

export const MAX_BLOCKS = 400;
export const MAX_FIELD_LEN = 300;
export const MAX_CODE_LEN = 20_000;

export const LocText = z.object({ ar: z.string(), en: z.string() });

export const FieldValue = z.union([
  z.string().max(MAX_FIELD_LEN),
  z.number().finite(),
  z.boolean(),
]);

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);
const TYPE = z.string().regex(/^[a-z]+(\.[a-z0-9-]+)?$/).max(40);

export interface BlockShape {
  id: string;
  type: string;
  locked?: boolean;
  /** fields come from the level (e.g. a text chip) and can't be edited */
  fixed?: boolean;
  fields: Record<string, string | number | boolean>;
  slots: Record<string, BlockShape[]>;
}

export const BlockSchema: z.ZodType<BlockShape> = z.lazy(() =>
  z.object({
    id: ID,
    type: TYPE,
    locked: z.boolean().optional(),
    fixed: z.boolean().optional(),
    fields: z.record(z.string().max(30), FieldValue),
    slots: z.record(z.string().max(30), z.array(BlockSchema).max(MAX_BLOCKS)),
  }),
);

/* ---------------- checks (declarative, interpreted by checker.ts) ---------------- */

const Count = z.union([z.number().int().min(0), z.object({ min: z.number().int().optional(), max: z.number().int().optional() })]);

export const DomCheck = z.object({
  type: z.literal('dom'),
  selector: z.string(),
  count: Count.optional(),
  text: z.string().optional(),
  textIncludes: z.string().optional(),
  nonEmpty: z.boolean().optional(),
  attr: z.object({ name: z.string(), equals: z.string().optional(), startsWith: z.string().optional() }).optional(),
});
export const KnownTagsCheck = z.object({ type: z.literal('known-tags') });
export const StyleCheck = z.object({
  type: z.literal('style'),
  selector: z.string(),
  prop: z.string(),
  value: z.string(),
});
export const ConsoleCheck = z.object({
  type: z.literal('console'),
  text: z.string().optional(),
  includes: z.string().optional(),
  index: z.number().int().optional(),
  count: Count.optional(),
});
export const RobotCheck = z.object({
  type: z.literal('robot'),
  at: z.tuple([z.number().int(), z.number().int()]).optional(),
  gems: z.union([z.literal('all'), z.number().int()]).optional(),
  noBump: z.boolean().optional(),
});
export const StructureCheck = z.object({
  type: z.literal('structure'),
  block: z.string(),
  count: Count.optional(),
  inside: z.string().optional(),
});
export const NoErrorCheck = z.object({ type: z.literal('no-error') });

const SimpleCheck = z.discriminatedUnion('type', [DomCheck, KnownTagsCheck, StyleCheck, ConsoleCheck, RobotCheck, StructureCheck, NoErrorCheck]);

export const EventCheck = z.object({
  type: z.literal('event'),
  selector: z.string(),
  event: z.enum(['click', 'input', 'mouseover']),
  expect: z.array(SimpleCheck),
});

export const CheckBody = z.union([SimpleCheck, EventCheck]);
export const Check = z.intersection(
  CheckBody,
  z.object({ label: LocText, fail: LocText.optional(), weight: z.number().positive().optional() }),
);

/* ---------------- levels ---------------- */

export const PaletteItem = z.object({
  type: TYPE,
  fields: z.record(z.string(), FieldValue).optional(),
  /** fields the player may not edit (value chips like "مرحبا يا بِت") */
  fixed: z.boolean().optional(),
  /** how many copies may be used; omitted = unlimited */
  count: z.number().int().positive().optional(),
  /** a nested preset (e.g. <ul> already holding <li>s) */
  slots: z.record(z.string(), z.array(BlockSchema)).optional(),
});

export const RobotMap = z.object({
  rows: z.array(z.string().regex(/^[.#*SG]+$/)).min(1).max(12),
  dir: z.enum(['N', 'E', 'S', 'W']),
});

export const LevelSchema = z.object({
  id: z.string().regex(/^[a-z]+-\d+$/),
  world: z.enum(['html', 'css', 'js']),
  num: z.number().int().positive(),
  mode: z.enum(['build', 'parsons', 'fill', 'code', 'debug', 'match']),
  output: z.enum(['web', 'console', 'robot']),
  boss: z.boolean().optional(),
  title: LocText,
  story: LocText,
  concept: z.object({ tag: z.string(), title: LocText, one: LocText, real: LocText }),
  hints: z.array(LocText).min(1),
  initial: BlockSchema.optional(),
  initialCode: z.string().max(MAX_CODE_LEN).optional(),
  palette: z.array(PaletteItem),
  checks: z.array(Check).min(1),
  solution: BlockSchema.optional(),
  solutionCode: z.string().optional(),
  optimalBlocks: z.number().int().positive().optional(),
  predict: z.object({ question: LocText, options: z.array(z.string()).min(2), answer: z.number().int() }).optional(),
  robot: RobotMap.optional(),
  tour: z.boolean().optional(),
  page: z.object({ url: z.string() }).optional(),
}).refine((l) => (l.mode === 'code' ? l.initialCode !== undefined && l.solutionCode !== undefined : l.initial !== undefined && l.solution !== undefined), {
  message: 'block levels need initial+solution, code levels need initialCode+solutionCode',
});

/* ---------------- trace + runner messages ---------------- */

export const DomEl = z.object({
  tag: z.string().max(40),
  parent: z.number().int(),
  text: z.string().max(2000),
  attrs: z.record(z.string(), z.string().max(500)),
  style: z.record(z.string(), z.string().max(200)),
});

export const DomSnapshot = z.object({
  title: z.string().max(300),
  els: z.array(DomEl).max(2000),
  /** selector → indices into els */
  q: z.record(z.string(), z.array(z.number().int())),
  /** "prop:value" → value as the browser computes it (for comparing styles) */
  norm: z.record(z.string(), z.string()),
});

export const TraceEvent = z.discriminatedUnion('t', [
  z.object({ t: z.literal('step'), id: z.string().max(60) }),
  z.object({ t: z.literal('set'), name: z.string().max(60), value: z.string().max(200) }),
  z.object({ t: z.literal('log'), level: z.enum(['log', 'warn', 'error', 'info']), text: z.string().max(1000) }),
  z.object({ t: z.literal('error'), name: z.string().max(60), message: z.string().max(500), id: z.string().max(60).optional() }),
  z.object({ t: z.literal('robot'), op: z.enum(['move', 'turn', 'collect', 'bump', 'miss']), x: z.number().int(), y: z.number().int(), dir: z.enum(['N', 'E', 'S', 'W']), gems: z.number().int() }),
  z.object({ t: z.literal('dom'), snap: DomSnapshot }),
  z.object({ t: z.literal('event'), key: z.string().max(200), snap: DomSnapshot }),
  z.object({ t: z.literal('limit'), what: z.enum(['loop', 'log', 'depth']) }),
  z.object({ t: z.literal('done') }),
]);

export const RunnerMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('events'), nonce: z.string().max(80), events: z.array(TraceEvent).max(2100), final: z.boolean() }),
]);

/* ---------------- saved progress ---------------- */

export const LevelProgress = z.object({
  solved: z.boolean(),
  stars: z.number().int().min(0).max(3),
  bestBlocks: z.number().int().optional(),
  attempts: z.number().int().min(0),
  timeMs: z.number().min(0),
  hints: z.number().int().min(0),
  lastError: z.string().max(500).optional(),
  predictedRight: z.boolean().optional(),
  tree: BlockSchema.optional(),
  code: z.string().max(MAX_CODE_LEN).optional(),
});

export const ProgressSchema = z.object({
  version: z.literal(2),
  xp: z.number().int().min(0),
  levels: z.record(z.string(), LevelProgress),
  badges: z.array(z.string().max(40)).max(50),
  settings: z.object({
    lang: z.enum(['ar', 'en']),
    sound: z.boolean(),
    captions: z.boolean(),
    reducedMotion: z.boolean(),
  }),
  tourDone: z.boolean(),
});
