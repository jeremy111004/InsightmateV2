// src/pages/PricingOptimizer.jsx
import React from "react";
import Papa from "papaparse";
import { estimateElasticityFromHistory, optimalPrice } from "../lib/pricing";
// On n'importe PAS charm99/markdownBias pour éviter le conflit avec les versions locales
// import { PRICING_CFG, charm99, markdownBias } from "../lib/pricingGuardrails";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

function PricingOptimizer() {
  // ==== Helpers locaux ====
  const toNum = (v, fb = 0) => {
    if (v == null) return fb;
    const x =
      typeof v === "string" ? v.replace(/\s+/g, "").replace(",", ".") : v;
    const n = Number(x);
    return Number.isFinite(n) ? n : fb;
  };
  const safeFinite = (n, fb = 0) => (Number.isFinite(n) ? n : fb);

  // === Réglages globaux (agressivité / objectif) ===
  const [aggr, setAggr] = React.useState(50); // 0..100
  const [objective, setObjective] = React.useState("balanced"); // balanced | margin | revenue

  const cfg = React.useMemo(() => {
    const a = Math.max(0, Math.min(100, aggr));
    const maxChangePct = 0.05 + (0.3 - 0.05) * (a / 100); // 5% → 30%
    const kviMaxUpPct = 0.02 + (0.08 - 0.02) * (a / 100); // 2% → 8%
    const lambda =
      objective === "margin" ? 0.0 : objective === "revenue" ? 0.6 : 0.25; // poids CA vs marge
    const alpha = 0.6 - 0.4 * (a / 100); // pénalité risque rupture
    const beta = 0.8 - 0.5 * (a / 100); // pénalité concurrence
    return {
      minMarginPct: 0.1,
      maxChangePct,
      kviMaxUpPct,
      charm: true,
      lambda,
      alpha,
      beta,
    };
  }, [aggr, objective]);

  // === Versions locales (pas de conflit d'import) ===
  const charm99 = (p) => {
    if (!cfg.charm) return Number(p.toFixed(2));
    const base = Math.floor(p);
    const c99 = base + 0.99;
    if (p < c99 && c99 - p < 0.02) return Number(p.toFixed(2));
    return Number((base + 0.99).toFixed(2));
  };
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

  // Clamp “business” + raisons
  function clampWithReason(
    Pstar,
    { P0, c, kvi = false, competitor_price = null }
  ) {
    const reasons = [];
    const floorByMargin = c * (1 + cfg.minMarginPct);
    const floorByStep = P0 * (1 - cfg.maxChangePct);
    const ceilByStep = P0 * (1 + cfg.maxChangePct);
    let low = Math.max(0.01, floorByMargin, floorByStep);
    let high = Math.max(ceilByStep, low);
    if (Pstar < floorByMargin) reasons.push("cap marge");
    if (Pstar < floorByStep) reasons.push("cap pas > baisse max");
    if (Pstar > ceilByStep) reasons.push("cap pas > hausse max");
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
    P = charm99(P);
    if (Math.abs(P - preCharm) > 1e-9) reasons.push(".99");
    if (P <= c) {
      P = Number((c * 1.02).toFixed(2));
      if (!reasons.includes("cap marge")) reasons.push("cap marge");
    }
    return { P, reasons };
  }

  // Demande linéaire locale
  function linearDemandParamsFromElasticity(P0, Q0, e) {
    const ee = Number.isFinite(e) && e < 0 ? e : -1.1;
    let b = ee * (Q0 / P0);
    if (!(b < 0)) b = -Math.abs(Q0 / P0);
    const a = Q0 - b * P0;
    return { a, b };
  }
  function profitAtPriceLinear(P, { a, b, c }) {
    const Q = Math.max(0, a + b * P);
    return (P - c) * Q;
  }
  function buildProfitCurveLinear({ P0, Q0, c, e }, span = 0.35, steps = 41) {
    const pts = [];
    if (!(P0 > 0 && Q0 > 0)) return pts;
    const { a, b } = linearDemandParamsFromElasticity(P0, Q0, e);
    const pMin = Math.max(c * 1.01, P0 * (1 - span));
    const pMax = P0 * (1 + span);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const P = pMin + (pMax - pMin) * t;
      pts.push({
        price: Number(P.toFixed(2)),
        profit: Number(profitAtPriceLinear(P, { a, b, c }).toFixed(2)),
      });
    }
    return pts;
  }

  // Formatters
  const nf0 = React.useMemo(
    () => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }),
    []
  );
  const nf2 = React.useMemo(
    () =>
      new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  // === State & dataset
  const [products, setProducts] = React.useState([]);
  const [selected, setSelected] = React.useState(null);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState("priorityDesc");
  const [onlyActionables, setOnlyActionables] = React.useState(false);

  // ==== Scoring / smart candidate ====
  function scoreAt(P, ctx) {
    const { a, b, c, competitor_price, kvi } = ctx;
    const Q = Math.max(0, a + b * P);
    const rev = P * Q;
    const prof = (P - c) * Q;
    const predDaily = Math.max(0, Q / 90);
    const lead = Math.max(0, toNum(ctx.lead_time_days, 0));
    const stock = Math.max(0, toNum(ctx.stock_on_hand, 0));
    const demandDuringLead = predDaily * lead;
    const shortage = Math.max(0, demandDuringLead - stock);
    const stockRisk = shortage / (demandDuringLead + 1e-9);
    let compPenalty = 0;
    if (competitor_price && competitor_price > 0) {
      const idx = P / competitor_price;
      compPenalty = Math.max(0, idx - (kvi ? 1.01 : 1.05)) / 0.1;
      compPenalty = Math.min(compPenalty, 1);
    }
    const s =
      prof +
      cfg.lambda * rev -
      cfg.alpha * stockRisk * rev -
      cfg.beta * compPenalty * rev;
    return { Q, rev, prof, stockRisk, compPenalty, score: s };
  }

  function pickSmartCandidate(ctx) {
    const P_lerner = optimalPrice({ c: ctx.c, e: ctx.e, P0: ctx.P0 });
    const { a, b } = linearDemandParamsFromElasticity(ctx.P0, ctx.Q0, ctx.e);
    const P_linear_raw = (b * ctx.c - a) / (2 * b);
    const P_linear = Number(
      Math.min(
        Math.max(P_linear_raw, ctx.c * 1.02, ctx.P0 * 0.5),
        ctx.P0 * 1.5
      ).toFixed(4)
    );
    const neigh = [0.98, 1.02, 0.95, 1.05].map((f) => ctx.P0 * f);
    const candidatesRaw = [P_lerner, P_linear, ...neigh].map(
      (x) =>
        clampWithReason(Number((x * (1 - ctx.mdBias)).toFixed(4)), {
          P0: ctx.P0,
          c: ctx.c,
          kvi: ctx.kvi,
          competitor_price: ctx.competitor_price,
        }).P
    );

    let best = { P: ctx.P0, eval: -Infinity, detail: null };
    for (const P of candidatesRaw) {
      const det = scoreAt(P, { ...ctx, a, b });
      if (det.score > best.eval) best = { P, eval: det.score, detail: det };
    }

    if (Math.abs(best.P - ctx.P0) < 0.02 * ctx.P0) {
      const down = clampWithReason(ctx.P0 * 0.98, {
        P0: ctx.P0,
        c: ctx.c,
        kvi: ctx.kvi,
        competitor_price: ctx.competitor_price,
      }).P;
      const up = clampWithReason(ctx.P0 * 1.02, {
        P0: ctx.P0,
        c: ctx.c,
        kvi: ctx.kvi,
        competitor_price: ctx.competitor_price,
      }).P;
      const sD = scoreAt(down, { ...ctx, a, b });
      const sU = scoreAt(up, { ...ctx, a, b });
      if (sU.score > best.eval) best = { P: up, eval: sU.score, detail: sU };
      if (sD.score > best.eval) best = { P: down, eval: sD.score, detail: sD };
    }

    const Qstar = Math.max(0, a + b * best.P);
    const rev0 = ctx.P0 * ctx.Q0;
    const margin0 = (ctx.P0 - ctx.c) * ctx.Q0;
    const revStar = best.P * Qstar;
    const marginStar = (best.P - ctx.c) * Qstar;

    return {
      suggestedPrice: Number(best.P.toFixed(2)),
      deltaRev: safeFinite(revStar - rev0, 0),
      deltaMargin: safeFinite(marginStar - margin0, 0),
      a,
      b,
      qStar: Qstar,
      stockRisk: best.detail.stockRisk,
      compPenalty: best.detail.compPenalty,
    };
  }

  // Recompute impacts (boutons ±2 %)
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
    setProducts((prev) =>
      prev.map((x) => {
        if (x.sku !== p.sku) return x;
        const target = p.suggestedPrice * (1 + pct);
        const upd = recomputeImpacts(p, target);
        return { ...x, ...upd, applied: false };
      })
    );
  }

  // Rebuild courbe après application
  function rebuildCurveFor(p, newPrice) {
    const P0 = newPrice;
    const Q0 = p.last_qty;
    const c = p.unit_cost;
    const e = p.e;
    return buildProfitCurveLinear({ P0, Q0, c, e });
  }

  // Appliquer (cumule les gains)
  function applySuggested(p) {
    setProducts((prev) =>
      prev.map((x) => {
        if (x.sku !== p.sku) return x;
        const Pnew = p.suggestedPrice;
        const gainRev = Number.isFinite(p.deltaRev) ? p.deltaRev : 0;
        const gainMrg = Number.isFinite(p.deltaMargin) ? p.deltaMargin : 0;
        const curve = rebuildCurveFor(p, Pnew);
        return {
          ...x,
          price: Pnew,
          suggestedPrice: Pnew,
          appliedRev: (x.appliedRev || 0) + gainRev,
          appliedMargin: (x.appliedMargin || 0) + gainMrg,
          deltaRev: 0,
          deltaMargin: 0,
          curve,
          applied: true,
        };
      })
    );
  }

  // Batch apply
  function batchApplyTop(n = 10) {
    const top = [...products]
      .filter((p) => !p.applied)
      .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))
      .slice(0, n)
      .map((p) => p.sku);

    setProducts((prev) =>
      prev.map((x) => {
        if (!top.includes(x.sku)) return x;
        const gainRev = Number.isFinite(x.deltaRev) ? x.deltaRev : 0;
        const gainMrg = Number.isFinite(x.deltaMargin) ? x.deltaMargin : 0;
        const curve = rebuildCurveFor(x, x.suggestedPrice);
        return {
          ...x,
          price: x.suggestedPrice,
          appliedRev: (x.appliedRev || 0) + gainRev,
          appliedMargin: (x.appliedMargin || 0) + gainMrg,
          deltaRev: 0,
          deltaMargin: 0,
          curve,
          applied: true,
        };
      })
    );
  }

  // Liste affichée
  const displayed = React.useMemo(() => {
    let arr = [...products];
    const q = searchQuery.trim().toLowerCase();
    if (q)
      arr = arr.filter(
        (p) =>
          (p.sku || "").toLowerCase().includes(q) ||
          (p.name || "").toLowerCase().includes(q)
      );
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

  React.useEffect(() => {
    if (!products.length) loadSampleProducts(); /* eslint-disable-next-line */
  }, []);

  // === Exemple rapide
  const loadSampleProducts = () => {
    const rows = [
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
      },
    ];
    setProducts(rows.map(mapperFromRow));
    setSelected(rows[0].sku);
  };

  // Mapper CSV → produit enrichi
  function mapperFromRow(r) {
    const sku = String(r.sku || "").trim();
    const name = String(r.name || sku || "").trim();
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
    const e = hist.length >= 3 ? estimateElasticityFromHistory(hist) : -1.3;

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

    const smart = pickSmartCandidate(ctx);
    const { a, b } = smart;
    const suggestedPrice = Number(smart.suggestedPrice.toFixed(2));

    const daily = Q0 / 90;
    const coverDays =
      ctx.stock_on_hand > 0 ? ctx.stock_on_hand / Math.max(1e-9, daily) : 0;
    const price_index =
      ctx.competitor_price > 0 ? P0 / ctx.competitor_price : null;

    const curve = buildProfitCurveLinear({ P0, Q0, c, e });

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

    return {
      sku,
      name,
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

  // Upload CSV
  const onUpload = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      delimiter: undefined,
      complete: (res) => {
        const rows = (res.data || []).filter((r) => r && (r.sku || r.name));
        const mapped = rows.map(mapperFromRow);
        setProducts(mapped);
        setSelected(mapped[0]?.sku || null);
      },
    });
  };

  // Export CSV du plan (prix)
  const exportNewPricesCSV = () => {
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
    URL.revokeObjectURL(url);
  };

  const sel = products.find((p) => p.sku === selected);

  // ====== REPLENISHMENT — Plan d’achat piloté par Prix* ======
  const [rpHorizonDays, setRpHorizonDays] = React.useState(14); // jours de couverture après réception
  const [rpSafetyDays, setRpSafetyDays] = React.useState(7); // stock de sécurité (jours)
  const [rpUseSuggested, setRpUseSuggested] = React.useState(true); // base = Prix*
  const [rpPackSize, setRpPackSize] = React.useState(1); // multiple de commande (carton)

  function estimateDailyAtPrice(p, price) {
    const Q0 = Math.max(1, Number(p.last_qty || 0));
    const P0 = Number(p.price || 0);
    const e = Number(p.e || -1.1);
    const baseDaily = Q0 / 90;
    if (!(P0 > 0 && baseDaily > 0)) return 0;
    const ratio = Math.pow(price / P0, e);
    return Math.max(0, baseDaily * ratio);
  }

  function buildReplenishRow(p) {
    const pricePlan =
      rpUseSuggested &&
      Number.isFinite(p.suggestedPrice) &&
      p.suggestedPrice > 0
        ? p.suggestedPrice
        : p.price;

    const daily = estimateDailyAtPrice(p, pricePlan);
    const lead = Math.max(0, Number(p.lead_time_days || 0));
    const demandLead = daily * lead;
    const demandHorizon = daily * rpHorizonDays;
    const safetyStock = daily * rpSafetyDays;
    const targetStock = Math.ceil(demandLead + demandHorizon + safetyStock);

    const onHand = Math.max(0, Number(p.stock_on_hand || 0));
    let qty = Math.max(0, Math.ceil(targetStock - onHand));

    const pack = Math.max(1, Number(rpPackSize || 1));
    if (qty > 0) qty = Math.max(pack, Math.ceil(qty / pack) * pack);

    const note = [];
    if (qty === 0) note.push("OK");
    if (p.kvi) note.push("KVI");
    if (p.price_index && p.price_index > 1.05) note.push("prix > marché");
    if (onHand > daily * 60) note.push("surstock");

    const unitCost = Number(p.unit_cost || 0);
    const buyCost = qty * unitCost;

    return {
      sku: p.sku,
      name: p.name,
      price_current: Number(p.price || 0),
      price_plan: Number(pricePlan.toFixed(2)),
      daily: Number(daily.toFixed(2)),
      lead_days: lead,
      safety_days: rpSafetyDays,
      horizon_days: rpHorizonDays,
      target_stock: targetStock,
      stock_on_hand: onHand,
      recommend_qty: qty,
      pack_size: pack,
      est_buy_cost: Number(buyCost.toFixed(2)),
      note: note.join(" · "),
    };
  }

  function buildReplenishment() {
    const rows = products.map(buildReplenishRow);
    rows.sort((a, b) => b.est_buy_cost - a.est_buy_cost);
    return rows;
  }

  function exportReplenishmentCSV() {
    const rows = buildReplenishment();
    if (!rows.length) {
      alert("Aucun article.");
      return;
    }
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "purchase_plan_pricing_driven.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ==== UI ====
  return (
    <section
      id="pricing"
      className="py-12 min-h-screen bg-white text-gray-900 dark:bg-transparent dark:text-white"
    >
      <div className="w-full px-4 lg:px-6">
        {/* En-tête + actions */}
        <header className="mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Pricing Optimizer</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 max-w-3xl">
                On calcule un <b>Prix conseillé (Prix*)</b> et on affiche
                l’impact attendu sur <b>CA</b> et <b>Marge</b>. Applique ligne
                par ligne ou en lot.
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-3 bg-gray-50/70 dark:bg-white/5">
              <div className="text-xs text-gray-500 mb-1">Réglages</div>
              <div className="flex items-center gap-3">
                <label className="text-sm">Agressivité {aggr}%</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={aggr}
                  onChange={(e) => setAggr(Number(e.target.value))}
                />
                <select
                  className="px-2 py-2 rounded-xl border text-sm"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                >
                  <option value="balanced">Équilibré</option>
                  <option value="margin">Priorité Marge</option>
                  <option value="revenue">Priorité CA</option>
                </select>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center px-3 py-2 rounded-xl border cursor-pointer">
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) =>
                  e.target.files?.[0] && onUpload(e.target.files[0])
                }
              />
              Importer un CSV
            </label>
            <button
              onClick={loadSampleProducts}
              className="px-3 py-2 rounded-xl border"
            >
              Charger un exemple
            </button>
            <button
              onClick={exportNewPricesCSV}
              disabled={!products.length}
              className="px-3 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
            >
              Exporter le plan de prix
            </button>
            <button
              onClick={() => batchApplyTop(10)}
              disabled={!products.length}
              className="px-3 py-2 rounded-xl border"
            >
              Appliquer les 10 meilleurs
            </button>
          </div>
        </header>

        {/* ===== Plan d’achat (piloté par Prix*) ===== */}
        <div className="mb-6 rounded-2xl border px-4 py-4 bg-gray-50/60 dark:bg-white/5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-base font-semibold">
                Réassort (piloté par Prix*)
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Calcule les <b>quantités à commander</b> selon <b>Prix*</b>,{" "}
                <b>élasticité</b>, <b>stock</b> et <b>lead time</b>.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm">Horizon (j)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={rpHorizonDays}
                  onChange={(e) => setRpHorizonDays(Number(e.target.value))}
                  className="w-20 px-2 py-1 rounded-xl border bg-white dark:bg-gray-900"
                />
                <label className="text-sm">Sécurité (j)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={rpSafetyDays}
                  onChange={(e) => setRpSafetyDays(Number(e.target.value))}
                  className="w-20 px-2 py-1 rounded-xl border bg-white dark:bg-gray-900"
                />
                <label className="text-sm">Colis (×)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={rpPackSize}
                  onChange={(e) => setRpPackSize(Number(e.target.value))}
                  className="w-20 px-2 py-1 rounded-xl border bg-white dark:bg-gray-900"
                />
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={rpUseSuggested}
                    onChange={(e) => setRpUseSuggested(e.target.checked)}
                  />
                  Base = Prix*
                </label>
              </div>
              <button
                onClick={exportReplenishmentCSV}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold shadow hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                Exporter le CSV fournisseur
              </button>
            </div>
          </div>

          {products.length > 0 && (
            <div className="mt-3 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-gray-600 dark:text-gray-300">
                    <th className="p-2 text-left">SKU</th>
                    <th className="p-2 text-left">Produit</th>
                    <th className="p-2 text-right">Stock</th>
                    <th className="p-2 text-right">Lead</th>
                    <th className="p-2 text-right">Jour.</th>
                    <th className="p-2 text-right">Cible</th>
                    <th className="p-2 text-right">Cmd</th>
                    <th className="p-2 text-right">Coût</th>
                    <th className="p-2 text-left">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {buildReplenishment()
                    .slice(0, 15)
                    .map((r) => (
                      <tr key={r.sku} className="border-t">
                        <td className="p-2">{r.sku}</td>
                        <td className="p-2">{r.name}</td>
                        <td className="p-2 text-right">{r.stock_on_hand}</td>
                        <td className="p-2 text-right">{r.lead_days}</td>
                        <td className="p-2 text-right">{r.daily}</td>
                        <td className="p-2 text-right">{r.target_stock}</td>
                        <td className="p-2 text-right">
                          <b>{r.recommend_qty}</b>
                          {r.pack_size > 1 ? ` (×${r.pack_size})` : ""}
                        </td>
                        <td className="p-2 text-right">
                          {nf2.format(r.est_buy_cost)} €
                        </td>
                        <td className="p-2">{r.note || "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <div className="text-[11px] text-gray-500 mt-1">
                Aperçu (15 lignes) — le CSV contient toutes les références,
                triées par coût d’achat.
              </div>
            </div>
          )}
        </div>

        {/* KPI + Filtres */}
        {!!products.length && (
          <div className="mb-4 grid grid-cols-12 gap-3">
            <div className="col-span-12 lg:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-3">
              {(() => {
                const totals = products.reduce(
                  (acc, p) => ({
                    appliedRev:
                      acc.appliedRev +
                      (Number.isFinite(p.appliedRev) ? p.appliedRev : 0),
                    appliedMrg:
                      acc.appliedMrg +
                      (Number.isFinite(p.appliedMargin) ? p.appliedMargin : 0),
                    remainingRev:
                      acc.remainingRev +
                      (Number.isFinite(p.deltaRev) ? p.deltaRev : 0),
                    remainingMrg:
                      acc.remainingMrg +
                      (Number.isFinite(p.deltaMargin) ? p.deltaMargin : 0),
                  }),
                  {
                    appliedRev: 0,
                    appliedMrg: 0,
                    remainingRev: 0,
                    remainingMrg: 0,
                  }
                );

                return (
                  <>
                    <div className="rounded-2xl border px-5 py-4 bg-white/70 dark:bg-white/5">
                      <div className="text-xs text-gray-500">
                        Gain CA appliqué
                      </div>
                      <div className="text-3xl font-extrabold text-emerald-700">
                        {nf0.format(Math.round(totals.appliedRev))} €
                      </div>
                    </div>
                    <div className="rounded-2xl border px-5 py-4 bg-white/70 dark:bg-white/5">
                      <div className="text-xs text-gray-500">
                        Gain Marge appliqué
                      </div>
                      <div className="text-3xl font-extrabold text-emerald-700">
                        {nf0.format(Math.round(totals.appliedMrg))} €
                      </div>
                    </div>
                    <div className="rounded-2xl border px-5 py-4 bg-white/70 dark:bg-white/5">
                      <div className="text-xs text-gray-500">
                        Potentiel CA restant
                      </div>
                      <div
                        className={`text-3xl font-extrabold ${
                          totals.remainingRev >= 0
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {nf0.format(Math.round(totals.remainingRev))} €
                      </div>
                    </div>
                    <div className="rounded-2xl border px-5 py-4 bg-white/70 dark:bg-white/5">
                      <div className="text-xs text-gray-500">
                        Potentiel Marge restant
                      </div>
                      <div
                        className={`text-3xl font-extrabold ${
                          totals.remainingMrg >= 0
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {nf0.format(Math.round(totals.remainingMrg))} €
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="col-span-12 lg:col-span-5 flex items-center justify-end gap-2">
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
                <option value="none">Tri : Aucun</option>
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
          </div>
        )}

        {!!products.length && (
          <div className="grid grid-cols-12 gap-6 items-start">
            {/* TABLEAU */}
            <div className="col-span-12 lg:col-span-8 rounded-2xl border h-[64vh] flex flex-col overflow-hidden">
              <div className="border-b px-4 py-3 text-sm text-gray-600 dark:text-gray-300 bg-gray-50/60 dark:bg-white/5">
                Catalogue —{" "}
                <span className="text-gray-400">
                  clique une ligne pour le détail
                </span>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="min-w-full text-sm tabular-nums">
                  <thead className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-900/80 backdrop-blur">
                    <tr className="text-gray-600 dark:text-gray-300">
                      <th className="p-3 text-left">SKU</th>
                      <th className="p-3 text-left">Produit</th>
                      <th className="p-3 text-right">Prix</th>
                      <th className="p-3 text-right">Coût</th>
                      <th className="p-3 text-right">Qté 90j</th>
                      <th className="p-3 text-right">e</th>
                      <th className="p-3 text-right">Prix*</th>
                      <th className="p-3 text-right">Δ CA</th>
                      <th className="p-3 text-right">Δ Marge</th>
                      <th className="p-3 text-right">Priorité</th>
                      <th className="p-3 text-right">Stock</th>
                      <th className="p-3 text-right">Conc.</th>
                      <th className="p-3 text-right w-64">
                        <div className="text-xs uppercase tracking-wide text-gray-500">
                          Actions
                        </div>
                        <div className="text-[10px] text-gray-400">
                          sur Prix*
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((p) => (
                      <tr
                        key={p.sku}
                        className={`border-t odd:bg-gray-50/40 dark:odd:bg-white/5 hover:bg-gray-50/80 dark:hover:bg-white/10 transition-colors cursor-pointer ${
                          selected === p.sku ? "ring-2 ring-blue-400/50" : ""
                        }`}
                        onClick={() => setSelected(p.sku)}
                      >
                        <td className="p-3">{p.sku}</td>
                        <td className="p-3">{p.name}</td>
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
                        <td className="p-3 text-right font-medium">
                          {Number.isFinite(p.suggestedPrice) &&
                          p.suggestedPrice > 0
                            ? nf2.format(p.suggestedPrice)
                            : "—"}
                        </td>
                        <td
                          className={`p-3 text-right ${
                            p.deltaRev >= 0
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }`}
                        >
                          {Number.isFinite(p.deltaRev)
                            ? nf0.format(Math.round(p.deltaRev))
                            : "—"}
                        </td>
                        <td
                          className={`p-3 text-right ${
                            p.deltaMargin >= 0
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }`}
                        >
                          {Number.isFinite(p.deltaMargin)
                            ? nf0.format(Math.round(p.deltaMargin))
                            : "—"}
                        </td>
                        <td className="p-3 text-right">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              p.priority === "haute"
                                ? "bg-rose-100 text-rose-700 border border-rose-300"
                                : p.priority === "moyenne"
                                ? "bg-amber-100 text-amber-700 border border-amber-300"
                                : "bg-emerald-100 text-emerald-700 border border-emerald-300"
                            }`}
                          >
                            {p.priority}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {p.coverDays ? `${p.coverDays} j` : "—"}
                          {p.stockRisk > 0.5 && (
                            <span className="ml-2 text-rose-600 text-xs">
                              ⚠ rupture
                            </span>
                          )}
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
                        <td className="p-3 text-right w-64 whitespace-nowrap">
                          <div className="flex justify-end gap-2">
                            <button
                              className="h-8 px-3 rounded-xl border border-rose-300 bg-rose-100 text-rose-700 text-xs font-semibold shadow-sm hover:bg-rose-200"
                              onClick={(e) => {
                                e.stopPropagation();
                                nudgePrice(p, -0.02);
                              }}
                              title="Baisser le prix* de 2%"
                            >
                              ↓ −2%
                            </button>
                            <button
                              className="h-8 px-3 rounded-xl border border-emerald-300 bg-emerald-100 text-emerald-700 text-xs font-semibold shadow-sm hover:bg-emerald-200"
                              onClick={(e) => {
                                e.stopPropagation();
                                nudgePrice(p, +0.02);
                              }}
                              title="Augmenter le prix* de 2%"
                            >
                              ↑ +2%
                            </button>
                            <button
                              className={`h-8 px-3 rounded-xl text-xs font-bold shadow-sm ${
                                Math.abs(p.price - p.suggestedPrice) < 1e-9 ||
                                p.applied
                                  ? "border border-gray-300 bg-gray-200 text-gray-500 cursor-not-allowed"
                                  : "border border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  Math.abs(p.price - p.suggestedPrice) < 1e-9 ||
                                  p.applied
                                )
                                  return;
                                applySuggested(p);
                              }}
                              disabled={
                                Math.abs(p.price - p.suggestedPrice) < 1e-9 ||
                                p.applied
                              }
                            >
                              ✓ Appliquer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Détail à droite */}
            <div className="col-span-12 lg:col-span-4 space-y-3">
              <div className="rounded-2xl border p-4 h-[40vh]">
                <h3 className="mb-2 font-medium">
                  Profit vs Prix {sel ? `— ${sel.name}` : ""}
                </h3>
                {sel ? (
                  <ResponsiveContainer width="100%" height={"80%"}>
                    <AreaChart data={sel.curve}>
                      <defs>
                        <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopOpacity={0.4} />
                          <stop offset="95%" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="price"
                        tickFormatter={(v) => nf0.format(v)}
                      />
                      <YAxis tickFormatter={(v) => nf0.format(v)} />
                      <Tooltip
                        formatter={(v, n) => [
                          nf0.format(v),
                          n === "profit" ? "Profit (€)" : "Prix",
                        ]}
                      />
                      <Area type="monotone" dataKey="profit" fill="url(#gP)" />
                      <Line type="monotone" dataKey="profit" dot={false} />
                      <ReferenceLine
                        x={sel.price}
                        strokeDasharray="4 4"
                        label={{ value: "Prix", position: "top" }}
                      />
                      <ReferenceLine
                        x={sel.suggestedPrice}
                        strokeDasharray="4 4"
                        label={{ value: "Prix*", position: "top" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="opacity-60 text-sm">
                    Sélectionne un produit pour voir la courbe.
                  </p>
                )}
                <p className="mt-3 text-xs opacity-70">
                  Courbe indicative autour du prix actuel.
                </p>
              </div>

              <div className="rounded-2xl border p-4">
                <h4 className="font-medium mb-2">Pourquoi ce prix ?</h4>
                {sel ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border p-3">
                        <div className="text-xs text-gray-500 mb-1">
                          Prix → Prix*
                        </div>
                        <div className="font-semibold">
                          {nf2.format(sel.price)} →{" "}
                          {nf2.format(sel.suggestedPrice)} €
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Coût : {nf2.format(sel.unit_cost)} € • e : {sel.e}
                        </div>
                      </div>
                      <div className="rounded-xl border p-3">
                        <div className="text-xs text-gray-500 mb-1">
                          Impact estimé
                        </div>
                        <div>
                          Δ CA{" "}
                          <b
                            className={
                              sel.deltaRev >= 0
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }
                          >
                            {nf0.format(Math.round(sel.deltaRev))} €
                          </b>
                          , Δ Marge{" "}
                          <b
                            className={
                              sel.deltaMargin >= 0
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }
                          >
                            {nf0.format(Math.round(sel.deltaMargin))} €
                          </b>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Qté actuelle ~{nf0.format(sel.last_qty)} ; à Prix* ~
                          {sel.qStar
                            ? nf0.format(Math.round(sel.qStar))
                            : "n/a"}
                        </div>
                      </div>
                      <div className="rounded-xl border p-3">
                        <div className="text-xs text-gray-500 mb-1">Stock</div>
                        <div>
                          Couverture : <b>{sel.coverDays || 0} j</b>{" "}
                          {sel.stockRisk > 0.5 && (
                            <span className="text-rose-600">
                              • risque rupture
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Délai d’appro : {sel.lead_time_days} j
                        </div>
                      </div>
                      <div className="rounded-xl border p-3">
                        <div className="text-xs text-gray-500 mb-1">
                          Concurrence
                        </div>
                        <div>
                          Prix marché :{" "}
                          {sel.competitor_price
                            ? `${nf2.format(sel.competitor_price)} €`
                            : "n/a"}{" "}
                          {sel.price_index && (
                            <span className="ml-2 text-xs">
                              (index {sel.price_index.toFixed(2)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ul className="mt-3 text-sm list-disc pl-5 space-y-1">
                      {sel.explain?.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="opacity-60 text-sm">
                    Sélectionne un produit dans le tableau.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default PricingOptimizer;
