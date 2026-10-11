/**
 * Runtime problems in plain words: what happened, and where.
 */
import type { Loc, Trace } from './types';
import { firstError, limitHit } from './trace';

export function explainError(name: string, message: string): Loc {
  let m: RegExpMatchArray | null;
  if (name === 'ReferenceError' && (m = message.match(/^(\S+) is not defined/))) {
    return { ar: `ما أعرف شي اسمه \`${m[1]}\`. هل كتبته صح؟ أو نسيت تعرّفه بـ \`let\`؟`, en: `I don’t know anything called \`${m[1]}\`. Is it spelled right, or did you forget \`let\`?` };
  }
  if (name === 'ReferenceError' && /before initialization/.test(message)) {
    const v = message.match(/'(\S+)'/)?.[1] ?? '';
    return { ar: `استخدمت \`${v}\` قبل ما تعرّفه — انقل سطر \`let\` لفوق`, en: `You used \`${v}\` before creating it — move the \`let\` line up` };
  }
  if (name === 'TypeError' && (m = message.match(/(\S+) is not a function/))) {
    return { ar: `\`${m[1]}\` مو دالة — ما ينفع تناديه بـ ()`, en: `\`${m[1]}\` isn’t a function — you can’t call it with ()` };
  }
  if (name === 'TypeError' && /Assignment to constant/.test(message)) {
    return { ar: 'حاولت تغيّر قيمة ثابتة (`const`) — استخدم `let`', en: 'You tried to change a constant (`const`) — use `let`' };
  }
  if (name === 'TypeError' && /null|undefined/.test(message)) {
    return { ar: 'حاولت تستخدم شي غير موجود (null أو undefined) — تأكد من اسم العنصر أو المتغير', en: 'You used something that doesn’t exist (null or undefined) — check the element or variable name' };
  }
  if (name === 'RangeError' && /call stack/i.test(message)) {
    return { ar: 'الدالة تنادي نفسها بلا توقف — لازم يكون لها نهاية', en: 'The function keeps calling itself forever — it needs a way to stop' };
  }
  if (name === 'SyntaxError') {
    return { ar: 'الكود فيه خطأ في الكتابة', en: 'The code has a typing mistake' };
  }
  return { ar: `صار خطأ: ${message}`, en: `Something went wrong: ${message}` };
}

const LIMIT_TEXT: Record<string, Loc> = {
  loop: { ar: 'الحلقة دارت أكثر من 10,000 مرة فأوقفتها — يمكن الشرط ما يصير false أبداً؟', en: 'The loop ran more than 10,000 times, so I stopped it — maybe its condition never becomes false?' },
  log: { ar: 'البرنامج طبع وسوّى أشياء كثيرة جداً (أكثر من 2,000) فأوقفته', en: 'The program did too many things (over 2,000), so I stopped it' },
  depth: { ar: 'الدوال نادت بعضها بعمق كبير جداً فأوقفت البرنامج', en: 'Functions called each other too deeply, so I stopped the program' },
};

/** The one problem to tell the player about, if any (with the responsible block). */
export function traceProblem(trace: Trace): { message: Loc; blockId?: string } | null {
  if (trace.timedOut) return { message: { ar: 'البرنامج أخذ وقت طويل (أكثر من 3 ثواني) فأوقفته', en: 'The program took too long (over 3 seconds), so I stopped it' } };
  const lim = limitHit(trace);
  if (lim) {
    const lastStep = [...trace.events].reverse().find((e) => e.t === 'step');
    return { message: LIMIT_TEXT[lim], blockId: lastStep && lastStep.t === 'step' ? lastStep.id : undefined };
  }
  const e = firstError(trace);
  if (e) return { message: explainError(e.name, e.message), blockId: e.id };
  return null;
}
