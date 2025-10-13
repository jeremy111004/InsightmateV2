// src/pages/PricingOptimizer.jsx
// ============================================================================
// INSIGHTMATE — PRICING OPTIMIZER (McKinsey-style) — PART 1/2
// Single-file, self-contained implementation with visuals & sections.
// Uses: React, papaparse, recharts, tailwindcss
// ============================================================================

import React from "react";
import Papa from "papaparse";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { motion } from "framer-motion";

// === [ANCHOR: THEME / UTILITIES] ============================================
const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const nf2 = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#ef4444",
  "#7c3aed",
  "#0891b2",
  "#dc2626",
  "#0ea5e9",
  "#ca8a04",
];

const toNum = (v, fb = 0) => {
  if (v == null) return fb;
  const x = typeof v === "string" ? v.replace(/\s+/g, "").replace(",", ".") : v;
  const n = Number(x);
  return Number.isFinite(n) ? n : fb;
};
const safeFinite = (n, fb = 0) => (Number.isFinite(n) ? n : fb);

// Robust stats
function median(arr) {
  const a = arr.slice().sort((x, y) => x - y);
  const n = a.length;
  if (!n) return NaN;
  const m = Math.floor(n / 2);
  return n % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function trimmedMean(arr, trim = 0.1) {
  const a = arr.slice().sort((x, y) => x - y);
  const n = a.length;
  if (!n) return NaN;
  const k = Math.floor(n * trim);
  const b = a.slice(k, Math.max(k, n - k));
  return b.length ? b.reduce((s, x) => s + x, 0) / b.length : NaN;
}
function mad(arr) {
  const m = median(arr);
  const dev = arr.map((x) => Math.abs(x - m));
  const madRaw = median(dev);
  return madRaw * 1.4826; // ~std robust
}

// === [ANCHOR: ELASTICITY / DEMAND MODEL] ====================================
/**
 * Estimate elasticity from price-quantity history using log-linear OLS:
 * ln(q) = a + b ln(p) + eps, elasticity ≈ b.
 */
function estimateElasticityFromHistory(hist /* [{price, qty}, ...] */) {
  const X = [];
  const Y = [];
  for (const h of hist) {
    const p = toNum(h.price, NaN);
    const q = toNum(h.qty, NaN);
    if (p > 0 && q > 0) {
      X.push([1, Math.log(p)]);
      Y.push(Math.log(q));
    }
  }
  if (X.length < 2) return -1.2; // fallback conservative
  // OLS beta = (X'X)^-1 X'Y   [2x2 inverse]
  const XtX00 = X.reduce((s, r) => s + r[0] * r[0], 0);
  const XtX01 = X.reduce((s, r) => s + r[0] * r[1], 0);
  const XtX11 = X.reduce((s, r) => s + r[1] * r[1], 0);
  const XtY0 = X.reduce((s, r, i) => s + r[0] * Y[i], 0);
  const XtY1 = X.reduce((s, r, i) => s + r[1] * Y[i], 0);
  const det = XtX00 * XtX11 - XtX01 * XtX01;
  if (Math.abs(det) < 1e-9) return -1.2;
  const inv00 = XtX11 / det;
  const inv01 = -XtX01 / det;
  const inv11 = XtX00 / det;
  const a = inv00 * XtY0 + inv01 * XtY1;
  const b = inv01 * XtY0 + inv11 * XtY1; // elasticity
  // clamp to sane range
  const e = Math.max(-3.5, Math.min(-0.2, b));
  return Number(e.toFixed(2));
}

/** Local linear demand around (P0,Q0) using elasticity e:
 *  Q(P) = a + b P, with b = e * (Q0/P0), a = Q0 - b P0
 */
function linearDemandParamsFromElasticity(P0, Q0, e) {
  const P = Number(P0) > 0 ? Number(P0) : 1;
  const Q = Number(Q0) >= 0 ? Number(Q0) : 0;
  const ee = Number.isFinite(e) ? e : -1.2;
  const b = ee * (Q / P);
  const a = Q - b * P;
  return { a, b };
}

// === [ANCHOR: GUARDRAILS / PRICING RULES] ===================================
function makeCfg(aggr = 50, objective = "balanced") {
  const a = Math.max(0, Math.min(100, aggr));
  const maxChangePct = 0.05 + (0.3 - 0.05) * (a / 100); // 5% → 30%
  const kviMaxUpPct = 0.02 + (0.08 - 0.02) * (a / 100); // 2% → 8%
  const lambda =
    objective === "margin" ? 0.0 : objective === "revenue" ? 0.6 : 0.25;
  const alpha = 0.6 - 0.4 * (a / 100); // stock risk penalty
  const beta = 0.8 - 0.5 * (a / 100); // competition penalty
  return {
    minMarginPct: 0.1,
    maxChangePct,
    kviMaxUpPct,
    charm: true,
    lambda,
    alpha,
    beta,
  };
}

function charm99(p, enabled = true) {
  if (!enabled) return Number(p.toFixed(2));
  const base = Math.floor(p);
  const c99 = base + 0.99;
  if (p < c99 && c99 - p < 0.02) return Number(p.toFixed(2));
  return Number((base + 0.99).toFixed(2));
}

function markdownBias({
  stock_on_hand = null,
  last_90d_qty = null,
  lead_time_days = null,
}) {
  if (!(stock_on_hand > 0 && last_90d_qty > 0)) return 0;
  const daily = last_90d_qty / 90;
  if (daily <= 0) return 0;
  const coverDays = stock_on_hand / daily;
  const lead = Math.max(0, lead_time_days || 0);
  if (coverDays > 60 && lead > 14) return 0.15;
  if (coverDays > 45) return 0.08;
  if (coverDays > 30) return 0.04;
  return 0;
}

function clampWithReason(
  Pstar,
  { P0, c, kvi = false, competitor_price = null },
  cfg
) {
  const reasons = [];
  const floorByMargin = c * (1 + cfg.minMarginPct);
  const floorByStep = P0 * (1 - cfg.maxChangePct);
  const ceilByStep = P0 * (1 + cfg.maxChangePct);
  let low = Math.max(0.01, floorByMargin, floorByStep);
  let high = Math.max(ceilByStep, low);
  if (Pstar < floorByMargin) reasons.push("cap marge");
  if (Pstar < floorByStep) reasons.push("cap baisse max");
  if (Pstar > ceilByStep) reasons.push("cap hausse max");
  if (kvi) {
    const kviCap = P0 * (1 + cfg.kviMaxUpPct);
    if (high > kviCap) {
      high = kviCap;
      reasons.push("cap KVI");
    }
  }
  if (competitor_price && competitor_price > 0) {
    const compHigh = (kvi ? 1.02 : 1.05) * competitor_price;
    if (high > compHigh) {
      high = compHigh;
      reasons.push("cap concurrence");
    }
    if (kvi) {
      const compLow = 0.9 * competitor_price;
      if (low < compLow) {
        low = compLow;
        reasons.push("alignement KVI");
      }
    }
  }
  let P = Math.min(Math.max(Pstar, low), high);
  const preCharm = P;
  P = charm99(P, cfg.charm);
  if (Math.abs(P - preCharm) > 1e-9) reasons.push(".99");
  if (P <= c) {
    P = Number((c * 1.02).toFixed(2));
    if (!reasons.includes("cap marge")) reasons.push("cap marge");
  }
  return { P, reasons, low, high };
}

// === [ANCHOR: OBJECTIVE SCORE] ==============================================
/**
 * Multi-criteria score to rank candidate prices.
 * S(P) = Margin + λ*Revenue - α*stockRisk*Revenue - β*compPenalty*Revenue
 */
function scoreAtPrice(P, ctx, cfg) {
  const { a, b, c, competitor_price, kvi } = ctx;
  const Q = Math.max(0, a + b * P);
  const revenue = P * Q;
  const margin = (P - c) * Q;

  // Stock risk (lead vs on-hand)
  const predDaily = Math.max(0, Q / 90);
  const lead = Math.max(0, toNum(ctx.lead_time_days, 0));
  const stock = Math.max(0, toNum(ctx.stock_on_hand, 0));
  const demandDuringLead = predDaily * lead;
  const shortage = Math.max(0, demandDuringLead - stock);
  const stockRisk = shortage / (demandDuringLead + 1e-9);

  // Competition penalty (esp. for KVI)
  let compPenalty = 0;
  if (competitor_price && competitor_price > 0) {
    const idx = P / competitor_price;
    compPenalty = Math.max(0, idx - (kvi ? 1.01 : 1.05)) / 0.1;
    compPenalty = Math.min(compPenalty, 1);
  }

  const S =
    margin +
    cfg.lambda * revenue -
    cfg.alpha * stockRisk * revenue -
    cfg.beta * compPenalty * revenue;
  return { score: S, Q, revenue, margin, stockRisk, compPenalty };
}

// === [ANCHOR: PRICE CANDIDATE & PICKER] =====================================
function bestPriceCandidate(ctx, cfg) {
  const { P0, Q0, c, e, kvi, competitor_price, mdBias } = ctx;
  const { a, b } = linearDemandParamsFromElasticity(P0, Q0, e);

  // Candidate set: Lerner heuristic + local quadratic optimum + small neighbors
  // Lerner (for constant elasticity): P* = c * e / (1 + e). With e<0 → use |e|.
  const ee = Math.abs(e || 1.2);
  const P_lerner = c * (ee / (1 + ee));
  const P_linear_raw = (b * c - a) / (2 * b);
  const P_linear = Number(
    Math.min(Math.max(P_linear_raw, c * 1.02, P0 * 0.5), P0 * 1.5).toFixed(4)
  );
  const neigh = [0.98, 1.02, 0.95, 1.05].map((f) => P0 * f);

  const rawCandidates = [P_lerner, P_linear, ...neigh].map((x) => {
    const biased = Number((x * (1 - (mdBias || 0))).toFixed(4));
    const cl = clampWithReason(biased, { P0, c, kvi, competitor_price }, cfg);
    return cl.P;
  });

  let best = { P: P0, eval: -Infinity, detail: null };
  for (const P of rawCandidates) {
    const det = scoreAtPrice(P, { ...ctx, a, b }, cfg);
    if (det.score > best.eval) best = { P, eval: det.score, detail: det };
  }

  // Local ±2% around P0 if we were too conservative
  if (Math.abs(best.P - P0) < 0.02 * P0) {
    const down = clampWithReason(
      P0 * 0.98,
      { P0, c, kvi, competitor_price },
      cfg
    ).P;
    const up = clampWithReason(
      P0 * 1.02,
      { P0, c, kvi, competitor_price },
      cfg
    ).P;
    const sD = scoreAtPrice(down, { ...ctx, a, b }, cfg);
    const sU = scoreAtPrice(up, { ...ctx, a, b }, cfg);
    if (sU.score > best.eval) best = { P: up, eval: sU.score, detail: sU };
    if (sD.score > best.eval) best = { P: down, eval: sD.score, detail: sD };
  }

  const Qstar = Math.max(0, a + b * best.P);
  const rev0 = P0 * Q0;
  const margin0 = (P0 - c) * Q0;
  const revStar = best.P * Qstar;
  const marginStar = (best.P - c) * Qstar;

  return {
    suggestedPrice: Number(best.P.toFixed(2)),
    deltaRev: safeFinite(revStar - rev0, 0),
    deltaMargin: safeFinite(marginStar - margin0, 0),
    a,
    b,
    qStar: Qstar,
    stockRisk: best.detail?.stockRisk ?? 0,
    compPenalty: best.detail?.compPenalty ?? 0,
  };
}

// === [ANCHOR: SAMPLE DATA] ==================================================
function sampleRows() {
  return [
    {
      sku: "SKU-001",
      name: "Café grain 1kg",
      price: 12.9,
      unit_cost: 7.8,
      last_90d_qty: 420,
      price_1: 11.9,
      qty_1: 460,
      price_2: 12.5,
      qty_2: 435,
      price_3: 13.2,
      qty_3: 390,
      kvi: "true",
      competitor_price: 12.5,
      stock_on_hand: 900,
      lead_time_days: 21,
      category: "Grocery",
    },
    {
      sku: "SKU-002",
      name: "Thé vert 100g",
      price: 5.9,
      unit_cost: 3.4,
      last_90d_qty: 610,
      price_1: 5.5,
      qty_1: 660,
      price_2: 6.2,
      qty_2: 590,
      price_3: 6.5,
      qty_3: 560,
      kvi: "false",
      competitor_price: 6.1,
      stock_on_hand: 350,
      lead_time_days: 10,
      category: "Grocery",
    },
    {
      sku: "SKU-003",
      name: "Tasse double paroi",
      price: 9.9,
      unit_cost: 5.1,
      last_90d_qty: 180,
      price_1: 8.9,
      qty_1: 220,
      price_2: 9.5,
      qty_2: 200,
      price_3: 10.5,
      qty_3: 165,
      kvi: "false",
      competitor_price: 10.2,
      stock_on_hand: 120,
      lead_time_days: 18,
      category: "Accessories",
    },
    {
      sku: "SKU-004",
      name: "Moulin manuel",
      price: 34.0,
      unit_cost: 22.0,
      last_90d_qty: 95,
      price_1: 32.0,
      qty_1: 110,
      price_2: 35.0,
      qty_2: 90,
      price_3: 36.0,
      qty_3: 84,
      kvi: "false",
      competitor_price: 33.0,
      stock_on_hand: 60,
      lead_time_days: 30,
      category: "Accessories",
    },
    {
      sku: "SKU-005",
      name: "Sirop caramel 75cl",
      price: 7.2,
      unit_cost: 4.0,
      last_90d_qty: 310,
      price_1: 6.9,
      qty_1: 330,
      price_2: 7.5,
      qty_2: 300,
      price_3: 7.9,
      qty_3: 280,
      kvi: "false",
      competitor_price: 7.3,
      stock_on_hand: 500,
      lead_time_days: 25,
      category: "Grocery",
    },
    {
      sku: "SKU-006",
      name: "Capsules espresso x10",
      price: 3.8,
      unit_cost: 2.0,
      last_90d_qty: 520,
      price_1: 3.5,
      qty_1: 560,
      price_2: 3.9,
      qty_2: 505,
      price_3: 4.2,
      qty_3: 470,
      kvi: "true",
      competitor_price: 3.9,
      stock_on_hand: 800,
      lead_time_days: 14,
      category: "Grocery",
    },
    {
      sku: "SKU-007",
      name: "Filtres papier x100",
      price: 2.6,
      unit_cost: 1.2,
      last_90d_qty: 740,
      price_1: 2.4,
      qty_1: 780,
      price_2: 2.7,
      qty_2: 720,
      price_3: 2.9,
      qty_3: 660,
      kvi: "false",
      competitor_price: 2.7,
      stock_on_hand: 300,
      lead_time_days: 12,
      category: "Accessories",
    },
    {
      sku: "SKU-008",
      name: "Sucre en morceaux 1kg",
      price: 1.9,
      unit_cost: 1.1,
      last_90d_qty: 880,
      price_1: 1.8,
      qty_1: 910,
      price_2: 2.0,
      qty_2: 860,
      price_3: 2.1,
      qty_3: 820,
      kvi: "false",
      competitor_price: 2.0,
      stock_on_hand: 400,
      lead_time_days: 7,
      category: "Grocery",
    },
    {
      sku: "SKU-009",
      name: "Café décaféiné 500g",
      price: 8.9,
      unit_cost: 5.2,
      last_90d_qty: 260,
      price_1: 8.5,
      qty_1: 280,
      price_2: 9.2,
      qty_2: 245,
      price_3: 9.5,
      qty_3: 230,
      kvi: "false",
      competitor_price: 9.2,
      stock_on_hand: 220,
      lead_time_days: 16,
      category: "Grocery",
    },
    {
      sku: "SKU-010",
      name: "Mug céramique 35cl",
      price: 6.5,
      unit_cost: 3.1,
      last_90d_qty: 340,
      price_1: 6.0,
      qty_1: 370,
      price_2: 6.8,
      qty_2: 320,
      price_3: 7.2,
      qty_3: 300,
      kvi: "false",
      competitor_price: 6.7,
      stock_on_hand: 500,
      lead_time_days: 20,
      category: "Accessories",
    },
    {
      sku: "SKU-011",
      name: "Biscotti amande 250g",
      price: 4.4,
      unit_cost: 2.1,
      last_90d_qty: 410,
      price_1: 4.0,
      qty_1: 450,
      price_2: 4.6,
      qty_2: 385,
      price_3: 4.9,
      qty_3: 360,
      kvi: "false",
      competitor_price: 4.5,
      stock_on_hand: 380,
      lead_time_days: 9,
      category: "Grocery",
    },
    {
      sku: "SKU-012",
      name: "Gourde inox 500ml",
      price: 19.9,
      unit_cost: 11.5,
      last_90d_qty: 120,
      price_1: 18.5,
      qty_1: 130,
      price_2: 20.5,
      qty_2: 115,
      price_3: 21.9,
      qty_3: 108,
      kvi: "false",
      competitor_price: 19.5,
      stock_on_hand: 140,
      lead_time_days: 25,
      category: "Accessories",
    },
    {
      sku: "SKU-013",
      name: "Sucre roux 1kg",
      price: 2.2,
      unit_cost: 1.3,
      last_90d_qty: 760,
      price_1: 2.0,
      qty_1: 800,
      price_2: 2.3,
      qty_2: 730,
      price_3: 2.4,
      qty_3: 700,
      kvi: "false",
      competitor_price: 2.2,
      stock_on_hand: 420,
      lead_time_days: 7,
      category: "Grocery",
    },
    {
      sku: "SKU-014",
      name: "Thé noir Earl Grey 100g",
      price: 6.9,
      unit_cost: 3.8,
      last_90d_qty: 520,
      price_1: 6.5,
      qty_1: 560,
      price_2: 7.2,
      qty_2: 500,
      price_3: 7.5,
      qty_3: 470,
      kvi: "false",
      competitor_price: 7.0,
      stock_on_hand: 360,
      lead_time_days: 12,
      category: "Grocery",
    },
    {
      sku: "SKU-015",
      name: "Boîte hermétique 1L",
      price: 8.2,
      unit_cost: 4.6,
      last_90d_qty: 230,
      price_1: 7.8,
      qty_1: 250,
      price_2: 8.5,
      qty_2: 220,
      price_3: 8.9,
      qty_3: 210,
      kvi: "false",
      competitor_price: 8.4,
      stock_on_hand: 150,
      lead_time_days: 18,
      category: "Accessories",
    },
    {
      sku: "SKU-016",
      name: "Café moulu 250g",
      price: 3.4,
      unit_cost: 1.9,
      last_90d_qty: 980,
      price_1: 3.2,
      qty_1: 1020,
      price_2: 3.6,
      qty_2: 940,
      price_3: 3.8,
      qty_3: 900,
      kvi: "true",
      competitor_price: 3.5,
      stock_on_hand: 900,
      lead_time_days: 10,
      category: "Grocery",
    },
    {
      sku: "SKU-017",
      name: "Mix biscuits café 300g",
      price: 3.9,
      unit_cost: 2.2,
      last_90d_qty: 410,
      price_1: 3.5,
      qty_1: 445,
      price_2: 4.1,
      qty_2: 395,
      price_3: 4.3,
      qty_3: 375,
      kvi: "false",
      competitor_price: 4.0,
      stock_on_hand: 260,
      lead_time_days: 8,
      category: "Grocery",
    },
    {
      sku: "SKU-018",
      name: "Bouteille verre 750ml",
      price: 2.9,
      unit_cost: 1.6,
      last_90d_qty: 300,
      price_1: 2.7,
      qty_1: 325,
      price_2: 3.1,
      qty_2: 285,
      price_3: 3.3,
      qty_3: 270,
      kvi: "false",
      competitor_price: 3.0,
      stock_on_hand: 280,
      lead_time_days: 11,
      category: "Accessories",
    },
    {
      sku: "SKU-019",
      name: "Café premium 1kg",
      price: 18.9,
      unit_cost: 11.2,
      last_90d_qty: 150,
      price_1: 17.5,
      qty_1: 165,
      price_2: 19.5,
      qty_2: 140,
      price_3: 20.9,
      qty_3: 132,
      kvi: "false",
      competitor_price: 18.5,
      stock_on_hand: 190,
      lead_time_days: 21,
      category: "Grocery",
    },
    {
      sku: "SKU-020",
      name: "Sirops assortiment 3x25cl",
      price: 12.5,
      unit_cost: 7.1,
      last_90d_qty: 210,
      price_1: 11.9,
      qty_1: 225,
      price_2: 12.9,
      qty_2: 200,
      price_3: 13.5,
      qty_3: 190,
      kvi: "false",
      competitor_price: 12.7,
      stock_on_hand: 240,
      lead_time_days: 15,
      category: "Grocery",
    },
  ];
}

// === [ANCHOR: MAPPER CSV -> PRODUCT] ========================================
function mapRow(r, cfg) {
  const sku = String(r.sku || "").trim();
  const name = String(r.name || sku || "").trim();
  const category = String(r.category || "General").trim();

  const P0 = toNum(r.price ?? r.P0, 0);
  let c = toNum(r.unit_cost ?? r.cost, NaN);
  let Q0 = toNum(r.last_90d_qty ?? r.qty ?? r.Q0, NaN);
  if (!Number.isFinite(c) || c <= 0) c = P0 * 0.7;
  if (!Number.isFinite(Q0) || Q0 <= 0) Q0 = 1;

  const hist = [];
  [1, 2, 3, 4, 5].forEach((i) => {
    const p = toNum(r[`price_${i}`], NaN);
    const q = toNum(r[`qty_${i}`], NaN);
    if (p > 0 && q > 0) hist.push({ price: p, qty: q });
  });

  // Prior by category if not enough points
  let e = hist.length >= 3 ? estimateElasticityFromHistory(hist) : null;
  if (!Number.isFinite(e)) {
    e = category.toLowerCase().includes("access")
      ? -0.8
      : category.toLowerCase().includes("grocery")
      ? -1.3
      : -1.1;
  }

  const mdBias = markdownBias({
    stock_on_hand: toNum(r.stock_on_hand, null),
    last_90d_qty: Q0,
    lead_time_days: toNum(r.lead_time_days, null),
  });

  const ctx = {
    P0,
    Q0,
    c,
    e,
    mdBias,
    kvi: String(r.kvi || "").toLowerCase() === "true",
    competitor_price: toNum(r.competitor_price, null),
    stock_on_hand: toNum(r.stock_on_hand, 0),
    lead_time_days: toNum(r.lead_time_days, 0),
  };

  const smart = bestPriceCandidate(ctx, cfg);
  const { a, b } = smart;
  const suggestedPrice = Number(smart.suggestedPrice.toFixed(2));

  const daily = Q0 / 90;
  const coverDays =
    ctx.stock_on_hand > 0 ? ctx.stock_on_hand / Math.max(1e-9, daily) : 0;
  const price_index =
    ctx.competitor_price > 0 ? P0 / ctx.competitor_price : null;

  const priorityScore =
    Math.max(0, smart.deltaMargin) / 100 +
    (ctx.kvi ? 1.0 : 0) +
    Math.min(0.6, Math.abs(e) / 3) +
    (coverDays > 60 ? 0.5 : coverDays > 45 ? 0.3 : 0) -
    (smart.stockRisk > 0.5 ? 0.4 : 0) -
    (smart.compPenalty > 0.5 ? 0.4 : 0);

  const priority =
    priorityScore >= 2 ? "haute" : priorityScore >= 1 ? "moyenne" : "basse";

  const explain = [];
  if (ctx.kvi)
    explain.push("Produit sensible à l’image prix (KVI) : hausse limitée.");
  if (ctx.competitor_price > 0) {
    const diff = ((P0 / ctx.competitor_price - 1) * 100).toFixed(0);
    explain.push(`Concurrence : ${diff}% vs marché (cap appliqué).`);
  } else {
    explain.push("Pas de prix concurrent connu.");
  }
  if (Math.abs(e) < 1) explain.push("Demande peu sensible au prix.");
  else explain.push("Demande sensible au prix : attention au volume.");
  if (coverDays > 60) explain.push("Surstock : légère baisse conseillée.");
  if (smart.stockRisk > 0.5)
    explain.push("Risque de rupture pendant l’approvisionnement.");
  if (smart.deltaRev < 0 && smart.deltaMargin > 0)
    explain.push("CA ↓ mais marge unitaire ↑ ⇒ profit total ↑.");

  const curve = buildProfitCurveLinear({ P0, Q0, c, e });

  return {
    sku,
    name,
    category,
    price: P0,
    unit_cost: c,
    last_qty: Q0,
    e: Number(e.toFixed(2)),
    suggestedPrice,
    deltaRev: smart.deltaRev,
    deltaMargin: smart.deltaMargin,
    qStar: smart.qStar,
    curve,
    kvi: ctx.kvi,
    competitor_price: ctx.competitor_price || 0,
    price_index,
    stock_on_hand: ctx.stock_on_hand,
    lead_time_days: ctx.lead_time_days,
    coverDays: Math.round(coverDays),
    stockRisk: smart.stockRisk,
    compPenalty: smart.compPenalty,
    priorityScore,
    priority,
    explain,
    appliedRev: 0,
    appliedMargin: 0,
    applied: false,
  };
}

// === [ANCHOR: PROFIT CURVE] =================================================
function buildProfitCurveLinear({ P0, Q0, c, e }, span = 0.35, steps = 41) {
  const P0v = Number(P0) > 0 ? Number(P0) : 1;
  const Q0v = Number(Q0) >= 0 ? Number(Q0) : 0;
  const cv = Number.isFinite(Number(c)) ? Number(c) : 0;
  const ev = Number.isFinite(Number(e)) ? Number(e) : -1;

  const b = ev * (Q0v / P0v);
  const a = Q0v - b * P0v;

  const pMin = Math.max(0.01, P0v * (1 - span));
  const pMax = Math.max(pMin + 0.01, P0v * (1 + span));
  const n = Math.max(3, Math.floor(steps));

  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const priceVal = pMin + (pMax - pMin) * t;
    const Q = Math.max(0, a + b * priceVal);
    const revenue = priceVal * Q;
    const margin = (priceVal - cv) * Q;
    const profit = margin;
    pts.push({
      price: Number(priceVal.toFixed(2)),
      profit: Number(profit.toFixed(2)),
      revenue: Number(revenue.toFixed(2)),
      margin: Number(margin.toFixed(2)),
    });
  }

  const pickMax = (key) =>
    pts.reduce(
      (acc, p) =>
        p[key] > acc.value ? { value: p[key], price: p.price } : acc,
      {
        value: -Infinity,
        price: P0v,
      }
    );

  const peaks = {
    profit: pickMax("profit"),
    revenue: pickMax("revenue"),
    margin: pickMax("margin"),
  };

  pts.meta = {
    a,
    b,
    pMin,
    pMax,
    steps: n,
    P0: P0v,
    Q0: Q0v,
    c: cv,
    e: ev,
    peaks,
  };
  return pts;
}

