import { SystemState } from './state.js';
import { CONFIG } from './config.js';
import { FS } from './filesystem.js';

export const outputEl = document.getElementById('output');
export const promptEl = document.getElementById('prompt');
export const inputEl  = document.getElementById('cmd-input');
export const panelEl  = document.getElementById('panel');

// ── Helpers ───────────────────────────────────────────────────────────────
export function addLine(text = '', cls = '') {
  const span = document.createElement('span');
  span.className = 'line' + (cls ? ' ' + cls : '');
  span.textContent = text;
  outputEl.appendChild(span);
  outputEl.scrollTop = outputEl.scrollHeight;
  return span;
}

export function clearOutput() { outputEl.innerHTML = ''; }

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