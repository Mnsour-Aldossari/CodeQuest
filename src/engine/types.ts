import type { z } from 'zod';
import type {
  BlockShape, Check as CheckS, CheckBody as CheckBodyS, LevelSchema, LocText as LocTextS, PaletteItem as PaletteItemS,
  TraceEvent as TraceEventS, DomSnapshot as DomSnapshotS, ProgressSchema, LevelProgress as LevelProgressS, RobotMap as RobotMapS,
} from './schema';

export type Block = BlockShape;
export type FieldVal = string | number | boolean;
export type Loc = z.infer<typeof LocTextS>;
export type Check = z.infer<typeof CheckS>;
export type CheckBody = z.infer<typeof CheckBodyS>;
export type Level = z.infer<typeof LevelSchema>;
export type PaletteItem = z.infer<typeof PaletteItemS>;
export type TraceEvent = z.infer<typeof TraceEventS>;
export type DomSnapshot = z.infer<typeof DomSnapshotS>;
export type Progress = z.infer<typeof ProgressSchema>;
export type LevelProgress = z.infer<typeof LevelProgressS>;
export type RobotMap = z.infer<typeof RobotMapS>;
export type Lang = 'ar' | 'en';
export type Dir = 'N' | 'E' | 'S' | 'W';

/** What a slot accepts. Statement slots are scoped by language. */
export type SlotKind =
  | 'html'        // HTML content (children of <body>, <div>, <ul>…)
  | 'li'          // only <li> (children of <ul>/<ol>)
  | 'css'         // CSS rules in a stylesheet
  | 'decl'        // CSS declarations inside a rule
  | 'js'          // JS statements
  | 'value'       // a JS expression
  | 'text';       // HTML text content (a text chip)

/** Typed inline inputs. Each has its own sanitizer in sanitize.ts. */
export type FieldType =
  | 'text'        // HTML text → escaped
  | 'string'      // JS string literal → JSON-encoded
  | 'number'
  | 'boolean'
  | 'ident'       // JS identifier
  | 'cls'         // HTML class / id token
  | 'selector'    // CSS selector: tag, .class or #id
  | 'css-value'   // CSS value, allow-listed per property
  | 'url'         // href: https: or # only
  | 'src'         // image: game images only
  | 'tag'         // fixed element name (never typed by the player)
  | 'op'          // operator from a fixed list
  | 'prop'        // CSS property name from the allow-list
  | 'expr';       // typed JS expression, acorn allow-list

/** Where a block can be dropped: into a list slot at an index. */
export interface Place {
  parentId: string;
  slot: string;
  index: number;
}

export interface SourceRange { from: number; to: number } // 1-based display lines, inclusive
export type SourceMap = Record<string, SourceRange>;

export interface Program {
  /** full code shown to the player (CodeView) */
  display: string;
  /** blockId → display lines */
  sourceMap: SourceMap;
  /** what the sandbox executes */
  run: { title: string; html: string; css: string; js: string };
  /** problems found while building (unsafe/invalid values, unknown tags) */
  diagnostics: Diagnostic[];
}

export interface Diagnostic {
  severity: 'error' | 'warning';
  message: Loc;
  blockId?: string;
  line?: number;
}

export interface Trace {
  events: TraceEvent[];
  timedOut: boolean;
}

export interface CheckResult {
  pass: boolean;
  reason?: Loc;
}
