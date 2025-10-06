// src/lib/datastore.js
export const DATASTORE_KEY = "insightmate.datastore.v1";
export const EVT_DATASTORE = "im:datastore";

// ---------- Safe storage ----------
function hasDOM() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}
function _loadJSON(key, fallback) {
  if (!hasDOM()) return fallback ?? null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : (fallback ?? null);
  } catch {
    return fallback ?? null;
  }
}
function _saveJSON(key, value) {
  if (!hasDOM()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function _emit(detail) {
  if (!hasDOM()) return;
  try {
    window.dispatchEvent(new CustomEvent(EVT_DATASTORE, { detail }));
  } catch {}
}

// ---------- Core API (compat) ----------
export function getDatastore() {
  // Structure attendue:
  // {
  //   __active: "bucketId" | undefined,
  //   __demo: true | undefined,
  //   [bucketId]: { sales: [], payments: [], banking: [], invoices: [] },
  //   // ou directement: { sales: [], ... } (legacy sans bucket)
  // }
  return _loadJSON(DATASTORE_KEY, {}) || {};
}

export function setDatastore(ds) {
  if (!ds || typeof ds !== "object") return;
  _saveJSON(DATASTORE_KEY, ds);
  _emit({ at: Date.now(), kind: "set" });
}

/** Retourne l'id du bucket actif (ou null) */
export function getActiveBucket() {
  const ds = getDatastore();
  if (ds && typeof ds === "object") {
    if (ds.__active && ds[ds.__active]) return ds.__active;
    if (ds.__demo && ds["__demo"]) return "__demo";
  }
  return null;
}

/** Définit le bucket actif (créé si absent) */
export function setActiveBucket(bucketId) {
  const id = bucketId || "__default";
  updateDatastore((prev) => {
    const next = { ...(prev || {}) };
    next.__active = id;
    next[id] = next[id] || {};
    return next;
  });
}

/** Lecture d’un dataset (compat legacy et buckets) */
export function loadDataset(kind) {
  const ds = getDatastore() || {};
  const bucket = getActiveBucket();
  if (bucket && ds[bucket] && ds[bucket][kind]) return ds[bucket][kind];
  if (ds[kind]) return ds[kind]; // legacy sans bucket
  return [];
}

// ---------- Helpers étendus ----------
/** Transaction: patch fonctionnel -> persiste + émet event */
export function updateDatastore(patchFn) {
  if (typeof patchFn !== "function") return;
  const prev = getDatastore();
  const next = patchFn(prev);
  if (next && typeof next === "object" && next !== prev) {
    _saveJSON(DATASTORE_KEY, next);
    _emit({ at: Date.now(), kind: "update" });
  }
}

/** Écrit un dataset dans un bucket (par défaut: actif ou "__default") */
export function setDataset(kind, rows, { bucket } = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  updateDatastore((prev) => {
    const next = { ...(prev || {}) };
    const bid = bucket || getActiveBucket() || "__default";
    next[bid] = next[bid] || {};
    next[bid][kind] = safeRows;
    // Si pas d'actif, on le définit
    if (!next.__active) next.__active = bid;
    return next;
  });
}

/** Efface complètement le datastore (tous buckets) */
export function clearDatastore() {
  _saveJSON(DATASTORE_KEY, {});
  _emit({ at: Date.now(), kind: "clear" });
}

// ---------- Utils (optionnels) ----------
/** Supprime un dataset d’un bucket */
export function removeDataset(kind, { bucket } = {}) {
  updateDatastore((prev) => {
    const bid = bucket || getActiveBucket();
    if (!bid) return prev;
    const scope = prev?.[bid];
    if (!scope || !scope.hasOwnProperty(kind)) return prev;
    const next = { ...prev, [bid]: { ...scope } };
    delete next[bid][kind];
    return next;
  });
}

/** Liste des buckets existants */
export function listBuckets() {
  const ds = getDatastore();
  return Object.keys(ds || {}).filter((k) => !k.startsWith("__"));
}
