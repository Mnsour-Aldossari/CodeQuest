import { Fragment } from 'react';
import { useLang } from '../state/progress';
import type { Lang, Loc } from '../engine/types';
import { S, type StrKey } from './strings';

export function useT() {
  const lang = useLang();
  return {
    lang,
    ar: lang === 'ar',
    dir: (lang === 'ar' ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
    t: (k: StrKey) => S[k][lang],
    tl: (l: Loc | undefined) => (l ? l[lang] : ''),
  };
}

export const pick = (l: Loc, lang: Lang) => l[lang];

/** Text where `backticks` mark code — rendered as isolated LTR code chips. Never HTML. */
export function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('`').map((part, i) =>
        i % 2 ? (
          <code key={i} className="kc">
            {part}
          </code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
