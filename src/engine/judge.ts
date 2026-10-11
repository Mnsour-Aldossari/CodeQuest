/**
 * One place that turns "what the player built" into a program, and "what happened"
 * into a verdict. The level screen and the level tests both use it.
 */
import { evaluate } from './checker';
import { traceProblem } from './errors';
import { compileHtmlCode } from './htmlCode';
import { instrumentJs } from './instrument';
import { serialize } from './serialize';
import type { Block, CheckResult, Level, Loc, Program, Trace } from './types';

export interface Compiled {
  program: Program;
  /** parsed player JS (code mode), for structure checks */
  ast?: unknown;
}

export function compile(level: Level, input: { tree?: Block; code?: string }, lang: 'ar' | 'en' = 'ar'): Compiled {
  if (level.mode === 'code') {
    const code = input.code ?? '';
    if (level.output === 'web') return { program: compileHtmlCode(code) };
    const r = instrumentJs(code);
    if (!r.ok) {
      return { program: { display: code, sourceMap: {}, run: { title: '', html: '', css: '', js: '' }, diagnostics: [{ severity: 'error', message: r.error.message, line: r.error.line }] } };
    }
    return { program: { display: code, sourceMap: {}, run: { title: '', html: '', css: '', js: r.code }, diagnostics: [] }, ast: r.ast };
  }
  return { program: serialize(input.tree!, { lang }) };
}

export interface Problem {
  message: Loc;
  blockId?: string;
  line?: number;
}

export interface Verdict {
  results: CheckResult[];
  problem: Problem | null;
  solved: boolean;
}

export function judge(level: Level, compiled: Compiled, trace: Trace, tree?: Block): Verdict {
  const results = evaluate(level.checks, { trace, tree, ast: compiled.ast, robot: level.robot });
  const d = compiled.program.diagnostics.find((x) => x.severity === 'error');
  const problem: Problem | null = d ? { message: d.message, blockId: d.blockId, line: d.line } : traceProblem(trace);
  return { results, problem, solved: !problem && results.every((r) => r.pass) };
}
