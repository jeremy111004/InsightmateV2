import React from "react";

/** ---------------- utils ---------------- */
const dd = (d) =>
  typeof d === "string"
    ? d.slice(0, 10)
    : new Date(d).toISOString().slice(0, 10);

/** Build daily net cash from sales-like rows + stress
 * rows: [{date, qty, unit_price, unit_cost, discount, shipping_fee, shipping_cost}, ...]
 */
function dailyNetFromRows(
  rows,
  { salesPct = 0, costsPct = 0, dsoDays = 0 } = {}
) {
  const byDay = new Map();
  for (const r of rows || []) {
    const day = dd(r.date);
    const qty = Math.max(0, Number(r.qty || 0));
    const price = Number(r.unit_price || 0);
    const cost = Number(r.unit_cost || 0);
    const discount = Math.max(0, Number(r.discount || 0));
    const fee = Number(r.shipping_fee ?? 0);
    const scost = Number(r.shipping_cost ?? 0);

    const inc0 =
      Math.max(0, qty * price - discount) + (Number.isFinite(fee) ? fee : 0);
    const out0 = Math.max(0, qty * cost) + (Number.isFinite(scost) ? scost : 0);

    const inc = inc0 * (1 + salesPct / 100);
    const out = out0 * (1 + costsPct / 100);

    const inflowDay = dd(
      new Date(new Date(day).getTime() + dsoDays * 86400000)
    );
    byDay.set(inflowDay, (byDay.get(inflowDay) || 0) + inc);
    byDay.set(day, (byDay.get(day) || 0) - out);
  }
  const days = [...byDay.keys()].sort();
  return days.map((t) => ({ t, net: byDay.get(t) }));
}

/** Fit AR(1) on daily net flows */
function fitAR1(series) {
  if (!series.length) return { mu: 0, phi: 0, sigma: 0 };
  const x = series.map((d) => d.net);
  const n = x.length;
  const mu = x.reduce((s, v) => s + v, 0) / n;
  let num = 0,
    den = 0;
  for (let t = 1; t < n; t++) {
    const a = x[t] - mu,
      b = x[t - 1] - mu;
    num += a * b;
    den += b * b;
  }
  const phi = den > 0 ? Math.max(-0.995, Math.min(0.995, num / den)) : 0;
  let s2 = 0;
  for (let t = 1; t < n; t++) {
    const xhat = mu + phi * (x[t - 1] - mu);
    s2 += (x[t] - xhat) ** 2;
  }
  const sigma = Math.sqrt(s2 / Math.max(1, n - 1));
  return { mu, phi, sigma };
}

/** Monte-Carlo with weekly seasonality + mild vol clustering (wavy) */
function simulateCash({ lastCash, ar, horizon = 60, nSim = 3000, seed = 42 }) {
  const lcg = (() => {
    let s = seed >>> 0;
    return () => (s = (1664525 * s + 1013904223) >>> 0) / 2 ** 32;
  })();
  const byDay = Array.from({ length: horizon }, () => new Float64Array(nSim));
  const seasAmp = Math.max(0, ar.sigma) * 0.5;

  for (let k = 0; k < nSim; k++) {
    let cash = lastCash,
      xPrev = ar.mu,
      lastShock = 0;
    for (let d = 0; d < horizon; d++) {
      const u1 = Math.max(1e-12, lcg()),
        u2 = Math.max(1e-12, lcg());
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); // N(0,1)
      const sigma_t =
        ar.sigma * (1.1 + 0.35 * Math.min(2, Math.abs(lastShock)));
      const season = seasAmp * Math.sin((2 * Math.PI * (d % 7)) / 7);
      const flow = ar.mu + ar.phi * (xPrev - ar.mu) + sigma_t * z + season;
      lastShock = z;
      xPrev = flow;
      cash += flow;
      byDay[d][k] = cash;
    }
  }

  const pct = (arr, q) => {
    const a = Float64Array.from(arr).sort();
    const i = Math.max(
      0,
      Math.min(a.length - 1, Math.floor(q * (a.length - 1)))
    );
    return a[i];
  };

  const fan = [];
  let probOverdraftPaths = 0;
  for (let k = 0; k < nSim; k++) {
    let under = false;
    for (let d = 0; d < horizon; d++)
      if (byDay[d][k] < 0) {
        under = true;
        break;
      }
    if (under) probOverdraftPaths++;
  }
  for (let d = 0; d < horizon; d++) {
    const slice = byDay[d];
    fan.push({
      t: dd(new Date(Date.now() + (d + 1) * 86400000)),
      p5: pct(slice, 0.05),
      p50: pct(slice, 0.5),
      p95: pct(slice, 0.95),
    });
  }

  const cfar = Math.min(...fan.map((x) => x.p5 - x.p50));
  const es = fan.length
    ? fan.reduce((s, x) => s + (x.p5 - x.p50), 0) / fan.length
    : 0;
  const probOverdraft = probOverdraftPaths / nSim;
  const idx = fan.findIndex((x) => x.p5 < 0);
  const runwayP5 = idx === -1 ? Infinity : idx + 1;

  return { fan, cfar, es, probOverdraft, runwayP5 };
}

/** ---------------- Hook: identical API to your old one ----------------
 * RETURNS: { params, setParams, stress, setStress, metrics, fanSeries, recompute }
 * - params: { horizon, alpha, nSim }
 * - stress: { salesPct, costsPct, dsoDays }
 * - metrics: { cfar, es, probOverdraft, runwayP5, isDemo }
 * - fanSeries: [{t,p5,p50,p95}, ...]
 */
export default function useCashRiskEngine({
  demoRows,
  realRows,
  initialCash = 12000,
} = {}) {
  const [params, setParams] = React.useState({
    horizon: 60,
    alpha: 0.95,
    nSim: 3000,
  });
  const [stress, setStress] = React.useState({
    salesPct: 0,
    costsPct: 0,
    dsoDays: 0,
  });
  const [metrics, setMetrics] = React.useState({
    cfar: 0,
    es: 0,
    probOverdraft: 0,
    runwayP5: Infinity,
    isDemo: true,
  });
  const [fanSeries, setFanSeries] = React.useState([]);

  const recompute = React.useCallback(() => {
    const rows = (realRows && realRows.length ? realRows : demoRows) || [];
    const isDemo = !(realRows && realRows.length);

    const daily = dailyNetFromRows(rows, {
      salesPct: stress.salesPct ?? 0,
      costsPct: stress.costsPct ?? 0,
      dsoDays: stress.dsoDays ?? 0,
    });
    if (!daily.length) {
      setFanSeries([]);
      setMetrics((m) => ({
        ...m,
        isDemo: true,
        cfar: 0,
        es: 0,
        probOverdraft: 0,
        runwayP5: Infinity,
      }));
      return;
    }

    const lastCash = initialCash + daily.reduce((s, d) => s + d.net, 0);
    const ar = fitAR1(daily);
    const { fan, cfar, es, probOverdraft, runwayP5 } = simulateCash({
      lastCash,
      ar,
      horizon: params.horizon,
      nSim: params.nSim,
    });

    setFanSeries(fan);
    setMetrics((m) => ({ ...m, cfar, es, probOverdraft, runwayP5, isDemo }));
  }, [
    demoRows,
    realRows,
    initialCash,
    params.horizon,
    params.nSim,
    stress.salesPct,
    stress.costsPct,
    stress.dsoDays,
  ]);

  React.useEffect(() => {
    recompute();
  }, [recompute]);

  return {
    params,
    setParams,
    stress,
    setStress,
    metrics,
    fanSeries,
    recompute,
  };
}
