/** Motion tokens (motion/react). Only transform + opacity are animated, to stay at 60fps. */
import type { Transition } from 'motion/react';

export const spring = {
  snap: { type: 'spring', stiffness: 520, damping: 28, mass: 0.7 } satisfies Transition,
  soft: { type: 'spring', stiffness: 260, damping: 26 } satisfies Transition,
  bouncy: { type: 'spring', stiffness: 380, damping: 16 } satisfies Transition,
  layout: { type: 'spring', stiffness: 600, damping: 40 } satisfies Transition,
};

export const fade = { duration: 0.2, ease: [0.22, 1, 0.36, 1] } satisfies Transition;
