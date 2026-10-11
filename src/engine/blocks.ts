/**
 * Block registry. A block is real code: `head`/`foot` describe exactly the code text
 * the block shows, with inline fields (typed inputs) and slots (holes for other blocks).
 */
import type { Block, FieldType, Loc, SlotKind } from './types';

export type Category = 'html' | 'css' | 'js' | 'bot' | 'val' | 'root';

export interface FieldDef {
  name: string;
  type: FieldType;
  options?: readonly string[];
  min?: number;
  max?: number;
  /** placeholder shown in an empty input */
  hint?: string;
}

export interface SlotDef {
  name: string;
  accepts: SlotKind;
  /** list slot (statements / children) vs single hole (a value) */
  multiple: boolean;
}

export type Part = string | { field: string } | { slot: string };

export interface BlockDef {
  type: string;
  cat: Category;
  /** slot kinds this block can be dropped into */
  fits: SlotKind[];
  fields: FieldDef[];
  slots: SlotDef[];
  /** the code on the block's first line */
  head(b: Block): Part[];
  /** a container renders this slot as an indented body under the head */
  body?: string;
  foot?(b: Block): Part[];
  caption(b: Block): Loc;
}

const s = (v: unknown) => String(v ?? '');

const TAG_CAPTION: Record<string, Loc> = {
  h1: { ar: 'عنوان كبير', en: 'Big heading' },
  h2: { ar: 'عنوان متوسط', en: 'Medium heading' },
  h3: { ar: 'عنوان صغير', en: 'Small heading' },
  p: { ar: 'فقرة', en: 'Paragraph' },
  button: { ar: 'زر', en: 'Button' },
  span: { ar: 'قطعة نص', en: 'Piece of text' },
  strong: { ar: 'نص عريض', en: 'Bold text' },
  em: { ar: 'نص مائل', en: 'Italic text' },
  div: { ar: 'صندوق', en: 'Box' },
  section: { ar: 'قسم', en: 'Section' },
  header: { ar: 'رأس الصفحة', en: 'Page header' },
  footer: { ar: 'ذيل الصفحة', en: 'Page footer' },
  main: { ar: 'المحتوى الرئيسي', en: 'Main content' },
  nav: { ar: 'قائمة تنقّل', en: 'Navigation' },
  ul: { ar: 'قائمة نقاط', en: 'Bullet list' },
  ol: { ar: 'قائمة مرقّمة', en: 'Numbered list' },
  li: { ar: 'عنصر في القائمة', en: 'List item' },
};

export const TEXT_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'button', 'span', 'strong', 'em', 'h7'] as const;
export const BOX_TAGS = ['div', 'section', 'header', 'footer', 'main', 'nav'] as const;

function attrPart(b: Block, name: string, attr: string): Part[] {
  return name in b.fields ? [` ${attr}="`, { field: name }, '"'] : [];
}

