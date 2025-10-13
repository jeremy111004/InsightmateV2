// src/lib/regimePricing.js
// Smart Regime Pricing — detect market regime and recommend price accordingly.

import { PRICING_CFG, applyGuardrails as guard } from "./pricingGuardrails";
import {
  estimateElasticityLogLog,
  optimalPriceLerner,
} from "./pricing";

// ---------- utils ----------
const toNum = (v, d = 0) => {
  if (v == null || v === "") return d;
  const n = typeof v === "number" ? v : Number(String(v).replace?.(",", "."));
  return Number.isFinite(n) ? n : d;
};
const clamp = (x, a, b) => Math.min(Math.max(x, a), b);

// ---------- 1) Signals (fast, robust) ----------
/**
 * Build regime signals from lightweight inputs.
 * If no daily history, we proxy demand with last_90d_qty / 90.
 */
export function computeRegimeSignals({
  // data (some optional)
  salesDaily = null,                // Array<number> of recent daily quantities (optional)
  last_90d_qty = null,
  price = null,
  competitor_price = null,
  stock_on_hand = null,
  lead_time_days = null,
}) {
  // Demand proxy
  let dailySeries = Array.isArray(salesDaily) && salesDaily.length >= 21
    ? salesDaily.slice(-60)
    : null;

  const q90 = toNum(last_90d_qty, 0);
  const dailyProxy = q90 > 0 ? q90 / 90 : 0;

  // mean/std for z-score
  const mean = (arr) => arr.reduce((a,b)=>a+b,0) / (arr.length || 1);
  const std = (arr) => {
    if (!arr || arr.length < 2) return 0;
    const m = mean(arr);
    const v = mean(arr.map(x => (x - m) ** 2));
    return Math.sqrt(v);
  };

  const demandMean = dailySeries ? mean(dailySeries) : dailyProxy;
  const demandStd  = dailySeries ? std(dailySeries)  : (dailyProxy * 0.35);
  const lastDaily  = dailySeries ? dailySeries.at(-1) : dailyProxy;
  const demandZ    = demandStd > 0 ? (lastDaily - demandMean) / demandStd : 0;

  // Competitor price index (your price vs market)
  const idx = (toNum(price, 0) > 0 && toNum(competitor_price, 0) > 0)
    ? (toNum(price, 0) / toNum(competitor_price, 0))
    : null;

  // Cover days (inventory)
  const daily = Math.max(0, demandMean);
  const coverDays = daily > 0 ? (toNum(stock_on_hand, 0) / daily) : 0;
  const lead = Math.max(0, toNum(lead_time_days, 0));

  return {
    demandZ,        // >0 => above recent average demand
    priceIndex: idx, // 1.07 => 7% above market
    coverDays,      // inventory coverage in days
    leadDays: lead,
  };
}

// ---------- 2) Classify regime ----------
/**
 * Heuristic classifier (transparent, fast):
 * - HIGH: demandZ > +0.7 and not short on stock
 * - LOW : demandZ < -0.7 OR priceIndex >> market OR big overstock
 * - else : MID
 */
export function classifyRegime({ demandZ, priceIndex, coverDays, leadDays }) {
  const overStock = coverDays > Math.max(45, 2 * leadDays);
  const shortStock = coverDays < Math.max(10, 0.7 * leadDays);
  const pricey = (priceIndex != null && priceIndex > 1.06);

  if (demandZ > 0.7 && !shortStock) return "HIGH";
  if (demandZ < -0.7 || pricey || overStock) return "LOW";
  return "MID";
}

// ---------- 3) Adjust elasticity per regime ----------
/**
 * If demand is high, effective elasticity is lower in magnitude (customers less price-sensitive).
 * If demand is low, it's higher in magnitude (more sensitive).
 */
