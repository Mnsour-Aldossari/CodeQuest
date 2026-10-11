/** DOM → plain snapshot the checker can read. Runs inside the sandbox (and in jsdom for tests). */
export interface ProbeSet {
  selectors: string[];
  props: string[];
  norms: string[];
}

export function snapshot(pr: ProbeSet, doc: Document = document) {
  const view = doc.defaultView ?? window;
  const norm: Record<string, string> = {};
  for (const pv of pr.norms) {
    const i = pv.indexOf(':');
    const t = doc.createElement('div');
    t.style.setProperty(pv.slice(0, i), pv.slice(i + 1));
    doc.body.appendChild(t);
    norm[pv] = view.getComputedStyle(t).getPropertyValue(pv.slice(0, i));
    t.remove();
  }
  const all: Element[] = [doc.body, ...Array.from(doc.body.querySelectorAll('*'))].slice(0, 1500);
  const index = new Map<Element, number>(all.map((el, i) => [el, i]));
  const els = all.map((el) => {
    const cs = view.getComputedStyle(el);
    const attrs: Record<string, string> = {};
    for (const a of Array.from(el.attributes).slice(0, 20)) attrs[a.name.slice(0, 40)] = a.value.slice(0, 500);
    const style: Record<string, string> = {};
    for (const prop of pr.props) style[prop] = cs.getPropertyValue(prop).slice(0, 200);
    return {
      tag: el.tagName.toLowerCase().slice(0, 40),
      parent: el.parentElement ? index.get(el.parentElement) ?? -1 : -1,
      text: (el.textContent ?? '').trim().slice(0, 2000),
      attrs,
      style,
    };
  });
  const q: Record<string, number[]> = {};
  for (const s of pr.selectors) {
    try {
      q[s] = Array.from(doc.querySelectorAll(s)).map((el) => index.get(el)).filter((i): i is number => i !== undefined);
    } catch {
      q[s] = [];
    }
  }
  return { title: doc.title.slice(0, 300), els, q, norm };
}