const defs: BlockDef[] = [
  /* ---------- roots ---------- */
  {
    type: 'root.page', cat: 'root', fits: [],
    fields: [{ name: 'title', type: 'text', hint: 'title' }],
    slots: [
      { name: 'style', accepts: 'css', multiple: true },
      { name: 'body', accepts: 'html', multiple: true },
      { name: 'script', accepts: 'js', multiple: true },
    ],
    head: () => [], caption: () => ({ ar: 'الصفحة', en: 'Page' }),
  },
  {
    type: 'root.js', cat: 'root', fits: [], fields: [],
    slots: [{ name: 'main', accepts: 'js', multiple: true }],
    head: () => [], caption: () => ({ ar: 'البرنامج', en: 'Program' }),
  },
  {
    type: 'root.bot', cat: 'root', fits: [], fields: [],
    slots: [{ name: 'main', accepts: 'js', multiple: true }],
    head: () => [], caption: () => ({ ar: 'أوامر بِت', en: 'Bit’s program' }),
  },

  /* ---------- HTML ---------- */
  {
    type: 'html.el', cat: 'html', fits: ['html'],
    fields: [{ name: 'tag', type: 'tag' }, { name: 'cls', type: 'cls', hint: 'class' }, { name: 'id', type: 'cls', hint: 'id' }],
    slots: [{ name: 'content', accepts: 'text', multiple: false }],
    head: (b) => [`<${s(b.fields.tag)}`, ...attrPart(b, 'cls', 'class'), ...attrPart(b, 'id', 'id'), '>', { slot: 'content' }, `</${s(b.fields.tag)}>`],
    caption: (b) => TAG_CAPTION[s(b.fields.tag)] ?? { ar: 'وسم؟', en: 'Tag?' },
  },
  {
    type: 'html.box', cat: 'html', fits: ['html'],
    fields: [{ name: 'tag', type: 'tag' }, { name: 'cls', type: 'cls', hint: 'class' }, { name: 'id', type: 'cls', hint: 'id' }],
    slots: [{ name: 'children', accepts: 'html', multiple: true }],
    head: (b) => [`<${s(b.fields.tag)}`, ...attrPart(b, 'cls', 'class'), ...attrPart(b, 'id', 'id'), '>'],
    body: 'children',
    foot: (b) => [`</${s(b.fields.tag)}>`],
    caption: (b) => TAG_CAPTION[s(b.fields.tag)] ?? { ar: 'صندوق', en: 'Box' },
  },
  {
    type: 'html.list', cat: 'html', fits: ['html'],
    fields: [{ name: 'tag', type: 'tag' }],
    slots: [{ name: 'items', accepts: 'li', multiple: true }],
    head: (b) => [`<${s(b.fields.tag)}>`],
    body: 'items',
    foot: (b) => [`</${s(b.fields.tag)}>`],
    caption: (b) => TAG_CAPTION[s(b.fields.tag)] ?? { ar: 'قائمة', en: 'List' },
  },
  {
    type: 'html.li', cat: 'html', fits: ['li'], fields: [],
    slots: [{ name: 'content', accepts: 'text', multiple: false }],
    head: () => ['<li>', { slot: 'content' }, '</li>'],
    caption: () => TAG_CAPTION.li,
  },
  {
    type: 'html.img', cat: 'html', fits: ['html'],
    fields: [{ name: 'src', type: 'src', hint: 'house.svg' }, { name: 'alt', type: 'text', hint: 'alt' }],
    slots: [],
    head: () => ['<img src="', { field: 'src' }, '" alt="', { field: 'alt' }, '">'],
    caption: () => ({ ar: 'صورة (ووصفها في alt)', en: 'Image (described in alt)' }),
  },
  {
    type: 'html.a', cat: 'html', fits: ['html'],
    fields: [{ name: 'href', type: 'url', hint: 'https://' }],
    slots: [{ name: 'content', accepts: 'text', multiple: false }],
    head: () => ['<a href="', { field: 'href' }, '">', { slot: 'content' }, '</a>'],
    caption: () => ({ ar: 'رابط', en: 'Link' }),
  },
  {
    type: 'text', cat: 'val', fits: ['text'],
    fields: [{ name: 'text', type: 'text', hint: '…' }],
    slots: [],
    head: () => [{ field: 'text' }],
    caption: () => ({ ar: 'نص', en: 'text' }),
  },

  /* ---------- CSS ---------- */
  {
    type: 'css.rule', cat: 'css', fits: ['css'],
    fields: [{ name: 'selector', type: 'selector', hint: 'h1' }],
    slots: [{ name: 'decls', accepts: 'decl', multiple: true }],
    head: () => [{ field: 'selector' }, ' {'],
    body: 'decls',
    foot: () => ['}'],
    caption: () => ({ ar: 'قاعدة: لمن؟', en: 'Rule: for whom?' }),
  },
  {
    type: 'css.decl', cat: 'css', fits: ['decl'],
    fields: [{ name: 'prop', type: 'prop' }, { name: 'value', type: 'css-value', hint: '?' }],
    slots: [],
    head: () => [{ field: 'prop' }, ': ', { field: 'value' }, ';'],
    caption: (b) => CSS_CAPTION[s(b.fields.prop)] ?? { ar: 'خاصية', en: 'Property' },
  },

  /* ---------- JavaScript ---------- */
  {
    type: 'js.log', cat: 'js', fits: ['js'], fields: [],
    slots: [{ name: 'value', accepts: 'value', multiple: false }],
    head: () => ['console.log(', { slot: 'value' }, ');'],
    caption: () => ({ ar: 'اطبع في الكونسول', en: 'Print to the console' }),
  },
  {
    type: 'js.let', cat: 'js', fits: ['js'],
    fields: [{ name: 'name', type: 'ident', hint: 'name' }],
    slots: [{ name: 'value', accepts: 'value', multiple: false }],
    head: () => ['let ', { field: 'name' }, ' = ', { slot: 'value' }, ';'],
    caption: () => ({ ar: 'صندوق جديد له اسم', en: 'A new named box' }),
  },
  {
    type: 'js.set', cat: 'js', fits: ['js'],
    fields: [{ name: 'name', type: 'ident', hint: 'name' }],
    slots: [{ name: 'value', accepts: 'value', multiple: false }],
    head: () => [{ field: 'name' }, ' = ', { slot: 'value' }, ';'],
    caption: () => ({ ar: 'غيّر قيمة الصندوق', en: 'Change the box’s value' }),
  },
  {
    type: 'js.for', cat: 'js', fits: ['js'],
    fields: [{ name: 'times', type: 'number', min: 0, max: 100, hint: '3' }],
    slots: [{ name: 'body', accepts: 'js', multiple: true }],
    head: () => ['for (let i = 0; i < ', { field: 'times' }, '; i++) {'],
    body: 'body', foot: () => ['}'],
    caption: () => ({ ar: 'كرّر عدداً من المرات', en: 'Repeat a number of times' }),
  },
  {
    type: 'js.while', cat: 'js', fits: ['js'], fields: [],
    slots: [{ name: 'cond', accepts: 'value', multiple: false }, { name: 'body', accepts: 'js', multiple: true }],
    head: () => ['while (', { slot: 'cond' }, ') {'],
    body: 'body', foot: () => ['}'],
    caption: () => ({ ar: 'كرّر ما دام الشرط صحيح', en: 'Repeat while it’s true' }),
  },
  {
    type: 'js.if', cat: 'js', fits: ['js'], fields: [],
    slots: [{ name: 'cond', accepts: 'value', multiple: false }, { name: 'body', accepts: 'js', multiple: true }],
    head: () => ['if (', { slot: 'cond' }, ') {'],
    body: 'body', foot: () => ['}'],
    caption: () => ({ ar: 'إذا كان الشرط صحيح', en: 'If it’s true' }),
  },
  {
    type: 'js.func', cat: 'js', fits: ['js'],
    fields: [{ name: 'name', type: 'ident', hint: 'name' }],
    slots: [{ name: 'body', accepts: 'js', multiple: true }],
    head: () => ['function ', { field: 'name' }, '() {'],
    body: 'body', foot: () => ['}'],
    caption: () => ({ ar: 'دالة: أوامر لها اسم', en: 'Function: named steps' }),
  },
  {
    type: 'js.call', cat: 'js', fits: ['js'],
    fields: [{ name: 'name', type: 'ident', hint: 'name' }],
    slots: [],
    head: () => [{ field: 'name' }, '();'],
    caption: () => ({ ar: 'نادِ الدالة', en: 'Call the function' }),
  },
  {
    type: 'js.on', cat: 'js', fits: ['js'],
    fields: [{ name: 'selector', type: 'selector', hint: 'button' }, { name: 'event', type: 'op', options: ['click', 'mouseover'] }],
    slots: [{ name: 'body', accepts: 'js', multiple: true }],
    head: () => ['document.querySelector("', { field: 'selector' }, '").addEventListener("', { field: 'event' }, '", () => {'],
    body: 'body', foot: () => ['});'],
    caption: () => ({ ar: 'لما يصير حدث…', en: 'When something happens…' }),
  },
  {
    type: 'js.settext', cat: 'js', fits: ['js'],
    fields: [{ name: 'selector', type: 'selector', hint: 'p' }],
    slots: [{ name: 'value', accepts: 'value', multiple: false }],
    head: () => ['document.querySelector("', { field: 'selector' }, '").textContent = ', { slot: 'value' }, ';'],
    caption: () => ({ ar: 'غيّر نص العنصر', en: 'Change the element’s text' }),
  },

  /* ---------- values ---------- */
  {
    type: 'val.str', cat: 'val', fits: ['value'], fields: [{ name: 'v', type: 'string', hint: '…' }], slots: [],
    head: () => ['"', { field: 'v' }, '"'], caption: () => ({ ar: 'نص', en: 'text' }),
  },
  {
    type: 'val.num', cat: 'val', fits: ['value'], fields: [{ name: 'v', type: 'number', hint: '0' }], slots: [],
    head: () => [{ field: 'v' }], caption: () => ({ ar: 'رقم', en: 'number' }),
  },
  {
    type: 'val.bool', cat: 'val', fits: ['value'], fields: [{ name: 'v', type: 'boolean' }], slots: [],
    head: () => [{ field: 'v' }], caption: () => ({ ar: 'صح أو خطأ', en: 'true or false' }),
  },
  {
    type: 'val.var', cat: 'val', fits: ['value'], fields: [{ name: 'name', type: 'ident', hint: 'name' }], slots: [],
    head: () => [{ field: 'name' }], caption: () => ({ ar: 'قيمة الصندوق', en: 'the box’s value' }),
  },
  {
    type: 'val.op', cat: 'val', fits: ['value'],
    fields: [{ name: 'op', type: 'op', options: ['+', '-', '*', '/', '%', '<', '>', '<=', '>=', '===', '!=='] }],
    slots: [{ name: 'a', accepts: 'value', multiple: false }, { name: 'b', accepts: 'value', multiple: false }],
    head: () => [{ slot: 'a' }, ' ', { field: 'op' }, ' ', { slot: 'b' }],
    caption: (b) => OP_CAPTION[s(b.fields.op)] ?? { ar: 'عملية', en: 'operation' },
  },
  {
    type: 'val.not', cat: 'val', fits: ['value'], fields: [],
    slots: [{ name: 'a', accepts: 'value', multiple: false }],
    head: () => ['!', { slot: 'a' }], caption: () => ({ ar: 'عكس الشرط', en: 'not' }),
  },
  {
    type: 'val.expr', cat: 'val', fits: ['value'], fields: [{ name: 'v', type: 'expr', hint: '?' }], slots: [],
    head: () => [{ field: 'v' }], caption: () => ({ ar: 'اكتب قيمة', en: 'type a value' }),
  },
  {
    type: 'bot.sense', cat: 'bot', fits: ['value'],
    fields: [{ name: 'fn', type: 'op', options: ['isWallAhead', 'isGemHere', 'isAtGoal'] }], slots: [],
    head: () => [{ field: 'fn' }, '()'],
    caption: (b) => SENSE_CAPTION[s(b.fields.fn)] ?? { ar: 'حسّاس', en: 'sensor' },
  },

  /* ---------- robot ---------- */
  bot('bot.move', 'moveForward', { ar: 'امشِ خطوة', en: 'Step forward' }),
  bot('bot.left', 'turnLeft', { ar: 'لف يسار', en: 'Turn left' }),
  bot('bot.right', 'turnRight', { ar: 'لف يمين', en: 'Turn right' }),
  bot('bot.collect', 'collectGem', { ar: 'التقط الجوهرة', en: 'Pick up the gem' }),
];

