/** Test-only: run a composed Worker script in a Node worker thread (same isolation semantics: separate thread, hard terminate). */
import { Worker } from 'node:worker_threads';
import type { Spawn, WorkerLike } from './workerRunner';

export const nodeSpawn: Spawn = (script) => {
  const shim = `const { parentPort } = require('node:worker_threads'); globalThis.self = globalThis; globalThis.postMessage = (m) => parentPort.postMessage(m);\n`;
  const w = new Worker(shim + script, { eval: true });
  const like: WorkerLike = {
    onmessage: null,
    onerror: null,
    terminate: () => void w.terminate(),
  };
  w.on('message', (data) => like.onmessage?.({ data }));
  w.on('error', (e) => like.onerror?.({ message: e.message }));
  return like;
};
