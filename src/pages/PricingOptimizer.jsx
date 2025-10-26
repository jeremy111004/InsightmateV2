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
import { useTranslation, Trans } from "react-i18next";

// === [ANCHOR: THEME / UTILITIES] ============================================
function deriveLocale(lng) {
  if (!lng) return "en-US";
  const l = String(lng).toLowerCase();
  if (l.startsWith("fr")) return "fr-FR";
  if (l.startsWith("es")) return "es-ES";
  return "en-US";
}

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

// === i18n SAFE DEFAULTS (prevents missing-key issues) =======================
const I18N_DEFAULTS = {
  "pricing:title": "Pricing Optimizer",
  "pricing:subtitle":
    "Calcule un <b>Prix conseillé (Prix*)</b> par article, avec <b>garde-fous</b>, <b>élasticité</b>, <b>concurrence KVI</b>, et <b>risques stock</b>. Applique ligne par ligne ou en lot.",
  "pricing.globalSettings": "Réglages globaux",
  "pricing.objectiveTitle": "Objectif du score multi-critères",
  "pricing.objective.balanced": "Équilibré",
  "pricing.objective.margin": "Priorité Marge",
  "pricing.objective.revenue": "Priorité CA",
  "pricing.aggressiveness": "Agressivité",
  "pricing.importCsv": "Importer CSV",
  "pricing.exportPlan": "Exporter le plan",
  "pricing.guardrailsLabel": "Guardrails",
  "pricing.deltaMax": "Δ max",
  "pricing.kviCap": "Cap KVI",
  "pricing.minMargin": "Marge min.",
  "pricing.charm99": ".99",
  "pricing.portfolioPerformance": "Performance portefeuille",
  "pricing.revenue": "Chiffre d’affaires",
  "pricing.optimalAdjustment": "Ajustement optimal θ*",
  "pricing.optimalAdjustmentHint": "Ajustement global selon l’objectif",
  "pricing.dataQualityIndex": "Indice qualité des données",
  "pricing.health.knownCompetition": "Concurrence connue",
  "pricing.health.kvi": "KVI",
  "pricing.health.lowElasticity": "Élasticité faible / données faibles",
  "pricing.health.ok": "OK",
  "pricing.dataQuality": "Qualité des données",
  "pricing.categoryAttention": "Catégories à surveiller",
  "pricing.category.overstock": "Surstock",
  "pricing.category.stockout": "Rupture",
  "pricing.searchPlaceholder": "Rechercher SKU/nom…",
  "pricing.sort.priorityDesc": "Tri : priorité",
  "pricing.sort.deltaMarginDesc": "Tri : Δ marge",
  "pricing.sort.deltaRevDesc": "Tri : Δ CA",
  "pricing.sort.elasticityAsc": "Tri : |élasticité|",
  "pricing.onlyActionables": "Seulement actionnables",
  "pricing.loadExample": "Charger un exemple",
  "pricing.portfolioCurve.title": "Courbe portefeuille (θ)",
  "pricing.portfolioCurve.subtitle":
    "Variation globale des prix (θ) bornée par l’agressivité. La position optimale dépend de l’objectif.",
  "pricing.bestTheta": "Meilleur θ",
  "pricing.ca": "CA",
  "pricing.margin": "Marge",
  "pricing.kpi.caAtBest": "CA au meilleur θ",
  "pricing.kpi.marginAtBest": "Marge au meilleur θ",
  "pricing.kpi.deltaCaVsZero": "Δ CA vs θ = 0%",
  "pricing.kpi.deltaMarginVsZero": "Δ Marge vs θ = 0%",
  "pricing.productsGeneral": "Produits (vue générale)",
  "pricing.product": "Produit",
  "pricing.categoryCol": "Catégorie",
  "pricing.price": "Prix",
  "pricing.cost": "Coût",
  "pricing.qty90d": "Qté 90j",
  "pricing.compShort": "Comp.",
  "pricing.stockDays": "Jours stock",
  "pricing.advancedAnalysis": "Analyse avancée",
  "pricing.mcRuns": "Itérations MC",
  "pricing.profitWithBands": "Profit avec bandes d’incertitude",
  "pricing.profitP10": "Profit P10",
  "pricing.profitP50": "Profit P50",
  "pricing.profitP90": "Profit P90",
  "pricing.p0": "P0",
  "pricing.pStar": "P*",
  "pricing.revenueVsPriceMedian": "CA vs prix (médiane)",
  "pricing.revenueP50": "CA P50",
  "pricing.marginVsPriceMedian": "Marge vs prix (médiane)",
  "pricing.marginP50": "Marge P50",
  "pricing.optimizePortfolio": "Optimiser le portefeuille",
  "pricing.optimizePortfolioHint":
    "Micro-pas vers P* pour atteindre une cible de marge.",
  "pricing.marginTargetEuro": "Cible marge (€)",
  "pricing.launch": "Lancer",
  "pricing.currentAggressiveness": "Agressivité actuelle",
  "pricing.currentObjective": "Objectif actuel",
  "pricing.replenishmentPlan": "Plan de réassort",
  "pricing.replenishmentHint": "Couvrir lead time + stock de sécurité à P*.",
  "pricing.safetyStockDays": "Jours de sécu.",
  "pricing.exportReplenishmentCsvTitle": "Exporter CSV de réassort",
  "pricing.exportCsv": "Exporter CSV",
  "pricing.experimentation": "Expérimentation",
  "pricing.experimentationHint": "Planifier un test de prix sur un SKU.",
  "pricing.deltaPricePct": "Δ prix (%)",
  "pricing.durationDays": "Durée (jours)",
  "pricing.scheduleTest": "Programmer le test",
  "pricing.scheduledTests": "Tests programmés",
  "pricing.start": "Début",
  "pricing.end": "Fin",
  "pricing.status": "Statut",
  "pricing.auditLog": "Journal",
  "pricing.recentActions": "Actions récentes",
  "pricing.noEventsYet": "Aucun événement pour le moment.",
  "pricing.timestamp": "Horodatage",
  "pricing.event": "Événement",
  "pricing.detail": "Détail",

  // NEW for full-key coverage
  "pricing.priceStory": "Règles appliquées au prix",
  "pricing.story.costFloor": "Plancher par marge (c × (1 + marge min))",
  "pricing.story.maxDown": "Baisse max autorisée",
  "pricing.story.maxUp": "Hausse max autorisée",
  "pricing.story.kviCap": "Cap hausse KVI",
  "pricing.story.compCap": "Cap concurrence",
  "pricing.story.charm99": "Terminaison psychologique .99",
  "pricing.table.sku": "SKU",
  "pricing.table.kvi": "KVI",
  "pricing.deltaPctShort": "Δ%",
  "pricing.labels.sku": "SKU",
  "pricing.status.scheduled": "Programmé",
  "pricing.events.nudge_price": "Ajustement manuel du prix",
  "pricing.events.apply_suggested": "Application du prix suggéré",
  "pricing.events.export_plan_csv": "Export du plan (CSV)",
  "pricing.events.portfolio_optimize": "Optimisation portefeuille",
  "pricing.events.replenishment_export": "Export réassort (CSV)",
  "pricing.events.experiment_schedule": "Programmation d'un test",

  "common:live": "Live",
  "common:ok": "OK",
  "common:na": "n/a",
  "common:yes": "Oui",
  "common:no": "Non",
  "common:daysShort": "j",
};
// helper: safe translate with defaults
// replace your current useT with this
const useT = (tfn) => (key) => {
  const k = key.startsWith("pricing.")
    ? key.replace("pricing.", "pricing:")
    : key;
  return tfn(k, {
    defaultValue: I18N_DEFAULTS[key] ?? I18N_DEFAULTS[k] ?? key,
  });
};

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
    // ... (unchanged sample items)
  ];
}

