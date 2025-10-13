// src/lib/math.js

/** Convertit en nombre (tolérant) */
function toNum(v, def = 0) {
  if (v == null || v === "") return def;
  const n = typeof v === "number" ? v : Number(String(v).replace?.(",", "."));
  return Number.isFinite(n) ? n : def;
}

/** Somme d'un tableau simple ou d'objets via 'key' ou 'selector' */
export function sum(arr = [], key, selector) {
  if (!Array.isArray(arr) || !arr.length) return 0;
  if (typeof selector === "function") {
    return arr.reduce((s, x) => s + toNum(selector(x), 0), 0);
  }
  if (key != null) {
    return arr.reduce((s, x) => s + toNum(x?.[key], 0), 0);
  }
  return arr.reduce((s, x) => s + toNum(x, 0), 0);
}

/** Moyenne */
export function avg(arr = [], key, selector) {
  const n = Array.isArray(arr) ? arr.length : 0;
  if (!n) return 0;
  return sum(arr, key, selector) / n;
}

/** Médiane */
export function median(arr = [], key, selector) {
  if (!Array.isArray(arr) || !arr.length) return 0;
  const vals =
    typeof selector === "function"
      ? arr.map((x) => toNum(selector(x), 0))
      : key != null
      ? arr.map((x) => toNum(x?.[key], 0))
      : arr.map((x) => toNum(x, 0));
  vals.sort((a, b) => a - b);
  const m = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[m] : (vals[m - 1] + vals[m]) / 2;
}

/** Écart-type (population=false => échantillon) */
export function stddev(arr = [], { sample = false } = {}) {
  if (!Array.isArray(arr) || arr.length < 2) return 0;
  const vals = arr.map((x) => toNum(x, 0));
  const mean = avg(vals);
  const denom = vals.length - (sample ? 1 : 0);
  if (denom <= 0) return 0;
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / denom;
  return Math.sqrt(variance);
}

/** Pourcentage de variation (a vs b) */
export function pct(a, b) {
  const A = toNum(a, 0);
  const B = toNum(b, 0);
  if (!Number.isFinite(B) || B === 0) return 0;
  return ((A - B) / B) * 100;
}

/** Division sûre */
export function safeDiv(a, b, def = 0) {
  const A = toNum(a, 0);
  const B = toNum(b, 0);
  if (!Number.isFinite(B) || B === 0) return def;
  return A / B;
}

/** Croissance simple: (dernier - premier) / |premier| */
export function growth(series = []) {
  if (!Array.isArray(series) || series.length < 2) return 0;
  const first = toNum(series[0], 0);
  const last = toNum(series[series.length - 1], 0);
  if (first === 0) return 0;
  return (last - first) / Math.abs(first);
}

/** Clamp */
export function clamp(x, min, max) {
  const v = toNum(x, 0);
  if (Number.isFinite(min) && v < min) return min;
  if (Number.isFinite(max) && v > max) return max;
  return v;
}

/** Moyenne mobile simple (fenêtre w) sur un tableau de nombres */
export function sma(values = [], w = 7) {
  const n = Array.isArray(values) ? values.length : 0;
  if (!n || w <= 1) return values.map((v) => toNum(v, 0));
  const out = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += toNum(values[i], 0);
    if (i >= w) acc -= toNum(values[i - w], 0);
    out.push(i >= w - 1 ? acc / w : toNum(values[i], 0));
  }
  return out;
}

/** Moyenne mobile exponentielle */
export function ema(values = [], alpha = 0.3) {
  const n = Array.isArray(values) ? values.length : 0;
  if (!n) return [];
  let level = toNum(values[0], 0);
  const out = [level];
  for (let i = 1; i < n; i++) {
    const y = toNum(values[i], 0);
    level = alpha * y + (1 - alpha) * level;
    out.push(level);
  }
  return out;
}

/** Somme roulante (fenêtre w) */
export function rollingSum(values = [], w = 7) {
  const n = Array.isArray(values) ? values.length : 0;
  if (!n || w <= 1) return values.map((v) => toNum(v, 0));
  const out = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += toNum(values[i], 0);
    if (i >= w) acc -= toNum(values[i - w], 0);
    out.push(i >= w - 1 ? acc : toNum(values[i], 0));
  }
  return out;
}

/**
 * Pente de régression linéaire sur une série [{value}] (x = 1..n).
 * Renvoie 0 si série trop courte.
 */
export function linRegSlope(series = []) {
  const n = Array.isArray(series) ? series.length : 0;
  if (n < 2) return 0;

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;

  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const y = toNum(series[i]?.value, 0);
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denom = n * sumXX - sumX * sumX || 1;
  return (n * sumXY - sumX * sumY) / denom;
}

export default {
  sum,
  avg,
  median,
  stddev,
  pct,
  safeDiv,
  growth,
  clamp,
  sma,
  ema,
  rollingSum,
  linRegSlope,
};