function bot(type: string, fn: string, cap: Loc): BlockDef {
  return { type, cat: 'bot', fits: ['js'], fields: [], slots: [], head: () => [`${fn}();`], caption: () => cap };
}

const CSS_CAPTION: Record<string, Loc> = {
  color: { ar: 'لون النص', en: 'Text color' },
  'background-color': { ar: 'لون الخلفية', en: 'Background color' },
  background: { ar: 'الخلفية', en: 'Background' },
  'font-size': { ar: 'حجم الخط', en: 'Font size' },
  'border-radius': { ar: 'حواف ناعمة', en: 'Rounded corners' },
  display: { ar: 'طريقة العرض', en: 'Display' },
  'justify-content': { ar: 'توزيع أفقي', en: 'Main-axis alignment' },
  'align-items': { ar: 'محاذاة عمودية', en: 'Cross-axis alignment' },
  'text-align': { ar: 'محاذاة النص', en: 'Text alignment' },
  padding: { ar: 'مسافة داخلية', en: 'Inner space' },
  margin: { ar: 'مسافة خارجية', en: 'Outer space' },
  width: { ar: 'العرض', en: 'Width' },
  height: { ar: 'الارتفاع', en: 'Height' },
  gap: { ar: 'المسافة بين العناصر', en: 'Gap between items' },
  border: { ar: 'إطار', en: 'Border' },
  'font-weight': { ar: 'سماكة الخط', en: 'Font weight' },
};