// === [ANCHOR: MAPPER CSV -> PRODUCT] ========================================
function mapRow(r, cfg) {
  const sku = String(r.sku || "").trim();
  const name = String(r.name || sku || "").trim();
  const category = String(r.category || "General").trim();

  const P0 = toNum(r.price ?? r.P0 ?? r.P, 0); // <— ADD THIS
  let c = toNum(r.unit_cost ?? r.cost, NaN);
  let Q0 = toNum(r.last_90d_qty ?? r.qty ?? r.Q0, NaN);

  const missingCost = !(Number.isFinite(c) && c > 0);
  const missingQty = !(Number.isFinite(Q0) && Q0 > 0);
  const valid = Number.isFinite(P0) && P0 > 0 && !missingCost && !missingQty;

  // Soft fallbacks for display only (flagged), not for ranking
  if (missingCost) c = Math.max(0.01, P0 * 0.85);
  if (missingQty) Q0 = 1;

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

  const smart = valid
    ? bestPriceCandidate(ctx, cfg)
    : {
        suggestedPrice: P0,
        deltaRev: 0,
        deltaMargin: 0,
        stockRisk: 0,
        compPenalty: 0,
      };

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
    (smart.compPenalty > 0.5 ? 0.4 : 0) -
    (valid ? 0 : 1.5);

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
    valid,
    needsCost: missingCost,
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
function buildProfitCurveLinear(
  { P0: p0, Q0: q0, c, e },
  span = 0.35,
  steps = 41
) {
  const P0v = Number(p0) > 0 ? Number(p0) : 1;
  const Q0v = Number(q0) >= 0 ? Number(q0) : 0;

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
function buildPriceStory(p, cfg) {
  if (!p) return [];
  const p0 = Number(p?.price) || 0;
  const c = Number(p?.unit_cost) || 0;
  const steps = [];
  const floorByMargin = c * (1 + cfg.minMarginPct);
  steps.push({ key: "costFloor", value: Number(floorByMargin.toFixed(2)) });

  const floorByStep = p0 * (1 - cfg.maxChangePct);
  steps.push({ key: "maxDown", value: Number(floorByStep.toFixed(2)) });

  let low = Math.max(0.01, floorByMargin, floorByStep);
  let high = p0 * (1 + cfg.maxChangePct);

  steps.push({ key: "maxUp", value: Number(high.toFixed(2)) });

  if (p.kvi) {
    const kviCap = p0 * (1 + cfg.kviMaxUpPct);
    high = Math.min(high, kviCap);
    steps.push({ key: "kviCap", value: Number(kviCap.toFixed(2)) });
  }
  if (p.competitor_price && p.competitor_price > 0) {
    const compHigh = (p.kvi ? 1.02 : 1.05) * p.competitor_price;
    high = Math.min(high, compHigh);
    steps.push({ key: "compCap", value: Number(compHigh.toFixed(2)) });
  }
  const clamped = Math.min(Math.max(p.suggestedPrice, low), high);
  steps.push({ key: "charm99", value: charm99(clamped, cfg.charm) });
  return steps;
}

export default function PricingOptimizer() {
  const { t, i18n } = useTranslation(["pricing", "common"]);
  const locale = React.useMemo(
    () => deriveLocale(i18n.language || i18n.resolvedLanguage),
    [i18n.language, i18n.resolvedLanguage]
  );
  const nf0 = React.useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    [locale]
  );
  const nf1 = React.useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [locale]
  );
  const nf2 = React.useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale]
  );

  const tt = useT(t);

  // Global knobs
  const [aggr, setAggr] = React.useState(50); // 0..100
  const [objective, setObjective] = React.useState("balanced"); // balanced | margin | revenue
  const cfg = React.useMemo(() => makeCfg(aggr, objective), [aggr, objective]);

  // Data state
  const [products, setProducts] = React.useState([]);
  const [rawRows, setRawRows] = React.useState([]);

  const [selected, setSelected] = React.useState(null);

  // UI state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState("priorityDesc");
  const [onlyActionables, setOnlyActionables] = React.useState(false);

  React.useEffect(() => {
    if (!rawRows.length) {
      const rows = sampleRows();
      setRawRows(rows);
      setProducts(rows.map((r) => mapRow(r, cfg)));
      setSelected(rows[0].sku);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-map when cfg changes (aggr/objective)
  React.useEffect(() => {
    if (!rawRows.length) return;
    setProducts(rawRows.map((r) => mapRow(r, cfg)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rawRows,
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
        setRawRows(rows);
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
  const dataHealthBuckets = React.useMemo(() => {
    const b = { withComp: 0, kvi: 0, lowData: 0, ok: 0 };
    for (const p of products) {
      if (!p?.valid || !Number.isFinite(p.e) || Math.abs(p.e) < 0.3) {
        b.lowData++;
        continue;
      }
      if (p.kvi) {
        b.kvi++;
        continue;
      }
      if ((p.competitor_price ?? 0) > 0) {
        b.withComp++;
        continue;
      }
      b.ok++;
    }
    return [
      { key: "withComp", value: b.withComp },
      { key: "kvi", value: b.kvi },
      { key: "lowData", value: b.lowData },
      { key: "ok", value: b.ok },
    ];
  }, [products]);

  const dataHealthDisplay = React.useMemo(() => {
    const label = (k) =>
      k === "withComp"
        ? tt("pricing.health.knownCompetition")
        : k === "kvi"
        ? tt("pricing.health.kvi")
        : k === "lowData"
        ? tt("pricing.health.lowElasticity")
        : tt("pricing.health.ok");
    return dataHealthBuckets.map((d) => ({
      name: label(d.key),
      value: d.value,
    }));
  }, [dataHealthBuckets, tt]);

  // === [ANCHOR: DATA HEALTH %] ===============================================
  const dataHealthPct = React.useMemo(() => {
    const total = products.length || 0;
    if (!total) return 0;
    const ok = dataHealthBuckets.find((d) => d.key === "ok")?.value ?? 0;
    return (ok / total) * 100;
  }, [products, dataHealthBuckets]);

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
    if (!p || !Number.isFinite(p.suggestedPrice)) return;

    setProducts((prev) => {
      const next = prev.map((x) => {
        if (x.sku !== p.sku) return x;

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

    setSelected(p.sku);

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

        const newCurve = buildProfitCurveLinear({
          P0: p.suggestedPrice,
          Q0: p.last_qty,
          c: p.unit_cost,
          e: p.e,
        });

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

    setSelected(p.sku);

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
    try {
      typeof logAudit === "function" &&
        logAudit("export_plan_csv", { rows: products.length });
    } catch (_) {}
    URL.revokeObjectURL(url);
  }

  // === [ANCHOR: PART2 HELPERS / STATE] =======================================
  const [audit, setAudit] = React.useState([]);
  const [experiments, setExperiments] = React.useState([]); // {id, sku, pct, start, end, status}
  const [portfolioTarget, setPortfolioTarget] = React.useState(3000);
  const [safetyDays, setSafetyDays] = React.useState(14);
  const [mcRuns, setMcRuns] = React.useState(400);

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

  function randn() {
    let u = 0,
      v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function computeUncertaintyBands(p, n = 400) {
    if (!p?.curve?.meta) return null;
    const { P0, Q0, c, e } = p.curve.meta;
    const prices = p.curve.map((d) => d.price);

    const profits = prices.map(() => []);
    const revenues = prices.map(() => []);
    const margins = prices.map(() => []);

    for (let k = 0; k < n; k++) {
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

  function optimizePortfolioGreedy(targetEuro = 3000, stepPct = 0.01) {
    const cfgLocal = makeCfg(aggr, objective);

    let remaining = targetEuro;
    const maxIterations = 500;
    let iter = 0;

    setProducts((prev) => {
      let productsCopy = prev.map((p) => ({ ...p }));
      while (remaining > 50 && iter < maxIterations) {
        iter++;

        let bestGain = 0;
        let bestIdx = -1;
        let bestNew = null;

        for (let i = 0; i < productsCopy.length; i++) {
          const p = productsCopy[i];
          const dir = p.suggestedPrice > p.price ? +1 : -1;
          const trialRaw = p.price * (1 + dir * stepPct);

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

          if (Math.abs(cl.P - p.price) < 0.001) continue;

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

        if (bestIdx < 0 || !bestNew) break;

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
  const [portfolioCurve, setPortfolioCurve] = React.useState([]);
  const [bestTheta, setBestTheta] = React.useState(0);

  function computePortfolioCurveData(list, cfg) {
    const listValid = Array.isArray(list) ? list.filter((p) => p?.valid) : [];
    if (!listValid.length) return { curve: [], bestTheta: 0 };
    const step = 0.01;
    const max = Math.max(0.01, Math.min(0.35, cfg.maxChangePct));
    const arr = [];

    for (let t = -max; t <= max + 1e-9; t += step) {
      let revenueSum = 0,
        marginSum = 0,
        scoreSum = 0;

      for (const p of listValid) {
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
        theta: +(t * 100).toFixed(1),
        revenue: revenueSum,
        margin: marginSum,
        score: scoreSum,
      });
    }

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
                {tt("pricing:title")}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 max-w-3xl">
                <Trans
                  i18nKey="pricing:subtitle"
                  defaults={I18N_DEFAULTS["pricing:subtitle"]}
                />
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-3 bg-gray-50/70 dark:bg-white/5 shadow-sm">
              <div className="text-xs text-gray-500 mb-1">
                {tt("pricing.globalSettings")}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  className="px-2 py-2 rounded-xl border text-sm"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  title={tt("pricing.objectiveTitle")}
                >
                  <option value="balanced">
                    {tt("pricing.objective.balanced")}
                  </option>
                  <option value="margin">
                    {tt("pricing.objective.margin")}
                  </option>
                  <option value="revenue">
                    {tt("pricing.objective.revenue")}
                  </option>
                </select>
                <label className="text-sm">
                  {tt("pricing.aggressiveness")} {aggr}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={aggr}
                  onChange={(e) => setAggr(Number(e.target.value))}
                />
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer">
                  <input
                    id="pricing-csv-input"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files?.[0] && onUpload(e.target.files[0])
                    }
                  />
                  <span
                    onClick={() =>
                      document.getElementById("pricing-csv-input")?.click()
                    }
                  >
                    {tt("pricing.importCsv")}
                  </span>
                </label>
                <button
                  onClick={exportPlanCSV}
                  disabled={!products.length}
                  className="px-3 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
                >
                  {tt("pricing.exportPlan")}
                </button>
              </div>
              <div className="text-[11px] text-gray-500 mt-2">
                {tt("pricing.guardrailsLabel")} · {tt("pricing.deltaMax")}{" "}
                <b>{nf1.format(cfg.maxChangePct * 100)}%</b> ·{" "}
                {tt("pricing.kviCap")}{" "}
                <b>{nf1.format(cfg.kviMaxUpPct * 100)}%</b> ·{" "}
                {tt("pricing.minMargin")}{" "}
                <b>{nf1.format(cfg.minMarginPct * 100)}%</b> ·{" "}
                {tt("pricing.charm99")} <b>{tt("common:live")}</b>
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
                    {tt("pricing.portfolioPerformance")}
                  </div>
                  <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    {tt("common:live")}
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
                        name={tt("pricing.revenue")}
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
                  {tt("pricing.optimalAdjustment")}
                </div>
                <div className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {nf1.format(bestTheta)}%
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  {tt("pricing.optimalAdjustmentHint")}
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
                  {tt("pricing.dataQualityIndex")}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-4xl font-extrabold text-amber-500 dark:text-amber-400">
                    {nf1.format(dataHealthPct)}%
                  </div>
                  <PieChart width={70} height={70}>
                    <Pie
                      data={dataHealthDisplay}
                      dataKey="value"
                      innerRadius={20}
                      outerRadius={30}
                    >
                      {dataHealthDisplay.map((e, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </div>
              </div>
            </div>
            {/* Data Health & Category bars */}
            <div className="col-span-12 lg:col-span-5 grid grid-cols-5 gap-3">
              <div className="col-span-2 rounded-2xl border px-3 py-3 bg-white/70 dark:bg白/5 shadow-sm dark:bg-white/5">
                <div className="text-xs text-gray-500 mb-1">
                  {tt("pricing.dataQuality")}
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        dataKey="value"
                        data={dataHealthDisplay}
                        innerRadius={34}
                        outerRadius={60}
                        paddingAngle={2}
                      >
                        {dataHealthDisplay.map((e, i) => (
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
                  {tt("pricing.categoryAttention")}
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryBars}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="KVI"
                        stackId="a"
                        name={tt("pricing.health.kvi")}
                      />
                      <Bar
                        dataKey="Surstock"
                        stackId="a"
                        name={tt("pricing.category.overstock")}
                      />
                      <Bar
                        dataKey="Rupture"
                        stackId="a"
                        name={tt("pricing.category.stockout")}
                      />
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
                placeholder={tt("pricing.searchPlaceholder")}
                className="px-3 py-2 rounded-xl border w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select
                className="px-3 py-2 rounded-xl border"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="priorityDesc">
                  {tt("pricing.sort.priorityDesc")}
                </option>
                <option value="deltaMarginDesc">
                  {tt("pricing.sort.deltaMarginDesc")}
                </option>
                <option value="deltaRevDesc">
                  {tt("pricing.sort.deltaRevDesc")}
                </option>
                <option value="elasticityAsc">
                  {tt("pricing.sort.elasticityAsc")}
                </option>
              </select>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border">
                <input
                  type="checkbox"
                  checked={onlyActionables}
                  onChange={(e) => setOnlyActionables(e.target.checked)}
                />
                {tt("pricing.onlyActionables")}
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
              {tt("pricing.loadExample")}
            </button>
          </div>
        )}

        {/* === OVERVIEW — Vue générale portefeuille ======================== */}
        <div className="mt-4">
          <div className="rounded-2xl border p-4 bg-white/70 dark:bg-white/5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">
                  {tt("pricing.portfolioCurve.title")}
                </div>
                <div className="text-xs text-gray-500">
                  <Trans
                    i18nKey="pricing.portfolioCurve.subtitle"
                    defaults={I18N_DEFAULTS["pricing.portfolioCurve.subtitle"]}
                  />
                </div>
              </div>
              <div className="text-right text-xs text-gray-600 dark:text-gray-400">
                {tt("pricing.bestTheta")}: <b>{bestTheta}%</b>
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
                    name={tt("pricing.ca")}
                    stroke="#2563eb"
                    fill="url(#revGrad)"
                  />
                  <Line
                    type="monotone"
                    dataKey="margin"
                    name={tt("pricing.margin")}
                    dot={false}
                  />
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
                      {tt("pricing.kpi.caAtBest")}
                    </div>
                    <div className="text-lg font-bold">
                      {nf0.format(Math.round(best.revenue))} €
                    </div>
                  </div>
                  <div className="rounded-xl border px-4 py-3">
                    <div className="text-[11px] text-gray-500">
                      {tt("pricing.kpi.marginAtBest")}
                    </div>
                    <div className="text-lg font-bold">
                      {nf0.format(Math.round(best.margin))} €
                    </div>
                  </div>
                  <div className="rounded-xl border px-4 py-3">
                    <div className="text-[11px] text-gray-500">
                      {tt("pricing.kpi.deltaCaVsZero")}
                    </div>
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
                      {tt("pricing.kpi.deltaMarginVsZero")}
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

          {/* Liste générale des produits */}
          {!!products.length && (
            <div className="mt-5 rounded-2xl border bg-white/70 dark:bg-white/5 shadow-sm overflow-hidden">
              <div className="border-b px-4 py-3 text-sm text-gray-600 dark:text-gray-300 bg-gray-50/60 dark:bg-white/5">
                {tt("pricing.productsGeneral")}
              </div>
              <div className="max-h-[50vh] overflow-auto">
                <table className="min-w-full text-sm tabular-nums">
                  <thead className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-900/80 backdrop-blur">
                    <tr className="text-gray-600 dark:text-gray-300">
                      <th className="p-3 text-left">
                        {tt("pricing.table.sku")}
                      </th>
                      <th className="p-3 text-left">{tt("pricing.product")}</th>
                      <th className="p-3 text-left">
                        {tt("pricing.categoryCol")}
                      </th>
                      <th className="p-3 text-right">{tt("pricing.price")}</th>
                      <th className="p-3 text-right">{tt("pricing.cost")}</th>
                      <th className="p-3 text-right">{tt("pricing.qty90d")}</th>
                      <th className="p-3 text-right">e</th>
                      <th className="p-3 text-right">
                        {tt("pricing.table.kvi")}
                      </th>
                      <th className="p-3 text-right">
                        {tt("pricing.compShort")}
                      </th>
                      <th className="p-3 text-right">
                        {tt("pricing.stockDays")}
                      </th>
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
                          {p.kvi ? tt("common:yes") : tt("common:no")}
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
                                {tt("common:ok")}
                              </span>
                            )
                          ) : (
                            <span className="text-gray-400 text-xs">
                              {tt("common:na")}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {p.coverDays
                            ? `${p.coverDays} ${tt("common:daysShort")}`
                            : "—"}
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
                    {tt("pricing.advancedAnalysis")} — {sel.sku}
                  </div>
                  <div className="text-lg font-semibold">{sel.name}</div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600">
                    {tt("pricing.mcRuns")}
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
                        {tt("pricing.profitWithBands")}
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
                              name={tt("pricing.profitP10")}
                            />
                            <Area
                              type="monotone"
                              dataKey="profit_p50"
                              stroke="#16a34a"
                              fill="url(#gBandMid)"
                              name={tt("pricing.profitP50")}
                            />
                            <Area
                              type="monotone"
                              dataKey="profit_p90"
                              stroke="#f59e0b"
                              fill="url(#gBandHigh)"
                              name={tt("pricing.profitP90")}
                            />
                            {/* Reference lines */}
                            <ReferenceLine
                              x={sel.price}
                              stroke="#2563eb"
                              strokeDasharray="3 3"
                              label={tt("pricing.p0")}
                            />
                            <ReferenceLine
                              x={sel.suggestedPrice}
                              stroke="#f59e0b"
                              strokeDasharray="3 3"
                              label={tt("pricing.pStar")}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* REVENUE line & MARGIN line */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border bg-white/60 dark:bg-white/5 h-56 p-2">
                        <div className="text-xs text-gray-500 pl-2">
                          {tt("pricing.revenueVsPriceMedian")}
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
                              name={tt("pricing.revenueP50")}
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
                          {tt("pricing.marginVsPriceMedian")}
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
                              name={tt("pricing.marginP50")}
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
              {/* Price Story / Explainability */}
              <div className="rounded-2xl border p-4 bg-white/70 dark:bg-white/5 shadow-sm">
                <div className="text-sm font-semibold">
                  {tt("pricing.priceStory")}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {sel?.sku ? `${sel.sku} — ${sel.name}` : ""}
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {buildPriceStory(sel, cfg).map((s) => (
                    <li
                      key={s.key}
                      className="flex items-center justify-between"
                    >
                      <span>{tt(`pricing.story.${s.key}`)}</span>
                      <span className="tabular-nums font-semibold">
                        {nf2.format(s.value)} €
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Optimiseur portefeuille */}
              <div className="rounded-2xl border p-4 bg-white/70 dark:bg-white/5 shadow-sm">
                <div className="text-sm font-semibold">
                  {tt("pricing.optimizePortfolio")}
                </div>
                <div className="text-xs text-gray-500">
                  {tt("pricing.optimizePortfolioHint")}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <label className="text-sm">
                    {tt("pricing.marginTargetEuro")}
                  </label>
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
                    title={tt("pricing.optimizePortfolio")}
                  >
                    {tt("pricing.launch")}
                  </button>
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  {tt("pricing.currentAggressiveness")}: <b>{aggr}%</b> •{" "}
                  {tt("pricing.currentObjective")}:{" "}
                  <b>{tt(`pricing.objective.${objective}`)}</b>
                </div>
              </div>

              {/* Réassort */}
              <div className="rounded-2xl border p-4 bg-white/70 dark:bg-white/5 shadow-sm">
                <div className="text-sm font-semibold">
                  {tt("pricing.replenishmentPlan")}
                </div>
                <div className="text-xs text-gray-500">
                  {tt("pricing.replenishmentHint")}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <label className="text-sm">
                    {tt("pricing.safetyStockDays")}
                  </label>
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
                    title={tt("pricing.exportReplenishmentCsvTitle")}
                  >
                    {tt("pricing.exportCsv")}
                  </button>
                </div>
              </div>

              {/* Expérimentation */}
              <div className="rounded-2xl border p-4 bg-white/70 dark:bg-white/5 shadow-sm">
                <div className="text-sm font-semibold">
                  {tt("pricing.experimentation")}
                </div>
                <div className="text-xs text-gray-500">
                  {tt("pricing.experimentationHint")}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500">
                      {tt("pricing.labels.sku")}
                    </label>
                    <input
                      className="w-full px-3 py-2 rounded-xl border"
                      value={sel?.sku || ""}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">
                      {tt("pricing.deltaPricePct")}
                    </label>
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
                      {tt("pricing.durationDays")}
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
                      {tt("pricing.scheduleTest")}
                    </button>
                  </div>
                </div>
                {/* Liste courte */}
                {experiments.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-1">
                      {tt("pricing.scheduledTests")}
                    </div>
                    <div className="max-h-40 overflow-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="p-2 text-left">
                              {tt("pricing.table.sku")}
                            </th>
                            <th className="p-2 text-right">
                              {tt("pricing.deltaPctShort")}
                            </th>
                            <th className="p-2 text-left">
                              {tt("pricing.start")}
                            </th>
                            <th className="p-2 text-left">
                              {tt("pricing.end")}
                            </th>
                            <th className="p-2 text-left">
                              {tt("pricing.status")}
                            </th>
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
                              <td className="p-2">
                                {tt(`pricing.status.${e.status}`)}
                              </td>
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
            <div className="text-sm font-semibold">
              {tt("pricing.auditLog")}
            </div>
            <div className="text-xs text-gray-500">
              {tt("pricing.recentActions")}
            </div>
          </div>
          {audit.length === 0 ? (
            <div className="text-sm text-gray-500 mt-2">
              {tt("pricing.noEventsYet")}
            </div>
          ) : (
            <div className="mt-2 max-h-60 overflow-auto">
              <table className="min-w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-gray-500">
                    <th className="p-2 text-left">{tt("pricing.timestamp")}</th>
                    <th className="p-2 text-left">{tt("pricing.event")}</th>
                    <th className="p-2 text-left">{tt("pricing.detail")}</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="p-2">
                        {a.ts.replace("T", " ").slice(0, 19)}
                      </td>
                      <td className="p-2">
                        {tt(`pricing.events.${a.event}`, {
                          defaultValue: a.event,
                        })}
                      </td>
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
