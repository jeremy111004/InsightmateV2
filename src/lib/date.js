// src/lib/date.js

/** @typedef {"local"|"utc"} TZMode */

/** Pad 2 digits */
const pad2 = (n) => String(n).padStart(2, "0");

/**
 * Convertit n'importe quelle date (Date | string | number) en "YYYY-MM-DD".
 * Par défaut on travaille en **local** (plus logique pour business).
 * Utilise l'UTC si { tz: "utc" } pour éviter tout décalage lié au fuseau.
 * @param {Date|string|number} d
 * @param {{tz?: TZMode}} [opts]
 * @returns {string} YYYY-MM-DD
 */
export function toDateKey(d, { tz = "local" } = {}) {
  const dt = d instanceof Date ? new Date(d) : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  if (tz === "utc") {
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
  }
  // local
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/**
 * Parse une "YYYY-MM-DD" en Date à minuit local ou UTC selon opts.
 * @param {string} key
 * @param {{tz?: TZMode}} [opts]
 * @returns {Date}
 */
export function parseDateKey(key, { tz = "local" } = {}) {
  if (!key || typeof key !== "string") return new Date(NaN);
  const [y, m, d] = key.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return new Date(NaN);
  return tz === "utc"
    ? new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
    : new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Ajoute N jours à une date "YYYY-MM-DD" → "YYYY-MM-DD".
 * @param {string} dateKey
 * @param {number} days
 * @param {{tz?: TZMode}} [opts]
 */
export function dateAddDays(dateKey, days = 0, { tz = "local" } = {}) {
  const base = parseDateKey(dateKey, { tz });
  if (Number.isNaN(base.getTime())) return "";
  if (tz === "utc") {
    base.setUTCDate(base.getUTCDate() + days);
  } else {
    base.setDate(base.getDate() + days);
  }
  return toDateKey(base, { tz });
}

/**
 * Génère une plage de dates à partir d'un start "YYYY-MM-DD".
 * @param {string} start - YYYY-MM-DD
 * @param {number} n - nombre de jours
 * @param {{includeStart?: boolean, tz?: TZMode}} [opts]
 * @returns {string[]} tableau de YYYY-MM-DD
 */
export function rangeDays(start, n, { includeStart = true, tz = "local" } = {}) {
  const out = [];
  if (!n || n <= 0) return out;
  for (let i = 0; i < n; i++) {
    const offset = includeStart ? i : i + 1;
    out.push(dateAddDays(start, offset, { tz }));
  }
  return out;
}

/**
 * Différence en jours entre deux keys (b - a).
 * @param {string} a - YYYY-MM-DD
 * @param {string} b - YYYY-MM-DD
 * @param {{tz?: TZMode}} [opts]
 */
export function diffInDays(a, b, { tz = "local" } = {}) {
  const da = parseDateKey(a, { tz });
  const db = parseDateKey(b, { tz });
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return NaN;
  const ms = (tz === "utc" ? Date.UTC(db.getUTCFullYear(), db.getUTCMonth(), db.getUTCDate())
                           : new Date(db.getFullYear(), db.getMonth(), db.getDate()).getTime())
           - (tz === "utc" ? Date.UTC(da.getUTCFullYear(), da.getUTCMonth(), da.getUTCDate())
                           : new Date(da.getFullYear(), da.getMonth(), da.getDate()).getTime());
  return Math.round(ms / 86400000);
}

/** "YYYY-MM" (utile pour des groupements mensuels) */
export function toMonthKey(d, { tz = "local" } = {}) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  if (tz === "utc") {
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}`;
  }
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}`;
}

/** Date du jour en key */
export function todayKey({ tz = "local" } = {}) {
  return toDateKey(new Date(), { tz });
}

/** Début de journée comme Date (local/utc) */
export function startOfDay(d = new Date(), { tz = "local" } = {}) {
  const dt = d instanceof Date ? new Date(d) : new Date(d);
  if (tz === "utc") return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

/** Fin de journée comme Date (local/utc) */
export function endOfDay(d = new Date(), { tz = "local" } = {}) {
  const s = startOfDay(d, { tz });
  return new Date(s.getTime() + 86400000 - 1); // -1 ms
}

/** Vérifie si l'entrée date est valide pour nos helpers */
export function isValidDateInput(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return !Number.isNaN(dt.getTime());
}

export default {
  toDateKey,
  parseDateKey,
  dateAddDays,
  rangeDays,
  diffInDays,
  toMonthKey,
  todayKey,
  startOfDay,
  endOfDay,
  isValidDateInput,
};
