import { SystemState } from './state.js';
import { CONFIG, TELETYPE_CPS, TELETYPE_MAX_MS } from './config.js';
import { FS } from './filesystem.js';

export const outputEl = document.getElementById('output');
export const promptEl = document.getElementById('prompt');
export const inputEl  = document.getElementById('cmd-input');
export const panelEl  = document.getElementById('panel');

// ── Teletype queue ────────────────────────────────────────────────────────
// addLine is the one chokepoint every line of output passes through, and no
// caller uses its return value, so the reveal lives here and no call site
// changes. Lines emitted during a single synchronous command all land before
// the first animation frame, which makes them one batch: the reveal runs
// continuously across the whole response instead of stuttering line to line.
const queue   = [];      // [{ span, text, from }]
let   rafId   = null;
let   started = 0;       // timestamp the current batch began revealing
let   budget  = 0;       // effective characters/second for this batch
let   revealed = 0;      // characters revealed so far this batch
let   pinned  = true;    // was the reader at the bottom when this batch began?
let   idleWaiters = [];

function reducedMotion() {
  return typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// 0 means reveal instantly — the original behaviour, and what a reader who has
// asked for reduced motion gets regardless of configuration.
function revealRate() {
  return (!TELETYPE_CPS || reducedMotion()) ? 0 : TELETYPE_CPS;
}

function settleIdle() {
  const waiting = idleWaiters;
  idleWaiters = [];
  for (const resolve of waiting) resolve();
}

function endBatch() { started = 0; revealed = 0; settleIdle(); }

function frame(now) {
  rafId = null;
  if (!queue.length) { endBatch(); return; }
  if (!started) {
    started  = now;
    revealed = 0;
    // The cap is a deadline, not a truncation: a long batch speeds up to meet
    // it rather than revealing at the floor rate and then snapping.
    const total = queue.reduce((n, q) => n + (q.text.length - q.from), 0);
    const secs  = TELETYPE_MAX_MS / 1000;
    budget = Math.max(revealRate(), secs > 0 ? Math.ceil(total / secs) : 0);
  }
  let due = Math.ceil(((now - started) / 1000) * budget) - revealed;
  while (due > 0 && queue.length) {
    const head = queue[0];
    const take = Math.min(due, head.text.length - head.from);
    head.span.textContent = head.text.slice(0, head.from + take);
    head.from += take;
    revealed  += take;
    due       -= take;
    if (head.from >= head.text.length) queue.shift();
  }
  if (pinned) outputEl.scrollTop = outputEl.scrollHeight;
  if (queue.length) rafId = requestAnimationFrame(frame);
  else endBatch();
}

// Reveal everything still pending, right now.
export function drainOutput() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  for (const q of queue) q.span.textContent = q.text;
  queue.length = 0;
  if (pinned) outputEl.scrollTop = outputEl.scrollHeight;
  endBatch();
}

// Drop what's pending without revealing it — for when the output it belongs to
// is about to be wiped.
function cancelQueue() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  queue.length = 0;
  endBatch();
}

// Resolves once nothing is left to reveal. Test hook: lets a driver await the
// real completion signal instead of guessing at a timeout.
export function outputIdle() {
  return queue.length ? new Promise(r => idleWaiters.push(r)) : Promise.resolve();
}

// ── Helpers ───────────────────────────────────────────────────────────────
export function addLine(text = '', cls = '') {
  const span = document.createElement('span');
  span.className = 'line' + (cls ? ' ' + cls : '');
  if (!revealRate()) {
    span.textContent = text;
    outputEl.appendChild(span);
    outputEl.scrollTop = outputEl.scrollHeight;
    return span;
  }
  // Note whether the reader is at the bottom *before* appending, so a reveal
  // never yanks someone who has scrolled up to re-read something.
  if (!queue.length)
    pinned = outputEl.scrollHeight - outputEl.scrollTop - outputEl.clientHeight <= 24;
  span.textContent = '';
  outputEl.appendChild(span);
  queue.push({ span, text: String(text), from: 0 });
  if (!rafId) rafId = requestAnimationFrame(frame);
  return span;
}

export function clearOutput() { cancelQueue(); outputEl.innerHTML = ''; }

// Any keypress dumps the rest of the batch. Deliberately never calls
// preventDefault — the keystroke still has to reach the input, including the
// floppy password field. Modifier-only presses and shortcuts are ignored, so
// copying text mid-reveal doesn't count as impatience.
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (!queue.length) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (['Shift', 'Control', 'Meta', 'Alt', 'CapsLock', 'Tab', 'Escape'].includes(e.key)) return;
    drainOutput();
  }, true);
}

// A hidden tab stops firing animation frames, which would strand text
// mid-reveal until the reader came back. Nobody is watching it happen, so
// there's nothing to reveal — just finish.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && queue.length) drainOutput();
  });
}

if (typeof window !== 'undefined') {
  window.__tt = {
    idle:    outputIdle,
    drain:   drainOutput,
    pending: () => queue.reduce((n, q) => n + (q.text.length - q.from), 0),
  };
}

export function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// ── Crypto helpers ────────────────────────────────────────────────────────
export async function deriveKey(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

export async function decryptLetter(password, b64) {
  const blob = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const salt  = blob.slice(0, 16);
  const iv    = blob.slice(16, 28);
  const ct    = blob.slice(28);
  const key   = await deriveKey(password, salt);
  const pt    = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}

// ── Path helpers ───────────────────────────────────────────────────────────
export function normPath(p) {
  const parts = p.split('/').filter(Boolean);
  const out = [];
  for (const seg of parts) {
    if (seg === '..') { if (out.length) out.pop(); }
    else if (seg !== '.') out.push(seg);
  }
  return '/' + out.join('/');
}

// Expand ~ at start of path, then resolve relative to SystemState.cwd
export function resolvePath(arg) {
  if (!arg || arg === '.') return SystemState.cwd;
  if (arg === '~')         return CONFIG.HOME;
  if (arg.startsWith('~/')) return normPath(CONFIG.HOME + '/' + arg.slice(2));
  if (arg.startsWith('/'))  return normPath(arg);
  return normPath(SystemState.cwd + '/' + arg);
}

// Direct children of dirPath (one level only)
export function children(dirPath, showHidden = false) {
  const prefix = dirPath === '/' ? '/' : dirPath + '/';
  return Object.keys(FS)
    .filter(k => {
      if (k === dirPath) return false;
      if (!k.startsWith(prefix)) return false;
      const rest = k.slice(prefix.length);
      if (rest.includes('/')) return false;
      if (!showHidden && FS[k].hidden) return false;
      return true;
    })
    .sort();  // alphabetical, like real ls
}