/** Tiny synthesized sounds (no audio files). Muted state lives in progress settings. */
import { useProgress } from '../state/progress';

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (!useProgress.getState().settings.sound) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, at: number, dur: number, type: OscillatorType = 'sine', vol = 0.12) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  pick: () => tone(520, 0, 0.08, 'triangle', 0.08),
  snap: () => {
    tone(880, 0, 0.06, 'square', 0.05);
    tone(1320, 0.04, 0.09, 'triangle', 0.07);
  },
  remove: () => tone(300, 0, 0.12, 'triangle', 0.07),
  bad: () => {
    tone(220, 0, 0.12, 'sawtooth', 0.05);
    tone(180, 0.08, 0.14, 'sawtooth', 0.05);
  },
  goal: (i: number) => tone(660 + i * 120, 0, 0.14, 'triangle', 0.09),
  error: () => {
    tone(330, 0, 0.18, 'square', 0.05);
    tone(247, 0.15, 0.25, 'square', 0.05);
  },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle', 0.1)),
  star: (i: number) => tone(784 + i * 196, 0, 0.18, 'sine', 0.1),
};