const OP_CAPTION: Record<string, Loc> = {
  '+': { ar: 'جمع', en: 'plus' }, '-': { ar: 'طرح', en: 'minus' }, '*': { ar: 'ضرب', en: 'times' }, '/': { ar: 'قسمة', en: 'divide' },
  '%': { ar: 'باقي القسمة', en: 'remainder' }, '<': { ar: 'أصغر من', en: 'less than' }, '>': { ar: 'أكبر من', en: 'greater than' },
  '===': { ar: 'يساوي', en: 'equals' }, '!==': { ar: 'لا يساوي', en: 'not equal' },
};

const SENSE_CAPTION: Record<string, Loc> = {
  isWallAhead: { ar: 'فيه جدار قدامي؟', en: 'Wall ahead?' },
  isGemHere: { ar: 'فيه جوهرة هنا؟', en: 'Gem here?' },
  isAtGoal: { ar: 'وصلت الهدف؟', en: 'At the goal?' },
};

export const BLOCKS: Record<string, BlockDef> = Object.fromEntries(defs.map((d) => [d.type, d]));

export function def(type: string): BlockDef {
  const d = BLOCKS[type];
  if (!d) throw new Error(`unknown block type: ${type}`);
  return d;
}

export function slotDef(type: string, slot: string): SlotDef | undefined {
  return BLOCKS[type]?.slots.find((x) => x.name === slot);
}

export function fieldDef(type: string, field: string): FieldDef | undefined {
  return BLOCKS[type]?.fields.find((x) => x.name === field);
}

/** Robot API visible to player code (and to typed expressions). */
export const ROBOT_FUNCS = ['moveForward', 'turnLeft', 'turnRight', 'collectGem', 'isWallAhead', 'isGemHere', 'isAtGoal'];