// === [ANCHOR: MAIN COMPONENT] ===============================================
export default function PricingOptimizer() {
  // Global knobs
  const [aggr, setAggr] = React.useState(50); // 0..100
  const [objective, setObjective] = React.useState("balanced"); // balanced | margin | revenue
  const cfg = React.useMemo(() => makeCfg(aggr, objective), [aggr, objective]);

  // Data state
  const [products, setProducts] = React.useState([]);
  const [selected, setSelected] = React.useState(null);

  // UI state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState("priorityDesc");
  const [onlyActionables, setOnlyActionables] = React.useState(false);

  React.useEffect(() => {
    if (!products.length) {
      const rows = sampleRows();
      setProducts(rows.map((r) => mapRow(r, cfg)));
      setSelected(rows[0].sku);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-map when cfg changes (aggr/objective)
  React.useEffect(() => {
    if (!products.length) return;
    setProducts((prev) => prev.map((p) => mapRow(p, cfg)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cfg.minMarginPct,
    cfg.maxChangePct,
    cfg.kviMaxUpPct,
    cfg.lambda,
    cfg.alpha,
    cfg.beta,
    cfg.charm,
  ]);

  // CSV upload
  const onUpload = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (res) => {
        const rows = (res.data || []).filter((r) => r && (r.sku || r.name));
        const mapped = rows.map((r) => mapRow(r, cfg));
        setProducts(mapped);
        setSelected(mapped[0]?.sku || null);
      },
    });
  };

  // Displayed table
  const displayed = React.useMemo(() => {
    let arr = [...products];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      arr = arr.filter(
        (p) =>
          (p.sku || "").toLowerCase().includes(q) ||
          (p.name || "").toLowerCase().includes(q)
      );
    }
    if (onlyActionables)
      arr = arr.filter((p) => (p.priority || "") === "haute" || p.kvi === true);
    if (sortBy === "priorityDesc")
      arr.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
    if (sortBy === "deltaMarginDesc")
      arr.sort((a, b) => (b.deltaMargin || 0) - (a.deltaMargin || 0));
    if (sortBy === "deltaRevDesc")
      arr.sort((a, b) => (b.deltaRev || 0) - (a.deltaRev || 0));
    if (sortBy === "elasticityAsc")
      arr.sort((a, b) => Math.abs(a.e) - Math.abs(b.e));
    return arr;
  }, [products, searchQuery, sortBy, onlyActionables]);

  const sel = products.find((p) => p.sku === selected);

  // === [ANCHOR: KPI / QUICK WINS] ===========================================
  const totals = React.useMemo(() => {
    return products.reduce(
      (acc, p) => ({
        appliedRev:
          acc.appliedRev + (Number.isFinite(p.appliedRev) ? p.appliedRev : 0),
        appliedMrg:
          acc.appliedMrg +
          (Number.isFinite(p.appliedMargin) ? p.appliedMargin : 0),
        remainingRev:
          acc.remainingRev + (Number.isFinite(p.deltaRev) ? p.deltaRev : 0),
        remainingMrg:
          acc.remainingMrg +
          (Number.isFinite(p.deltaMargin) ? p.deltaMargin : 0),
      }),
      { appliedRev: 0, appliedMrg: 0, remainingRev: 0, remainingMrg: 0 }
    );
  }, [products]);

  // === [ANCHOR: DATA HEALTH / PIE] ==========================================
  const dataHealth = React.useMemo(() => {
    const n = products.length || 0;
    let withComp = 0,
      withKVI = 0,
      lowData = 0;
    for (const p of products) {
      if ((p.competitor_price ?? 0) > 0) withComp++;
      if (p.kvi) withKVI++;
      if (!Number.isFinite(p.e) || Math.abs(p.e) < 0.3) lowData++;
    }
    const ok = Math.max(0, n - withComp - withKVI - lowData);

    // Libellés FR
    return [
      { name: "Concurrence connue", value: withComp },
      { name: "KVI", value: withKVI },
      { name: "Faible élasticité", value: lowData },
      { name: "OK", value: ok },
    ];
  }, [products]);

  // === [ANCHOR: DATA HEALTH %] ===============================================
  const dataHealthPct = React.useMemo(() => {
    const total = products.length || 0;
    if (!total) return 0;
    const ok = dataHealth.find((d) => d.name === "OK")?.value ?? 0;
    return (ok / total) * 100;
  }, [dataHealth, products]);

  const categoryBars = React.useMemo(() => {
    const byCat = new Map();
    for (const p of products) {
      const key = p.category || "General";
      if (!byCat.has(key))
        byCat.set(key, {
          category: key,
          kvi: 0,
          surstock: 0,
          rupture: 0,
          count: 0,
        });
      const o = byCat.get(key);
      o.count++;
      if (p.kvi) o.kvi++;
      if (p.coverDays > 60) o.surstock++;
      if (p.stockRisk > 0.5) o.rupture++;
    }
    return Array.from(byCat.values())
      .map((o) => ({
        category: o.category,
        KVI: o.kvi,
        Surstock: o.surstock,
        Rupture: o.rupture,
      }))
      .sort(
        (a, b) =>
          b.KVI + b.Surstock + b.Rupture - (a.KVI + a.Surstock + a.Rupture)
      );
  }, [products]);

  // === [ANCHOR: ACTIONS] ====================================================
  function recomputeImpacts(p, newPrice) {
    const { a, b } = linearDemandParamsFromElasticity(p.price, p.last_qty, p.e);
    const Qstar = Math.max(0, a + b * newPrice);
    const rev0 = p.price * p.last_qty;
    const revStar = newPrice * Qstar;
    const margin0 = (p.price - p.unit_cost) * p.last_qty;
    const marginStar = (newPrice - p.unit_cost) * Qstar;
    return {
      suggestedPrice: Number(newPrice.toFixed(2)),
      deltaRev: safeFinite(revStar - rev0, 0),
      deltaMargin: safeFinite(marginStar - margin0, 0),
      qStar: Qstar,
    };
  }
  function nudgePrice(p, pct) {
    // Guard: ensure valid product
    if (!p || !Number.isFinite(p.suggestedPrice)) return;

    setProducts((prev) => {
      const next = prev.map((x) => {
        if (x.sku !== p.sku) return x;

        // respect guardrails
        const cl = clampWithReason(
          p.suggestedPrice * (1 + pct),
          {
            P0: p.price,
            c: p.unit_cost,
            kvi: p.kvi,
            competitor_price: p.competitor_price,
          },
          cfg
        );
        const upd = recomputeImpacts(p, cl.P);
        return { ...x, ...upd, applied: false };
      });

      return next;
    });

    // keep selection stable
    setSelected(p.sku);

    // optional audit (safe if Part 2 not installed)
    try {
      typeof logAudit === "function" &&
        logAudit("nudge_price", { sku: p.sku, pct });
    } catch (_) {}
  }

  function applySuggested(p) {
    if (!p || !Number.isFinite(p.suggestedPrice)) return;

    setProducts((prev) => {
      const next = prev.map((x) => {
        if (x.sku !== p.sku) return x;

        const gainRev = Number.isFinite(p.deltaRev) ? p.deltaRev : 0;
        const gainMrg = Number.isFinite(p.deltaMargin) ? p.deltaMargin : 0;

        // Rebuild curve around the NEW current price (we "apply" P*)
        const newCurve = buildProfitCurveLinear({
          P0: p.suggestedPrice,
          Q0: p.last_qty,
          c: p.unit_cost,
          e: p.e,
        });

        // After applying, deltas become 0 (since the new current price is P*)
        return {
          ...x,
          price: p.suggestedPrice,
          appliedRev: (x.appliedRev || 0) + gainRev,
          appliedMargin: (x.appliedMargin || 0) + gainMrg,
          deltaRev: 0,
          deltaMargin: 0,
          curve: newCurve,
          applied: true,
        };
      });

      return next;
    });

    // keep selection stable
    setSelected(p.sku);

    // optional audit (safe if Part 2 not installed)
    try {
      typeof logAudit === "function" &&
        logAudit("apply_suggested", { sku: p.sku, to: p.suggestedPrice });
    } catch (_) {}
  }

  function exportPlanCSV() {
    const rows = products.map((p) => ({
      sku: p.sku,
      name: p.name,
      current_price: p.price,
      suggested_price: p.suggestedPrice,
      unit_cost: p.unit_cost,
      elasticity: p.e,
      competitor_price: p.competitor_price || "",
      price_index: p.price_index || "",
      stock_on_hand: p.stock_on_hand,
      cover_days: p.coverDays,
      priority: p.priority,
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pricing_plan.csv";
    a.click();
    logAudit("export_plan_csv", { rows: products.length });
    URL.revokeObjectURL(url);
  }
  // === [ANCHOR: PART2 HELPERS / STATE] =======================================
  // États additionnels
  const [audit, setAudit] = React.useState([]);
  const [experiments, setExperiments] = React.useState([]); // {id, sku, pct, start, end, status}
  const [portfolioTarget, setPortfolioTarget] = React.useState(3000); // € marge à atteindre
  const [safetyDays, setSafetyDays] = React.useState(14); // stock de sécurité (jours)
  const [mcRuns, setMcRuns] = React.useState(400); // itérations Monte Carlo

  // Util: log d’audit
  function logAudit(event, detail) {
    setAudit((prev) => [
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ts: new Date().toISOString(),
        event,
        detail,
      },
      ...prev,
    ]);
  }

  // RNG ~N(0,1) simple (Box-Muller)
  function randn() {
    let u = 0,
      v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  // Monte Carlo: bandes d’incertitude pour un produit sélectionné
  function computeUncertaintyBands(p, n = 400) {
    if (!p?.curve?.meta) return null;
    const { P0, Q0, c, e } = p.curve.meta;
    const prices = p.curve.map((d) => d.price);

    const profits = prices.map(() => []);
    const revenues = prices.map(() => []);
    const margins = prices.map(() => []);

    for (let k = 0; k < n; k++) {
      // bruit sur e (~0.15) et Q0 (10%) — ajustables
      const eDraw = e + 0.15 * randn();
      const q0Draw = Math.max(0, Q0 * (1 + 0.1 * randn()));

      const b = eDraw * (q0Draw / Math.max(1e-9, P0));
      const a = q0Draw - b * P0;

      for (let i = 0; i < prices.length; i++) {
        const P = prices[i];
        const Q = Math.max(0, a + b * P);
        const rev = P * Q;
        const mrg = (P - c) * Q;
        profits[i].push(mrg);
        revenues[i].push(rev);
        margins[i].push(mrg);
      }
    }

    // P10/P50/P90
    const pct = (arr, p) => {
      const a = arr.slice().sort((x, y) => x - y);
      const idx = Math.min(
        a.length - 1,
        Math.max(0, Math.floor((p / 100) * a.length))
      );
      return a[idx];
    };

    const bands = prices.map((P, i) => ({
      price: P,
      profit_p10: pct(profits[i], 10),
      profit_p50: pct(profits[i], 50),
      profit_p90: pct(profits[i], 90),
      revenue_p10: pct(revenues[i], 10),
      revenue_p50: pct(revenues[i], 50),
      revenue_p90: pct(revenues[i], 90),
      margin_p10: pct(margins[i], 10),
      margin_p50: pct(margins[i], 50),
      margin_p90: pct(margins[i], 90),
    }));
    return bands;
  }

  // Greedy micro-pas portefeuille vers objectif (€ de marge)
  // On pousse chaque SKU par incrément ±1% vers son Prix* (selon gain de marge le plus élevé)
  // tout en respectant les guardrails.
  function optimizePortfolioGreedy(targetEuro = 3000, stepPct = 0.01) {
    let remaining = targetEuro;
    const maxIterations = 500; // borne de sécurité
    let iter = 0;

    setProducts((prev) => {
      let productsCopy = prev.map((p) => ({ ...p }));
      while (remaining > 50 && iter < maxIterations) {
        iter++;

        // Pour chaque SKU: calcule un pas dans la bonne direction (vers suggestedPrice)
        let bestGain = 0;
        let bestIdx = -1;
        let bestNew = null;

        for (let i = 0; i < productsCopy.length; i++) {
          const p = productsCopy[i];
          // direction vers P*
          const dir = p.suggestedPrice > p.price ? +1 : -1;
          const trialRaw = p.price * (1 + dir * stepPct);

          // Clamp guardrails
          const cl = clampWithReason(
            trialRaw,
            {
              P0: p.price,
              c: p.unit_cost,
              kvi: p.kvi,
              competitor_price: p.competitor_price,
            },
            makeCfg(aggr, objective)
          );

          // Si le clamp ne change pas => pas utile
          if (Math.abs(cl.P - p.price) < 0.001) continue;

          // Gain de marge estimé sur micro-pas
          const { a, b } = linearDemandParamsFromElasticity(
            p.price,
            p.last_qty,
            p.e
          );
          const Qold = Math.max(0, a + b * p.price);
          const Qnew = Math.max(0, a + b * cl.P);
          const mOld = (p.price - p.unit_cost) * Qold;
          const mNew = (cl.P - p.unit_cost) * Qnew;
          const gain = mNew - mOld;

          if (gain > bestGain) {
            bestGain = gain;
            bestIdx = i;
            bestNew = cl.P;
          }
        }

        if (bestIdx < 0 || !bestNew) break; // plus de gains

        // Applique le meilleur micro-pas
        const p = productsCopy[bestIdx];
        const { a, b } = linearDemandParamsFromElasticity(
          p.price,
          p.last_qty,
          p.e
        );
        const Qold = Math.max(0, a + b * p.price);
        const Qnew = Math.max(0, a + b * bestNew);
        const mOld = (p.price - p.unit_cost) * Qold;
        const mNew = (bestNew - p.unit_cost) * Qnew;
        const deltaM = mNew - mOld;

        p.price = Number(bestNew.toFixed(2));
        p.appliedMargin = (p.appliedMargin || 0) + deltaM;
        // Rebuild courbe autour du nouveau prix de référence
        p.curve = buildProfitCurveLinear({
          P0: p.price,
          Q0: p.last_qty,
          c: p.unit_cost,
          e: p.e,
        });

        remaining -= deltaM;
      }

      logAudit("portfolio_optimize", {
        target: targetEuro,
        achieved: targetEuro - remaining,
        iterations: iter,
      });

      return productsCopy.map((x) => {
        // Recalculer deltas vs nouveau P0 (pour afficher le potentiel restant)
        const upd = ((p) => {
          const { a, b } = linearDemandParamsFromElasticity(
            p.price,
            p.last_qty,
            p.e
          );
          const Qstar = Math.max(0, a + b * p.suggestedPrice);
          const rev0 = p.price * p.last_qty;
          const revStar = p.suggestedPrice * Qstar;
          const margin0 = (p.price - p.unit_cost) * p.last_qty;
          const marginStar = (p.suggestedPrice - p.unit_cost) * Qstar;
          return {
            ...p,
            deltaRev: safeFinite(revStar - rev0, 0),
            deltaMargin: safeFinite(marginStar - margin0, 0),
          };
        })(x);
        return upd;
      });
    });
  }

  // Plan de réassort piloté par Prix* : calcule, pour chaque SKU, la quantité à commander
  // pour couvrir (lead_time + safetyDays) en jours, à partir de la demande prédite à Prix*.
  function buildReplenishmentPlan() {
    const rows = products.map((p) => {
      const { a, b } = linearDemandParamsFromElasticity(
        p.price,
        p.last_qty,
        p.e
      );
      const Qstar = Math.max(0, a + b * p.suggestedPrice);
      const daily = Qstar / 90;
      const horizon = Math.max(
        0,
        Number(p.lead_time_days || 0) + Number(safetyDays || 0)
      );
      const need = Math.max(0, daily * horizon - Number(p.stock_on_hand || 0));
      const orderQty = Math.ceil(Math.max(0, need));
      const orderCost = orderQty * p.unit_cost;
      return {
        sku: p.sku,
        name: p.name,
        horizon_days: horizon,
        order_qty: orderQty,
        order_cost: orderCost,
        unit_cost: p.unit_cost,
      };
    });

    // Export CSV
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "replenishment_plan.csv";
    a.click();
    URL.revokeObjectURL(url);

    logAudit("replenishment_export", { items: rows.length, safetyDays });
  }

  // Expérimentations: ajout d’un test ±X% pour un SKU
  function scheduleExperiment(sku, pct = 0.05, days = 14) {
    const start = new Date();
    const end = new Date(start.getTime() + days * 24 * 3600 * 1000);
    const exp = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sku,
      pct,
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      status: "scheduled",
    };
    setExperiments((prev) => [exp, ...prev]);
    logAudit("experiment_schedule", exp);
  }
  // === [ANCHOR: PORTFOLIO CURVE HELPERS] =====================================
  // Courbe portefeuille Revenue/Margin/Score en fonction d'un 'global tilt' (θ)
  // θ = variation globale des prix en %, bornée par cfg.maxChangePct (pilotée par l'agressivité)
  const [portfolioCurve, setPortfolioCurve] = React.useState([]);
  const [bestTheta, setBestTheta] = React.useState(0); // en %

  function computePortfolioCurveData(list, cfg) {
    if (!Array.isArray(list) || !list.length)
      return { curve: [], bestTheta: 0 };
    const step = 0.01; // 1% pas
    const max = Math.max(0.01, Math.min(0.35, cfg.maxChangePct)); // borne sécu
    const arr = [];

    for (let t = -max; t <= max + 1e-9; t += step) {
      let revenueSum = 0,
        marginSum = 0,
        scoreSum = 0;

      for (const p of list) {
        // Prix candidat = P0 * (1 + θ), clampé par garde-fous (KVI, Δ max, concurrence, marge)
        const cl = clampWithReason(
          p.price * (1 + t),
          {
            P0: p.price,
            c: p.unit_cost,
            kvi: p.kvi,
            competitor_price: p.competitor_price,
          },
          cfg
        );

        // Demande locale (autour de P0, Q0, e)
        const { a, b } = linearDemandParamsFromElasticity(
          p.price,
          p.last_qty,
          p.e
        );
        const Q = Math.max(0, a + b * cl.P);
        const rev = cl.P * Q;
        const mrg = (cl.P - p.unit_cost) * Q;

        revenueSum += rev;
        marginSum += mrg;

        // Score multi-critères (pénalités stock & concurrence déjà gérées ici)
        const det = scoreAtPrice(
          cl.P,
          {
            a,
            b,
            c: p.unit_cost,
            competitor_price: p.competitor_price,
            kvi: p.kvi,
            lead_time_days: p.lead_time_days,
            stock_on_hand: p.stock_on_hand,
          },
          cfg
        );
        scoreSum += det.score;
      }

      arr.push({
        theta: +(t * 100).toFixed(1), // en %
        revenue: revenueSum,
        margin: marginSum,
        score: scoreSum,
      });
    }

    // Meilleur θ par score (fonction de l'objectif choisi)
    let bestIdx = 0,
      bestScore = -Infinity;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].score > bestScore) {
        bestScore = arr[i].score;
        bestIdx = i;
      }
    }
    return { curve: arr, bestTheta: arr[bestIdx]?.theta ?? 0 };
  }

  // Recalcul automatique de la courbe quand données/réglages changent
  React.useEffect(() => {
    if (!products.length) {
      setPortfolioCurve([]);
      setBestTheta(0);
      return;
    }
    const { curve, bestTheta } = computePortfolioCurveData(products, cfg);
    setPortfolioCurve(curve);
    setBestTheta(bestTheta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    products,
    cfg.maxChangePct,
    cfg.minMarginPct,
    cfg.kviMaxUpPct,
    cfg.lambda,
    cfg.alpha,
    cfg.beta,
    cfg.charm,
  ]);

  // === [ANCHOR: RENDER] =====================================================
  return (
    <section
      id="pricing"
      className="py-10 min-h-screen bg-white text-gray-900 dark:bg-transparent dark:text-white"
    >
      <div className="w-full px-4 lg:px-6">
        {/* === HEADER & GLOBAL CONTROLS ===================================== */}
        <header className="mb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Pricing Optimizer
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 max-w-3xl">
                Calcule un <b>Prix conseillé (Prix*)</b> par article, avec{" "}
                <b>garde-fous</b>, <b>élasticité</b>, <b>concurrence KVI</b>, et{" "}
                <b>risques stock</b>. Applique ligne par ligne ou en lot.
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-3 bg-gray-50/70 dark:bg-white/5 shadow-sm">
              <div className="text-xs text-gray-500 mb-1">Réglages globaux</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  className="px-2 py-2 rounded-xl border text-sm"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  title="Objectif du score multi-critères"
                >
                  <option value="balanced">Équilibré</option>
                  <option value="margin">Priorité Marge</option>
                  <option value="revenue">Priorité CA</option>
                </select>
                <label className="text-sm">Agressivité {aggr}%</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={aggr}
                  onChange={(e) => setAggr(Number(e.target.value))}
                />
                <label className="inline-flex items-center px-3 py-2 rounded-xl border cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files?.[0] && onUpload(e.target.files[0])
                    }
                  />
                  Importer CSV
                </label>
                <button
                  onClick={exportPlanCSV}
                  disabled={!products.length}
                  className="px-3 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
                >
                  Exporter le plan
                </button>
              </div>
              <div className="text-[11px] text-gray-500 mt-2">
                Guardrails · Δ max: <b>{nf1.format(cfg.maxChangePct * 100)}%</b>{" "}
                · KVI cap: <b>{nf1.format(cfg.kviMaxUpPct * 100)}%</b> · Min
                marge: <b>{nf1.format(cfg.minMarginPct * 100)}%</b> · Charm .99:{" "}
                <b>{cfg.charm ? "ON" : "OFF"}</b>
              </div>
            </div>
          </div>
        </header>

        {/* === QUICK WINS & HEALTH ========================================= */}
        {!!products.length && (
          <motion.div
            className="mb-5 grid grid-cols-12 gap-4 items-stretch"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            {/* KPI */}
            <div className="col-span-12 lg:col-span-7 grid grid-cols-12 gap-3">
              {/* Carte 1 — Mini courbe portefeuille */}
              <div className="col-span-12 lg:col-span-6 rounded-2xl border px-5 py-5 bg-gradient-to-br from-indigo-50 via-white to-white dark:from-indigo-950/30 dark:via-transparent dark:to-transparent shadow-md hover:shadow-xl transition-all duration-500">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Performance portefeuille
                  </div>
                  <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    Live
                  </div>
                </div>
                <div className="mt-3 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={portfolioCurve}>
                      <defs>
                        <linearGradient
                          id="gradPerf"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#6366f1"
                            stopOpacity={0.4}
                          />
                          <stop
                            offset="95%"
                            stopColor="#6366f1"
                            stopOpacity={0.05}
                          />
                        </linearGradient>
                      </defs>
                      <Area
                        dataKey="revenue"
                        stroke="#6366f1"
                        fill="url(#gradPerf)"
                      />
                      <Tooltip
                        formatter={(v) => nf0.format(Math.round(v)) + " €"}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Carte 2 — θ* + barre de progression */}
              <div className="col-span-6 lg:col-span-3 rounded-2xl border px-5 py-5 bg-gradient-to-br from-emerald-50 via-white to-white dark:from-emerald-950/30 dark:via-transparent dark:to-transparent shadow-md hover:shadow-xl transition-all duration-500">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  Ajustement optimal (θ*)
                </div>
                <div className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {nf1.format(bestTheta)}%
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  Ajustement global recommandé
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.abs(bestTheta))}%` }}
                  />
                </div>
              </div>

              {/* Carte 3 — Indice de qualité des données */}
              <div className="col-span-6 lg:col-span-3 rounded-2xl border px-5 py-5 bg-gradient-to-br from-amber-50 via-white to-white dark:from-amber-950/30 dark:via-transparent dark:to-transparent shadow-md hover:shadow-xl transition-all duration-500">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  Indice de qualité des données
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-4xl font-extrabold text-amber-500 dark:text-amber-400">
                    {nf1.format(dataHealthPct)}%
                  </div>
                  <PieChart width={70} height={70}>
                    <Pie
                      data={dataHealth}
                      dataKey="value"
                      innerRadius={20}
                      outerRadius={30}
                    >
                      {dataHealth.map((e, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </div>
              </div>
            </div>
            {/* Data Health & Category bars */}
            <div className="col-span-12 lg:col-span-5 grid grid-cols-5 gap-3">
              <div className="col-span-2 rounded-2xl border px-3 py-3 bg-white/70 dark:bg-white/5 shadow-sm">
                <div className="text-xs text-gray-500 mb-1">
                  Qualité des données
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        dataKey="value"
                        data={dataHealth}
                        innerRadius={34}
                        outerRadius={60}
                        paddingAngle={2}
                      >
                        {dataHealth.map((e, i) => (
                          <Cell key={e.name} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend verticalAlign="bottom" height={24} />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="col-span-3 rounded-2xl border px-3 py-3 bg-white/70 dark:bg-white/5 shadow-sm">
                <div className="text-xs text-gray-500 mb-1">
                  Points d’attention par catégorie
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryBars}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="KVI" stackId="a" />
                      <Bar dataKey="Surstock" stackId="a" />
                      <Bar dataKey="Rupture" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        {/* === FILTERS ====================================================== */}
        {!!products.length && (
          <div className="mb-4 flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Rechercher SKU/Produit…"
                className="px-3 py-2 rounded-xl border w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select
                className="px-3 py-2 rounded-xl border"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="priorityDesc">Priorité ↓</option>
                <option value="deltaMarginDesc">Δ Marge ↓</option>
                <option value="deltaRevDesc">Δ CA ↓</option>
                <option value="elasticityAsc">|e| ↑</option>
              </select>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border">
                <input
                  type="checkbox"
                  checked={onlyActionables}
                  onChange={(e) => setOnlyActionables(e.target.checked)}
                />
                À faire en priorité
              </label>
            </div>
            <button
              className="px-3 py-2 rounded-xl border bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={() => {
                const rows = sampleRows();
                setProducts(rows.map((r) => mapRow(r, cfg)));
                setSelected(rows[0].sku);
              }}
            >
              Charger un exemple
            </button>
          </div>
        )}

        {/* === OVERVIEW — Vue générale portefeuille ======================== */}
        <div className="mt-4">
          {/* Courbe CA global (avec marge en overlay) contrôlée par objectif & agressivité */}
          <div className="rounded-2xl border p-4 bg-white/70 dark:bg-white/5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">
                  Courbe portefeuille — Revenu global
                </div>
                <div className="text-xs text-gray-500">
                  Variation globale des prix (θ) bornée par l’<b>agressivité</b>
                  . La position optimale dépend de l’<b>objectif</b>.
                </div>
              </div>
              <div className="text-right text-xs text-gray-600 dark:text-gray-400">
                Meilleur θ (score) : <b>{bestTheta}%</b>
              </div>
            </div>

            <div className="h-64 mt-3 rounded-xl border bg-white/60 dark:bg-white/5">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={portfolioCurve}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                      <stop
                        offset="95%"
                        stopColor="#2563eb"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="theta" tickFormatter={(v) => `${v}%`} />
                  <YAxis />
                  <Tooltip
                    formatter={(v, n) =>
                      n === "revenue" || n === "margin"
                        ? `${nf0.format(Math.round(v))} €`
                        : v
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="CA"
                    stroke="#2563eb"
                    fill="url(#revGrad)"
                  />
                  <Line
                    type="monotone"
                    dataKey="margin"
                    name="Marge"
                    dot={false}
                  />
                  {/* Références : 0% et meilleur θ */}
                  <ReferenceLine
                    x={0}
                    stroke="#94a3b8"
                    strokeDasharray="3 3"
                    label="0%"
                  />
                  <ReferenceLine
                    x={bestTheta}
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    label="θ*"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* KPIs portefeuille au point optimal */}
            {(() => {
              if (!portfolioCurve.length) return null;
              const best = portfolioCurve.reduce(
                (a, b) => (b.score > a.score ? b : a),
                portfolioCurve[0]
              );
              const base = portfolioCurve.find((d) => +d.theta === 0) || {
                revenue: 0,
                margin: 0,
              };
              const dRev = best.revenue - base.revenue;
              const dMrg = best.margin - base.margin;
              return (
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-xl border px-4 py-3">
                    <div className="text-[11px] text-gray-500">
                      CA au meilleur θ
                    </div>
                    <div className="text-lg font-bold">
                      {nf0.format(Math.round(best.revenue))} €
                    </div>
                  </div>
                  <div className="rounded-xl border px-4 py-3">
                    <div className="text-[11px] text-gray-500">
                      Marge au meilleur θ
                    </div>
                    <div className="text-lg font-bold">
                      {nf0.format(Math.round(best.margin))} €
                    </div>
                  </div>
                  <div className="rounded-xl border px-4 py-3">
                    <div className="text-[11px] text-gray-500">Δ CA vs 0%</div>
                    <div
                      className={`text-lg font-bold ${
                        dRev >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {nf0.format(Math.round(dRev))} €
                    </div>
                  </div>
                  <div className="rounded-xl border px-4 py-3">
                    <div className="text-[11px] text-gray-500">
                      Δ Marge vs 0%
                    </div>
                    <div
                      className={`text-lg font-bold ${
                        dMrg >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {nf0.format(Math.round(dMrg))} €
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Liste générale des produits (sans actions, pour contexte) */}
          {!!products.length && (
            <div className="mt-5 rounded-2xl border bg-white/70 dark:bg-white/5 shadow-sm overflow-hidden">
              <div className="border-b px-4 py-3 text-sm text-gray-600 dark:text-gray-300 bg-gray-50/60 dark:bg-white/5">
                Produits — vue générale (sans actions)
              </div>
              <div className="max-h-[50vh] overflow-auto">
                <table className="min-w-full text-sm tabular-nums">
                  <thead className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-900/80 backdrop-blur">
                    <tr className="text-gray-600 dark:text-gray-300">
                      <th className="p-3 text-left">SKU</th>
                      <th className="p-3 text-left">Produit</th>
                      <th className="p-3 text-left">Catégorie</th>
                      <th className="p-3 text-right">Prix</th>
                      <th className="p-3 text-right">Coût</th>
                      <th className="p-3 text-right">Qté 90j</th>
                      <th className="p-3 text-right">e</th>
                      <th className="p-3 text-right">KVI</th>
                      <th className="p-3 text-right">Conc.</th>
                      <th className="p-3 text-right">Stock (jours)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((p) => (
                      <tr
                        key={p.sku}
                        className="border-t odd:bg-gray-50/40 dark:odd:bg-white/5"
                      >
                        <td className="p-3">{p.sku}</td>
                        <td className="p-3">{p.name}</td>
                        <td className="p-3">{p.category}</td>
                        <td className="p-3 text-right">
                          {nf2.format(p.price)}
                        </td>
                        <td className="p-3 text-right">
                          {nf2.format(p.unit_cost)}
                        </td>
                        <td className="p-3 text-right">
                          {nf0.format(p.last_qty)}
                        </td>
                        <td className="p-3 text-right">{p.e}</td>
                        <td className="p-3 text-right">
                          {p.kvi ? "Oui" : "Non"}
                        </td>
                        <td className="p-3 text-right">
                          {p.price_index ? (
                            p.price_index > 1.03 ? (
                              <span className="text-rose-600 text-xs">
                                +
                                {nf0.format(
                                  Math.round((p.price_index - 1) * 100)
                                )}
                                %
                              </span>
                            ) : (
                              <span className="text-emerald-700 text-xs">
                                OK
                              </span>
                            )
                          ) : (
                            <span className="text-gray-400 text-xs">n/a</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {p.coverDays ? `${p.coverDays} j` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* === ADVANCED CHARTS (sélection) ======================================== */}
        {sel && (
          <div className="mt-6 grid grid-cols-12 gap-6">
            <div className="col-span-12 xl:col-span-8 rounded-2xl border p-4 bg-white/70 dark:bg-white/5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">
                    Analyse avancée — {sel.sku}
                  </div>
                  <div className="text-lg font-semibold">{sel.name}</div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600">
                    Monte Carlo runs
                  </label>
                  <input
                    type="number"
                    min={100}
                    max={2000}
                    className="w-24 px-2 py-1 rounded-xl border"
                    value={mcRuns}
                    onChange={(e) => setMcRuns(Number(e.target.value))}
                  />
                </div>
              </div>

              {(() => {
                const bands = computeUncertaintyBands(sel, mcRuns) || [];
                // Merge bands (P10/P50/P90) avec la courbe déterministe existante
                const merged = sel.curve.map((d) => {
                  const b = bands.find(
                    (x) =>
                      Number(x.price.toFixed(2)) === Number(d.price.toFixed(2))
                  );
                  return { ...d, ...(b || {}) };
                });
                return (
                  <>
                    {/* PROFIT with bands */}
                    <div className="mt-3">
                      <div className="text-xs text-gray-500 mb-1">
                        Profit vs Prix — avec bandes P10/P50/P90
                      </div>
                      <div className="h-56 rounded-xl border bg-white/60 dark:bg-white/5">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={merged}>
                            <defs>
                              <linearGradient
                                id="gBandLow"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor="#0ea5e9"
                                  stopOpacity={0.35}
                                />
                                <stop
                                  offset="95%"
                                  stopColor="#0ea5e9"
                                  stopOpacity={0.02}
                                />
                              </linearGradient>
                              <linearGradient
                                id="gBandMid"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor="#16a34a"
                                  stopOpacity={0.4}
                                />
                                <stop
                                  offset="95%"
                                  stopColor="#16a34a"
                                  stopOpacity={0.02}
                                />
                              </linearGradient>
                              <linearGradient
                                id="gBandHigh"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor="#f59e0b"
                                  stopOpacity={0.3}
                                />
                                <stop
                                  offset="95%"
                                  stopColor="#f59e0b"
                                  stopOpacity={0.02}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="price" />
                            <YAxis />
                            <Tooltip />
                            {/* Bands */}
                            <Area
                              type="monotone"
                              dataKey="profit_p10"
                              stroke="#0ea5e9"
                              fill="url(#gBandLow)"
                            />
                            <Area
                              type="monotone"
                              dataKey="profit_p50"
                              stroke="#16a34a"
                              fill="url(#gBandMid)"
                            />
                            <Area
                              type="monotone"
                              dataKey="profit_p90"
                              stroke="#f59e0b"
                              fill="url(#gBandHigh)"
                            />
                            {/* Reference lines */}
                            <ReferenceLine
                              x={sel.price}
                              stroke="#2563eb"
                              strokeDasharray="3 3"
                              label="P0"
                            />
                            <ReferenceLine
                              x={sel.suggestedPrice}
                              stroke="#f59e0b"
                              strokeDasharray="3 3"
                              label="P*"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* REVENUE line & MARGIN line */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border bg-white/60 dark:bg-white/5 h-56 p-2">
                        <div className="text-xs text-gray-500 pl-2">
                          CA (Revenue) vs Prix — médiane
                        </div>
                        <ResponsiveContainer width="100%" height="90%">
                          <LineChart data={merged}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="price" />
                            <YAxis />
                            <Tooltip />
                            <Line
                              type="monotone"
                              dataKey="revenue_p50"
                              dot={false}
                            />
                            <ReferenceLine
                              x={sel.price}
                              stroke="#2563eb"
                              strokeDasharray="3 3"
                            />
                            <ReferenceLine
                              x={sel.suggestedPrice}
                              stroke="#f59e0b"
                              strokeDasharray="3 3"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="rounded-xl border bg-white/60 dark:bg-white/5 h-56 p-2">
                        <div className="text-xs text-gray-500 pl-2">
                          Marge vs Prix — médiane
                        </div>
                        <ResponsiveContainer width="100%" height="90%">
                          <LineChart data={merged}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="price" />
                            <YAxis />
                            <Tooltip />
                            <Line
                              type="monotone"
                              dataKey="margin_p50"
                              dot={false}
                            />
                            <ReferenceLine
                              x={sel.price}
                              stroke="#2563eb"
                              strokeDasharray="3 3"
                            />
                            <ReferenceLine
                              x={sel.suggestedPrice}
                              stroke="#f59e0b"
                              strokeDasharray="3 3"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* ACTIONS latérales — Optimiseur, Réassort, Expérimentation */}
            <div className="col-span-12 xl:col-span-4 grid grid-cols-1 gap-4">
              {/* Optimiseur portefeuille */}
              <div className="rounded-2xl border p-4 bg-white/70 dark:bg-white/5 shadow-sm">
                <div className="text-sm font-semibold">
                  Optimiser le portefeuille
                </div>
                <div className="text-xs text-gray-500">
                  Micro-pas ±1% vers Prix* en respectant les garde-fous (KVI, Δ
                  max, concurrence).
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <label className="text-sm">Objectif marge (€)</label>
                  <input
                    type="number"
                    className="w-28 px-3 py-2 rounded-xl border"
                    value={portfolioTarget}
                    onChange={(e) => setPortfolioTarget(Number(e.target.value))}
                    min={500}
                    step={100}
                  />
                  <button
                    className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => optimizePortfolioGreedy(portfolioTarget)}
                    title="Distribuer des micro-pas jusqu’à atteindre l’objectif"
                  >
                    Lancer
                  </button>
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  Agressivité actuelle : <b>{aggr}%</b> • Objectif :{" "}
                  <b>{objective}</b>
                </div>
              </div>

              {/* Réassort */}
              <div className="rounded-2xl border p-4 bg-white/70 dark:bg-white/5 shadow-sm">
                <div className="text-sm font-semibold">Plan de réassort</div>
                <div className="text-xs text-gray-500">
                  Calcule la couverture (lead + sécurité) à partir de la demande
                  à Prix*.
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <label className="text-sm">Stock sécurité (jours)</label>
                  <input
                    type="number"
                    className="w-24 px-3 py-2 rounded-xl border"
                    value={safetyDays}
                    onChange={(e) => setSafetyDays(Number(e.target.value))}
                    min={0}
                    max={60}
                  />
                  <button
                    className="px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                    onClick={buildReplenishmentPlan}
                    title="Exporter le CSV réassort"
                  >
                    Exporter CSV
                  </button>
                </div>
              </div>

              {/* Expérimentation */}
              <div className="rounded-2xl border p-4 bg-white/70 dark:bg-white/5 shadow-sm">
                <div className="text-sm font-semibold">Expérimentation</div>
                <div className="text-xs text-gray-500">
                  Planifie un test de prix contrôlé sur un SKU.
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500">SKU</label>
                    <input
                      className="w-full px-3 py-2 rounded-xl border"
                      value={sel?.sku || ""}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Δ prix (%)</label>
                    <select
                      id="expDelta"
                      className="w-full px-3 py-2 rounded-xl border"
                    >
                      <option value="0.05">+5%</option>
                      <option value="-0.05">-5%</option>
                      <option value="0.08">+8%</option>
                      <option value="-0.08">-8%</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">
                      Durée (jours)
                    </label>
                    <select
                      id="expDays"
                      className="w-full px-3 py-2 rounded-xl border"
                    >
                      <option value="14">14</option>
                      <option value="21">21</option>
                      <option value="28">28</option>
                    </select>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button
                      className="px-3 py-2 rounded-xl bg-black text-white hover:bg-gray-800"
                      onClick={() => {
                        const pct = Number(
                          document.getElementById("expDelta")?.value || 0.05
                        );
                        const days = Number(
                          document.getElementById("expDays")?.value || 14
                        );
                        scheduleExperiment(sel.sku, pct, days);
                      }}
                    >
                      Programmer le test
                    </button>
                  </div>
                </div>
                {/* Liste courte */}
                {experiments.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-1">
                      Tests programmés
                    </div>
                    <div className="max-h-40 overflow-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="p-2 text-left">SKU</th>
                            <th className="p-2 text-right">Δ%</th>
                            <th className="p-2 text-left">Début</th>
                            <th className="p-2 text-left">Fin</th>
                            <th className="p-2 text-left">Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {experiments.map((e) => (
                            <tr key={e.id} className="border-t">
                              <td className="p-2">{e.sku}</td>
                              <td className="p-2 text-right">
                                {(e.pct * 100).toFixed(0)}%
                              </td>
                              <td className="p-2">{e.start}</td>
                              <td className="p-2">{e.end}</td>
                              <td className="p-2">{e.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* === AUDIT / JOURNAL ===================================================== */}
        <div className="mt-6 rounded-2xl border p-4 bg-white/70 dark:bg-white/5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Journal / Audit</div>
            <div className="text-xs text-gray-500">
              Actions récentes (appliquer, optimiser, exporter, expérimenter)
            </div>
          </div>
          {audit.length === 0 ? (
            <div className="text-sm text-gray-500 mt-2">
              Aucun événement pour l’instant.
            </div>
          ) : (
            <div className="mt-2 max-h-60 overflow-auto">
              <table className="min-w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-gray-500">
                    <th className="p-2 text-left">Horodatage</th>
                    <th className="p-2 text-left">Événement</th>
                    <th className="p-2 text-left">Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="p-2">
                        {a.ts.replace("T", " ").slice(0, 19)}
                      </td>
                      <td className="p-2">{a.event}</td>
                      <td className="p-2">
                        <pre className="whitespace-pre-wrap break-words text-[11px]">
                          {JSON.stringify(a.detail, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// END OF PART 1/2 — The second half will extend from the placeholder above.
// ============================================================================
