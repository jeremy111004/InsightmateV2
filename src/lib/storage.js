// src/lib/storage.js

// ------------------------
// Safe localStorage access
// ------------------------
const MEMORY_FALLBACK = new Map();

function hasDOM() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function _getItem(key) {
  if (!hasDOM()) return MEMORY_FALLBACK.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Safari private / QuotaExceeded → fallback mémoire
    return MEMORY_FALLBACK.get(key) ?? null;
  }
}

function _setItem(key, val) {
  if (!hasDOM()) {
    MEMORY_FALLBACK.set(key, val);
    return;
  }
  try {
    window.localStorage.setItem(key, val);
  } catch {
    // si quota ou interdit, bascule en mémoire
    MEMORY_FALLBACK.set(key, val);
  }
}

function _removeItem(key) {
  if (!hasDOM()) {
    MEMORY_FALLBACK.delete(key);
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    MEMORY_FALLBACK.delete(key);
  }
}

function _emit(key) {
  if (!hasDOM()) return;
  try {
    window.dispatchEvent(new CustomEvent("im:storage", { detail: { key, at: Date.now() } }));
  } catch {}
}

// ------------------------
// JSON helpers (compat)
// ------------------------
/**
 * Sauvegarde JSON (safe)
 * @param {string} key
 * @param {any} val
 */
export function saveJSON(key, val) {
  try {
    const str = JSON.stringify(val);
    _setItem(key, str);
    _emit(key);
  } catch {
    // ignore
  }
}

/**
 * Charge JSON (safe). Retourne `fb` si absent/illisible.
 * @param {string} key
 * @param {any} fb fallback
 */
export function loadJSON(key, fb = null) {
  try {
    const raw = _getItem(key);
    if (raw == null) return fb;
    return JSON.parse(raw);
  } catch {
    return fb;
  }
}

/**
 * Comme loadJSON, mais lève une erreur si JSON invalide (utile pour debug)
 */
export function loadJSONStrict(key) {
  const raw = _getItem(key);
  if (raw == null) return null;
  return JSON.parse(raw);
}

/**
 * Supprime une clé.
 */
export function removeJSON(key) {
  _removeItem(key);
  _emit(key);
}

/**
 * Met à jour transactionnellement un objet JSON.
 * @param {string} key
 * @param {(prev:any)=>any} updater
 * @param {any} fb fallback si absent
 */
export function updateJSON(key, updater, fb = null) {
  if (typeof updater !== "function") return;
  const prev = loadJSON(key, fb);
  const next = updater(prev);
  if (next !== undefined) saveJSON(key, next);
}

/**
 * Retourne les clés disponibles (localStorage ou fallback mémoire).
 * @param {string} [prefix] filtre par préfixe
 */
export function listKeys(prefix) {
  const out = [];
  if (hasDOM()) {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && (!prefix || k.startsWith(prefix))) out.push(k);
      }
    } catch {
      // ignore et tombe sur fallback
    }
  }
  for (const k of MEMORY_FALLBACK.keys()) {
    if (!prefix || k.startsWith(prefix)) out.push(k);
  }
  return Array.from(new Set(out)).sort();
}

/**
 * Namespacing pratique: crée un mini client {get,set,remove,update}
 */
export function createNamespace(ns) {
  const prefix = String(ns || "").trim();
  const mk = (k) => (prefix ? `${prefix}:${k}` : k);

  return {
    get: (k, fb = null) => loadJSON(mk(k), fb),
    set: (k, v) => saveJSON(mk(k), v),
    remove: (k) => removeJSON(mk(k)),
    update: (k, fn, fb) => updateJSON(mk(k), fn, fb),
    keys: () => listKeys(prefix + ":"),
  };
}

export default {
  saveJSON,
  loadJSON,
  loadJSONStrict,
  removeJSON,
  updateJSON,
  listKeys,
  createNamespace,
};
