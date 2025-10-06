// src/lib/pricing.js

// ——— utils locaux ———
function toNum(v, def = 0) {
  if (v == null || v === "") return def;
  const n = typeof v === "number" ? v : Number(String(v).replace?.(",", "."));
  return Number.isFinite(n) ? n : def;
}
const clamp = (x, min, max) => Math.min(Math.max(x, min), max);

// ——— 1) Élasticité (log-log) à partir d’un historique {price, qty} ———
/**
 * rows: Array<{ price:number, qty:number }>
 * Retourne l’élasticité (slope de ln(q) ~ e * ln(p) + b)
 * Fallback conservateur -1.3 si pas assez de données.
 */
export function estimateElasticityFromHistory(rows = []) {
  const clean = (rows || [])
    .map((r) => ({ p: toNum(r.price), q: toNum(r.qty) }))
    .filter((r) => r.p > 0 && r.q > 0);

  if (clean.length < 3) return -1.3;

  const xs = clean.map((r) => Math.log(r.p));
  const ys = clean.map((r) => Math.log(r.q));

  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const mx = mean(xs);
  const my = mean(ys);

  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    num += dx * (ys[i] - my);
    den += dx * dx;
  }
  const slope = den === 0 ? -1.3 : num / den;
  // e devrait être négatif : borne douce
  const e = Number.isFinite(slope) ? Math.min(-0.2, slope) : -1.3;
  return e;
}

// ——— 2) Prix optimal théorique (Lerner) ———
/**
 * optimalPrice({ c, e, P0 })
 * - c: coût unitaire (>= 0)
 * - e: élasticité (négative; on refuse si e >= -1)
 * - P0: prix courant (fallback si e non fiable)
 */
export function optimalPrice({ c, e, P0 }) {
  const cost = Math.max(0, toNum(c, 0));
  const elast = toNum(e, NaN);

  // Si l'élasticité est non fiable ou trop faible en valeur absolue, ne change rien
  if (!Number.isFinite(elast) || elast >= -1.05) return toNum(P0, cost);

  // Lerner: (P - c)/P = -1/e  =>  P* = (c * e) / (e + 1)
  const Pstar = (cost * elast) / (elast + 1);
  // evite valeurs bizarres sous le coût
  if (!Number.isFinite(Pstar) || Pstar <= 0) return Math.max(cost, toNum(P0, cost));
  return Pstar;
}

// ——— 3) Modèle simple de demande q = k * P^e calibré sur (P0, Q0) ———
function calibrateK({ P0, Q0, e }) {
  const p = Math.max(0.01, toNum(P0, 0.01));
  const q = Math.max(0.01, toNum(Q0, 0.01));
  const elast = toNum(e, -1.3);
  return q / Math.pow(p, elast);
}
function demandAtPrice({ k, e, P }) {
  const p = Math.max(0.01, toNum(P, 0.01));
  return k * Math.pow(p, toNum(e, -1.3));
}
function revenue({ P, Q }) {
  const p = toNum(P, 0), q = toNum(Q, 0);
  return p * q;
}
function profit({ P, Q, c }) {
  const p = toNum(P, 0), q = toNum(Q, 0), cost = Math.max(0, toNum(c, 0));
  return (p - cost) * q;
}
function marginPct({ P, c }) {
  const p = toNum(P, 0), cost = Math.max(0, toNum(c, 0));
  if (p <= 0) return 0;
  return ((p - cost) / p) * 100;
}

// ——— 4) Garde-fous pratiques pour proposer un prix actionnable ———
/**
 * applyGuardrails(P*, { P0, c, step, maxDeltaPct, minMarginPct, minPrice, maxPrice })
 */
function applyGuardrails(Pstar, {
  P0,
  c,
  step = 0.1,            // pas d’arrondi (ex: 0.05, 0.1, 0.5, 1)
  maxDeltaPct = 25,      // variation max vs P0 en %
  minMarginPct = 5,      // marge min
  minPrice,              // borne explicite
  maxPrice,              // borne explicite
} = {}) {
  const base = Math.max(0.01, toNum(P0, 0.01));
  let p = Math.max(Pstar, toNum(c, 0)); // jamais sous le coût

  // borne variation vs P0
  if (Number.isFinite(maxDeltaPct) && maxDeltaPct > 0) {
    const up = base * (1 + maxDeltaPct / 100);
    const down = base * (1 - maxDeltaPct / 100);
    p = clamp(p, down, up);
  }

  // bornes explicites
  if (Number.isFinite(minPrice)) p = Math.max(p, minPrice);
  if (Number.isFinite(maxPrice)) p = Math.min(p, maxPrice);

  // marge minimale
  if (Number.isFinite(minMarginPct) && minMarginPct > 0) {
    const cost = Math.max(0, toNum(c, 0));
    const minPforMargin = cost / (1 - minMarginPct / 100);
    p = Math.max(p, minPforMargin);
  }

  // arrondi au pas
  const st = Math.max(0.01, toNum(step, 0.01));
  p = Math.round(p / st) * st;

  // éviter -0.00
  p = Number(p.toFixed(6));
  return p;
}

// ——— 5) Suggestion complète avec justification ———
/**
 * suggestPrice({
 *   history: [{price, qty}],   // historique récent
 *   currentPrice: number,      // P0
 *   cost: number,              // c
 *   guardrails: { step, maxDeltaPct, minMarginPct, minPrice, maxPrice }
 * })
 * -> { suggested, elasticity, baseline: {P0, Q0}, forecast: {Q_at_suggested, revenue, profit}, reason }
 */
export function suggestPrice({
  history = [],
  currentPrice,
  cost = 0,
  guardrails = {},
}) {
  const P0 = toNum(currentPrice, 0);
  const Q0 = toNum((history && history.length ? history[history.length - 1].qty : 0), 0);
  const e = estimateElasticityFromHistory(history);
  const k = calibrateK({ P0, Q0: Math.max(Q0, 1), e });

  const P_theory = optimalPrice({ c: cost, e, P0 });
  const suggested = applyGuardrails(P_theory, { P0, c: cost, ...guardrails });

  const Q_suggested = demandAtPrice({ k, e, P: suggested });
  const rev = revenue({ P: suggested, Q: Q_suggested });
  const prof = profit({ P: suggested, Q: Q_suggested, c: cost });
  const margin = marginPct({ P: suggested, c: cost });

  const reason =
    e >= -1.05
      ? "Élasticité estimée peu fiable (|e| < 1). Prix conservé avec garde-fous."
      : "Prix basé sur la règle de Lerner (élasticité constante), ajusté par des garde-fous (variation, marge, pas).";

  return {
    suggested,
    elasticity: e,
    baseline: { P0, Q0 },
    forecast: {
      Q_at_suggested: Math.max(0, Math.round(Q_suggested)),
      revenue: Math.round(rev),
      profit: Math.round(prof),
      marginPct: Math.round(margin * 10) / 10,
    },
    reason,
  };
}

// ——— 6) Export par défaut pratique ———
export default {
  estimateElasticityFromHistory,
  optimalPrice,
  suggestPrice,
};