export function adjustElasticity(baseE, regime) {
  const e = Number.isFinite(baseE) ? baseE : -1.2;
  const abs = Math.abs(e);
  const sign = e < 0 ? -1 : 1; // should be negative
  let factor = 1.0;
  if (regime === "HIGH") factor = 0.8; // reduce magnitude
  if (regime === "LOW")  factor = 1.2; // increase magnitude
  const eAdj = -sign * abs * factor; // keep negative
  // keep bounded for stability
  return clamp(eAdj, -3.0, -0.2);
}

// ---------- 4) Regime-aware guardrail tuning ----------
/**
 * Tweak guardrails based on regime:
 * - HIGH: allow a bit more upside
 * - LOW : allow a bit more downside (markdown), protect margin floor
 */
function guardsForRegime(regime, cfg = PRICING_CFG) {
  if (regime === "HIGH") {
    return {
      step: cfg.step,
      maxChangePct: Math.max(cfg.maxChangePct, 0.12), // allow more up/down
      kviMaxUpPct: Math.max(cfg.kviMaxUpPct, 0.06),   // KVI can go a bit higher
      minMarginPct: cfg.minMarginPct,
      charm: cfg.charm,
    };
  }
  if (regime === "LOW") {
    return {
      step: cfg.step,
      maxChangePct: Math.max(cfg.maxChangePct, 0.12),
      kviMaxUpPct: cfg.kviMaxUpPct, // still cautious on KVI ups
      minMarginPct: Math.max(cfg.minMarginPct, 0.12), // protect a bit more
      charm: cfg.charm,
    };
  }
  return {
    step: cfg.step,
    maxChangePct: cfg.maxChangePct,
    kviMaxUpPct: cfg.kviMaxUpPct,
    minMarginPct: cfg.minMarginPct,
    charm: cfg.charm,
  };
}

// ---------- 5) Main: regimeAwarePrice ----------
/**
 * regimeAwarePrice({
 *   cost, priceCurr, samples, baseElasticity, category, isKVI,
 *   signalsInput: { salesDaily?, last_90d_qty, price, competitor_price, stock_on_hand, lead_time_days },
 *   cfg
 * })
 */
export function regimeAwarePrice({
  cost,
  priceCurr,
  samples = null,
  baseElasticity = null,
  category = "autre",
  isKVI = false,
  signalsInput = {},
  cfg = PRICING_CFG,
}) {
  // 1) signals & regime
  const signals = computeRegimeSignals({
    ...signalsInput,
    last_90d_qty: signalsInput.last_90d_qty,
    price: priceCurr,
  });
  const regime = classifyRegime(signals);

  // 2) base elasticity (from samples or fallback)
  let e =
    baseElasticity ??
    estimateElasticityLogLog(samples) ??
    cfg?.defaultElasticityByCategory?.[category] ??
    cfg?.defaultElasticityByCategory?.autre ??
    -0.8;

  // 3) regime-adjusted elasticity
  const eAdj = adjustElasticity(e, regime);

  // 4) theoretical price (Lerner) if |e|>1
  const eAbs = Math.abs(eAdj);
  const pStar = eAbs > 1 ? optimalPriceLerner(cost, eAbs) : null;

  // 5) regime-tuned guardrails (+ markdown context for overstock)
  const guards = guardsForRegime(regime, cfg);
  const pRec = guard(pStar ?? priceCurr, {
    P0: priceCurr,
    cost,
    isKVI: !!isKVI,
    ...guards,
    markdownContext: {
      stock_on_hand: signalsInput.stock_on_hand,
      last_90d_qty: signalsInput.last_90d_qty,
      lead_time_days: signalsInput.lead_time_days,
    },
  });

  return {
    regime,         // "LOW" | "MID" | "HIGH"
    signals,        // demandZ, priceIndex, coverDays, leadDays
    eBase: e,
    eAdj,
    eAbs,
    pStar,
    pRec,
  };
}

export default {
  computeRegimeSignals,
  classifyRegime,
  adjustElasticity,
  regimeAwarePrice,
};
