/**
 * CodeMirror 6 view of the real code. Player code is only ever shown as text here.
 * Read-only in block levels (with block↔line highlighting), editable in code levels.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { EditorState, StateEffect, StateField, type Range } from '@codemirror/state';
import { Decoration, EditorView, keymap, lineNumbers, highlightActiveLine, type DecorationSet } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';

/** Token colors from the design (tok-tag, tok-attr, tok-str …). */
const style = HighlightStyle.define([
  { tag: [tags.tagName, tags.angleBracket], color: '#B23A1C' },
  { tag: tags.attributeName, color: '#8A5A00' },
  { tag: [tags.string, tags.attributeValue], color: '#157A44' },
  { tag: [tags.keyword, tags.definitionKeyword, tags.controlKeyword], color: '#6A3FD6' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#0A6E92' },
  { tag: [tags.number, tags.bool], color: '#B5470E' },
  { tag: tags.comment, color: '#7B7290', fontStyle: 'italic' },
  { tag: [tags.punctuation, tags.bracket, tags.operator], color: '#5C5470' },
  { tag: tags.propertyName, color: '#8A5A00' },
  { tag: tags.documentMeta, color: '#5C5470' },
]);

export interface LineMarks {
  hl?: [number, number] | null;
  exec?: number | null;
  err?: number | null;
}

const setMarks = StateEffect.define<LineMarks>();

const marksField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setMarks)) continue;
      const doc = tr.state.doc;
      const r: Range<Decoration>[] = [];
      const add = (line: number, cls: string) => {
        if (line >= 1 && line <= doc.lines) r.push(Decoration.line({ class: cls }).range(doc.line(line).from));
      };
      const m = e.value;
      if (m.hl) for (let l = m.hl[0]; l <= m.hl[1]; l++) add(l, 'cq-hl');
      if (m.exec) add(m.exec, 'cq-exec');
      if (m.err) add(m.err, 'cq-err');
      r.sort((a, b) => a.from - b.from);
      deco = Decoration.set(r, true);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const theme = EditorView.theme({
  '&': { backgroundColor: '#FFFDF9', color: '#1F1A2E' },
  '.cm-gutters': { backgroundColor: '#FFFDF9', color: '#A99E8A', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '&.cm-editor.cm-focused .cm-activeLine': { backgroundColor: 'rgba(46,107,255,.06)' },
  '.cm-content': { padding: '10px 0', caretColor: '#2E6BFF' },
});

export function CodeView({
  code, lang, readOnly = true, marks, onChange, onHoverLine, label,
}: {
  code: string;
  lang: 'html' | 'js';
  readOnly?: boolean;
  marks?: LineMarks;
  onChange?: (s: string) => void;
  onHoverLine?: (line: number | null) => void;
  label: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const cb = useRef({ onChange, onHoverLine });
  useLayoutEffect(() => {
    cb.current = { onChange, onHoverLine };
  });

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: code,
        extensions: [
          lineNumbers(),
          history(),
          indentOnInput(),
          bracketMatching(),
          ...(readOnly ? [] : [highlightActiveLine()]),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          lang === 'html' ? html({ autoCloseTags: false }) : javascript(),
          syntaxHighlighting(style),
          marksField,
          theme,
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
          EditorView.contentAttributes.of({ 'aria-label': label, dir: 'ltr', spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) cb.current.onChange?.(u.state.doc.toString());
          }),
          EditorView.domEventHandlers({
            mousemove: (e, view) => {
              const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
              cb.current.onHoverLine?.(pos === null ? null : view.state.doc.lineAt(pos).number);
            },
            mouseleave: () => cb.current.onHoverLine?.(null),
          }),
        ],
      }),
    });
    view.current = v;
    return () => v.destroy();
    // the editor is created once per mount; content syncs below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, readOnly]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const cur = v.state.doc.toString();
    if (cur !== code) v.dispatch({ changes: { from: 0, to: cur.length, insert: code } });
  }, [code]);

  const marksKey = JSON.stringify(marks ?? {});
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const m = JSON.parse(marksKey) as LineMarks;
    v.dispatch({ effects: setMarks.of(m) });
    const target = m.err ?? m.exec ?? m.hl?.[0];
    if (target && target <= v.state.doc.lines) {
      v.dispatch({ effects: EditorView.scrollIntoView(v.state.doc.line(target).from, { y: 'nearest' }) });
    }
  }, [marksKey, code]);

  return <div ref={host} dir="ltr" style={{ height: '100%', overflow: 'hidden', textAlign: 'left' }} />;
}
