// src/lib/forecast.js

export function _isNum(x) {
  return typeof x === "number" && Number.isFinite(x);
}

export function ses(values, alpha = 0.3, h = 30) {
  const arr = Array.isArray(values) ? values : [];
  if (!arr.length) return { forecast: Array(h).fill(0), fitted: [] };

  let level = Number(arr[0]) || 0;
  const fitted = [];

  for (let t = 0; t < arr.length; t++) {
    const y = Number(arr[t]) || 0;
    fitted.push(level);
    level = alpha * y + (1 - alpha) * level;
  }
  return { forecast: Array(h).fill(level), fitted };
}

export function holt(values, alpha = 0.3, beta = 0.2, h = 30) {
  const arr = Array.isArray(values) ? values : [];
  if (!arr.length) return { forecast: Array(h).fill(0), fitted: [] };

  let level = Number(arr[0]) || 0;
  let trend = arr[1] != null ? (Number(arr[1]) || 0) - level : 0;

  const fitted = [];
  for (let t = 0; t < arr.length; t++) {
    const y = Number(arr[t]) || 0;
    const prevLevel = level;
    fitted.push(level + trend);
    level = alpha * y + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const forecast = Array.from({ length: h }, (_, i) => level + (i + 1) * trend);
  return { forecast, fitted };
}

export function holtDamped(values, alpha = 0.4, beta = 0.3, phi = 0.9, h = 30) {
  const arr = Array.isArray(values) ? values : [];
  if (!arr.length) return { forecast: Array(h).fill(0), fitted: [] };

  let level = Number(arr[0]) || 0;
  let trend = arr[1] != null ? (Number(arr[1]) || 0) - level : 0;

  const fitted = [];
  for (let t = 0; t < arr.length; t++) {
    const y = Number(arr[t]) || 0;
    const prevLevel = level;
    fitted.push(level + phi * trend);
    level = alpha * y + (1 - alpha) * (level + phi * trend);
    trend = beta * (level - prevLevel) + (1 - beta) * phi * trend;
  }

  const forecast = Array.from({ length: h }, (_, i) => {
    const k = i + 1;
    const dampSum = phi === 1 ? k : (1 - Math.pow(phi, k)) / (1 - phi);
    return level + trend * dampSum;
  });
  return { forecast, fitted };
}

export function holtWintersAdditive(
  values,
  m = 7,
  alpha = 0.3,
  beta = 0.2,
  gamma = 0.2,
  h = 30
) {
  const arr = Array.isArray(values) ? values : [];
  const n = arr.length;
  if (n < m * 2) return holt(arr, alpha, beta, h);

  // initialisation
  let level = arr.slice(0, m).reduce((s, x) => s + (Number(x) || 0), 0) / m;
  let trend = ((Number(arr[m]) || 0) - (Number(arr[0]) || 0)) / m;

  const season = new Array(m).fill(0);
  const seasonsCount = Math.floor(n / m);
  for (let i = 0; i < m; i++) {
    let sum = 0;
    for (let s = 0; s < seasonsCount; s++) sum += Number(arr[i + s * m]) || 0;
    season[i] = sum / seasonsCount - level;
  }

  const fitted = [];
  for (let t = 0; t < n; t++) {
    const y = Number(arr[t]) || 0;
    const sIdx = t % m;
    const yHat = level + trend + season[sIdx];
    fitted.push(yHat);

    const newLevel = alpha * (y - season[sIdx]) + (1 - alpha) * (level + trend);
    const newTrend = beta * (newLevel - level) + (1 - beta) * trend;
    const newSeason = gamma * (y - newLevel) + (1 - gamma) * season[sIdx];

    level = newLevel;
    trend = newTrend;
    season[sIdx] = newSeason;
  }

  const forecast = Array.from(
    { length: h },
    (_, i) => level + (i + 1) * trend + season[(n + i) % m]
  );

  return { forecast, fitted };
}

export function mape(actual, fitted) {
  const a = Array.isArray(actual) ? actual : [];
  const f = Array.isArray(fitted) ? fitted : [];
  let n = 0, s = 0;
  for (let i = 0; i < a.length; i++) {
    const av = Number(a[i]);
    const fv = Number(f[i]);
    if (av !== 0 && _isNum(av) && _isNum(fv)) {
      n++;
      s += Math.abs((av - fv) / av);
    }
  }
  return n ? (s / n) * 100 : Infinity;
}

/**
 * Détection d’une saisonnalité hebdo simple.
 * Attend un tableau d’objets { date, revenue }.
 * Ignore les dates invalides et les revenus non numériques.
 */
export function detectWeeklySeasonality(series) {
  const arr = Array.isArray(series) ? series : [];
  if (arr.length < 14) return { detected: false, strength: 0 };

  const byDow = Array.from({ length: 7 }, () => ({ sum: 0, c: 0 }));
  let overallSum = 0;
  let overallCount = 0;

  for (const d of arr) {
    const dateStr = d?.date ? String(d.date).slice(0, 10) : "";
    const rev = Number(d?.revenue);
    const dt = new Date(dateStr);
    if (!dateStr || Number.isNaN(dt.getTime()) || !Number.isFinite(rev)) continue;

    const dow = dt.getDay(); // 0..6
    byDow[dow].sum += rev;
    byDow[dow].c += 1;

    overallSum += rev;
    overallCount += 1;
  }

  if (overallCount < 14) return { detected: false, strength: 0 };

  const means = byDow.map((x) => (x.c ? x.sum / x.c : 0));
  const overall = overallSum / overallCount;

  const varProfile = means.reduce((s, m) => s + Math.pow(m - overall, 2), 0) / 7;
  const varTotal = arr.reduce((s, x) => {
    const r = Number(x?.revenue);
    return Number.isFinite(r) ? s + Math.pow(r - overall, 2) : s;
  }, 0) / overallCount;

  const strength = varTotal ? varProfile / varTotal : 0;
  return { detected: strength > 0.15, strength };
}

// [ANCHOR: FORECAST_EXPORTS]

