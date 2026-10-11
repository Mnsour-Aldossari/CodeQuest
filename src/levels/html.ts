/** World 1 — HTML Village (levels 1–5). Bit's village lost its structure. */
import type { Level } from '../engine/types';
import { P, el, img, li, link, list, page, txt } from './build';

const BOSS_START = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <title>بيت بِت</title>
</head>
<body>
  <h7>بيت بِت</h7>
  <p>هذا بيتي الأول</p>
  <ul>
    <li>ليلى</li>
    <li>عمر</li>
  </ul>
  <a href="javascript:alert('hi')">موقعي المفضّل</a>
</body>
</html>
`;

const BOSS_SOLUTION = BOSS_START.replace('<h7>بيت بِت</h7>', '<h1>بيت بِت</h1>')
  .replace('<li>عمر</li>', '<li>عمر</li>\n    <li>بِت</li>')
  .replace(`javascript:alert('hi')`, 'https://developer.mozilla.org');

export const HTML_LEVELS: Level[] = [
  {
    id: 'html-1', world: 'html', num: 1, mode: 'build', output: 'web', tour: true,
    title: { ar: 'أول وسم', en: 'First tag' },
    story: {
      ar: 'البيت الأول في القرية نسي اسمه! ضع عنواناً كبيراً `<h1>` يقول «مرحبا يا بِت».',
      en: 'The first house in the village forgot its name! Add a big heading `<h1>` that says “مرحبا يا بِت”.',
    },
    concept: {
      tag: '<h1>',
      title: { ar: 'العنوان الكبير', en: 'The big heading' },
      one: { ar: '`<h1>` هو أكبر عنوان في الصفحة — يخبر الجميع: هذا موضوعي.', en: '`<h1>` is the biggest heading on a page — it tells everyone what the page is about.' },
      real: { ar: 'اسم كل مقال في ويكيبيديا هو `<h1>` واحد.', en: 'Every Wikipedia article’s name is a single `<h1>`.' },
    },
    hints: [
      { ar: 'اسحب كتلة `<h1>` إلى داخل `<body>`، ثم ضع النص «مرحبا يا بِت» في الفراغ اللي داخلها.', en: 'Drag the `<h1>` block into `<body>`, then drop the text “مرحبا يا بِت” into its empty slot.' },
    ],
    page: { url: 'bit.village/house-1.html' },
    initial: page('بيتي', []),
    palette: [P.el('h1'), P.el('p'), P.text('مرحبا يا بِت'), P.text('أهلاً')],
    checks: [
      { type: 'dom', selector: 'h1', count: 1, label: { ar: 'ضع عنواناً كبيراً `<h1>`', en: 'Add a big heading `<h1>`' } },
      { type: 'dom', selector: 'h1', text: 'مرحبا يا بِت', label: { ar: 'اكتب داخله «مرحبا يا بِت»', en: 'Make it say “مرحبا يا بِت”' } },
    ],
    solution: page('بيتي', [el('h1', 'مرحبا يا بِت')]),
    optimalBlocks: 2,
  },
  {
    id: 'html-2', world: 'html', num: 2, mode: 'build', output: 'web',
    title: { ar: 'لافتة البيت', en: 'The house sign' },
    story: {
      ar: 'البيت الثاني فقد لافتته! ضع عنواناً كبيراً يقول «مرحبا يا بِت»، وتحته فقرة، ثم صورة البيت.',
      en: 'The second house lost its sign! Add a big heading that says “مرحبا يا بِت”, a paragraph under it, then the house picture.',
    },
    concept: {
      tag: '<p> <img>',
      title: { ar: 'الفقرة والصورة', en: 'Paragraphs and images' },
      one: { ar: '`<p>` فقرة نص عادية، و`<img>` يعرض صورة — ووصفها في `alt` لمن ما يقدر يشوفها.', en: '`<p>` is a plain paragraph, and `<img>` shows a picture — with a description in `alt` for people who can’t see it.' },
      real: { ar: 'كل منتج في المتجر له صورة `<img>` ووصف `<p>` تحتها.', en: 'Every product in an online shop has an `<img>` and a `<p>` description.' },
    },
    hints: [
      { ar: 'العنوان `<h1>` أولاً، ثم `<p>` تحته، ثم `<img>`. انتبه: `<h7>` مو وسم حقيقي!', en: '`<h1>` first, then `<p>` under it, then `<img>`. Careful: `<h7>` isn’t a real tag!' },
    ],
    page: { url: 'bit.village/house-2.html' },
    initial: page('بيتي', []),
    palette: [P.el('h1'), P.el('p'), P.el('h7'), P.img('house.svg', 'بيتي'), P.text('مرحبا يا بِت'), P.text('هذا بيتي الأول'), P.text('ادخل')],
    checks: [
      { type: 'dom', selector: 'h1', text: 'مرحبا يا بِت', label: { ar: 'عنوان `<h1>` يقول «مرحبا يا بِت»', en: 'An `<h1>` that says “مرحبا يا بِت”' } },
      { type: 'dom', selector: 'h1 ~ p', nonEmpty: true, label: { ar: 'فقرة `<p>` فيها نص تحت العنوان', en: 'A `<p>` with text below the heading' } },
      { type: 'dom', selector: 'img[alt]:not([alt=""])', label: { ar: 'صورة البيت `<img>` مع وصف في `alt`', en: 'The house `<img>` with an `alt` description' } },
    ],
    solution: page('بيتي', [el('h1', 'مرحبا يا بِت'), el('p', 'هذا بيتي الأول'), img('house.svg', 'بيتي')]),
    optimalBlocks: 5,
  },
  {
    id: 'html-3', world: 'html', num: 3, mode: 'parsons', output: 'web',
    title: { ar: 'قائمة أصدقائي', en: 'My friends list' },
    story: {
      ar: 'الريح خربطت قائمة أصدقاء بِت! رتّب الكتل: العنوان أولاً، ثم القائمة — ليلى، ثم عمر، ثم بِت.',
      en: 'The wind scrambled Bit’s friends list! Put the blocks in order: the heading first, then the list — Laila, then Omar, then Bit.',
    },
    concept: {
      tag: '<ul> <li>',
      title: { ar: 'القائمة', en: 'Lists' },
      one: { ar: '`<ul>` قائمة نقاط، وكل عنصر فيها يسكن داخل `<li>` — والترتيب في الكود هو الترتيب في الصفحة.', en: '`<ul>` is a bullet list, each item lives in an `<li>` — and the order in the code is the order on the page.' },
      real: { ar: 'قائمة السلة في أي متجر إلكتروني.', en: 'The shopping cart in any online store.' },
    },
    hints: [
      { ar: 'اسحب `<h2>` لفوق القائمة، ثم رتّب عناصر `<li>` داخل `<ul>`: ليلى، عمر، بِت.', en: 'Drag `<h2>` above the list, then order the `<li>` items inside `<ul>`: Laila, Omar, Bit.' },
    ],
    page: { url: 'bit.village/friends.html' },
    initial: page('أصدقائي', [list('ul', [li('بِت'), li('ليلى'), li('عمر')]), el('h2', 'أصدقائي')]),
    palette: [],
    checks: [
      { type: 'dom', selector: 'body > h2:first-child', text: 'أصدقائي', label: { ar: 'العنوان `<h2>` في أول الصفحة', en: 'The `<h2>` heading at the top' } },
      { type: 'dom', selector: 'ul > li:nth-child(1)', text: 'ليلى', label: { ar: 'أول صديق: ليلى', en: 'First friend: ليلى' } },
      { type: 'dom', selector: 'ul > li:nth-child(2)', text: 'عمر', label: { ar: 'ثاني صديق: عمر', en: 'Second: عمر' } },
      { type: 'dom', selector: 'ul > li:nth-child(3)', text: 'بِت', label: { ar: 'ثالث صديق: بِت', en: 'Third: بِت' } },
    ],
    solution: page('أصدقائي', [el('h2', 'أصدقائي'), list('ul', [li('ليلى'), li('عمر'), li('بِت')])]),
    optimalBlocks: 9,
  },
  {
    id: 'html-4', world: 'html', num: 4, mode: 'fill', output: 'web',
    title: { ar: 'الرابط السحري', en: 'The magic link' },
    story: {
      ar: 'باب البيت الرابع يفتح برابط! عبّي الفراغات: رابط آمن يبدأ بـ `https://`، ونص للرابط، وكلمة على الزر.',
      en: 'The fourth house opens with a link! Fill the blanks: a safe link that starts with `https://`, the link’s words, and a word on the button.',
    },
    concept: {
      tag: '<a href>',
      title: { ar: 'الرابط', en: 'Links' },
      one: { ar: '`<a href="…">` يأخذك لمكان ثاني. الصفة `href` فيها العنوان، والآمن يبدأ بـ `https://`.', en: '`<a href="…">` takes you somewhere else. The `href` attribute holds the address — safe ones start with `https://`.' },
      real: { ar: 'كل نتيجة في محرك البحث هي رابط `<a>`.', en: 'Every search result is an `<a>` link.' },
    },
    hints: [
      { ar: 'اضغط داخل الفراغ الأبيض واكتب: `https://developer.mozilla.org` — ثم اكتب نص الرابط وكلمة الزر.', en: 'Tap the white blank and type `https://developer.mozilla.org` — then type the link’s words and the button’s word.' },
    ],
    page: { url: 'bit.village/door.html' },
    initial: page('الباب', [
      el('p', 'زر موقع بِت المفضّل:'),
      link('', txt('', false)),
      el('button', txt('', false)),
    ]),
    palette: [],
    checks: [
      { type: 'dom', selector: 'a', attr: { name: 'href', startsWith: 'https://' }, label: { ar: 'رابط يبدأ بـ `https://`', en: 'A link that starts with `https://`' } },
      { type: 'dom', selector: 'a', nonEmpty: true, label: { ar: 'نص للرابط يضغط عليه الزائر', en: 'Words on the link to click' } },
      { type: 'dom', selector: 'button', nonEmpty: true, label: { ar: 'كلمة على الزر `<button>`', en: 'A word on the `<button>`' } },
    ],
    solution: page('الباب', [
      el('p', 'زر موقع بِت المفضّل:'),
      link('https://developer.mozilla.org', txt('موقع MDN', false)),
      el('button', txt('ادخل', false)),
    ]),
    optimalBlocks: 6,
  },
  {
    id: 'html-5', world: 'html', num: 5, mode: 'code', output: 'web', boss: true,
    title: { ar: 'الزعيم: الصفحة المكسورة', en: 'Boss: The broken page' },
    story: {
      ar: 'ساحر الفوضى كسر صفحة بيت بِت! هذي المرة تكتب الكود بيدك: صلّح الوسم الغلط، كمّل القائمة، وخلّ الرابط آمن.',
      en: 'The Chaos Wizard broke Bit’s home page! This time you type the code yourself: fix the wrong tag, finish the list, and make the link safe.',
    },
    concept: {
      tag: 'HTML',
      title: { ar: 'تكتب HTML بنفسك', en: 'Writing HTML yourself' },
      one: { ar: 'كل وسم يُفتح `<p>` ويُقفل `</p>` — والكتل اللي ركّبتها كانت هذا الكود بالضبط.', en: 'Every tag opens `<p>` and closes `</p>` — the blocks you snapped together were exactly this code.' },
      real: { ar: 'المبرمجون يكتبون صفحات الويب بهذي الطريقة كل يوم.', en: 'Web developers write pages exactly like this every day.' },
    },
    hints: [
      { ar: 'ابدأ بالسطر اللي فيه `<h7>` — العناوين من `<h1>` إلى `<h6>`. لا تنسَ تغيّر الوسم اللي يقفله أيضاً.', en: 'Start with the `<h7>` line — headings go from `<h1>` to `<h6>`. Change the closing tag too.' },
      { ar: 'أضف سطر `<li>بِت</li>` داخل `<ul>`، وغيّر الرابط إلى `https://developer.mozilla.org`.', en: 'Add `<li>بِت</li>` inside `<ul>`, and change the link to `https://developer.mozilla.org`.' },
    ],
    page: { url: 'bit.village/home.html' },
    initialCode: BOSS_START,
    solutionCode: BOSS_SOLUTION,
    palette: [],
    checks: [
      { type: 'known-tags', label: { ar: 'صلّح الوسم المكسور (العناوين من `<h1>` إلى `<h6>`)', en: 'Fix the broken tag (headings are `<h1>`–`<h6>`)' } },
      { type: 'dom', selector: 'h1', text: 'بيت بِت', label: { ar: 'عنوان `<h1>` يقول «بيت بِت»', en: 'An `<h1>` that says “بيت بِت”' } },
      { type: 'dom', selector: 'ul > li', count: 3, label: { ar: 'القائمة فيها 3 أصدقاء — أضف «بِت»', en: 'The list has 3 friends — add “بِت”' } },
      { type: 'dom', selector: 'a', attr: { name: 'href', startsWith: 'https://' }, label: { ar: 'الرابط آمن ويبدأ بـ `https://`', en: 'The link is safe and starts with `https://`' } },
    ],
  },
];
