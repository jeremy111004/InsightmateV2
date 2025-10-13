import React, { useMemo, useState, useEffect, useRef } from "react";
// --- Drop this near the top of app.js ---

import {
  motion,
  AnimatePresence,
  MotionConfig,
  useScroll,
  useTransform,
} from "framer-motion";
import Papa from "papaparse";
import {
  ComposedChart,
  LineChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
  BarChart,
  Bar,
  LabelList,
  AreaChart,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
} from "recharts";
import {
  Upload,
  FileDown,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Settings,
  Sun,
  Moon,
  LineChart as LineChartIcon,
  Wallet,
  Info,
  ArrowRight,
  Brain,
  Shield,
  Zap,
  CheckCircle2,
  ClipboardCopy,
  CalendarDays,
  Share2,
  HandCoins,
  Mail,
  Link as LinkIcon,
  CreditCard,
  ShoppingBag,
  Store,
  FileSpreadsheet,
  Building2,
  Banknote,
  PlugZap,
  Leaf,
  Wand2,
  Gauge,
  Bolt,
  Fuel,
  Package,
  Truck,
} from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

// ...

// === PATCH EB-1: ErrorBoundary anti-HMR ===
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static shouldIgnore(error, info) {
    const txt =
      String(error?.stack || error?.message || error || "") +
      "\n" +
      String(info?.componentStack || "");
    // Bruit connu pendant React Fast Refresh / Framer Motion
    return /removeChild|react-refresh|framer-motion|flushSync|commitRoot/i.test(
      txt
    );
  }

  static getDerivedStateFromError(error) {
    // Ne pas activer l’écran d’erreur pour le bruit HMR
    if (ErrorBoundary.shouldIgnore(error, null)) return null;
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (ErrorBoundary.shouldIgnore(error, info)) {
      // On log en warning mais on n’affiche pas le panneau rouge
      console.warn("[Ignored HMR error]", error);
      return;
    }
    this.setState({ info });
    console.error("App crashed:", error, info);
  }

  componentDidUpdate(prevProps) {
    // Si on était en erreur et que l’arbre enfant a changé (ex: HMR),
    // on réinitialise l’état de l’ErrorBoundary.
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false, error: null, info: null });
    }
  }

  handleDismiss = () =>
    this.setState({ hasError: false, error: null, info: null });

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 m-4 rounded-xl bg-red-50 border border-red-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold mb-2 text-red-700">
                Un souci est survenu
              </h2>
              <pre className="text-sm overflow-auto">
                {String(
                  this.state.error?.stack ||
                    this.state.error?.message ||
                    this.state.error
                )}
              </pre>
              {this.state.info && (
                <pre className="text-xs mt-2 opacity-70 overflow-auto">
                  {String(this.state.info?.componentStack || "")}
                </pre>
              )}
            </div>
            <button
              onClick={this.handleDismiss}
              className="h-8 px-3 rounded-lg text-sm bg-white hover:bg-gray-50 border border-gray-200 text-gray-700"
            >
              Masquer
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
// === /PATCH EB-1 ===
// === SmoothScroll (anchor links) ===
/* ============================
   Utilities
============================ */
function parseCsv(file, onDone) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => onDone(results.data),
  });
}

function formatNumber(n, decimals = 0) {
  if (Number.isNaN(n) || n === undefined || n === null) return "-";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function toDateKey(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString().slice(0, 10);
}

function dateAddDays(dateStr, days) {
  const dt = new Date(dateStr);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function rangeDays(start, n) {
  return Array.from({ length: n }, (_, i) => dateAddDays(start, i + 1));
}
/* ============================
   ECO · facteurs & helpers
============================ */
const ECO_DEFAULTS = {
  // Valeurs par défaut (approchées, modifiables dans l’UI)
  gridKgPerKWh: 0.056, // élec FR ~0.056 kgCO2e/kWh
  dieselKgPerL: 2.68, // diesel ~2.68 kgCO2e/L
  shipKgPerOrder: 0.8, // petit colis national, ordre de grandeur
  elecEURperkWh: 0.2, // conversion €→kWh si facture bancaire sans kWh
  dieselEURperL: 1.85, // conversion €→L si ticket station
};

// Détecte des dépenses "énergie / transport / expédition" dans la banque
function ecoExtractFromBank(bankingRows = [], salesRows = []) {
  const sinceISO = (() => {
    const dt = new Date();
    dt.setDate(dt.getDate() - 30);
    dt.setHours(0, 0, 0, 0);
    return dt.toISOString().slice(0, 10);
  })();

  let kwh = 0,
    dieselL = 0,
    shipOrders = 0;

  (bankingRows || [])
    .filter((r) => r && r.date && String(r.date).slice(0, 10) >= sinceISO)
    .forEach((r) => {
      const out = Number(r.outflow || r.debit || 0);
      if (!(out > 0)) return;
      const label = `${r.description || ""} ${r.category || ""}`.toLowerCase();

      // Électricité (EDF/Engie/TotalEnergies/etc.)
      if (/(edf|engie|enedis|total\s*energies|électri|electric)/i.test(label)) {
        kwh += out / ECO_DEFAULTS.elecEURperkWh;
        return;
      }
      // Carburants
      if (
        /(station|carburant|diesel|gazole|gasoil|fuel|esso|total|bp|shell|avia|galp)/i.test(
          label
        )
      ) {
        dieselL += out / ECO_DEFAULTS.dieselEURperL;
        return;
      }
      // Transport / colis
      if (
        /(la\s*poste|colissimo|chronopost|dpd|ups|dhl|gls|mondial\s*relay|expédi|shipping|colis)/i.test(
          label
        )
      ) {
        shipOrders += 1; // 1 ligne ≈ 1 expédition (approx)
        return;
      }
    });

  // Filet de sécurité : si pas d’expéditions repérées, approx via ventes
  const orders30 = (salesRows || []).filter(
    (r) => r.date && toDateKey(r.date) >= sinceISO
  ).length;
  if (shipOrders === 0 && orders30 > 0)
    shipOrders = Math.round(orders30 * 0.6 * 0.1); // ~10% des orders expédiés (démo)

  return { kwh, dieselL, shipOrders, sinceISO };
}

function sum(arr, key) {
  return (arr || []).reduce((s, x) => s + Number(x[key] || 0), 0);
}

function pct(a, b) {
  if (!b) return 0;
  return ((a - b) / b) * 100;
}

function linRegSlope(series) {
  const n = series.length;
  if (n < 2) return 0;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const y = series[i].value;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denom = n * sumXX - sumX * sumX || 1;
  return (n * sumXY - sumX * sumY) / denom;
}
// ===== Encaissements (DSO) · Utils & Sample =====
const SAMPLE_INVOICES_CSV = `invoice_id,client,email,phone,issue_date,due_date,amount,currency,status,paid_date,stripe_url
F-1001,Café Horizon,cafe.horizon@example.com,+33 6 00 00 00 01,2025-07-28,2025-08-12,420,EUR,ISSUED,,
F-1002,Menuiserie Lopez,contact@lopez-menuiserie.fr,+33 6 00 00 00 02,2025-07-25,2025-08-09,1380,EUR,PAID,2025-08-05,
F-1003,Boulangerie Miel,bonjour@boulangerie-miel.fr,+33 6 00 00 00 03,2025-07-30,2025-08-14,690,EUR,ISSUED,,
F-1004,Atelier Nova,hello@atelier-nova.com,+33 6 00 00 00 04,2025-08-10,2025-08-25,2350,EUR,ISSUED,,
F-1005,Studio Vert,contact@studio-vert.fr,+33 6 00 00 00 05,2025-08-18,2025-09-02,820,EUR,ISSUED,,
F-1006,Garage Martin,service@garage-martin.fr,+33 6 00 00 00 06,2025-08-05,2025-08-20,1540,EUR,ISSUED,,
F-1007,Fromagerie Laiton,bonsoir@laiton.fr,+33 6 00 00 00 08,2025-07-22,2025-08-06,980,EUR,ISSUED,,
F-1008,Librairie Plume,contact@plume.fr,+33 6 00 00 00 10,2025-07-31,2025-08-15,390,EUR,ISSUED,,
F-1009,Floralys,contact@floralys.fr,+33 6 00 00 00 07,2025-08-11,2025-08-26,510,EUR,ISSUED,,
F-1010,Menuiserie Lopez,contact@lopez-menuiserie.fr,+33 6 00 00 00 02,2025-08-06,2025-08-21,1990,EUR,ISSUED,,
`;

function parseInvoicesCsv(text) {
  const rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  return rows
    .map((r) => ({
      invoice_id: (r.invoice_id || "").trim(),
      client: (r.client || "").trim(),
      email: (r.email || "").trim(),
      phone: (r.phone || "").trim(),
      issue_date: r.issue_date ? new Date(r.issue_date) : null,
      due_date: r.due_date ? new Date(r.due_date) : null,
      amount: Number(r.amount || 0),
      currency: (r.currency || "EUR").trim(),
      status: (r.status || "ISSUED").trim(), // ISSUED|PAID|CANCELED...
      paid_date: r.paid_date ? new Date(r.paid_date) : null,
      stripe_url: (r.stripe_url || "").trim(),
    }))
    .filter((x) => x.invoice_id && x.due_date && x.amount > 0);
}

function daysBetween(a, b) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
function bucketLabel(d) {
  if (d <= 0) return "À échéance/À venir";
  if (d <= 15) return "1–15 j";
  if (d <= 30) return "16–30 j";
  if (d <= 60) return "31–60 j";
  return "61+ j";
}
function computeAging(invoices, asOf) {
  const buckets = {
    "À échéance/À venir": 0,
    "1–15 j": 0,
    "16–30 j": 0,
    "31–60 j": 0,
    "61+ j": 0,
  };
  let overdueTotal = 0;
  const open = invoices.filter(
    (v) => v.status !== "PAID" && v.status !== "CANCELED"
  );
  const enriched = open.map((v) => {
    const d = Math.max(0, daysBetween(v.due_date, asOf));
    const past = d > 0;
    if (past) overdueTotal += v.amount;
    buckets[bucketLabel(d)] += v.amount;
    return { ...v, days_past_due: d, past_due: past };
  });
  return { buckets, overdueTotal, open: enriched };
}
function riskScore(inv) {
  const base = 40;
  const byDays = Math.min(40, inv.days_past_due * 0.8);
  const byAmt = Math.min(20, inv.amount / 200);
  return Math.round(Math.min(100, base + byDays + byAmt));
}
function computeDSO(invoices, asOf) {
  const open = invoices.filter(
    (v) => v.status !== "PAID" && v.status !== "CANCELED"
  );
  if (!open.length) return 0;
  let sumWA = 0,
    sumAmt = 0;
  for (const v of open) {
    const age = Math.max(0, daysBetween(v.issue_date ?? v.due_date, asOf));
    sumWA += age * v.amount;
    sumAmt += v.amount;
  }
  return Math.round(sumWA / Math.max(1, sumAmt));
}
function computeRecoverable7d(agingBuckets) {
  const mix = {
    "À échéance/À venir": 0.2,
    "1–15 j": 0.7,
    "16–30 j": 0.5,
    "31–60 j": 0.3,
    "61+ j": 0.15,
  };
  let total = 0;
  for (const k of Object.keys(agingBuckets))
    total += (agingBuckets[k] || 0) * (mix[k] || 0);
  return Math.round(total);
}
// === PRICING UTILS (début) ===

// Estime l'élasticité prix (e) à partir d'un petit historique (log-log).
// rows = [{price, qty}, ...]. Fallback à -1.3 si pas assez de points.
function estimateElasticityFromHistory(rows) {
  const clean = rows
    .map((r) => ({ p: toNum(r.price), q: toNum(r.qty) }))
    .filter((r) => r.p > 0 && r.q > 0);
  if (clean.length < 3) return -1.3;
  const xs = clean.map((r) => Math.log(r.p));
  const ys = clean.map((r) => Math.log(r.q));
  const n = xs.length,
    mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const mx = mean(xs),
    my = mean(ys);
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) * (xs[i] - mx);
  }
  const slope = den === 0 ? -1.3 : num / den;
  return Number.isFinite(slope) ? slope : -1.3;
}

// Prix optimal théorique pour élasticité constante: P* = (c * e) / (e + 1)
// === optimalPrice réaliste (REPLACE) ===
// Lerner : (P - c)/P = -1/e  =>  P* = (c * e) / (e + 1), valable si e < -1.
// Si e est peu fiable (>= -1.05), on garde P0 (pas de changement violent).
function optimalPrice({ c, e, P0 }) {
  if (!Number.isFinite(e) || e >= -1.05) return P0;
  const Pstar = (c * e) / (e + 1);
  return Pstar;
}

/// === Courbe réaliste : demande linéaire autour de P0 ===
// À P0, on impose que l'élasticité locale = e  ⇒ b = e * Q0 / P0,  Q(P) = a + bP
function linearDemandParamsFromElasticity(P0, Q0, e) {
  // Si e >= 0 (anormal) ou non fini → ramène à -1.1 (pauvre élasticité)
  const ee = Number.isFinite(e) && e < 0 ? e : -1.1;
  let b = ee * (Q0 / P0); // pente (<0)
  if (!(b < 0)) b = -Math.abs(Q0 / P0); // sécurité
  const a = Q0 - b * P0;
  return { a, b };
}

function profitAtPriceLinear(P, { a, b, c }) {
  // Q(P) = max(0, a + bP) pour éviter quantités négatives
  const Q = Math.max(0, a + b * P);
  return (P - c) * Q;
}

function buildProfitCurve({ P0, Q0, c, e }, span = 0.35, steps = 41) {
  const pts = [];
  if (!(P0 > 0 && Q0 > 0)) return pts;

  const { a, b } = linearDemandParamsFromElasticity(P0, Q0, e);

  // On trace entre P0*(1-span) et P0*(1+span)
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

// === PRICING UTILS (fin) ===

/* ============================
   Forecasting helpers (SES / Holt / Holt-Winters + Smart)
============================ */
function ses(values, alpha = 0.3, h = 30) {
  if (!values.length) return { forecast: Array(h).fill(0), fitted: [] };
  let level = values[0];
  const fitted = [];
  for (let t = 0; t < values.length; t++) {
    const y = values[t];
    fitted.push(level);
    level = alpha * y + (1 - alpha) * level;
  }
  return { forecast: Array(h).fill(level), fitted };
}

function holt(values, alpha = 0.3, beta = 0.2, h = 30) {
  if (!values.length) return { forecast: Array(h).fill(0), fitted: [] };
  let level = values[0];
  let trend = values[1] ? values[1] - values[0] : 0;
  const fitted = [];
  for (let t = 0; t < values.length; t++) {
    const y = values[t];
    const prevLevel = level;
    fitted.push(level + trend);
    level = alpha * y + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const forecast = Array.from({ length: h }, (_, i) => level + (i + 1) * trend);
  return { forecast, fitted };
}

function holtDamped(values, alpha = 0.4, beta = 0.3, phi = 0.9, h = 30) {
  if (!values.length) return { forecast: Array(h).fill(0), fitted: [] };
  let level = values[0];
  let trend = values[1] ? values[1] - values[0] : 0;
  const fitted = [];
  for (let t = 0; t < values.length; t++) {
    const y = values[t];
    const prevLevel = level;
    fitted.push(level + phi * trend);
    level = alpha * y + (1 - alpha) * (level + phi * trend);
    trend = beta * (level - prevLevel) + (1 - beta) * phi * trend;
  }
  const forecast = Array.from({ length: h }, (_, i) => {
    const k = i + 1;
    const dampSum = (1 - Math.pow(phi, k)) / (1 - phi);
    return level + trend * dampSum;
  });
  return { forecast, fitted };
}

function holtWintersAdditive(
  values,
  m = 7,
  alpha = 0.3,
  beta = 0.2,
  gamma = 0.2,
  h = 30
) {
  const n = values.length;
  if (n < m * 2) return holt(values, alpha, beta, h);
  let level = values.slice(0, m).reduce((s, x) => s + x, 0) / m;
  let trend = (values[m] - values[0]) / m;
  const season = new Array(m).fill(0);
  const seasonsCount = Math.floor(n / m);
  for (let i = 0; i < m; i++) {
    let sum = 0;
    for (let s = 0; s < seasonsCount; s++) sum += values[i + s * m];
    season[i] = sum / seasonsCount - level;
  }
  const fitted = [];
  for (let t = 0; t < n; t++) {
    const y = values[t];
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
function mape(actual, fitted) {
  let n = 0,
    s = 0;
  for (let i = 0; i < actual.length; i++) {
    const a = actual[i],
      f = fitted[i];
    if (a !== 0 && isFinite(a) && isFinite(f)) {
      n++;
      s += Math.abs((a - f) / a);
    }
  }
  return n ? (s / n) * 100 : Infinity;
}

// Détection hebdo simple (force de motif jour-de-semaine)
function detectWeeklySeasonality(series) {
  if (series.length < 14) return { detected: false, strength: 0 };
  const byDow = Array.from({ length: 7 }, () => ({ sum: 0, c: 0 }));
  series.forEach((d) => {
    const dow = new Date(d.date).getDay();
    byDow[dow].sum += d.revenue;
    byDow[dow].c += 1;
  });
  const means = byDow.map((x) => (x.c ? x.sum / x.c : 0));
  const overall =
    series.reduce((s, x) => s + x.revenue, 0) / (series.length || 1);
  const varProfile =
    means.reduce((s, m) => s + Math.pow(m - overall, 2), 0) / 7;
  const varTotal =
    series.reduce((s, x) => s + Math.pow(x.revenue - overall, 2), 0) /
    (series.length || 1);
  const strength = varTotal ? varProfile / varTotal : 0;
  return { detected: strength > 0.15, strength };
}
/* ============================
   Eco · facteurs & helpers (estimation pédagogique)
============================ */
const ECO_FACTORS = {
  // kgCO2e par € de CA, ordre de grandeur pédagogique
  sectorKgPerEUR: {
    ecommerce: 0.6,
    cafe: 0.35,
    saas: 0.05,
  },
  shippingKgPerOrder: 0.9, // expéditions / emballages
  electricityKgPerKWh: 0.056, // France ~ mix bas carbone
  dieselKgPerL: 2.68,
};
// === AUTO-CARBON ENGINE (add after ECO_FACTORS) ===
const EEIO_FALLBACK_KG_PER_EUR = {
  packaging: 1.2,
  logistics: 0.6,
  electricity: 0.06,
  fuel: 3.0,
  hosting: 0.04,
  misc: 0.3,
};
const TX_RULES = [
  {
    when: /edf|engie|enedis|électri|electric/i,
    tag: "electricity",
    basis: "exact",
  },
  {
    when: /gazole|gasoil|diesel|station|esso|total|shell|avia|bp/i,
    tag: "fuel",
    basis: "exact",
  },
  {
    when: /la\s*poste|colissimo|chronopost|dpd|ups|dhl|gls|mondial\s*relay|shipping|colis/i,
    tag: "logistics",
    basis: "inferred",
  },
  {
    when: /carton|packaging|emballage|mailers|boîtes|palettes/i,
    tag: "packaging",
    basis: "inferred",
  },
  {
    when: /ovh|scaleway|aws|gcp|azure|ionos|ovhcloud|hetzner/i,
    tag: "hosting",
    basis: "inferred",
  },
];

function classifyTx(label, amountEUR) {
  const rule = TX_RULES.find((r) => r.when.test(label));
  if (!rule)
    return {
      tag: "misc",
      basis: "proxy",
      kg: amountEUR * (EEIO_FALLBACK_KG_PER_EUR.misc || 0.3),
      conf: 0.4,
    };
  // "exact" energy/fuel: convert money → physical → kg
  if (rule.tag === "electricity") {
    const kWh = amountEUR / (ECO_DEFAULTS.elecEURperkWh || 0.2);
    return {
      tag: "electricity",
      basis: "exact",
      kg: kWh * ECO_FACTORS.electricityKgPerKWh,
      conf: 0.9,
    };
  }
  if (rule.tag === "fuel") {
    const liters = amountEUR / (ECO_DEFAULTS.dieselEURperL || 1.85);
    return {
      tag: "fuel",
      basis: "exact",
      kg: liters * ECO_FACTORS.dieselKgPerL,
      conf: 0.9,
    };
  }
  // inferred (logistics/packaging/hosting): EEIO €/kg factors
  const kgPerEUR =
    EEIO_FALLBACK_KG_PER_EUR[rule.tag] ?? EEIO_FALLBACK_KG_PER_EUR.misc;
  const conf = rule.basis === "inferred" ? 0.7 : 0.5;
  return { tag: rule.tag, basis: rule.basis, kg: amountEUR * kgPerEUR, conf };
}

function estimateCO2eFromBankTx(bankingRows = [], sinceISO) {
  const items = [];
  for (const r of bankingRows || []) {
    const date = String(r.date || "").slice(0, 10);
    if (!date || (sinceISO && date < sinceISO)) continue;
    const out = Number(r.outflow || r.debit || 0);
    if (!(out > 0)) continue;
    const label = `${r.description || ""} ${r.category || ""}`.toLowerCase();
    const est = classifyTx(label, out);
    items.push({ date, amount: out, label, ...est });
  }
  const sums = items.reduce(
    (acc, x) => {
      acc.totalKg += x.kg;
      acc.conf += x.conf;
      acc.count += 1;
      acc.byTag[x.tag] = (acc.byTag[x.tag] || 0) + x.kg;
      return acc;
    },
    { totalKg: 0, conf: 0, count: 0, byTag: {} }
  );
  const confidence = sums.count
    ? Math.round((sums.conf / sums.count) * 100)
    : 0;
  return { items, totalKg: sums.totalKg, byTag: sums.byTag, confidence };
}
// === ECO-ROI helpers ===

function ecoGradeFromIntensity(kgPerEUR) {
  if (!Number.isFinite(kgPerEUR))
    return { grade: "—", color: "bg-gray-200 text-gray-800" };
  if (kgPerEUR < 0.2) return { grade: "A", color: "bg-emerald-600 text-white" };
  if (kgPerEUR < 0.5) return { grade: "B", color: "bg-green-600 text-white" };
  if (kgPerEUR < 1.0) return { grade: "C", color: "bg-amber-600 text-white" };
  if (kgPerEUR < 1.5) return { grade: "D", color: "bg-orange-600 text-white" };
  return { grade: "E", color: "bg-rose-600 text-white" };
}
function useEcoBadgeData() {
  const sales = React.useMemo(() => loadDataset("sales") || [], []);
  // approx simple : total des 30 derniers jours
  const sinceISO = toDateKey(Date.now() - 30 * 864e5);
  const last30 = (sales || [])
    .map((r) => ({
      date: toDateKey(r.date || r.created_at || new Date()),
      rev: Number(r.price || r.amount || r.total || 0),
    }))
    .filter((r) => r.date >= sinceISO && isFinite(r.rev));
  const revenue = last30.reduce((s, x) => s + x.rev, 0);

  if (!revenue) return { grade: "—", intensity: NaN };

  // ordre de grandeur par défaut (ecommerce + shipping moyen)
  const sector = "ecommerce";
  const sectorKg = revenue * (ECO_FACTORS.sectorKgPerEUR[sector] || 0);
  const shipKg = last30.length * (ECO_FACTORS.shippingKgPerOrder || 0.9);
  const totalKg = Math.max(0, sectorKg + shipKg);
  const inten = totalKg / revenue;
  const { grade } = ecoGradeFromIntensity(inten);
  return { grade, intensity: inten };
}

function EcoMiniBadge() {
  const { grade, intensity } = useEcoBadgeData();
  if (!Number.isFinite(intensity)) return null;
  return (
    <span className="ml-1 inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
      {grade}
    </span>
  );
}
function ConfidencePill({ value = 0 }) {
  const tone =
    value >= 80
      ? "emerald"
      : value >= 60
      ? "lime"
      : value >= 40
      ? "amber"
      : "rose";
  const cls =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : tone === "lime"
      ? "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300"
      : tone === "amber"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
      : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${cls}`}>
      {value}% confiance
    </span>
  );
}
// Compute intensity with safe fallbacks (measured → sector median → none)
// Compute intensity with safe fallbacks (measured → sector median → none)
function computeIntensity({ totalKg, last30Revenue, sectorMedian }) {
  if (
    Number.isFinite(totalKg) &&
    totalKg > 0 &&
    Number.isFinite(last30Revenue) &&
    last30Revenue > 0
  ) {
    return { value: totalKg / last30Revenue, source: "measured" };
  }
  if (Number.isFinite(sectorMedian) && sectorMedian > 0) {
    return { value: sectorMedian, source: "sector" };
  }
  return { value: NaN, source: "none" };
}

/* ============================
   Samples
============================ */
/* ============================
   Samples – SALES (gros volume, réaliste)
============================ */
function seededRand(seed = 42) {
  // LCG déterministe pour que l'exemple soit stable à chaque refresh
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * Génère un CSV de ventes "réaliste" :
 * - 45 jours d'historique
 * - 28 à 60 commandes / jour selon le jour de semaine
 * - légère croissance jour après jour
 * - mix produits/prix cohérent
 * - ~250–400 clients uniques (réachat inclus)
 */
function buildSampleSalesCSV({
  start = "2025-07-01",
  days = 45,
  baseDaily = 42,
  growth = 0.004, // ~0.4%/jour
  customersCap = 420,
  seed = 1337,
} = {}) {
  const rnd = seededRand(seed);

  // Profil hebdo (dim..sam)
  const weekMul = [0.82, 0.98, 1.05, 1.1, 1.12, 1.25, 0.88];

  const products = [
    { name: "Espresso", price: 2.4, p: 0.22 },
    { name: "Café", price: 3.2, p: 0.18 },
    { name: "Latte", price: 4.6, p: 0.16 },
    { name: "Croissant", price: 2.3, p: 0.17 },
    { name: "Sandwich", price: 6.9, p: 0.15 },
    { name: "Cookie", price: 1.9, p: 0.07 },
    { name: "Thé", price: 2.1, p: 0.05 },
  ];
  // cumul pour tirage pondéré
  const cumP = (() => {
    let s = 0;
    return products.map((p) => (s += p.p));
  })();

  const pickProduct = () => {
    const r = rnd();
    const idx = cumP.findIndex((c) => r <= c);
    return products[idx < 0 ? products.length - 1 : idx];
  };

  const qtyFromR = () => {
    const r = rnd();
    return r < 0.6 ? 1 : r < 0.92 ? 2 : 3; // surtout 1–2
  };

  // Clients (réachat)
  let nextCust = 2001;
  const known = [];
  const pickCustomer = () => {
    // 35% nouveaux (tant qu’on n’a pas atteint le cap), sinon réachat
    const makeNew = rnd() < 0.35 && nextCust - 2001 < customersCap;
    if (makeNew || known.length === 0) {
      const id = nextCust++;
      known.push(id);
      return id;
    }
    // réachat sur base existante, biais vers “habitués”
    const idx = Math.floor(Math.pow(rnd(), 0.6) * known.length);
    return known[Math.min(idx, known.length - 1)];
  };

  // dates util
  const toISO = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.toISOString().slice(0, 10);
  };
  const addDays = (iso, n) => {
    const d = new Date(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  };

  let orderId = 10001;
  const header = "date,order_id,product,qty,price,customer_id";
  const lines = [header];

  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const dow = new Date(date).getDay(); // 0..6
    const trend = 1 + growth * i;
    const noise = 0.85 + rnd() * 0.3; // ±15%
    const dayTarget = Math.round(baseDaily * weekMul[dow] * trend * noise);

    for (let k = 0; k < dayTarget; k++) {
      const pr = pickProduct();
      const qty = qtyFromR();
      const cid = pickCustomer();
      lines.push(
        `${date},${orderId++},${pr.name},${qty},${pr.price.toFixed(2)},${cid}`
      );
    }
  }

  return lines.join("\n");
}

// ⚠️ Remplace l’ancien SAMPLE_SALES par celui-ci :
const SAMPLE_SALES = buildSampleSalesCSV({
  start: "2025-07-01",
  days: 46, // ~1,5 mois
  baseDaily: 44, // volume de base
  growth: 0.0035, // légère hausse
  customersCap: 380, // ~clients uniques
  // seed: 1337      // garde tel quel pour stabilité
});

/* ============================
   Samples – CASHFLOW (volume réaliste + uptick discret en fin)
============================ */
function buildSampleCashCSV({
  start = "2025-07-01",
  days = 46, // ~1,5 mois
  baseIn = 520, // base inflows
  baseOut = 540, // base outflows (légèrement > inflows au début)
  seed = 909,
} = {}) {
  // RNG local déterministe
  const rand = (() => {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  })();

  // Profil hebdo (0=dim..6=sam) : ventes plus fortes ven/sam; paiements lourds le lundi
  const weekInMul = [0.9, 0.95, 1.02, 1.05, 1.08, 1.2, 0.85];
  const weekOutMul = [1.15, 1.05, 1.0, 0.98, 1.02, 1.1, 0.9];

  const toISO = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.toISOString().slice(0, 10);
  };
  const addDays = (iso, n) => {
    const d = new Date(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  };

  const lines = ["date,inflow,outflow"];

  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const dow = new Date(date).getDay();

    // Légère dérive baissière au début (net un peu négatif)
    const driftIn = 1 - 0.0012 * i; // -0,12% / jour sur la 1ère moitié
    const noiseIn = 0.9 + rand() * 0.3; // 0.90..1.20
    const noiseOut = 0.92 + rand() * 0.18; // 0.92..1.10

    let inflow = baseIn * weekInMul[dow] * noiseIn * driftIn;
    let outflow = baseOut * weekOutMul[dow] * noiseOut;

    // Spikes fournisseurs (bimensuels) pour rendre la lecture moins évidente
    if (i % 14 === 3) outflow *= 1.3;
    if (i % 28 === 10) outflow *= 1.25;

    // Uptick subtil sur les ~9 derniers jours (marketing / relances)
    const remain = days - i;
    if (remain <= 9) {
      const t = (9 - remain + 1) / 9; // 0 → 1
      const lift = 1 + 0.035 * t; // jusqu’à +3,5% en fin de série
      inflow *= lift;
      // Optionnel, effet miroir très léger sur les sorties
      outflow *= 1 - 0.005 * t; // jusqu’à -0,5% (quasi imperceptible)
    }

    lines.push(`${date},${Math.round(inflow)},${Math.round(outflow)}`);
  }

  return lines.join("\n");
}

// ⚠️ Remplace l’ancien SAMPLE_CASH par ceci :
const SAMPLE_CASH = buildSampleCashCSV({
  start: "2025-07-01",
  days: 46,
  baseIn: 520,
  baseOut: 540,
  seed: 909,
});

/* ============================
   Design System Bits (minimal + modern)
============================ */
function cx(...cls) {
  return cls.filter(Boolean).join(" ");
}
// ==== Connectors · storage & models (MVP FR) ====
const CONNECTORS_KEY = "insightmate.connectors.v1";
const CONNECTOR_LOG_KEY = "insightmate.connectors.log.v1";

function loadJSON(key, fb = null) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fb;
  } catch {
    return fb;
  }
}
function saveJSON(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
// ==== Connectors · import helpers & dataset registry ====
// Où on stocke les données importées (par connecteur)
const DATASTORE_KEY = "insightmate.datastore.v1";
// ---- Paywall (mock local) ----
const USER_KEY = "insightmate.user.v1";
function getUser() {
  try {
    return (
      JSON.parse(localStorage.getItem(USER_KEY)) || {
        isPro: false,
        email: null,
      }
    );
  } catch {
    return { isPro: false, email: null };
  }
}
function setUser(u) {
  localStorage.setItem(USER_KEY, JSON.stringify(u));
  window.dispatchEvent(
    new CustomEvent("im:user", { detail: { at: Date.now() } })
  );
}
// Checkout mock (remplace plus tard par /api/stripe/checkout)
async function startCheckout(
  { planId, interval } = { planId: "pro", interval: "monthly" }
) {
  // En prod:
  // const res = await fetch("/api/stripe/checkout", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ planId, interval })
  // });
  // const { url } = await res.json();
  // window.location.href = url;

  // Démo : on active Pro en local et on reste sur place
  setUser({
    ...getUser(),
    isPro: true,
    planId,
    interval,
    activatedAt: Date.now(),
  });
  alert(`Accès Pro activé (mock) — plan: ${planId} / ${interval}`);
}

// ---- Démo: jeu de données lecture-seule si !Pro ----
function seedDemoIfNeeded() {
  const user = getUser();
  const ds = getDatastore() || {};
  if (user.isPro) return;
  if (ds.__demo) return;

  const demoId = "__demo";
  ds[demoId] = {
    sales: [
      {
        date: "2025-08-01",
        product: "Café Latte",
        qty: 18,
        price: 3.2,
        customer_id: "C001",
      },
      {
        date: "2025-08-01",
        product: "Croissant",
        qty: 42,
        price: 1.4,
        customer_id: "C002",
      },
      {
        date: "2025-08-02",
        product: "Café Latte",
        qty: 20,
        price: 3.2,
        customer_id: "C003",
      },
      {
        date: "2025-08-02",
        product: "Thé Vert",
        qty: 12,
        price: 2.5,
        customer_id: "C004",
      },
    ],
    payments: [
      {
        date: "2025-08-01",
        gross: 240,
        fee: 4.57,
        net: 235.43,
        payout: "daily",
        balance_transaction: "txn_10001",
      },
      {
        date: "2025-08-02",
        gross: 280,
        fee: 5.1,
        net: 274.9,
        payout: "daily",
        balance_transaction: "txn_10002",
      },
    ],
    banking: [
      {
        date: "2025-08-01",
        description: "Vente carte",
        category: "Vente",
        inflow: 235.43,
        outflow: 0,
      },
      {
        date: "2025-08-02",
        description: "Paiement fournisseur",
        category: "Fournisseur",
        inflow: 0,
        outflow: 120.0,
      },
    ],
    invoices: [
      {
        invoice_id: "INV-001",
        client: "Client A",
        issue_date: "2025-07-25",
        due_date: "2025-08-10",
        amount: 180.0,
        currency: "EUR",
        status: "PAID",
        paid_date: "2025-08-02",
      },
      {
        invoice_id: "INV-002",
        client: "Client B",
        issue_date: "2025-07-28",
        due_date: "2025-08-12",
        amount: 420.0,
        currency: "EUR",
        status: "ISSUED",
        paid_date: "",
      },
    ],
  };
  ds.__demo = true;
  saveJSON(DATASTORE_KEY, ds);
  window.dispatchEvent(
    new CustomEvent("im:datastore", { detail: { at: Date.now() } })
  );
}

// Types de datasets attendus par IM (simple pour démo)
const DATASETS = {
  sales: "Ventes",
  payments: "Encaissements (Stripe/PayPal/SumUp)",
  banking: "Banque (mouvements)",
  accounting: "Comptabilité (écritures/journal)",
};

function getDatastore() {
  return loadJSON(DATASTORE_KEY, {});
}
// --- Pro gate (simple, global) ---
const PRO_KEY = "insightmate.pro"; // "1" => Pro, else demo
function isProEnabled() {
  return localStorage.getItem(PRO_KEY) === "1";
}
function setProEnabled(v) {
  localStorage.setItem(PRO_KEY, v ? "1" : "0");
  window.dispatchEvent(new Event("im:pro"));
}

function usePro() {
  const [pro, setPro] = React.useState(isProEnabled());
  React.useEffect(() => {
    const on = () => setPro(isProEnabled());
    window.addEventListener("im:pro", on);
    return () => window.removeEventListener("im:pro", on);
  }, []);
  return pro;
}

function setDatastore(updater) {
  const prev = getDatastore();
  const next = typeof updater === "function" ? updater(prev) : updater;
  saveJSON(DATASTORE_KEY, next);
  // 🔔 Notifier l’app qu’on a de nouvelles données
  window.dispatchEvent(
    new CustomEvent("im:datastore", { detail: { at: Date.now() } })
  );
  return next;
}
function useDataset(kind) {
  const [rows, setRows] = React.useState(() => loadDataset(kind) || []);
  React.useEffect(() => {
    const refresh = () => setRows(loadDataset(kind) || []);
    window.addEventListener("im:datastore", refresh);
    return () => window.removeEventListener("im:datastore", refresh);
  }, [kind]);
  return rows;
}

function loadDataset(kind) {
  const ds = getDatastore();
  const out = [];
  Object.keys(ds || {}).forEach((cid) => {
    const bucket = ds[cid];
    if (bucket && Array.isArray(bucket[kind])) out.push(...bucket[kind]);
  });
  return out;
}
// Reactif: recharge un dataset quand "im:datastore" est dispatché

// Détection de schéma ultra-simple (sales / payments / banking)
function detectDatasetKind(rows = []) {
  if (!rows.length) return null;
  const cols = Object.keys(rows[0] ?? {}).map((c) => c.toLowerCase());
  const has = (k) => cols.includes(k.toLowerCase());
  if ((has("product") || has("qty")) && (has("price") || has("amount")))
    return "sales";
  if (
    has("fee") ||
    has("payout") ||
    has("balance_transaction") ||
    (has("net") && has("gross"))
  )
    return "payments";
  if (
    has("inflow") ||
    has("outflow") ||
    has("credit") ||
    has("debit") ||
    (has("amount") && has("category"))
  )
    return "banking";
  return "sales"; // fallback utile pour démo
}

// Normalisation très basique pour aperçu
function normalizePreview(rows = []) {
  const first = rows.slice(0, 10);
  return first.map((r) => {
    const o = { ...r };
    // Essayons d’uniformiser quelques champs
    if (o.date) o.date = String(o.date).slice(0, 10);
    return o;
  });
}

// Import CSV (File)
function importCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data || []),
      error: (err) => reject(err),
    });
  });
}

// Import URL (CSV/Sheets public)
// Astuce: demander à l’utilisateur une URL CSV (Google Sheets = "Fichier > Partager > Publier sur le web > CSV")
async function importFromURL(url) {
  const res = await fetch(url);
  const text = await res.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  return parsed || [];
}

// Catalogue FR-first (zéro friction)
const CONNECTOR_CATALOG = [
  {
    id: "stripe",
    name: "Stripe",
    kind: "payments",
    icon: <CreditCard className="w-5 h-5" />,
    desc: "Encaissements, frais, virements",
  },
  {
    id: "bank_fr",
    name: "Banque FR",
    kind: "banking",
    icon: <Banknote className="w-5 h-5" />,
    desc: "Comptes & transactions (Open Banking)",
  },
  {
    id: "shopify",
    name: "Shopify",
    kind: "sales",
    icon: <ShoppingBag className="w-5 h-5" />,
    desc: "Commandes, remboursements, clients",
  },
  {
    id: "prestashop",
    name: "PrestaShop",
    kind: "sales",
    icon: <Store className="w-5 h-5" />,
    desc: "Commandes & produits",
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    kind: "sales",
    icon: <Store className="w-5 h-5" />,
    desc: "Commandes & produits",
  },
  {
    id: "pennylane",
    name: "Pennylane",
    kind: "accounting",
    icon: <Building2 className="w-5 h-5" />,
    desc: "Exports comptables (journal, TVA)",
  },
  {
    id: "sage",
    name: "Sage",
    kind: "accounting",
    icon: <Building2 className="w-5 h-5" />,
    desc: "Exports comptables",
  },
  {
    id: "sheets",
    name: "Google Sheets",
    kind: "import",
    icon: <FileSpreadsheet className="w-5 h-5" />,
    desc: "Import URL (CSV/Sheets)",
  },
  {
    id: "csv",
    name: "Fichier CSV",
    kind: "import",
    icon: <FileSpreadsheet className="w-5 h-5" />,
    desc: "Déposer un fichier",
  },
];

function defaultConnectorState() {
  const now = new Date().toISOString();
  const base = Object.fromEntries(
    CONNECTOR_CATALOG.map((c) => [
      c.id,
      {
        status: "disconnected",
        mode: null,
        lastSync: null,
        notes: "",
        createdAt: now,
      },
    ])
  );
  return base;
}
function getConnectorsState() {
  return loadJSON(CONNECTORS_KEY, defaultConnectorState());
}
function setConnectorsState(updater) {
  const prev = getConnectorsState();
  const next = typeof updater === "function" ? updater(prev) : updater;
  saveJSON(CONNECTORS_KEY, next);
  return next;
}
function pushConnectorLog(entry) {
  const arr = loadJSON(CONNECTOR_LOG_KEY, []);
  arr.unshift({ ts: new Date().toISOString(), ...entry });
  saveJSON(CONNECTOR_LOG_KEY, arr.slice(0, 200)); // cap
}
function getConnectorLog() {
  return loadJSON(CONNECTOR_LOG_KEY, []);
}

function Button({
  as = "button",
  className = "",
  variant = "solid",
  size = "md",
  icon,
  children,
  ...props // ← corrige ici
}) {
  const Comp = as;
  const base =
    "inline-flex items-center gap-2 rounded-2xl font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 transition-colors";
  const sizes = {
    sm: "px-3.5 py-1.5 text-sm",
    md: "px-5 py-2.5 text-base",
    lg: "px-6 py-3 text-lg",
  };
  const variants = {
    solid:
      "bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200",
    subtle:
      "bg-gray-100 text-gray-900 hover:bg-gray-200 ring-1 ring-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:ring-gray-700",
    ghost:
      "hover:bg-gray-100 text-gray-700 dark:text-gray-200 dark:hover:bg-gray-800",
  };
  return (
    <motion.div
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      className="inline-block"
    >
      <Comp
        className={cx(base, sizes[size], variants[variant], className)}
        type={as === "button" ? "button" : undefined} // évite les submits involontaires
        {...props} // ← et ici
      >
        {icon}
        {children}
      </Comp>
    </motion.div>
  );
}
function PaywallGate({ feature, children }) {
  const [user, setU] = React.useState(getUser());
  React.useEffect(() => {
    const fn = () => setU(getUser());
    window.addEventListener("im:user", fn);
    return () => window.removeEventListener("im:user", fn);
  }, []);
  if (user?.isPro) return children;

  return (
    <div className="relative">
      <div className="opacity-50 pointer-events-none select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white/85 dark:bg-zinc-900/85 backdrop-blur-sm p-5 rounded-2xl shadow-xl text-center">
          <div className="text-lg font-semibold mb-1">Fonction réservée</div>
          <div className="text-sm opacity-80 mb-3">
            Débloquez <span className="font-medium">{feature}</span> avec
            l’accès Pro.
          </div>
          <button
            onClick={startCheckout}
            className="px-4 py-2 rounded-xl shadow font-medium"
          >
            Activer l’accès Pro
          </button>
          <div className="text-xs mt-2 opacity-70">
            Vous voyez une version démo (lecture seule).
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Tailwind safelist pour les variants dynamiques du Button ---
function _TailwindSafelist() {
  // Élément masqué dont le seul but est de forcer l'inclusion des classes utilisées dans variants.solid/subtle/ghost
  return (
    <div
      className="
      hidden
      bg-gray-900 hover:bg-black text-white
      dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200
      bg-gray-100 hover:bg-gray-200 ring-1 ring-gray-300
      dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:ring-gray-700
      text-gray-700 dark:hover:bg-gray-800
    "
    />
  );
}

function NavBigTab({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-xl border",
        "text-[15px] font-medium py-2 px-3.5 whitespace-nowrap",
        active
          ? "bg-white text-gray-900 border-gray-300 shadow-sm ring-2 ring-indigo-500/30 dark:bg-gray-800 dark:text-white dark:border-gray-700"
          : "bg-gray-100 text-gray-800 hover:bg-gray-200 border-transparent dark:bg-gray-800/70 dark:text-gray-200 dark:hover:bg-gray-800/90",
      ].join(" ")}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function Pill({ children, className = "" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
        className
      )}
    >
      {children}
    </span>
  );
}

function Card({ children, className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.35 }}
      whileHover={{ translateY: -2 }}
      className={cx(
        "relative rounded-2xl border border-gray-200/70 bg-white/70 dark:bg-gray-900/60 dark:border-gray-800 shadow-sm backdrop-blur p-5 transition-colors",
        className
      )}
    >
      {/* glow subtil */}
      <span className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
      {children}
    </motion.div>
  );
}
function ConnectorTile({ c, state, onConnect, onDisconnect, onPreview }) {
  const connected = state?.status === "connected";
  const mode = state?.mode || "—";
  const last = state?.lastSync
    ? new Date(state.lastSync).toLocaleString()
    : "jamais";

  return (
    <div
      className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 bg-white/70 dark:bg-gray-900/60 flex flex-col justify-between"
      // SÉCURITÉ: ne jamais désactiver les interactions sur la tuile
      style={{ pointerEvents: "auto", opacity: 1 }}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          {c.icon}
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {c.name}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {c.desc}
          </div>

          <div className="mt-2 flex items-center gap-2 text-xs">
            <span
              className={
                "px-2 py-0.5 rounded-full border " +
                (connected
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/60 dark:text-gray-300 dark:border-gray-700")
              }
            >
              {connected ? "Connecté" : "Non connecté"}
            </span>
            <span className="text-gray-400">Mode: {mode}</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Dernière synchro : {last}
          </div>
        </div>
      </div>

      {/* Boutons TOUJOURS visibles et cliquables */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {connected ? (
          <>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => onPreview(c.id)}
              icon={<PlugZap className="w-4 h-4" />}
            >
              Prévisualiser
            </Button>
            <Button
              size="sm"
              onClick={() => onConnect(c.id)}
              icon={<Sparkles className="w-4 h-4" />}
            >
              Resynchroniser
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDisconnect(c.id)}
            >
              Déconnecter
            </Button>
          </>
        ) : (
          <>
            {/* Jamais disabled */}
            <Button
              size="sm"
              variant="subtle"
              onClick={() => onConnect(c.id)}
              icon={<Sparkles className="w-4 h-4" />}
            >
              Connecter
            </Button>

            {/* Raccourcis utiles selon le connecteur */}
            {c.id === "csv" && (
              <Button
                size="sm"
                variant="subtle"
                onClick={() => onPreview(c.id)}
              >
                Importer un fichier
              </Button>
            )}
            {c.id === "sheets" && (
              <Button
                size="sm"
                variant="subtle"
                onClick={() => onPreview(c.id)}
              >
                Coller une URL
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
// ===== Plans d'abonnement (UI) =====
const PLAN_CATALOG = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Découverte solo",
    monthly: 9,
    yearly: 90, // 2 mois off
    features: [
      "1 source (CSV/Sheets)",
      "Historique 30 jours",
      "Cockpit & KPIs",
      "Aperçu Encaissements",
    ],
    ctaHint: "Idéal pour essayer",
    recommended: false,
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "PME & consultants",
    monthly: 29,
    yearly: 290,
    features: [
      "5 sources (Stripe, Banque, Shopify, CSV, Sheets)",
      "Sync 15 min + webhooks",
      "DSO & relances intelligentes",
      "Exports PDF/CSV",
    ],
    ctaHint: "Le meilleur rapport valeur",
    recommended: true,
  },
  {
    id: "business",
    name: "Business",
    tagline: "Équipe & multi-dossiers",
    monthly: 79,
    yearly: 790,
    features: [
      "10+ sources & multi-user",
      "Exports comptables (journaux + TVA)",
      "SLA & support prioritaire",
      "Connecteurs avancés",
    ],
    ctaHint: "Pour passer à l'échelle",
    recommended: false,
  },
];

function formatEUR(n) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(n);
  } catch {
    return `${n} €`;
  }
}

function ConnectorsPage() {
  const [state, setState] = useState(getConnectorsState());
  const [log, setLog] = useState(getConnectorLog());

  // === Flow modal (ConnectFlow) ===
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowConnector, setFlowConnector] = useState(null);

  const openFlow = (id) => {
    const c = CONNECTOR_CATALOG.find((x) => x.id === id);
    setFlowConnector(c);
    setFlowOpen(true);
  };
  const closeFlow = () => {
    setFlowOpen(false);
    setFlowConnector(null);
  };

  const refresh = () => {
    setState(getConnectorsState());
    setLog(getConnectorLog());
  };

  // Ouvre la modale de connexion (OAuth/CSV/URL selon le connecteur)
  const onConnect = (id) => {
    openFlow(id);
  };

  const onDisconnect = (id) => {
    const next = setConnectorsState((prev) => ({
      ...prev,
      [id]: { ...prev[id], status: "disconnected", mode: null },
    }));
    pushConnectorLog({ level: "warn", msg: `Connecteur ${id} déconnecté.` });
    setState(next);
    setLog(getConnectorLog());
  };

  // Prévisualisation = même modal (pour CSV/URL)
  const onPreview = (id) => {
    openFlow(id);
  };

  // Callback quand le flow se termine (connexion OU import validé)
  // { mode, rows, dataset, count } viennent de <ConnectFlow onDone={...} />
  const onFlowDone = ({ mode, rows, dataset, count }) => {
    const id = flowConnector?.id;
    if (!id) return;

    const next = setConnectorsState((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        status: "connected",
        mode: mode || prev[id]?.mode || "oauth",
        lastSync: new Date().toISOString(),
        notes: dataset
          ? `Synchro ${DATASETS[dataset]}: ${count} lignes`
          : prev[id]?.notes || "",
      },
    }));

    if (dataset) {
      pushConnectorLog({
        level: "info",
        msg: `Import ${flowConnector.name} · ${DATASETS[dataset]} — ${count} lignes.`,
      });
    } else {
      pushConnectorLog({
        level: "info",
        msg: `Connecteur ${flowConnector.name} connecté (mode ${mode}).`,
      });
    }

    setState(next);
    setLog(getConnectorLog());
    closeFlow();
  };

  const groups = [
    { title: "Banque & Paiements", ids: ["bank_fr", "stripe"] },
    {
      title: "Ventes / E-commerce",
      ids: ["shopify", "prestashop", "woocommerce"],
    },
    { title: "Comptabilité / Facturation", ids: ["pennylane", "sage"] },
    { title: "Imports rapides", ids: ["sheets", "csv"] },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <Section
        title="Connecteurs"
        icon={<PlugZap className="w-6 h-6 text-indigo-600" />}
        actions={<AIPill label="Onboarding 30s" />}
      >
        <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Branchez vos outils en 2 clics. Lecture seule d’abord; écriture
          activable plus tard.
        </div>

        {groups.map((g) => (
          <div key={g.title} className="mb-6">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              {g.title}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {g.ids.map((id) => {
                const c = CONNECTOR_CATALOG.find((x) => x.id === id);
                return (
                  <ConnectorTile
                    key={id}
                    c={c}
                    state={state[id]}
                    onConnect={onConnect}
                    onDisconnect={onDisconnect}
                    onPreview={onPreview}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </Section>

      <Section
        title="Journal de synchronisation"
        icon={<Info className="w-5 h-5 text-indigo-600" />}
      >
        {log.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Aucun événement pour le moment.
          </div>
        ) : (
          <div className="space-y-2">
            {log.slice(0, 30).map((e, i) => (
              <div key={i} className="text-sm">
                <span className="text-gray-400">
                  {new Date(e.ts).toLocaleString()} —{" "}
                </span>
                <span
                  className={
                    e.level === "warn"
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-gray-800 dark:text-gray-100"
                  }
                >
                  {e.msg}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* === Modal de connexion / import === */}
      <ConnectFlow
        open={flowOpen}
        connector={flowConnector}
        onClose={closeFlow}
        onDone={onFlowDone}
      />
    </div>
  );
}
function AccessProPage() {
  const [interval, setInterval] = React.useState("monthly"); // "monthly" | "yearly"
  const user = getUser();

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-6">
        <h2 className="text-2xl font-semibold">Accès Pro</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Choisissez votre abonnement et débloquez les connecteurs, exports et
          la synchronisation automatique.
        </p>

        {/* Toggle mensuel/annuel */}
        <div className="mt-4 inline-flex items-center gap-2 border rounded-xl px-2 py-1">
          <button
            onClick={() => setInterval("monthly")}
            className={`px-3 py-1 rounded-lg text-sm ${
              interval === "monthly"
                ? "bg-black text-white dark:bg-white dark:text-black"
                : ""
            }`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setInterval("yearly")}
            className={`px-3 py-1 rounded-lg text-sm ${
              interval === "yearly"
                ? "bg-black text-white dark:bg-white dark:text-black"
                : ""
            }`}
          >
            Annuel <span className="ml-1 opacity-70">(−2 mois)</span>
          </button>
        </div>

        {/* Badge état */}
        <div className="mt-3 text-xs">
          {user?.isPro ? (
            <span className="px-2 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
              ✅ Accès Pro actif{" "}
              {user.planId
                ? `• ${user.planId} (${user.interval || "mensuel"})`
                : ""}
            </span>
          ) : (
            <span className="px-2 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
              🔒 Mode démo — actions verrouillées
            </span>
          )}
        </div>
      </header>

      {/* Cartes de plans */}
      <div className="grid md:grid-cols-3 gap-5">
        {PLAN_CATALOG.map((p) => {
          const price = interval === "monthly" ? p.monthly : p.yearly;
          const per = interval === "monthly" ? "/mois" : "/an";
          return (
            <div
              key={p.id}
              className={`rounded-2xl border p-5 shadow-sm ${
                p.recommended ? "ring-2 ring-indigo-400" : ""
              }`}
            >
              {p.recommended && (
                <div className="mb-2 inline-block text-[10px] px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
                  Recommandé
                </div>
              )}
              <div className="text-lg font-semibold">{p.name}</div>
              <div className="text-xs opacity-70 mb-3">{p.tagline}</div>

              <div className="text-3xl font-bold mt-1">
                {formatEUR(price)}{" "}
                <span className="text-base font-medium opacity-70">{per}</span>
              </div>

              <ul className="mt-4 space-y-2 text-sm">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      className="mt-0.5"
                    >
                      <path
                        fill="currentColor"
                        d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                      />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                {user?.isPro && user.planId === p.id ? (
                  <button
                    className="w-full py-2 rounded-xl border"
                    title="Déjà abonné"
                  >
                    Déjà actif
                  </button>
                ) : (
                  <button
                    onClick={() => startCheckout({ planId: p.id, interval })}
                    className="w-full py-2 rounded-xl shadow font-medium"
                  >
                    Activer {p.name}
                  </button>
                )}
                <div className="text-xs opacity-70 mt-2">{p.ctaHint}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FAQ courte */}
      <section className="mt-8">
        <h3 className="text-sm font-semibold">Questions rapides</h3>
        <ul className="mt-2 text-sm space-y-1">
          <li>• Facturation sécurisée Stripe (SCA/3-D Secure).</li>
          <li>• Annulable à tout moment depuis votre espace client.</li>
          <li>
            • Les connecteurs réels (Stripe, Banque, Shopify) s’activent dès
            validation.
          </li>
        </ul>
      </section>
    </div>
  );
}

// === PATCH 2.6c START (Stat avec shimmer) ===
function Stat({ label, value, note }) {
  return (
    <div className="flex flex-col">
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>

      <div className="relative inline-block">
        <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {value}
        </div>
        {/* Shimmer une seule fois à l’apparition */}
        <motion.span
          initial={{ x: "-120%", opacity: 0 }}
          whileInView={{ x: "120%", opacity: 1 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -inset-x-2 rounded-lg"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
          }}
        />
      </div>

      {note && <div className="text-xs text-gray-400 mt-0.5">{note}</div>}
    </div>
  );
}
// === PATCH 2.6c END ===
function RangeChips({ value, onChange }) {
  const Opt = ({ v, label }) => (
    <button
      onClick={() => onChange(v)}
      className={
        "px-2.5 py-1 rounded-full text-xs border transition " +
        (value === v
          ? "bg-indigo-600 text-white border-indigo-600"
          : "bg-white/60 dark:bg-gray-900/60 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-800 hover:bg-white dark:hover:bg-gray-900")
      }
    >
      {label}
    </button>
  );
  return (
    <div className="inline-flex items-center gap-1.5">
      <Opt v={7} label="7j" />
      <Opt v={30} label="30j" />
      <Opt v={90} label="90j" />
    </div>
  );
}

function MiniSparkline({ data = [] }) {
  if (!data || !data.length) return null;
  return (
    <div className="h-10 text-indigo-500 dark:text-indigo-400">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="sparkIM" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="y"
            stroke="currentColor"
            strokeWidth={2}
            fill="url(#sparkIM)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// === PATCH 2.4 START (Section reveal) ===
function Section({ title, icon, children, actions }) {
  return (
    <Card className="mb-6 group">
      <div className="flex items-center justify-between mb-4">
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.35 }}
          className="flex items-center gap-2"
        >
          {icon}
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
            Live
          </span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="flex items-center gap-2"
        >
          {actions}
        </motion.div>
      </div>
      {children}
    </Card>
  );
}
// === PATCH 2.4 END ===
// ==== Simple Modal ====
function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[min(92vw,680px)] rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">{title}</div>
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Fermer
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ==== Connect Flow (mock OAuth + CSV/URL) ====
function ConnectFlow({ open, connector, onClose, onDone }) {
  const [mode, setMode] = useState(null); // "oauth" | "fichier" | "url"
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState([]);
  const fileRef = useRef(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!connector) return;
    // Choix auto du mode (zéro friction)
    if (
      [
        "shopify",
        "stripe",
        "bank_fr",
        "pennylane",
        "sage",
        "prestashop",
        "woocommerce",
      ].includes(connector?.id)
    ) {
      setMode("oauth");
    } else if (connector?.id === "csv") {
      setMode("fichier");
    } else if (connector?.id === "sheets") {
      setMode("url");
    } else {
      setMode("oauth");
    }
    setRows([]);
    setPreview([]);
    setUrl("");
  }, [connector, open]);

  const doOAuth = async () => {
    setBusy(true);
    // Mock: on simule un consentement réussi au bout de 600ms
    await new Promise((r) => setTimeout(r, 600));
    setBusy(false);
    onDone({ mode: "oauth", rows: [], dataset: null, count: 0 });
  };

  const pickFile = () => fileRef.current?.click();
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const data = await importCSVFile(f);
      setRows(data);
      setPreview(normalizePreview(data));
    } finally {
      setBusy(false);
    }
  };

  const importUrl = async () => {
    if (!url) return;
    setBusy(true);
    try {
      const data = await importFromURL(url);
      setRows(data);
      setPreview(normalizePreview(data));
    } catch (e) {
      alert("Échec de l’import. Vérifie que l’URL pointe vers un CSV public.");
    } finally {
      setBusy(false);
    }
  };

  const confirmSync = () => {
    // Sauvegarde dans le datastore, avec détection de dataset
    const dataset = detectDatasetKind(rows);
    setDatastore((prev) => {
      const next = { ...prev };
      const cid = connector.id;
      next[cid] = next[cid] || {};
      next[cid][dataset] = rows;
      return next;
    });
    onDone({ mode, rows, dataset, count: rows.length });
  };

  return (
    <Modal
      open={open}
      title={`Connexion — ${connector?.name || ""}`}
      onClose={onClose}
    >
      {!connector ? null : (
        <div className="space-y-4">
          {/* Choix rapide (affiché mais présélectionné) */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={mode === "oauth" ? "solid" : "subtle"}
              onClick={() => setMode("oauth")}
            >
              OAuth / App Store
            </Button>
            <Button
              size="sm"
              variant={mode === "fichier" ? "solid" : "subtle"}
              onClick={() => setMode("fichier")}
            >
              Importer un fichier (CSV)
            </Button>
            <Button
              size="sm"
              variant={mode === "url" ? "solid" : "subtle"}
              onClick={() => setMode("url")}
            >
              Coller une URL (CSV/Sheets)
            </Button>
          </div>

          {/* Panneau selon mode */}
          {mode === "oauth" && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Nous allons ouvrir une fenêtre de consentement {connector.name}.
                Lecture seule d’abord.
              </div>
              <Button onClick={doOAuth} icon={<Sparkles className="w-4 h-4" />}>
                Continuer
              </Button>
              {busy && <div className="text-sm mt-2">Connexion…</div>}
            </div>
          )}

          {mode === "fichier" && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={onFile}
                className="hidden"
              />
              <Button
                variant="subtle"
                onClick={pickFile}
                icon={<FileDown className="w-4 h-4" />}
              >
                Choisir un fichier CSV
              </Button>
              {busy && <div className="text-sm">Import en cours…</div>}
              {preview.length > 0 && (
                <>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Aperçu (10 lignes)
                  </div>
                  <TablePreview rows={preview} max={10} />
                  <div className="flex justify-end">
                    <Button onClick={confirmSync}>
                      Valider la synchro ({rows.length} lignes)
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {mode === "url" && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://... (CSV public ou Google Sheets publié en CSV)"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60"
              />
              <div className="flex gap-2">
                <Button variant="subtle" onClick={importUrl}>
                  Charger l’aperçu
                </Button>
                {busy && <span className="text-sm mt-2">Chargement…</span>}
              </div>
              {preview.length > 0 && (
                <>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Aperçu (10 lignes)
                  </div>
                  <TablePreview rows={preview} max={10} />
                  <div className="flex justify-end">
                    <Button onClick={confirmSync}>
                      Valider la synchro ({rows.length} lignes)
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function TablePreview({ rows, max = 6 }) {
  if (!rows || rows.length === 0) return null;
  const cols = Object.keys(rows[0]);
  const head = cols.map((c) => (
    <th
      key={c}
      className="px-2 py-2 text-left text-xs text-gray-500 dark:text-gray-400 font-medium"
    >
      {c}
    </th>
  ));
  const body = rows.slice(0, max).map((r, i) => (
    <tr
      key={i}
      className="border-t border-gray-100 dark:border-gray-800 odd:bg-gray-50 dark:odd:bg-gray-900/30"
    >
      {cols.map((c) => (
        <td
          key={c}
          className="px-3 py-2 text-[13px] md:text-sm text-gray-900 dark:text-gray-100"
        >
          {String(r[c] ?? "")}
        </td>
      ))}
    </tr>
  ));
  return (
    <div className="overflow-auto border border-gray-200 dark:border-gray-800 rounded-xl">
      <table className="min-w-full">
        <thead className="sticky top-0 z-10 bg-gray-50/90 dark:bg-gray-900/70 backdrop-blur supports-[backdrop-filter]:bg-gray-900/60">
          {" "}
          <tr>{head}</tr>{" "}
        </thead>
        <tbody className="bg-white/30 dark:bg-gray-900/20">{body}</tbody>
      </table>
    </div>
  );
}
function AIPill({ className = "", label = "Propulsé par IA" }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium " +
        "bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-sm " +
        className
      }
    >
      <Sparkles className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

/* ============================
   Theme (dark / light)
============================ */
function useTheme() {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("insightmate-theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    const root = document.documentElement; // <html>
    root.classList.toggle("dark", theme === "dark");
    root.setAttribute("data-theme", theme);
    // aide quelques navigateurs
    root.style.colorScheme = theme;
    localStorage.setItem("insightmate-theme", theme);
  }, [theme]);

  return { theme, setTheme };
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 hover:bg-white dark:hover:bg-gray-800 p-2"
      aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      title={isDark ? "Mode clair" : "Mode sombre"}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}

/* ============================
   Landing · Animated BG + Hero + Features (Partie 1)
============================ */
/* ============================
   Landing · Animated BG + Hero (PATCH)
============================ */
function AnimatedBackground({ y }) {
  return (
    <motion.div
      className="absolute inset-0 -z-10 overflow-hidden"
      style={{ y }}
    >
      {/* Halo gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_80%_-10%,rgba(124,58,237,0.20),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(1000px_600px_at_10%_20%,rgba(59,130,246,0.18),transparent)]" />
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage:
            "radial-gradient(90% 50% at 50% 10%, black, transparent 80%)",
        }}
      />
      {/* Bottom vignette */}
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/30 to-transparent" />
    </motion.div>
  );
}

function Hero() {
  // Parallax très léger basé sur le scroll (respecte reduced motion via MotionConfig)
  const { scrollY } = useScroll();
  const bgY = useTransform(scrollY, [0, 400], [0, 40]); // fond
  const titleY = useTransform(scrollY, [0, 400], [0, 12]); // titre
  const statsY = useTransform(scrollY, [0, 400], [0, -8]); // compteurs

  const [counters, setCounters] = useState({ a: 0, b: 0, c: 0 });
  useEffect(() => {
    const target = { a: 8, b: 2.4, c: 15 };
    const t0 = performance.now();
    const dur = 900;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      setCounters({
        a: Math.round(target.a * p),
        b: Math.round(target.b * 10 * p) / 10,
        c: Math.round(target.c * p),
      });
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  return (
    <section className="relative flex items-center justify-center min-h-screen w-screen bg-gray-950 text-white text-center">
      <AnimatedBackground y={bgY} />

      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
        {/* Badge top */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur text-sm mb-8 shadow-sm">
          <Sparkles className="w-4 h-4" />
          <span>IA intégrée • Smart Forecast</span>
          <span className="text-white/50">·</span>
          <span>Essai gratuit</span>
        </div>

        {/* Headline massive (parallax) */}
        <motion.h1
          style={{ y: titleY }}
          className="font-extrabold tracking-tight leading-tight text-[clamp(56px,9vw,140px)] max-w-none"
        >
          Vos{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-300 drop-shadow-[0_0_40px_rgba(129,140,248,0.45)]">
            données
          </span>
          , vos décisions.
        </motion.h1>

        {/* Sous-titre */}
        <p className="mt-8 text-gray-300 text-[clamp(20px,2.5vw,36px)] leading-relaxed max-w-5xl mx-auto">
          Transformez vos ventes, votre trésorerie et vos prévisions en actions
          concrètes. <span className="text-white/90">Simple</span>,{" "}
          <span className="text-white/90">rapide</span>, conçu pour les PME.
        </p>

        {/* CTAs */}
        <div className="mt-12 flex flex-wrap justify-center gap-4">
          {/* CTA 1 : Ventes */}
          <a
            href="#demo"
            onClick={(e) => {
              e.preventDefault();
              location.hash = "#sales";
              document
                .getElementById("demo")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Essayer la démo ventes
          </a>

          {/* CTA 2 : Trésorerie */}
          <a
            href="#demo"
            onClick={(e) => {
              e.preventDefault();
              location.hash = "#cash";
              document
                .getElementById("demo")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl ring-1 ring-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:ring-gray-700"
          >
            Voir trésorerie
          </a>
        </div>

        <span className="mt-4 text-base text-gray-400">
          Sans carte bancaire • Annulable à tout moment
        </span>

        {/* Compteurs animés (parallax inverse léger) */}
        <motion.div
          style={{ y: statsY }}
          className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl w-full"
        >
          {/* … (garde tes 3 cartes compteur inchangées) … */}
          {/* Temps gagné */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
            <div className="flex items-center justify-center gap-2 text-white/90 mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              <span className="text-base">Temps gagné (reporting auto)</span>
            </div>
            <div className="text-3xl md:text-4xl font-bold">
              ~{counters.a} h / semaine
            </div>
            <div className="text-sm text-white/60 mt-1">
              Moins de tableaux Excel, plus d’actions concrètes.
            </div>
          </div>

          {/* Marge */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
            <div className="flex items-center justify-center gap-2 text-white/90 mb-2">
              <LineChartIcon className="w-5 h-5 text-indigo-300" />
              <span className="text-base">Marge (prix & mix)</span>
            </div>
            <div className="text-3xl md:text-4xl font-bold">
              +{counters.b}% de marge
            </div>
            <div className="text-sm text-white/60 mt-1">
              Focus best-sellers, prix ajustés intelligemment.
            </div>
          </div>

          {/* Anticipation trésorerie */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
            <div className="flex items-center justify-center gap-2 text-white/90 mb-2">
              <CalendarDays className="w-5 h-5 text-cyan-300" />
              <span className="text-base">Anticipation trésorerie</span>
            </div>
            <div className="text-3xl md:text-4xl font-bold">
              {counters.c} j d’avance
            </div>
            <div className="text-sm text-white/60 mt-1">
              Alertes découvert avant qu’il n’arrive.
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: <LineChartIcon className="w-6 h-6" />,
      title: "Prévisions auto",
      text: "Choix du meilleur modèle sans réglages. Zéro ligne droite gênante.",
    },
    {
      icon: <Wallet className="w-6 h-6" />,
      title: "Trésorerie claire",
      text: "Projetez votre solde en 30 s. Alerte tôt = décision sereine.",
    },
    {
      icon: <Brain className="w-6 h-6" />,
      title: "Conseils IA",
      text: "Recommandations compréhensibles, prêtes à agir.",
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Respect des données",
      text: "Agrégats uniquement pour l’IA complète. Vos ventes restent privées.",
    },
  ];
  return (
    <section
      id="features"
      className="relative py-20 bg-gradient-to-b from-gray-950 to-gray-900 text-white"
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-10">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ce qui change la donne
          </h2>
          <p className="text-gray-400 mt-2">
            Pensé pour les PME : rapide, lisible, et vraiment actionnable.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((it, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5 shadow-lg shadow-black/20"
            >
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mb-4">
                {it.icon}
              </div>
              <div className="text-lg font-semibold mb-1">{it.title}</div>
              <div className="text-sm text-gray-300">{it.text}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================
   SALES DEMO
============================ */
/* ============================
   SALES DEMO (Smart forecast + scénarios + bornes 95%)
============================ */

// — Robust fetch vers /api/advice avec fallback local —
// Permet d’utiliser VITE_ADVICE_URL si tu as un backend ailleurs
const ADVICE_URL = import.meta?.env?.VITE_ADVICE_URL || "/api/advice";

function synthSalesAdvice(summary) {
  const { kpis, trend, topProducts } = summary || {};
  const delta =
    trend && trend.first ? ((trend.last - trend.first) / trend.first) * 100 : 0;
  const top = (topProducts || [])
    .slice(0, 2)
    .map((p) => p.name)
    .join(" & ");
  const sens =
    delta > 5 ? "en hausse" : delta < -5 ? "en baisse" : "plutôt stable";
  return [
    `• Ventes ${sens} (~${delta >= 0 ? "+" : ""}${
      Math.round(delta * 10) / 10
    }%).`,
    `• Priorités: pousser ${
      top || "les best-sellers"
    } et travailler le mix pour le panier moyen (actuel ≈ ${kpis?.basket?.toFixed?.(
      2
    )}).`,
    `• Action 7j: micro-promo ciblée (+10–15%) sur J creux, AB test prix (+2–3%) sur top produit.`,
  ].join("\n");
}

function synthCashAdvice(summary) {
  const { lastBalance, avgNet7d, breachDate, worstOutflow } = summary || {};
  const risk = breachDate
    ? `Risque de découvert le ${breachDate}`
    : "Solde projeté positif sur 30j";
  const outTxt = worstOutflow
    ? `Grosse sortie le ${worstOutflow.date} (${Math.round(
        worstOutflow.amount
      )}€)`
    : null;
  return [
    `• ${risk}. Solde actuel ≈ ${Math.round(
      lastBalance
    )}€ ; flux net (7j) ≈ ${Math.round(avgNet7d)}€/j.`,
    outTxt ? `• ${outTxt}: tenter un échéancier / décaler paiement.` : null,
    avgNet7d < 0
      ? `• Objectif: améliorer le flux net de ${
          Math.ceil(Math.abs(avgNet7d)) + 1
        }€/j (relances clients + geler dépenses non essentielles 15j).`
      : `• Constituer un coussin = 30 jours d'outflows moyens.`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function getAdviceOrFallback(kind, summary) {
  try {
    const res = await fetch(ADVICE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, summary }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json().catch(() => ({}));
    if (data && typeof data.text === "string" && data.text.trim())
      return data.text;
    // si la réponse ne contient pas {text}, on fabrique localement
    return kind === "sales"
      ? synthSalesAdvice(summary)
      : synthCashAdvice(summary);
  } catch {
    // backend absent / CORS / JSON invalide => fallback local
    return kind === "sales"
      ? synthSalesAdvice(summary)
      : synthCashAdvice(summary);
  }
}

function SalesDemo() {
  const [rows, setRows] = useState([]);
  const chartRef = useRef(null);
  const [currency, setCurrency] = useState("€");
  const [smooth, setSmooth] = useState(14);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Full AI mode
  const [useFullAI, setUseFullAI] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [lastCallAt, setLastCallAt] = useState(0);
  // Priorité aux données importées (si présentes)
  const importedSales = useDataset("sales");

  // Dans ton compute useMemo existant, remplace la source "baseRows"

  function loadSample() {
    const parsed = Papa.parse(SAMPLE_SALES, {
      header: true,
      skipEmptyLines: true,
    }).data;
    setRows(parsed);
  }

  const {
    dailySeries,
    kpis,
    forecastSeries,
    forecastStart,
    forecastLabel,
    quality,
    productsTop5,
    minDate,
    maxDate,
    change, // 🔸 Patch 1: on expose 'change' pour les KPI
  } = useMemo(() => {
    const baseRows =
      rows && rows.length
        ? rows
        : importedSales && importedSales.length
        ? importedSales
        : Papa.parse(SAMPLE_SALES, { header: true, skipEmptyLines: true }).data;

    const clean = (baseRows || [])
      .filter((r) => r.date && r.qty && r.price)
      .map((r) => ({
        date: toDateKey(r.date),
        qty: Number(r.qty),
        price: Number(r.price),
        product: r.product || "-",
        customer_id: r.customer_id || null,
        revenue: Number(r.qty) * Number(r.price),
      }));

    // Agrégations
    const byDay = {};
    const byProduct = {};
    clean.forEach((r) => {
      byDay[r.date] = (byDay[r.date] || 0) + r.revenue;
      byProduct[r.product] = (byProduct[r.product] || 0) + r.revenue;
    });
    const dates = Object.keys(byDay).sort();
    let series = dates.map((d) => ({ date: d, revenue: byDay[d] }));

    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    // Densifier jours manquants
    if (dates.length) {
      const dt = new Date(minDate);
      const endDt = new Date(maxDate);
      const dense = {};
      while (dt <= endDt) {
        const key = dt.toISOString().slice(0, 10);
        dense[key] = byDay[key] || 0;
        dt.setDate(dt.getDate() + 1);
      }
      series = Object.keys(dense)
        .sort()
        .map((k) => ({ date: k, revenue: dense[k] }));
    }

    // 🔸 Patch 1: calcule 'change' TÔT (pour KPI)
    const first = series[0]?.revenue || 0;
    const last = series[series.length - 1]?.revenue || 0;
    const change = pct(last, first);

    // KPIs
    const last30cut = maxDate ? dateAddDays(maxDate, -30) : null;
    const last30 = series.filter((d) => !last30cut || d.date >= last30cut);
    const ca30 = last30.reduce((s, x) => s + x.revenue, 0);
    const basket = clean.length
      ? clean.reduce((s, x) => s + x.revenue, 0) / clean.length
      : 0;
    const unique = new Set(clean.map((x) => x.customer_id)).size;

    // ---------- Smart forecast (inchangé dans l’esprit)
    const lastDate = series.length ? series[series.length - 1].date : null;
    const futureDates = lastDate ? rangeDays(lastDate, 30) : [];
    const values = series.map((d) => d.revenue);

    const seasonInfo = detectWeeklySeasonality(series);

    let chosen = {
      name: "Smart: Holt amorti",
      out: holtDamped(values, 0.4, 0.3, 0.9, futureDates.length),
      season: false,
    };
    if (series.length >= 14 && seasonInfo.detected) {
      chosen = {
        name: "Smart: Holt-Winters (hebdo)",
        out: holtWintersAdditive(values, 7, 0.4, 0.3, 0.3, futureDates.length),
        season: true,
      };
    } else if (values.length < 8) {
      chosen = {
        name: "Smart: SES (historique court)",
        out: ses(values, 0.5, futureDates.length),
        season: false,
      };
    }

    // Résidus
    const fitted = chosen.out.fitted || [];
    const alignedLen = Math.min(values.length, fitted.length);
    const residuals = [];
    for (let i = 0; i < alignedLen; i++) residuals.push(values[i] - fitted[i]);

    // Petit biais “récent” (évite le plat) hors saison
    if (!seasonInfo.detected && values.length >= 6) {
      const cut = Math.floor(values.length * 0.7);
      const recentMean =
        values.slice(cut).reduce((s, x) => s + x, 0) /
        Math.max(1, values.length - cut);
      const globalMean =
        values.reduce((s, x) => s + x, 0) / Math.max(1, values.length);
      const bias = 0.2 * (recentMean - globalMean);
      chosen.out.forecast = chosen.out.forecast.map((f) => f + bias);
    }

    // Lissage visuel + micro-oscillations si pas de saison
    function movingAverage(arr, k = 3) {
      if (!arr.length) return [];
      const out = [];
      for (let i = 0; i < arr.length; i++) {
        const a = Math.max(0, i - Math.floor(k / 2));
        const b = Math.min(arr.length, i + Math.ceil(k / 2));
        const slice = arr.slice(a, b);
        out.push(slice.reduce((s, x) => s + x, 0) / slice.length);
      }
      return out;
    }
    let central = chosen.out.forecast.slice();
    if (!chosen.season) {
      central = movingAverage(central, 3).map(
        (f, i) => f * (1 + 0.02 * Math.sin((i / 7) * Math.PI))
      );
    } else {
      central = movingAverage(central, 3);
    }

    // Scénarios
    const cut = Math.floor(values.length * 0.7);
    const recentMean =
      values.slice(cut).reduce((s, x) => s + x, 0) /
      Math.max(1, values.length - cut);
    const globalMean =
      values.reduce((s, x) => s + x, 0) / Math.max(1, values.length);
    const recentDelta = globalMean ? (recentMean - globalMean) / globalMean : 0;
    const amp = Math.min(0.2, Math.max(0.08, Math.abs(recentDelta) * 0.6)); // 8%..20%
    const optimistic = central.map((v) => v * (1 + amp));
    const prudent = central.map((v) => Math.max(0, v * (1 - amp * 0.7)));

    // Bornes 95% (resserrées, uniquement futur)
    const recentResid = residuals.slice(-14);
    const sdRecent = (() => {
      if (!recentResid.length) return 0;
      const mean = recentResid.reduce((s, x) => s + x, 0) / recentResid.length;
      return Math.sqrt(
        recentResid.reduce((s, x) => s + Math.pow(x - mean, 2), 0) /
          Math.max(1, recentResid.length - 1)
      );
    })();
    const globalSd = (() => {
      if (!residuals.length) return 0;
      const mean = residuals.reduce((s, x) => s + x, 0) / residuals.length;
      return Math.sqrt(
        residuals.reduce((s, x) => s + Math.pow(x - mean, 2), 0) /
          Math.max(1, residuals.length - 1)
      );
    })();
    const baseSd = sdRecent || globalSd;
    const z = 1.96;

    const last30Mean = last30.length
      ? last30.reduce((s, x) => s + x.revenue, 0) / last30.length
      : values.slice(-7).reduce((s, x) => s + x, 0) /
        Math.max(1, Math.min(7, values.length));

    const forecastSeries = futureDates.map((d, i) => {
      const f = Math.max(0, central[i] || 0);
      const growth = Math.sqrt(i + 1);
      let span = z * baseSd * 0.6 * growth; // resserré
      const maxSpan = Math.max(last30Mean * 0.6, baseSd * 2);
      span = Math.min(span, maxSpan);
      return {
        date: d,
        forecast: f,
        forecast_hi: optimistic[i] || f,
        forecast_lo: prudent[i] || f,
        ci_hi: Math.max(0, f + span),
        ci_lo: Math.max(0, f - span),
      };
    });

    // Qualité lisible
    const mapeVal = mape(
      values.slice(1),
      (fitted || []).slice(0, values.length - 1)
    );
    let quality = {
      level: "moyen",
      text: "Pas de motif clair, tendance lissée.",
      icon: "~",
    };
    if (seasonInfo.detected && seasonInfo.strength >= 0.3)
      quality = { level: "fort", text: "Motif hebdomadaire net.", icon: "★" };
    else if (seasonInfo.detected)
      quality = { level: "modéré", text: "Motif hebdo léger.", icon: "☆" };
    if (values.length < 8)
      quality = {
        level: "limité",
        text: "Peu d’historique, prudence.",
        icon: "!",
      };

    const forecastLabel = `Prévision (Smart)`;

    const productsTop5 = Object.entries(byProduct)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      dailySeries: series,
      kpis: { ca30, basket, unique },
      forecastSeries,
      forecastStart: lastDate ? dateAddDays(lastDate, 1) : null,
      forecastLabel,
      quality: { ...quality, mape: mapeVal },
      productsTop5,
      minDate,
      maxDate,
      change, // 🔸 exposé pour Patch 1 (KPI)
    };
  }, [rows, smooth]);

  // Filtre période
  const filteredSeries = useMemo(() => {
    if (!dailySeries.length) return [];
    return dailySeries.filter((p) => {
      if (dateFrom && p.date < dateFrom) return false;
      if (dateTo && p.date > dateTo) return false;
      return true;
    });
  }, [dailySeries, dateFrom, dateTo]);
  // Résumé textuel lisible pour dirigeant (croissance & incertitude)
  const forecastText = useMemo(() => {
    if (!forecastSeries?.length || !filteredSeries?.length) return null;

    // Moyenne 14 derniers jours (historique) vs 14 premiers jours (prévision)
    const histTail = filteredSeries.slice(-14);
    const histAvg =
      histTail.reduce((s, x) => s + (x.revenue || 0), 0) /
      Math.max(1, histTail.length);

    const fwdWindow = Math.min(14, forecastSeries.length);
    const futAvg =
      forecastSeries
        .slice(0, fwdWindow)
        .reduce((s, x) => s + (x.forecast || 0), 0) / Math.max(1, fwdWindow);

    const growth = histAvg ? ((futAvg - histAvg) / histAvg) * 100 : 0;

    // Incertitude: demi-largeur moyenne des bornes 95% / centre, en %
    const relUncArr = forecastSeries.slice(0, fwdWindow).map((p) => {
      const mid = p.forecast || 0;
      const half = Math.max(0, ((p.ci_hi ?? mid) - (p.ci_lo ?? mid)) / 2);
      return mid > 0 ? half / mid : 0;
    });
    const uncertaintyPct = relUncArr.length
      ? (relUncArr.reduce((s, x) => s + x, 0) / relUncArr.length) * 100
      : 0;

    const tone =
      growth > 5 ? "en hausse" : growth < -5 ? "en baisse" : "stable";
    const msg = `Prévision ${tone} sur 30 jours : ${
      growth >= 0 ? "+" : ""
    }${formatNumber(growth, 1)}% avec une incertitude d’environ ±${formatNumber(
      uncertaintyPct,
      0
    )}%.`;

    return { msg, growth, uncertaintyPct, tone };
  }, [forecastSeries, filteredSeries]);

  useEffect(() => {
    if (!dateFrom && minDate) setDateFrom(minDate);
    if (!dateTo && maxDate) setDateTo(maxDate);
  }, [minDate, maxDate]);

  // Conseils offline
  const tips = useMemo(() => {
    const out = [];
    if (filteredSeries.length) {
      const first = filteredSeries[0]?.revenue || 0;
      const last = filteredSeries[filteredSeries.length - 1]?.revenue || 0;
      const change = pct(last, first);
      const slope = linRegSlope(
        filteredSeries.map((d) => ({ value: d.revenue }))
      );
      if (change > 10)
        out.push(
          `Tendance haussière: +${formatNumber(
            change,
            1
          )}% sur la période. Augmente le stock des best-sellers et teste un prix légèrement plus élevé (+2–3%).`
        );
      if (change < -10)
        out.push(
          `Tendance baissière: ${formatNumber(
            change,
            1
          )}%. Lance une promo ciblée 7 jours (10–15%) sur les 2 produits principaux.`
        );
      if (Math.abs(slope) < 0.01)
        out.push(
          "Ventes stables: active une offre fidélité (10 achats = 1 offert) pour doper la rétention."
        );
      const byWeekday = Array.from({ length: 7 }, () => 0);
      filteredSeries.forEach((d) => {
        byWeekday[new Date(d.date).getDay()] += d.revenue;
      });
      const minIdx = byWeekday.indexOf(Math.min(...byWeekday));
      const names = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
      out.push(
        `Jour creux: ${names[minIdx]}. Propose une offre spéciale ce jour-là (2×1 ou push SMS).`
      );
    }
    if (productsTop5 && productsTop5.length) {
      const top = productsTop5[0];
      out.push(
        `Produit leader: ${top.name}. Mets-le en avant sur la caisse et sur la home.`
      );
      if (productsTop5.length >= 2) {
        const runner = productsTop5[1];
        out.push(
          `Bundle: ${top.name} + ${runner.name} (-10%) pour augmenter le panier moyen.`
        );
      }
    }
    return out;
  }, [filteredSeries, productsTop5]);
  // Top 2 conseils actionnables (pour panneau dirigeant)
  const topActions = useMemo(() => {
    if (!tips || !tips.length) return [];
    // logiques simples de priorisation : baisse forte > risque jour creux > bundle
    const pri = tips.slice(); // copie
    // remonte les conseils contenant certains mots-clés business
    const boost = (t) => {
      let score = 0;
      const s = t.toLowerCase();
      if (s.includes("tendance baissière")) score += 5;
      if (s.includes("jour creux")) score += 3;
      if (s.includes("bundle")) score += 2;
      if (s.includes("promo") || s.includes("prix")) score += 2;
      if (s.includes("fidelité") || s.includes("fidélité")) score += 1;
      return score;
    };
    const ranked = pri
      .map((t, i) => ({ t, i, score: boost(t) }))
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .map((x) => x.t);
    return ranked.slice(0, 2);
  }, [tips]);

  // Build summary pour Full AI
  function buildSalesSummary() {
    return {
      currency,
      smooth,
      period: { from: dateFrom, to: dateTo },
      kpis: {
        ca30: Math.round(kpis.ca30 || 0),
        basket: Number(kpis.basket || 0),
        unique: Number(kpis.unique || 0),
      },
      trend: filteredSeries.length
        ? {
            first: Math.round(filteredSeries[0].revenue || 0),
            last: Math.round(
              filteredSeries[filteredSeries.length - 1].revenue || 0
            ),
          }
        : null,
      topProducts: (productsTop5 || [])
        .slice(0, 5)
        .map((p) => ({ name: p.name, revenue: Math.round(p.revenue) })),
    };
  }
  async function askFullAI() {
    const now = Date.now();
    if (now - lastCallAt < 15000) return;
    setLastCallAt(now);
    setAiLoading(true);
    setAiText("");
    try {
      const summary = buildSalesSummary();
      const txt = await getAdviceOrFallback("sales", summary);
      setAiText(txt);
    } finally {
      setAiLoading(false);
    }
  }

  // --- Helper: convertit le <svg> Recharts en PNG dataURL (fallback robuste)

  async function exportOnePagerPDF() {
    try {
      // Laisse le DOM finir de peindre
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => setTimeout(r, 50));

      // Cible du graphe
      const chartEl =
        chartRef?.current ||
        document.getElementById("forecastCard") ||
        document.querySelector("[data-forecast-card]");
      if (!chartEl) {
        alert("Graphique introuvable (wrapper non monté).");
        return;
      }
      chartEl.scrollIntoView({ block: "center", behavior: "auto" });

      // ------- Données texte / chiffres -------
      let changePct = null;
      if (filteredSeries && filteredSeries.length >= 2) {
        const first = filteredSeries[0].revenue || 0;
        const last = filteredSeries[filteredSeries.length - 1].revenue || 0;
        changePct = first ? ((last - first) / first) * 100 : null;
      }
      const evolTxt =
        typeof changePct === "number"
          ? changePct >= 0
            ? `↗ +${formatNumber(changePct, 1)}%`
            : `↘ ${formatNumber(changePct, 1)}%`
          : "—";
      const evolColor =
        typeof changePct === "number"
          ? changePct >= 0
            ? [16, 131, 85] // vert
            : [220, 38, 38] // rouge
          : [120, 120, 120];

      const forecastMsg = `${quality?.icon || ""} ${
        quality?.text || ""
      }`.trim();
      const periodTxt =
        dateFrom && dateTo
          ? `Période: ${dateFrom} → ${dateTo}`
          : "Période: (toutes données)";

      // ------- Compose PDF -------
      const margin = 36;
      const pageW = doc.internal.pageSize.getWidth(); // ≈ 595
      const pageH = doc.internal.pageSize.getHeight(); // ≈ 842
      const maxW = pageW - margin * 2;

      // HEADER bandeau
      doc.setFillColor(31, 41, 55); // gris-ardoise foncé
      doc.rect(0, 0, pageW, 64, "F");
      // === PATCH 2.6d.1 (HEADER logo) ===
      // pastille logo à gauche du titre
      doc.setFillColor(99, 102, 241); // indigo
      doc.circle(margin - 12, 32 - 4, 4, "F");
      doc.setFillColor(34, 211, 238); // cyan
      doc.circle(margin - 4, 32 + 4, 3, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text("InsightMate · OnePager", margin, 32);
      doc.setFontSize(10);
      doc.setTextColor(209, 213, 219);
      doc.text(
        "Rapport généré automatiquement — vos données restent locales",
        margin,
        48
      );

      // Badge période (sous le header)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      doc.text(periodTxt, margin, 82);

      // KPI BOXES (3 boîtes alignées)
      const boxW = 160,
        boxH = 64,
        boxR = 8;
      const kpiY = 96;
      const box = (x, title, value, icon, accentRGB) => {
        // fond
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, kpiY, boxW, boxH, boxR, boxR, "F");
        // barre accent
        doc.setFillColor(...accentRGB);
        doc.roundedRect(x, kpiY, 4, boxH, boxR, boxR, "F");
        // titre
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`${icon} ${title}`, x + 12, kpiY + 20);
        // valeur
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(17, 24, 39);
        doc.text(String(value), x + 12, kpiY + 44);
      };

      box(
        margin,
        "CA 30 jours",
        `${formatNumber(kpis?.ca30 || 0, 0)} ${currency}`,
        "💰",
        [99, 102, 241]
      ); // indigo
      box(
        margin + boxW + 16,
        "Panier moyen",
        `${formatNumber(kpis?.basket || 0, 2)} ${currency}`,
        "🛒",
        [147, 51, 234]
      ); // violet
      box(
        margin + 2 * (boxW + 16),
        "Clients",
        `${formatNumber(kpis?.unique || 0, 0)}`,
        "👥",
        [6, 182, 212]
      ); // cyan

      // Pastille d'évolution (à droite de la 1ère boîte)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...evolColor);
      doc.text(evolTxt, margin + boxW - 4, kpiY + 20, { align: "right" });

      // Qualité / message court
      const qualY = kpiY + boxH + 18;
      if (forecastMsg) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(55, 65, 81);
        doc.text(`Qualité: ${forecastMsg}`, margin, qualY);
      }

      // Image du graphe (centré)
      const rect = chartEl.getBoundingClientRect();
      const estW = Math.min(maxW, Math.max(360, rect.width || 520));
      const estH = Math.max(240, rect.height || 340);
      const imgW = estW;
      const imgH = (estH / (rect.width || estW)) * imgW;
      const imgX = margin + (maxW - imgW) / 2;
      const imgY = qualY + 10;

      // cadre du graphe
      doc.setDrawColor(229, 231, 235);
      doc.roundedRect(imgX - 8, imgY - 8, imgW + 16, imgH + 16, 8, 8, "S");
      doc.addImage(imgData, "PNG", imgX, imgY, imgW, imgH);
      // === PATCH 2.6d.2 (LÉGENDE sous le graphe) ===
      const legendY = imgY + imgH + 32;
      const items = [
        { label: "Historique", color: [37, 99, 235] }, // bleu
        { label: "Prévision", color: [14, 165, 233] }, // cyan
        { label: "Scénario optimiste", color: [16, 185, 129] }, // vert
        { label: "Scénario prudent", color: [249, 115, 22] }, // orange
      ];
      let lx = margin;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      items.forEach((it) => {
        // carré couleur
        doc.setFillColor(...it.color);
        doc.roundedRect(lx, legendY - 8, 10, 10, 2, 2, "F");
        // texte
        doc.setTextColor(55, 65, 81);
        doc.text(it.label, lx + 16, legendY);
        lx += doc.getTextWidth(it.label) + 52;
      });

      // Bandeau tendance sous le graphe (liseré vert/rouge)
      const trendBarY = imgY + imgH + 14;
      const barW = Math.min(maxW, imgW);
      const barX = margin + (maxW - barW) / 2;
      const [r, g, b] = evolColor;
      doc.setFillColor(r, g, b);
      doc.roundedRect(barX, trendBarY, barW, 6, 3, 3, "F");

      // Bloc "À faire cette semaine"
      const advStartY = trendBarY + 26;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(17, 24, 39);
      doc.text(sanitizePdfText("À faire cette semaine"), margin, yPlan);

      // panneau pastel
      const panelY = advStartY + 10;
      const panelH = 90;
      doc.setFillColor(240, 253, 244); // vert très clair
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(margin, panelY, maxW, panelH, 8, 8, "FD");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(20, 83, 45);
      const actions = (Array.isArray(tips) ? tips : []).slice(0, 3);
      let y = panelY + 22;
      actions.forEach((t, i) => {
        const wrapped = doc.splitTextToSize(`✅ ${t}`, maxW - 20);
        doc.text(wrapped, margin + 10, y);
        y += wrapped.length * 14 + 6;
      });

      // Bloc "Impact attendu" (petit pitch marketing)
      const pitchY = panelY + panelH + 24;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.text("Impact attendu", margin, pitchY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      const pitch =
        "Agissez dès cette semaine : promotion ciblée, focus best-sellers et optimisation des jours creux. L’objectif est d’améliorer vos ventes et votre trésorerie de manière simple et mesurable.";
      const wrappedPitch = doc.splitTextToSize(pitch, maxW);
      doc.text(wrappedPitch, margin, pitchY + 16);

      // FOOTER
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(
        "© 2025 InsightMate — Démo. Vos données restent locales.",
        margin,
        pageH - 24
      );

      doc.save("InsightMate_OnePager.pdf");
    } catch (e) {
      console.error("[Export PDF] Erreur finale:", e);
      alert(
        "Export PDF impossible. Regarde la console (F12) pour le détail — fallback activé."
      );
    }
  }

  return (
    <div id="demo" className="space-y-4">
      <Section
        title="Importer les ventes (CSV)"
        icon={<Upload className="w-5 h-5" />}
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="px-3 py-2 rounded-xl bg-gray-100 text-sm"
            >
              <option value="€">EUR (€)</option>
              <option value="$">USD ($)</option>
              <option value="£">GBP (£)</option>
            </select>
            <button
              className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm"
              onClick={loadSample}
            >
              Charger un exemple
            </button>
            <a
              className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm flex items-center gap-2"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(
                SAMPLE_SALES
              )}`}
              download="sample_sales.csv"
            >
              <FileDown className="w-4 h-4" /> Exemple CSV
            </a>
          </div>
        }
      >
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <input
              type="file"
              accept=".csv"
              onChange={handleUpload}
              className="block"
            />
            <p className="text-sm text-gray-500 mt-2">
              Colonnes requises:{" "}
              <code>date, order_id, product, qty, price, customer_id</code>
            </p>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500">
                Lissage (jours)
              </label>
              <input
                type="number"
                min={3}
                max={60}
                value={smooth}
                onChange={(e) => setSmooth(Number(e.target.value))}
                className="px-3 py-2 rounded-xl border w-28"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500">Du</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 rounded-xl border"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500">Au</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 rounded-xl border"
              />
            </div>
          </div>
        </div>
      </Section>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <Stat
            label="CA 30 jours"
            value={`${formatNumber(kpis.ca30, 0)} ${currency}`}
            note={
              change > 0
                ? `↗ +${formatNumber(change, 1)}%`
                : change < 0
                ? `↘ ${formatNumber(change, 1)}%`
                : "Stable"
            }
          />
        </Card>
        <Card>
          <Stat
            label="Panier moyen"
            value={`${formatNumber(kpis.basket, 2)} ${currency}`}
            note="Sur les commandes"
          />
        </Card>
        <Card>
          <Stat
            label="Clients uniques"
            value={formatNumber(kpis.unique, 0)}
            note="30 derniers jours"
          />
        </Card>
      </div>
      {/* Panneau dirigeant : Top 2 actions */}
      {topActions.length > 0 && (
        <Card className="border-emerald-200/60 bg-emerald-50/70 dark:bg-emerald-900/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
                À faire cette semaine
              </div>
              <ul className="space-y-1">
                {topActions.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-emerald-900 dark:text-emerald-100"
                  >
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-none" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <div className="text-xs text-emerald-800/80 dark:text-emerald-200/70 mt-2">
                Basé sur vos données récentes (tendance, jours creux, top
                produits).
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  const txt = topActions
                    .map((a, idx) => `${idx + 1}. ${a}`)
                    .join("\n");
                  navigator.clipboard
                    ?.writeText(`À faire cette semaine:\n${txt}`)
                    .catch(() => {});
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs bg-white/80 dark:bg-emerald-900/40 hover:bg-white ring-1 ring-emerald-300/50 text-emerald-900 dark:text-emerald-100"
              >
                <ClipboardCopy className="w-4 h-4" /> Copier
              </button>
            </div>
          </div>
        </Card>
      )}

      <Section
        title="Historique & Prévision (30j)"
        icon={<TrendingUp className="w-5 h-5" />}
        actions={
          <button
            onClick={exportOnePagerPDF}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            <FileDown className="w-4 h-4" />
            Exporter PDF (1 page)
          </button>
        }
      >
        {/* Bandeau micro-métriques business */}
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
            <Sparkles className="w-3.5 h-3.5" /> Smart forecast
          </span>

          {/* Qualité + MAPE */}
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
            {quality.icon} Qualité : {quality.level}
            {quality.mape && isFinite(quality.mape) ? (
              <span className="opacity-70">
                {" "}
                · MAPE ≈ {formatNumber(quality.mape, 1)}%
              </span>
            ) : null}
          </span>

          {/* Croissance & incertitude (lisible dirigeant) */}
          {forecastText && (
            <>
              <span
                className={
                  "inline-flex items-center gap-1 px-2 py-1 rounded-full " +
                  (forecastText.growth >= 5
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200"
                    : forecastText.growth <= -5
                    ? "bg-rose-100 text-rose-900 dark:bg-rose-900/20 dark:text-rose-200"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200")
                }
                title="Croissance moyenne prévue vs 14 derniers jours"
              >
                {forecastText.growth >= 0 ? "↗" : "↘"}{" "}
                {formatNumber(forecastText.growth, 1)}%
              </span>
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"
                title="Incertitude moyenne de la zone de prévision (±)"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> ±
                {formatNumber(forecastText.uncertaintyPct, 0)}%
              </span>
            </>
          )}
        </div>

        {/* Wrapper capturé pour le PDF */}
        <div
          id="forecastCard"
          data-forecast-card
          ref={chartRef}
          className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 bg-white dark:bg-gray-900"
        >
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={[...filteredSeries, ...forecastSeries]}>
              {/* Dégradés soignés */}
              <defs>
                <linearGradient id="histStroke" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="1" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="forecastStroke" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity="1" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient
                  id="optimisticStroke"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient id="prudentStroke" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="1" />
                  <stop offset="100%" stopColor="#fb923c" stopOpacity="0.9" />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v, name) =>
                  name === "Historique" ||
                  name === forecastLabel ||
                  name?.includes("Scénario") ||
                  name?.includes("Borne 95%")
                    ? `${formatNumber(v, 0)} ${currency}`
                    : v
                }
              />
              <Legend />

              {/* Historique (bleu) */}
              <Line
                type="monotone"
                dataKey="revenue"
                name="Historique"
                dot={false}
                strokeWidth={2.5}
                stroke="url(#histStroke)"
                activeDot={{ r: 3 }}
              />

              {/* Bornes 95% fines */}
              <Line
                type="monotone"
                dataKey="ci_lo"
                name="Borne 95% (basse)"
                dot={false}
                strokeWidth={1}
                strokeDasharray="2 4"
                strokeOpacity={0.6}
              />
              <Line
                type="monotone"
                dataKey="ci_hi"
                name="Borne 95% (haute)"
                dot={false}
                strokeWidth={1}
                strokeDasharray="2 4"
                strokeOpacity={0.6}
              />

              {/* Scénario prudent (orange) */}
              <Line
                type="basis"
                dataKey="forecast_lo"
                name="Scénario prudent"
                stroke="url(#prudentStroke)"
                strokeDasharray="3 3"
                dot={false}
                strokeWidth={1.8}
              />

              {/* Prévision centrale (cyan) */}
              <Line
                type="basis"
                dataKey="forecast"
                name={forecastLabel}
                stroke="url(#forecastStroke)"
                strokeDasharray="6 4"
                dot={false}
                strokeWidth={2.6}
              />

              {/* Scénario optimiste (vert) */}
              <Line
                type="basis"
                dataKey="forecast_hi"
                name="Scénario optimiste"
                stroke="url(#optimisticStroke)"
                strokeDasharray="3 3"
                dot={false}
                strokeWidth={1.8}
              />

              {/* Zone grisée de prévision */}
              {forecastStart && (
                <ReferenceArea
                  x1={forecastStart}
                  x2={(forecastSeries.slice(-1)[0] || {}).date}
                  strokeOpacity={0.06}
                />
              )}
            </LineChart>
          </ResponsiveContainer>

          {/* Légende business sous le graphe */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-200">
              ● Historique
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-900 dark:bg-cyan-900/20 dark:text-cyan-200">
              ● Prévision centrale
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">
              ● Scénario optimiste
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
              ● Scénario prudent
            </span>

            {/* Résumé dirigeant synthétique */}
            {forecastText && (
              <span className="ml-auto text-right">
                <span className="font-medium">
                  {forecastText.growth >= 0 ? "↗" : "↘"}{" "}
                  {formatNumber(forecastText.growth, 1)}%
                </span>{" "}
                sur 30 jours · Incertitude ±
                {formatNumber(forecastText.uncertaintyPct, 0)}%
              </span>
            )}
          </div>
        </div>
      </Section>

      <Section
        title="Top produits (CA)"
        icon={<Settings className="w-5 h-5" />}
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={productsTop5}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => `${formatNumber(v, 0)} ${currency}`} />
            <Bar dataKey="revenue" name="CA" />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Conseiller" icon={<Brain className="w-5 h-5" />}>
        {/* Header avec switch IA */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
              <Sparkles className="w-3.5 h-3.5" />
              Conseils actionnables
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Basé sur vos données récentes
            </span>
          </div>

          {/* Toggle capsule animé */}
          <div className="relative inline-flex p-1 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700">
            <button
              type="button"
              onClick={() => {
                if (useFullAI) setUseFullAI(false);
              }}
              className={
                "relative z-10 px-3 py-1.5 text-sm rounded-xl " +
                (!useFullAI ? "text-gray-900 dark:text-white" : "text-gray-500")
              }
            >
              Conseils locaux
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!useFullAI) {
                  setUseFullAI(true);
                  // petit délai pour l'effet, puis on lance l'IA
                  setTimeout(() => {
                    if (!aiLoading) askFullAI();
                  }, 150);
                }
              }}
              className={
                "relative z-10 px-3 py-1.5 text-sm rounded-xl flex items-center gap-1 " +
                (useFullAI ? "text-gray-900 dark:text-white" : "text-gray-500")
              }
            >
              <Sparkles className="w-4 h-4" /> IA personnalisée
            </button>
            {/* Pastille animée */}
            <motion.span
              layout
              transition={{ type: "spring", stiffness: 350, damping: 26 }}
              className="absolute top-1 bottom-1 w-1/2 rounded-xl bg-white dark:bg-gray-900 shadow-sm"
              style={{ left: useFullAI ? "50%" : 0 }}
            />
            {/* Glow discret quand IA on */}
            <AnimatePresence>
              {useFullAI && (
                <motion.span
                  key="ai-glow"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none absolute -inset-1 rounded-3xl blur-md"
                  style={{
                    background:
                      "radial-gradient(80% 80% at 50% 50%, rgba(99,102,241,0.20), rgba(34,211,238,0.12) 60%, transparent 80%)",
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Contenu avec transition (offline vs IA) */}
        <AnimatePresence mode="wait">
          {useFullAI ? (
            <motion.div
              key="ai-mode"
              initial={{ opacity: 0, y: 8, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.995 }}
              transition={{ duration: 0.18 }}
              className="rounded-2xl border border-indigo-200/50 dark:border-indigo-900/40 bg-gradient-to-br from-white to-indigo-50 dark:from-gray-900 dark:to-gray-900/40 p-4 shadow-sm relative overflow-hidden"
            >
              {/* ruban IA */}
              <div
                className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-30 blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle at 70% 30%, rgba(99,102,241,0.25), rgba(34,211,238,0.15))",
                }}
              />
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <div className="text-sm font-medium">
                    Conseils IA personnalisés
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    à partir de vos KPI & prévisions
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={askFullAI}
                    disabled={aiLoading}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60"
                  >
                    {aiLoading ? "Analyse…" : "Regénérer"}
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard?.writeText(aiText || "");
                      } catch {}
                    }}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white/70 hover:bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                  >
                    <ClipboardCopy className="w-3.5 h-3.5" />
                    Copier
                  </button>
                </div>
              </div>

              {/* contenu IA */}
              <div className="text-sm leading-6 whitespace-pre-wrap text-gray-800 dark:text-gray-100">
                {aiLoading ? (
                  /* skeleton simple */
                  <div className="animate-pulse space-y-2">
                    <div className="h-3 rounded bg-gray-200/80 dark:bg-gray-700/60 w-11/12" />
                    <div className="h-3 rounded bg-gray-200/80 dark:bg-gray-700/60 w-9/12" />
                    <div className="h-3 rounded bg-gray-200/80 dark:bg-gray-700/60 w-10/12" />
                  </div>
                ) : (
                  aiText || "Activez l’IA puis cliquez sur « Regénérer »."
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="local-mode"
              initial={{ opacity: 0, y: 8, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.995 }}
              transition={{ duration: 0.18 }}
              className="grid gap-4"
            >
              {(Array.isArray(tips) && tips.length > 0
                ? tips
                : ["Aucun conseil disponible"]
              ).map((tip, i) => {
                const isWarning = /alerte|risque|attention/i.test(tip);
                return (
                  <div
                    key={i}
                    className={
                      "flex items-start justify-between rounded-xl border p-4 shadow-sm " +
                      (isWarning
                        ? "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-100"
                        : "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-100")
                    }
                  >
                    {/* Conseil texte + icône */}
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5">
                        {isWarning ? (
                          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
                        )}
                      </span>
                      <p className="text-sm md:text-base leading-snug">{tip}</p>
                    </div>

                    {/* Actions copier / partager */}
                    <div className="flex items-center gap-2 ml-3">
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard?.writeText(tip);
                          } catch {}
                        }}
                        className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-white/40 hover:bg-white/70 text-gray-900 dark:bg-black/30 dark:hover:bg-black/50 dark:text-white"
                      >
                        <ClipboardCopy className="w-3.5 h-3.5" />
                        Copier
                      </button>
                      <button
                        onClick={() => alert("Fonction “Partager” à connecter")}
                        className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        Partager
                      </button>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </Section>

      <Section
        title="Aperçu des données"
        icon={<Sparkles className="w-5 h-5" />}
      >
        <TablePreview
          rows={
            rows && rows.length
              ? rows
              : Papa.parse(SAMPLE_SALES, { header: true, skipEmptyLines: true })
                  .data
          }
        />
      </Section>
    </div>
  );
}

// === Cash Safety · Vue simple dirigeant (bande d’incertitude + 3 tuiles) ===

/* ============================
   CASHFLOW DEMO
============================ */
/* ============================
   CASHFLOW DEMO — FIX
============================ */
// — Robust fetch vers /api/advice avec fallback local —
// Permet d’utiliser VITE_ADVICE_URL si tu as un backend ailleurs

function CashflowDemo() {
  const [startBalance, setStartBalance] = useState(1000);
  const [currency, setCurrency] = useState("€");
  const chartRef = useRef(null);

  // Live data from datastore
  const bankRows = useDataset("banking"); // movements: {date, inflow, outflow, ...}
  const payRows = useDataset("payments"); // payouts:  {date, net|gross|fee, ...}

  // Optional: file override via the existing upload (kept below)
  const [overrideRows, setOverrideRows] = useState(null);

  // Build daily inflow/outflow from datasets (or override if provided)
  const rows = useMemo(() => {
    if (overrideRows && overrideRows.length) return overrideRows;

    // 1) Normalize banking rows
    const b = (bankRows || []).map((r) => ({
      date: toDateKey(r.date),
      inflow: Number(r.inflow || r.credit || 0),
      outflow: Number(r.outflow || r.debit || 0),
    }));

    // 2) Normalize payments rows (treat “net” as inflow)
    const p = (payRows || []).map((r) => ({
      date: toDateKey(r.date),
      inflow: Number(r.net ?? r.gross ?? 0),
      outflow: 0,
    }));

    // 3) Merge per day
    const byDay = new Map();
    for (const x of [...b, ...p]) {
      if (!x.date) continue;
      const prev = byDay.get(x.date) || { date: x.date, inflow: 0, outflow: 0 };
      prev.inflow += x.inflow || 0;
      prev.outflow += x.outflow || 0;
      byDay.set(x.date, prev);
    }
    return Array.from(byDay.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [bankRows, payRows, overrideRows]);

  // --- Export PDF (local au composant) ---

  // Scénarios (futur only)
  const SCENARIOS = {
    normal: { encPct: 0, decPct: 0, label: "Normal" },
    prudent: { encPct: -5, decPct: 2, label: "Prudent" },
    severe: { encPct: -10, decPct: 5, label: "Sévère" },
    optimist: { encPct: 5, decPct: 0, label: "Optimiste" },
  };
  const [scenario, setScenario] = useState("normal");

  function handleUpload(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    parseCsv(f, (data) => setOverrideRows(data)); // overrides datastore for local testing
  }

  // ===== Calcul principal (pour le scénario sélectionné) =====
  const model = useMemo(() => {
    const clean = (rows || [])
      .filter((r) => r.date)
      .map((r) => ({
        date: toDateKey(r.date),
        inflow: Number(r.inflow || 0),
        outflow: Number(r.outflow || 0),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    let bal = Number(startBalance || 0);
    const series = clean.map((r) => {
      const net = r.inflow - r.outflow;
      bal += net;
      return { ...r, net, balance: bal };
    });

    const lastDate = series.length ? series[series.length - 1].date : null;
    const futureDates = lastDate ? rangeDays(lastDate, 30) : [];

    // Modélise le NET quotidien
    const valuesNet = series.map((d) => d.net);
    const seasonInfo = detectWeeklySeasonality(
      series.map((d) => ({ date: d.date, revenue: d.net }))
    );

    let chosen;
    if (valuesNet.length < 8) {
      chosen = { out: ses(valuesNet, 0.5, futureDates.length), season: false };
    } else if (seasonInfo.detected) {
      chosen = {
        out: holtWintersAdditive(
          valuesNet,
          7,
          0.4,
          0.3,
          0.3,
          futureDates.length
        ),
        season: true,
      };
    } else {
      chosen = {
        out: holtDamped(valuesNet, 0.4, 0.3, 0.9, futureDates.length),
        season: false,
      };
    }

    // Écart-type des résidus (NET)
    const fitted = chosen.out.fitted || [];
    const aligned = Math.min(valuesNet.length, fitted.length);
    const resid = [];
    for (let i = 0; i < aligned; i++) resid.push(valuesNet[i] - fitted[i]);
    const sd = (() => {
      if (!resid.length) return 0;
      const m = resid.reduce((s, x) => s + x, 0) / resid.length;
      return Math.sqrt(
        resid.reduce((s, x) => s + Math.pow(x - m, 2), 0) /
          Math.max(1, resid.length - 1)
      );
    })();

    // Leviers appliqués UNIQUEMENT au futur
    const tail = series.slice(-7);
    const avgIn = tail.length
      ? tail.reduce((s, x) => s + x.inflow, 0) / tail.length
      : 0;
    const avgOut = tail.length
      ? tail.reduce((s, x) => s + x.outflow, 0) / tail.length
      : 0;

    const encPct = SCENARIOS[scenario].encPct / 100;
    const decPct = SCENARIOS[scenario].decPct / 100;
    const leverPerDay = avgIn * encPct - avgOut * decPct;

    const baseNetFut = chosen.out.forecast.slice(0, futureDates.length);
    const centralNet = baseNetFut.map((v) => v + leverPerDay);

    // Cumuls → solde futur (médiane + bandes ~90%)
    let bC = series.length
      ? series[series.length - 1].balance
      : Number(startBalance || 0);
    const z = 1.64; // ~90%

    const forecast = futureDates.map((d, i) => {
      bC += centralNet[i] || 0;
      const half = z * sd * Math.sqrt(i + 1);
      return { date: d, forecast: bC, ci_hi: bC + half, ci_lo: bC - half };
    });

    const forecastStart = futureDates[0] || null;

    // KPI
    // KPI — robustes (coussin, médiane, proba de découvert)
    const loValues = forecast
      .map((p) => Number(p.ci_lo))
      .filter(Number.isFinite);
    const ciLoMin = loValues.length ? Math.min(...loValues) : bC;

    const cushion = Math.max(0, Math.ceil(-ciLoMin));
    const medianFinal = forecast.length
      ? Number(forecast[forecast.length - 1].forecast || bC)
      : bC;

    // Proba de découvert (~max sur l'horizon) + date de pic
    function erf(x) {
      const a1 = 0.254829592,
        a2 = -0.284496736,
        a3 = 1.421413741,
        a4 = -1.453152027,
        a5 = 1.061405429,
        p = 0.3275911;
      const sign = x < 0 ? -1 : 1;
      const t = 1 / (1 + p * Math.abs(x));
      const y =
        1 -
        ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
      return sign * y;
    }
    const normalCdf = (zv) => 0.5 * (1 + erf(zv / Math.SQRT2));

    let maxProb = 0;
    let peakDate = null;

    for (const p of forecast) {
      const mu = Number(p.forecast);
      const hi = Number(p.ci_hi);
      const lo = Number(p.ci_lo);
      if (!Number.isFinite(mu)) continue;

      // si les bornes sont foireuses → fallback sur sd (déjà calculé plus haut)
      let sdDay =
        Number.isFinite(hi) && Number.isFinite(lo) ? (hi - lo) / (2 * z) : sd;
      sdDay = Math.max(1e-6, sdDay);

      const prob = normalCdf((0 - mu) / sdDay); // P(solde<0)
      if (Number.isFinite(prob) && prob > maxProb) {
        maxProb = prob;
        peakDate = p.date;
      }
    }

    const probPctRaw = maxProb * 100;
    const probPct = Math.round(probPctRaw);
    // Données graphe
    const chartData = [
      ...series.map((p) => ({ date: p.date, balance: p.balance })),
      ...forecast.map((p) => ({
        date: p.date,
        balance_proj: p.forecast,
        lo: p.ci_lo,
        hi: p.ci_hi,
      })),
    ];

    return {
      series,
      chartData,
      forecastStart,
      probPct, // ✅ pour l’UI
      peakDate, // ✅ pour l’UI
      cushion,
      medianFinal,
      sd,
      baseNetFut,
      futureDates,
      avgIn,
      avgOut,
    };
  }, [rows, startBalance, scenario]);

  const {
    series,
    chartData,
    forecastStart,
    probPct, // %
    peakDate,
    cushion,
    medianFinal,
    sd,
    baseNetFut,
    futureDates,
    avgIn,
    avgOut,
  } = model;

  // ===== Axe Y figé (même échelle pour tous les scénarios) =====
  // On calcule un domaine global en balayant TOUS les scénarios, à partir
  // de l’historique courant (+ bornes futures). Ainsi, changer de scénario
  // n’auto-rescale plus le graphe.
  const yDomain = useMemo(() => {
    if (!series.length) return ["auto", "auto"];

    let minY = Math.min(...series.map((p) => p.balance));
    let maxY = Math.max(...series.map((p) => p.balance));

    // Si on n’a pas encore de forecast, garde un padding autour de l’historique
    if (!futureDates || !futureDates.length) {
      const pad = Math.max(200, (maxY - minY) * 0.08);
      return [Math.floor(minY - pad), Math.ceil(maxY + pad)];
    }

    const z = 1.64; // ~90%
    // baseNetFut vient du modèle (indépendant des leviers)
    Object.entries(SCENARIOS).forEach(([key, def]) => {
      const leverPerDay =
        avgIn * (def.encPct / 100) - avgOut * (def.decPct / 100);
      let b = series[series.length - 1].balance;
      for (let i = 0; i < futureDates.length; i++) {
        b += (baseNetFut[i] || 0) + leverPerDay;
        const half = z * sd * Math.sqrt(i + 1);
        minY = Math.min(minY, b - half);
        maxY = Math.max(maxY, b + half);
      }
    });

    const pad = Math.max(200, (maxY - minY) * 0.08);
    return [Math.floor(minY - pad), Math.ceil(maxY + pad)];
    // IMPORTANT: dépend DE L’HISTO et du dataset, pas du scénario choisi
  }, [series, baseNetFut, futureDates, sd, avgIn, avgOut]);

  // ===== UI =====
  return (
    <div className="space-y-4">
      <Section
        title="Importer trésorerie (CSV)"
        icon={<Upload className="w-5 h-5" />}
      >
        <div className="flex flex-wrap items-end gap-3">
          <input
            type="file"
            accept=".csv"
            onChange={handleUpload}
            className="block"
          />
          <div>
            <label className="block text-xs text-gray-500">Solde initial</label>
            <input
              type="number"
              value={startBalance}
              onChange={(e) => setStartBalance(Number(e.target.value))}
              className="px-3 py-2 rounded-xl border w-36"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Devise</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="px-3 py-2 rounded-xl bg-gray-100"
            >
              <option value="€">EUR (€)</option>
              <option value="$">USD ($)</option>
              <option value="£">GBP (£)</option>
            </select>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Colonnes requises : <code>date, inflow, outflow</code>
        </p>
      </Section>
      <div id="shield">
        <Section
          title="Plan de sécurité trésorerie (30 j)"
          icon={<Shield className="w-5 h-5" />}
          actions={
            <div className="flex gap-2">
              {Object.entries(SCENARIOS).map(([key, s]) => (
                <button
                  key={key}
                  onClick={() => setScenario(key)}
                  className={
                    "px-3 py-1.5 rounded-xl text-sm border " +
                    (scenario === key
                      ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-700 shadow-sm"
                      : "bg-gray-100 dark:bg-gray-800/60 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700")
                  }
                  title="N'affecte que la partie pointillée (prévision)"
                >
                  {s.label}
                </button>
              ))}
            </div>
          }
        >
          <div className="grid md:grid-cols-3 gap-4 mb-3">
            <Card>
              <Stat
                label="Probabilité de découvert (30 j)"
                value={`${formatNumber(probPct || 0, 0)} %`}
                note={peakDate ? `Pic vers ${peakDate}` : "—"}
              />
            </Card>
            <Card>
              <Stat
                label="Coussin de sécurité (≈90%)"
                value={`${formatNumber(cushion, 0)} ${currency}`}
                note="À ajouter au solde actuel"
              />
            </Card>
            <Card>
              <Stat
                label="Solde final attendu (médiane)"
                value={`${formatNumber(medianFinal, 0)} ${currency}`}
                note="Horizon 30 jours"
              />
            </Card>
          </div>

          <div
            id="cashSafetyChart"
            ref={chartRef}
            className="rounded-xl border border-gray-100 dark:border-gray-800 p-2 bg-white dark:bg-gray-900"
          >
            <ResponsiveContainer width="100%" height={380}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={yDomain} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v, name) =>
                    /Solde|Borne/.test(name)
                      ? `${formatNumber(v, 0)} ${currency}`
                      : v
                  }
                />
                <Legend />

                <Line
                  type="monotone"
                  dataKey="balance"
                  name="Solde (historique)"
                  dot={false}
                  strokeWidth={2.5}
                />
                <Line
                  type="monotone"
                  dataKey="balance_proj"
                  name="Solde (projeté)"
                  dot={false}
                  strokeDasharray="6 4"
                  strokeWidth={2.5}
                />
                <Line
                  type="monotone"
                  dataKey="lo"
                  name="Borne basse"
                  dot={false}
                  strokeWidth={1}
                  strokeDasharray="2 4"
                  strokeOpacity={0.6}
                />
                <Line
                  type="monotone"
                  dataKey="hi"
                  name="Borne haute"
                  dot={false}
                  strokeWidth={1}
                  strokeDasharray="2 4"
                  strokeOpacity={0.6}
                />

                {forecastStart && (
                  <ReferenceArea
                    x1={forecastStart}
                    x2={(chartData.slice(-1)[0] || {}).date}
                    strokeOpacity={0.06}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>

            <div className="mt-2 text-xs text-gray-500">
              L’échelle verticale est figée pour tous les scénarios afin
              d’éviter tout « effet d’optique ». L’historique n’est jamais
              modifié, seuls les points en pointillé (futur) changent.
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ===== Encaissements (DSO Guard) =====
function EmailRelanceButton({ invoice }) {
  const dueISO = (() => {
    const raw = invoice?.due_date;
    const d = raw instanceof Date ? raw : new Date(raw);
    return isNaN(d) ? String(raw ?? "") : d.toISOString().slice(0, 10);
  })();

  const subject = encodeURIComponent(
    `Relance facture ${invoice.invoice_id} – ${invoice.client}`
  );
  const body = encodeURIComponent(
    `Bonjour ${invoice.client},

Je me permets de vous contacter au sujet de la facture ${
      invoice.invoice_id
    } d’un montant de ${formatNumber(invoice.amount)} ${
      invoice.currency
    }, arrivée à échéance le ${dueISO}.

Pourriez-vous nous indiquer la date de règlement prévue ?
${
  invoice.stripe_url
    ? `Si besoin, vous pouvez payer ici : ${invoice.stripe_url}`
    : `Si besoin, je peux vous envoyer un lien de paiement sécurisé.`
}

Merci d’avance pour votre retour.
Bien cordialement,
— InsightMate`
  );
  const mailto = `mailto:${
    invoice.email || ""
  }?subject=${subject}&body=${body}`;
  return (
    <div className="flex gap-2">
      <a
        href={mailto}
        className="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm hover:bg-black inline-flex items-center gap-2"
      >
        <Mail className="w-4 h-4" /> Ouvrir email
      </a>
      {invoice.stripe_url ? (
        <a
          href={invoice.stripe_url}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm inline-flex items-center gap-2"
        >
          <LinkIcon className="w-4 h-4" /> Lien de paiement
        </a>
      ) : (
        <button
          disabled
          className="px-3 py-2 rounded-xl bg-gray-100 text-gray-400 text-sm inline-flex items-center gap-2"
        >
          <LinkIcon className="w-4 h-4" /> Lien de paiement
        </button>
      )}
    </div>
  );
}

function EncaissementsDemo() {
  const [asOf, setAsOf] = useState(() => new Date());
  const [csv, setCsv] = useState(SAMPLE_INVOICES_CSV);
  const [invoices, setInvoices] = useState(() =>
    parseInvoicesCsv(SAMPLE_INVOICES_CSV)
  );

  const [startingBal, setStartingBal] = useState(5000);
  const [dailyNetOut, setDailyNetOut] = useState(200);
  const [whatIfRate, setWhatIfRate] = useState(40); // %
  useEffect(() => {
    // 1) Si on a de vraies factures importées
    const invRows = loadDataset("invoices");
    if (invRows && invRows.length) {
      const coerce = (r) => ({
        invoice_id: String(r.invoice_id || r.id || ""),
        client: (r.client || r.customer || "Client").trim?.() || "Client",
        email: (r.email || "").trim?.() || "",
        phone: (r.phone || "").trim?.() || "",
        issue_date: r.issue_date
          ? new Date(r.issue_date)
          : r.date
          ? new Date(r.date)
          : null,
        due_date: r.due_date ? new Date(r.due_date) : null,
        amount: Number(r.amount ?? r.total ?? r.net ?? 0),
        currency: (r.currency || "EUR").trim?.() || "EUR",
        status:
          (r.status || (r.paid_date ? "PAID" : "ISSUED")).trim?.() || "ISSUED",
        paid_date: r.paid_date ? new Date(r.paid_date) : null,
        stripe_url: r.stripe_url || r.url || "",
      });
      setInvoices(invRows.map(coerce));
      return;
    }

    // 2) Sinon, “payments” → on synthétise en factures payées
    const pay = loadDataset("payments");
    if (pay && pay.length) {
      const toInvoice = (r, i) => {
        const d = r.date ? new Date(r.date) : null;
        const net = Number(r.net ?? r.amount ?? r.gross ?? 0);
        return {
          invoice_id: `PAY-${i + 1}`,
          client: r.customer || r.description || "Encaissement",
          email: "",
          phone: "",
          issue_date: d,
          due_date: d,
          amount: net,
          currency: r.currency || "EUR",
          status: "PAID",
          paid_date: d,
          stripe_url: r.balance_transaction
            ? `https://dashboard.stripe.com/tx/${r.balance_transaction}`
            : "",
        };
      };
      setInvoices(pay.map(toInvoice));
    }
  }, []);

  const { buckets, overdueTotal, open } = useMemo(
    () => computeAging(invoices, asOf),
    [invoices, asOf]
  );
  const dso = useMemo(() => computeDSO(invoices, asOf), [invoices, asOf]);
  const recover7 = useMemo(() => computeRecoverable7d(buckets), [buckets]);

  const agingData = useMemo(
    () => [
      {
        name: "À échéance/À venir",
        amount: Math.round(buckets["À échéance/À venir"] || 0),
      },
      { name: "1–15 j", amount: Math.round(buckets["1–15 j"] || 0) },
      { name: "16–30 j", amount: Math.round(buckets["16–30 j"] || 0) },
      { name: "31–60 j", amount: Math.round(buckets["31–60 j"] || 0) },
      { name: "61+ j", amount: Math.round(buckets["61+ j"] || 0) },
    ],
    [buckets]
  );

  const gt30 = open.filter((v) => v.days_past_due > 30);
  const impactCash = Math.round(
    (whatIfRate / 100) * gt30.reduce((s, v) => s + v.amount, 0)
  );
  const runwayDays = dailyNetOut > 0 ? Math.floor(impactCash / dailyNetOut) : 0;

  const topRelance = useMemo(
    () =>
      open
        .filter((v) => v.past_due)
        .map((v) => ({ ...v, risk: riskScore(v) }))
        .sort((a, b) => b.risk - a.risk || b.amount - a.amount)
        .slice(0, 10),
    [open]
  );

  function handleLoad() {
    setInvoices(parseInvoicesCsv(csv));
  }

  return (
    <div className="space-y-4">
      <Section
        title="Encaissements — Importer (CSV)"
        icon={<Wallet className="w-5 h-5" />}
        actions={
          <div className="flex gap-2">
            <input
              type="date"
              value={new Date(asOf.getTime() - asOf.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 10)}
              onChange={(e) => setAsOf(new Date(e.target.value + "T00:00:00"))}
              className="px-3 py-2 rounded-xl border text-sm"
              title="Date d’évaluation"
            />
            <button
              onClick={handleLoad}
              className="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm hover:bg-black"
            >
              Charger le CSV
            </button>
          </div>
        }
      >
        <textarea
          className="mt-2 w-full h-36 rounded-xl border border-gray-200 p-3 font-mono text-xs"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <p className="text-xs text-gray-500 mt-2">
          Colonnes requises:{" "}
          <code>
            invoice_id, client, email, phone, issue_date, due_date, amount,
            currency, status, paid_date, stripe_url
          </code>
        </p>
      </Section>

      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <Stat
            label="Montant en retard"
            value={`${formatNumber(overdueTotal)} €`}
          />
        </Card>
        <Card>
          <Stat label="DSO estimé" value={`${dso} j`} />
        </Card>
        <Card>
          <Stat
            label="Cash récupérable (7 j)"
            value={`${formatNumber(recover7)} €`}
          />
        </Card>
        <Card>
          <Stat label="Factures ouvertes" value={open.length} />
        </Card>
      </div>

      <Section
        title="What-if & Runway"
        icon={<HandCoins className="w-5 h-5" />}
      >
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">
            Trésorerie actuelle (€)
            <input
              type="number"
              className="mt-1 w-full rounded-xl border p-2"
              value={startingBal}
              onChange={(e) => setStartingBal(Number(e.target.value || 0))}
            />
          </label>
          <label className="text-sm">
            Dépense nette / jour (€)
            <input
              type="number"
              className="mt-1 w-full rounded-xl border p-2"
              value={dailyNetOut}
              onChange={(e) => setDailyNetOut(Number(e.target.value || 0))}
            />
          </label>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-sm">
            <span>% encaisser (&gt;30 j)</span>
            <span>{whatIfRate}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            className="w-full mt-1"
            value={whatIfRate}
            onChange={(e) => setWhatIfRate(Number(e.target.value))}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Card>
            <Stat
              label="Impact cash"
              value={`+${formatNumber(impactCash)} €`}
            />
          </Card>
          <Card>
            <Stat label="Jours de runway gagnés" value={`+${runwayDays} j`} />
          </Card>
        </div>
      </Section>

      <div className="grid md:grid-cols-2 gap-4">
        <Section
          title="Vieillissement des créances"
          icon={<TrendingUp className="w-5 h-5" />}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={agingData}
                margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v) => formatNumber(v)}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip formatter={(v) => `${formatNumber(v)} €`} />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                  <LabelList
                    dataKey="amount"
                    position="top"
                    formatter={(v) => (v ? `${formatNumber(v)}€` : "")}
                    style={{ fontSize: 11 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Priorise 61+ j puis 31–60 j.
          </div>
        </Section>

        <Section
          title="Top 10 à relancer"
          icon={<AlertTriangle className="w-5 h-5" />}
        >
          <div className="space-y-3">
            {topRelance.length === 0 && (
              <div className="text-sm text-gray-500">
                Aucune facture en retard 🎉
              </div>
            )}
            {topRelance.map((inv) => (
              <div key={inv.invoice_id} className="border rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">
                      {inv.client} · {inv.invoice_id}
                    </div>
                    <div className="text-xs text-gray-500">
                      Échéance: {inv.due_date.toISOString().slice(0, 10)} ·
                      Retard: {inv.days_past_due} j
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {formatNumber(inv.amount)} €
                    </div>
                    <div className="text-xs text-gray-500">
                      Risque {inv.risk}/100
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <EmailRelanceButton invoice={inv} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
// === PATCH PRICING — UTILS SÛRS ===

// === /PATCH UTILS ===

// === PRICING GUARDRAILS (ADD BEFORE PricingOptimizer) ===
const PRICING_CFG = {
  minMarginPct: 0.1, // marge brute mini +10%
  maxChangePct: 0.2, // variation max ±20% par cycle
  kviMaxUpPct: 0.05, // KVI : hausse limitée à +5%
  charm: true, // arrondi .99
};

function charm99(p) {
  if (!PRICING_CFG.charm) return Number(p.toFixed(2));
  const base = Math.floor(p);
  const c99 = base + 0.99;
  if (p < c99 && c99 - p < 0.02) return Number(p.toFixed(2));
  return Number((base + 0.99).toFixed(2));
}

// Heuristique “markdown” : si surstock + délai long -> autorise plus de baisse
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
// === /PRICING GUARDRAILS ===

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

  // Estimation d’élasticité (log-log) sur historique
  function estimateElasticityFromHistory(rows) {
    const clean = rows
      .map((r) => ({ p: toNum(r.price), q: toNum(r.qty) }))
      .filter((r) => r.p > 0 && r.q > 0);
    if (clean.length < 3) return -1.3;
    const xs = clean.map((r) => Math.log(r.p));
    const ys = clean.map((r) => Math.log(r.q));
    const n = xs.length;
    const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const mx = mean(xs),
      my = mean(ys);
    let num = 0,
      den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) * (xs[i] - mx);
    }
    const e = den === 0 ? -1.3 : num / den;
    return Number.isFinite(e) ? e : -1.3;
  }

  // Lerner (prix “théorique” sans garde-fous)
  function optimalPrice({ c, e, P0 }) {
    if (!Number.isFinite(e) || e >= -1.05) return P0;
    return (c * e) / (e + 1);
  }

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

  const charm99 = (p) => {
    if (!cfg.charm) return Number(p.toFixed(2));
    const base = Math.floor(p);
    const c99 = base + 0.99;
    if (p < c99 && c99 - p < 0.02) return Number(p.toFixed(2));
    return Number((base + 0.99).toFixed(2));
  };

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

  // Biais déstockage
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
/* ============================
   ÉCO-LABEL (durabilité)
============================ */
function EcoLabelPage() {
  // en haut d’EcoLabelPage()
  const bankingRows = useDataset("banking");
  const salesRows = useDataset("sales");

  const auto = React.useMemo(
    () => ecoExtractFromBank(bankingRows, salesRows),
    [bankingRows, salesRows]
  );

  // 1) Données (on prend les ventes importées si dispo, sinon l’échantillon)
  const { last30Revenue, last30Orders } = useMemo(() => {
    const base =
      salesRows && salesRows.length
        ? salesRows
        : Papa.parse(SAMPLE_SALES, { header: true, skipEmptyLines: true }).data;

    const rows = (base || [])
      .map((r) => ({
        date: toDateKey(
          r.date || r.Date || r.created_at || r.order_date || new Date()
        ),
        qty: Number(r.qty || r.quantity || 1),
        price: Number(r.price || r.unit_price || r.amount || r.total || 0),
      }))
      .filter((r) => r.date && r.qty > 0 && r.price >= 0);

    const sinceISO = toDateKey(Date.now() - 30 * 864e5);
    const last30 = rows.filter((r) => r.date >= sinceISO);
    const last30Revenue = last30.reduce((s, r) => s + r.qty * r.price, 0);
    const last30Orders = last30.length;

    return { last30Revenue, last30Orders };
  }, [salesRows]);

  // 2) Paramètres utilisateur (quick & transparent)
  const [sector, setSector] = useState("ecommerce");
  // DÉMO prête à l'emploi (exemple réaliste)
  const [kwhMonth, setKwhMonth] = useState("450"); // kWh/mois (ex : boutique + petit entrepôt)
  const [dieselL, setDieselL] = useState("60"); // L/mois (livraisons / déplacements)
  const [shipKgOrder, setShipKgOrder] = useState(
    ECO_FACTORS.shippingKgPerOrder
  ); // 0.9 par défaut

  // 3) Calculs
  const sinceISO30 = toDateKey(Date.now() - 30 * 864e5);
  const txCarbon = useMemo(
    () => estimateCO2eFromBankTx(bankingRows, sinceISO30),
    [bankingRows]
  );

  // --- DEMO snapshot so tiles always show data when nothing is connected
  const demoMode =
    Number(last30Revenue) === 0 && !(bankingRows && bankingRows.length);
  const displayRevenue = demoMode ? 12500 : last30Revenue; // € (30j)
  const displayOrders = demoMode ? 320 : last30Orders; // nb (30j)
  const displayConf = demoMode ? 65 : txCarbon?.confidence || 0; // %

  const sectorEmissions =
    (ECO_FACTORS.sectorKgPerEUR[sector] || 0) * last30Revenue;
  const shipping = last30Orders * (Number(shipKgOrder) || 0);
  const electricity = (Number(kwhMonth) || 0) * ECO_FACTORS.electricityKgPerKWh;
  const fuel = (Number(dieselL) || 0) * ECO_FACTORS.dieselKgPerL;

  const totalKg = Math.max(
    0,
    Math.round(
      sectorEmissions + shipping + (txCarbon?.totalKg || electricity + fuel)
    )
  );

  const intensity = last30Revenue > 0 ? totalKg / last30Revenue : Infinity; // kg/€
  const { grade, color } = ecoGradeFromIntensity(intensity);

  // 4bis) Fenêtre & séries d’intensité (7/30/90j)
  const [ecoWindow, setEcoWindow] = useState(30);

  const salesDaily = useMemo(() => {
    const rows = (
      salesRows && salesRows.length
        ? salesRows
        : Papa.parse(SAMPLE_SALES, { header: true, skipEmptyLines: true }).data
    )
      .map((r) => ({
        date: toDateKey(
          r.date || r.Date || r.created_at || r.order_date || new Date()
        ),
        qty: Number(r.qty || r.quantity || 1),
        price: Number(r.price || r.unit_price || r.amount || r.total || 0),
      }))
      .filter((r) => r.date && r.qty > 0 && r.price >= 0);

    const byDay = {};
    rows.forEach((r) => {
      const rev = r.qty * r.price;
      byDay[r.date] = byDay[r.date] || { revenue: 0, orders: 0 };
      byDay[r.date].revenue += rev;
      byDay[r.date].orders += 1; // 1 ligne = 1 “commande” simplifiée
    });

    return Object.keys(byDay)
      .sort()
      .map((d) => ({ date: d, ...byDay[d] }));
  }, [salesRows]);

  const intensitySeries = useMemo(() => {
    const sectorFactor = ECO_FACTORS.sectorKgPerEUR[sector] || 0;
    const elecPerDay =
      ((Number(kwhMonth) || 0) * ECO_FACTORS.electricityKgPerKWh) / 30;
    const fuelPerDay = ((Number(dieselL) || 0) * ECO_FACTORS.dieselKgPerL) / 30;

    return (salesDaily || []).map((d) => {
      const shipKg = d.orders * (Number(shipKgOrder) || 0);
      const sectorKg = d.revenue * sectorFactor;
      const total = Math.max(0, sectorKg + shipKg + elecPerDay + fuelPerDay);
      const inten = d.revenue > 0 ? total / d.revenue : null;
      return {
        date: d.date,
        intensity: inten,
        totalKg: total,
        revenue: d.revenue,
      };
    });
  }, [salesDaily, sector, shipKgOrder, kwhMonth, dieselL]);

  const ecoSpark = useMemo(
    () =>
      (intensitySeries || [])
        .filter((p) => Number.isFinite(p.intensity))
        .slice(-ecoWindow)
        .map((p) => ({ x: p.date, y: Number(p.intensity.toFixed(3)) })),
    [intensitySeries, ecoWindow]
  );

  const sectorMedian = ECO_FACTORS.sectorKgPerEUR[sector] || 0;

  // Budget CO2e simple + signal Cockpit
  const [budgetKgMonth, setBudgetKgMonth] = useState(1000);
  const avgKgPerDay = useMemo(() => {
    const last = (intensitySeries || [])
      .slice(-30)
      .reduce((s, x) => s + (x.totalKg || 0), 0);
    const n = Math.min(30, (intensitySeries || []).length || 0);
    return n ? last / n : 0;
  }, [intensitySeries]);
  const daysToBreach =
    budgetKgMonth && avgKgPerDay > 0
      ? Math.floor(budgetKgMonth / avgKgPerDay)
      : null;

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("im:eco", { detail: { daysToBreach } })
    );
  }, [daysToBreach]);

  // 4ter) Objectif & Conseils IA (plan d’action chiffré)
  const initialTarget =
    grade === "A"
      ? 0.2
      : grade === "B"
      ? 0.2
      : grade === "C"
      ? 0.5
      : grade === "D"
      ? 1.0
      : 1.5;
  const [targetIntensity, setTargetIntensity] = useState(initialTarget);
  // Keep target auto-aligned with latest grade unless the user edits it
  const [targetDirty, setTargetDirty] = useState(false);
  useEffect(() => {
    if (!targetDirty) setTargetIntensity(initialTarget);
  }, [initialTarget, targetDirty]);

  const [doneIds, setDoneIds] = useState(new Set());

  const aiPlan = useMemo(() => {
    const needKg = Math.max(0, totalKg - targetIntensity * last30Revenue);
    const out = [];
    if (needKg <= 0) {
      out.push({
        id: "keep",
        label: "Objectif atteint — maintenir les bonnes pratiques.",
        impactKg: 0,
      });
      return out;
    }
    // Heuristique de répartition (40% élec, 30% carburant, 30% shipping)
    let remain = needKg;
    if ((Number(kwhMonth) || 0) > 0) {
      const kg = Math.round(Math.min(remain * 0.4, remain));
      const perKwh = ECO_FACTORS.electricityKgPerKWh;
      const kwhDelta = Math.max(1, Math.ceil(kg / Math.max(perKwh, 0.0001)));
      out.push({
        id: "elec",
        label: `Réduire l’électricité d’environ ${kwhDelta} kWh/mois (≈ -${Math.round(
          kwhDelta * perKwh
        )} kg)`,
        impactKg: Math.round(kwhDelta * perKwh),
      });
      remain -= Math.round(kwhDelta * perKwh);
    }
    if ((Number(dieselL) || 0) > 0 && remain > 0) {
      const kg = Math.round(Math.min(needKg * 0.3, remain));
      const perL = ECO_FACTORS.dieselKgPerL;
      const lDelta = Math.max(1, Math.ceil(kg / Math.max(perL, 0.0001)));
      out.push({
        id: "fuel",
        label: `Réduire le carburant d’environ ${lDelta} L/mois (≈ -${Math.round(
          lDelta * perL
        )} kg)`,
        impactKg: Math.round(lDelta * perL),
      });
      remain -= Math.round(lDelta * perL);
    }
    if (last30Orders > 0 && remain > 0) {
      const kg = Math.round(Math.max(0, remain));
      const perOrderDelta = Math.max(
        1,
        Math.ceil(kg / Math.max(last30Orders, 1))
      );
      const newPerOrder = Math.max(
        0,
        (Number(shipKgOrder) || 0) - perOrderDelta
      );
      out.push({
        id: "ship",
        label: `Optimiser expéditions : -${perOrderDelta} kg/commande (cible ${newPerOrder.toFixed(
          2
        )} kg/commande) ≈ -${perOrderDelta * last30Orders} kg`,
        impactKg: perOrderDelta * last30Orders,
      });
    }
    return out;
  }, [
    totalKg,
    targetIntensity,
    last30Revenue,
    kwhMonth,
    dieselL,
    last30Orders,
    shipKgOrder,
  ]);

  const toggleTodo = (id) => {
    setDoneIds((prev) => {
      const next = new Set([...prev]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 4) Conseils simples
  const tips = [
    shipping > 0 &&
      `Optimiser les expéditions : -20% colis (groupage, relais) ≈ -${Math.round(
        shipping * 0.2
      )} kg/mois`,
    electricity > 0 &&
      `Énergie : plan -10% kWh (veille, 19–26°C) ≈ -${Math.round(
        electricity * 0.1
      )} kg/mois`,
    fuel > 0 &&
      `Déplacements : +co-voiturage / EV partagée ≈ -${Math.round(
        fuel * 0.25
      )} kg/mois`,
  ].filter(Boolean);

  // --- KPI Tiles helpers ---
  function KpiTile({ label, value, sublabel, progress = null, icon = null }) {
    return (
      <div className="rounded-2xl border bg-white/60 dark:bg-slate-900/40 p-4 shadow-sm flex flex-col justify-between min-h-[220px]">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">{label}</div>
          {icon}
        </div>
        <div className="text-2xl font-semibold leading-tight">{value}</div>
        {sublabel && <div className="text-xs text-slate-500">{sublabel}</div>}
        {progress !== null && (
          <div className="mt-2 h-2 w-full rounded bg-slate-100 dark:bg-slate-800">
            <div
              className="h-2 rounded bg-slate-900 dark:bg-white"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  function BigEmissionsTile({
    totalKg,
    demo = false,
    spark = [],
    breakdown = { electricity: 0, fuel: 0, shipping: 0 },
    intensity = null,
    sectorMedian = null,
    thresholds = null,
  }) {
    const total = Math.max(1, totalKg);
    const part = {
      electricity: Math.round((breakdown.electricity / total) * 100),
      fuel: Math.round((breakdown.fuel / total) * 100),
      shipping: Math.round((breakdown.shipping / total) * 100),
    };
    // --- dynamic tone based on intensity vs thresholds/sector
    const hasInt =
      Number.isFinite(Number(intensity)) &&
      Number.isFinite(Number(sectorMedian));
    const warn = thresholds?.warn ?? (hasInt ? Number(sectorMedian) : null);
    const danger =
      thresholds?.danger ??
      (hasInt && Number(sectorMedian) ? Number(sectorMedian) * 1.5 : null);

    const lastY =
      spark && spark.length ? Number(spark[spark.length - 1].y) : null;

    let bgCls =
      "bg-gradient-to-br from-emerald-50 via-white to-emerald-100 " +
      "dark:from-emerald-900/25 dark:via-slate-900/40 dark:to-emerald-900/20";

    if (Number.isFinite(Number(intensity)) && warn != null && danger != null) {
      if (Number(intensity) > danger) {
        bgCls =
          "bg-gradient-to-br from-rose-50 via-white to-rose-100 " +
          "dark:from-rose-900/25 dark:via-slate-900/40 dark:to-rose-900/20";
      } else if (Number(intensity) > warn) {
        bgCls =
          "bg-gradient-to-br from-amber-50 via-white to-amber-100 " +
          "dark:from-amber-900/25 dark:via-slate-900/40 dark:to-amber-900/20";
      }
    }

    const sparkTone =
      Number.isFinite(lastY) && warn != null && danger != null
        ? lastY > danger
          ? "text-rose-600"
          : lastY > warn
          ? "text-amber-600"
          : "text-emerald-600"
        : "text-indigo-500";

    return (
      <div
        className={`relative overflow-hidden rounded-2xl border ${bgCls} p-5 shadow-md min-h-[260px]`}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Émissions totales (mois)
            </div>
            <div className="text-3xl font-bold">
              {totalKg.toLocaleString()} <span className="text-lg">kgCO₂e</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Élec{" "}
                {part.electricity}%
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Carburant{" "}
                {part.fuel}%
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />{" "}
                Expéditions {part.shipping}%
              </span>
            </div>
          </div>
          {demo && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-slate-900/5 dark:bg-white/10">
              Exemple
            </span>
          )}
        </div>
        {/* mini donut breakdown */}
        <div className="absolute top-3 right-3 w-28 h-28">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  {
                    name: "Élec",
                    value: breakdown.electricity || 0,
                    fill: "#059669",
                  }, // emerald-600
                  {
                    name: "Carburant",
                    value: breakdown.fuel || 0,
                    fill: "#f43f5e",
                  }, // rose-500
                  {
                    name: "Expéditions",
                    value: breakdown.shipping || 0,
                    fill: "#14b8a6",
                  }, // teal-500
                ]}
                dataKey="value"
                innerRadius={36}
                outerRadius={52}
                startAngle={90}
                endAngle={450}
                padAngle={2}
                cornerRadius={6}
                isAnimationActive={false}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* sparkline */}
        <div
          className={`absolute right-3 bottom-3 left-3 h-14 opacity-80 pointer-events-none ${sparkTone}`}
        >
          <MiniSparkline
            data={spark}
            thresholds={
              warn != null && danger != null ? { warn, danger } : null
            }
          />
        </div>
      </div>
    );
  }

  // --- Floating IA assistant (Right Dock) ---
  // --- IA Advisor (inline, right-rail) ---
  function EcoAdvisorPanel({ plan = [], doneIds = new Set(), toggle }) {
    return (
      <Card>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <div className="text-sm font-semibold">Conseils IA — Impact</div>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              Priorités chiffrées
            </span>
          </div>
        </div>

        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Cible d’intensité (kg/€) et actions priorisées. Cochez ce qui est
          fait.
        </div>

        {/* Checklist */}
        <ul className="mt-3 space-y-2 text-sm">
          {plan.map((t) => (
            <label
              key={t.id}
              className="group flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 p-3"
            >
              <input
                type="checkbox"
                className="mt-1.5 h-4 w-4 rounded border-slate-300 focus:ring-2 focus:ring-indigo-400"
                checked={doneIds.has(t.id)}
                onChange={() => toggle(t.id)}
              />
              <div className="min-w-0">
                <div className="font-medium leading-snug">{t.label}</div>
                {t.impactKg > 0 && (
                  <div className="mt-0.5 text-xs text-slate-500">
                    Impact estimé : ~{t.impactKg.toLocaleString()} kg
                  </div>
                )}
              </div>
            </label>
          ))}
          {!plan?.length && (
            <li className="text-sm text-slate-500">
              Aucun conseil pour l’instant.
            </li>
          )}
        </ul>

        {/* Footer actions */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="subtle"
            icon={<FileDown className="w-4 h-4" />}
          >
            Exporter le plan
          </Button>
          <Button
            size="sm"
            variant="subtle"
            icon={<Share2 className="w-4 h-4" />}
          >
            Partager
          </Button>
        </div>

        <AINote
          className="mt-2"
          text="Conseils générés automatiquement. À valider avant diffusion."
        />
      </Card>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 md:px-4">
      <Section
        title="Éco-Label (estimation pédagogique)"
        icon={<Leaf className="w-5 h-5 text-emerald-600" />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="subtle"
              size="sm"
              onClick={() => {
                // auto-fill from banking extraction
                setKwhMonth(Math.round(auto.kwh || 0));
                setDieselL(Math.round(auto.dieselL || 0));
                const last30 = Math.max(
                  1,
                  (salesRows || []).filter((r) => {
                    const d = new Date(r.date || r.created_at || Date.now());
                    return (Date.now() - d.getTime()) / 86400000 <= 30;
                  }).length
                );
                const kgPerOrder =
                  (ECO_DEFAULTS.shipKgPerOrder || 0.9) *
                  ((auto.shipOrders || 0) / last30);
                setShipKgOrder(Math.max(0.1, Math.round(kgPerOrder * 10) / 10));
              }}
              icon={<Wand2 className="w-4 h-4" />}
            >
              Remplir auto depuis Banque
            </Button>

            <Button
              variant="subtle"
              size="sm"
              onClick={() => {
                const payload = {
                  generatedAt: new Date().toISOString(),
                  windowDays: ecoWindow,
                  factorsVersion: "IM-0.2",
                  sector,
                  sectorFactor: ECO_FACTORS.sectorKgPerEUR[sector] || 0,
                  shippingPerOrder: Number(shipKgOrder) || 0.9,
                  bankConfidence: txCarbon?.confidence || 0,
                  bankBreakdownKg: txCarbon?.byTag || {},
                  totals: {
                    last30Revenue,
                    last30Orders,
                    totalKg,
                    intensity: Number.isFinite(intensity)
                      ? +intensity.toFixed(3)
                      : null,
                  },
                };
                const blob = new Blob([JSON.stringify(payload, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "insightmate-methodology.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
              icon={<FileDown className="w-4 h-4" />}
            >
              Export méthodologie (.json)
            </Button>
          </div>
        }
      >
        <div id="eco-report">
          {/* Badge */}
          <div className="flex items-center gap-4 mb-4">
            <div
              className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${color} text-2xl font-bold shadow`}
            >
              {grade}
            </div>
            <div>
              <div className="text-lg font-semibold">Éco-Label InsightMate</div>
              <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                <span>
                  Intensité estimée :{" "}
                  <b>
                    {(() => {
                      const { value } = computeIntensity({
                        totalKg,
                        last30Revenue,
                        sectorMedian,
                      });
                      return Number.isFinite(value) ? value.toFixed(2) : "—";
                    })()}{" "}
                    kgCO₂e/€
                  </b>
                </span>
                <ConfidencePill value={txCarbon?.confidence || 0} />
              </div>

              <div className="text-xs text-gray-500">
                Méthodologie simple basée sur facteurs publics (GHG/ADEME ordre
                de grandeur) — non certifiée.
              </div>
            </div>
          </div>

          {/* Fenêtre & tendance */}
          <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Période :</span>
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setEcoWindow(d)}
                  className={`text-xs px-2 py-1 rounded-lg border ${
                    ecoWindow === d
                      ? "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:text-white dark:border-emerald-500"
                      : "hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                  }`}
                >
                  {d}j
                </button>
              ))}
            </div>
            <div className="w-full md:w-64">
              <MiniSparkline data={ecoSpark} />
            </div>
          </div>

          {/* Comparateur secteur */}
          {/* Comparateur secteur — compact, executive look */}
          <div className="mb-6 rounded-2xl border bg-white/70 dark:bg-slate-900/60 backdrop-blur p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                Intensité vs. secteur
              </div>
              <div className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Médiane secteur ~ {sectorMedian.toFixed(2)} kg/€
              </div>
            </div>

            {/* Main row: value + percentile */}
            <div className="mt-1.5 flex items-end gap-3">
              <div className="text-2xl font-semibold tracking-tight">
                {(() => {
                  const { value } = computeIntensity({
                    totalKg,
                    last30Revenue,
                    sectorMedian,
                  });
                  return Number.isFinite(value) ? value.toFixed(2) : "—";
                })()}{" "}
                <span className="text-base">kg/€</span>
              </div>

              {/* Percentile chip (lower = better) */}
              {(() => {
                const { value: showIntensity } = computeIntensity({
                  totalKg,
                  last30Revenue,
                  sectorMedian,
                });
                const hasVal =
                  Number.isFinite(showIntensity) && sectorMedian > 0;
                if (!hasVal) return null;
                const r = showIntensity / sectorMedian;
                let pct = Math.round(100 - ((r - 0.5) / 1.0) * 80);
                pct = Math.max(5, Math.min(95, pct));
                const label =
                  pct >= 50
                    ? `Top ${100 - pct}% du secteur`
                    : `${pct}ᵉ percentile`;
                const tone =
                  pct >= 75
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : pct >= 50
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : pct >= 25
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
                return (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${tone}`}>
                    {label}
                  </span>
                );
              })()}
            </div>

            {/* Comparator track (0 → 2× median) */}
            {/* Comparator track (0 → 2× median) */}
            {(() => {
              const { value: showIntensity } = computeIntensity({
                totalKg,
                last30Revenue,
                sectorMedian,
              });
              const hasVal = Number.isFinite(showIntensity) && sectorMedian > 0;
              const maxVal = sectorMedian * 2;
              const pos = hasVal
                ? Math.max(0, Math.min(1, showIntensity / maxVal))
                : 0;

              return (
                <div className="mt-3">
                  <div className="relative h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    {/* Subtle ticks */}
                    <div className="absolute inset-y-0 left-1/4 w-px bg-slate-300/60 dark:bg-slate-600/60" />
                    <div
                      className="absolute inset-y-0 left-1/2 w-px bg-slate-400/80 dark:bg-slate-500"
                      title="Médiane secteur"
                    />
                    <div className="absolute inset-y-0 left-3/4 w-px bg-slate-300/60 dark:bg-slate-600/60" />

                    {/* Your position marker */}
                    <div
                      className="absolute -top-1 -translate-x-1/2"
                      style={{ left: `${pos * 100}%` }}
                      aria-label="Votre intensité"
                    >
                      <div className="mx-auto h-3.5 w-0.5 rounded bg-slate-900/90 dark:bg-white/85" />
                      <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 text-center">
                        vous
                      </div>
                    </div>
                  </div>

                  {/* Scale labels */}
                  <div className="mt-1.5 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>0</span>
                    <span>25ᵉ</span>
                    <span>50ᵉ (médiane)</span>
                    <span>75ᵉ</span>
                    <span>~2× méd.</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* KPIs (denser, more aesthetic) */}
          <div className="grid lg:grid-cols-12 sm:grid-cols-6 grid-cols-1 gap-4 mb-6">
            {/* Big hero tile */}
            <div className="lg:col-span-6 sm:col-span-6 col-span-1">
              <BigEmissionsTile
                totalKg={totalKg}
                intensity={intensity}
                sectorMedian={sectorMedian}
                thresholds={{ warn: sectorMedian, danger: sectorMedian * 1.5 }}
                demo={demoMode}
                spark={ecoSpark}
                breakdown={{ electricity, fuel, shipping }}
              />
            </div>

            <div className="lg:col-span-3 sm:col-span-3 col-span-1">
              <KpiTile
                label="Intensité (kg/€)"
                value={(() => {
                  const { value, source } = computeIntensity({
                    totalKg,
                    last30Revenue,
                    sectorMedian,
                  });
                  return (
                    <span className="inline-flex items-center gap-2">
                      {Number.isFinite(value) ? value.toFixed(2) : "—"}
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600">
                        {source === "measured"
                          ? "mesuré"
                          : source === "sector"
                          ? "médiane secteur"
                          : "—"}
                      </span>
                    </span>
                  );
                })()}
                sublabel={`Secteur ~ ${sectorMedian.toFixed(2)} kg/€`}
                progress={(() => {
                  const { value /* , source */ } = computeIntensity({
                    totalKg,
                    last30Revenue: displayRevenue,
                    sectorMedian,
                  });

                  return Number.isFinite(value) && sectorMedian > 0
                    ? Math.min(100, (sectorMedian / Math.max(0.01, value)) * 50)
                    : 0;
                })()}
              />
            </div>

            <div className="lg:col-span-3 sm:col-span-3 col-span-1">
              <KpiTile
                label="Commandes (30j)"
                value={formatNumber(displayOrders, 0)}
                sublabel="Période glissante"
                progress={Math.min(100, displayOrders ? 70 : 10)}
              />
            </div>
            <div className="lg:col-span-3 sm:col-span-3 col-span-1">
              <Card>
                <div className="text-sm font-medium">Objectif d’intensité</div>
                {(() => {
                  const { value /* , source */ } = computeIntensity({
                    totalKg,
                    last30Revenue: displayRevenue,
                    sectorMedian,
                  });

                  const target = Number.isFinite(targetIntensity)
                    ? targetIntensity
                    : sectorMedian;

                  if (!Number.isFinite(value) || !Number.isFinite(target)) {
                    return (
                      <div className="mt-3 text-xs text-slate-500">
                        En attente de données…
                      </div>
                    );
                  }

                  const gap = value - target;
                  const onTrack = gap <= 0;

                  return (
                    <div className="mt-2">
                      <div className="flex items-baseline justify-between">
                        <div className="text-2xl font-semibold">
                          {target.toFixed(2)}{" "}
                          <span className="text-base">kg/€</span>
                        </div>
                        <div
                          className={`text-xs ${
                            onTrack ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {onTrack ? "Atteint" : `+${gap.toFixed(2)} au-dessus`}
                        </div>
                      </div>

                      <div className="mt-3 relative h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        {/* current (neutral) */}
                        <div
                          className="absolute inset-y-0 left-0 bg-slate-900/40 dark:bg-white/30"
                          style={{
                            width: `${Math.min(
                              100,
                              (value / (sectorMedian * 2)) * 100
                            )}%`,
                          }}
                          aria-hidden
                        />
                        {/* target (green) */}
                        <div
                          className="relative h-2 bg-emerald-600"
                          style={{
                            width: `${Math.min(
                              100,
                              (target / (sectorMedian * 2)) * 100
                            )}%`,
                          }}
                          title="Cible"
                        />
                      </div>

                      {!onTrack &&
                        Number.isFinite(last30Revenue) &&
                        last30Revenue > 0 && (
                          <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                            Écart ≈ <b>{kg(gap * last30Revenue)}</b> / 30j (à CA
                            constant).
                          </div>
                        )}
                    </div>
                  );
                })()}
              </Card>
            </div>

            <div className="lg:col-span-3 sm:col-span-3 col-span-1">
              <KpiTile
                label="Confiance données"
                value={`${displayConf}%`}
                sublabel="Exact / Inféré / Proxy"
                progress={displayConf}
              />
            </div>
          </div>

          {/* Paramètres & Impact (Live) – visuel unifié */}
          <Section
            key={`${sector}-${kwhMonth}-${dieselL}-${shipKgOrder}-${displayRevenue}-${totalKg}`}
            title="Paramètres & Impact (Live)"
            icon={<Gauge className="w-5 h-5" />}
          >
            {(() => {
              const kg = (x) =>
                `${formatNumber(Math.max(0, Math.round(x || 0)))} kg`;
              const pct = (x) => `${Math.max(0, Math.round(x || 0))}%`;

              const decomp = {
                sector: Math.max(0, Math.round(sectorEmissions || 0)),
                shipping: Math.max(0, Math.round(shipping || 0)),
                electricity: Math.max(0, Math.round(electricity || 0)),
                fuel: Math.max(0, Math.round(fuel || 0)),
              };
              const total =
                Math.max(
                  0,
                  decomp.sector +
                    decomp.shipping +
                    decomp.electricity +
                    decomp.fuel
                ) || 0;
              const share = Object.fromEntries(
                Object.entries(decomp).map(([k, v]) => [
                  k,
                  total ? Math.round((v / total) * 100) : 0,
                ])
              );

              // --- Mini simulateur (quick wins) ---
              const whatIf = { saveKwhPct: 10, pickupSharePct: 20 };
              const kwh = Number(kwhMonth || 0);
              const elecFactor = ECO_FACTORS.electricityKgPerKWh || 0.233;
              const shipBase =
                Number(last30Orders || 0) * (Number(shipKgOrder) || 0);
              const roadGain = 0.35;

              const baseElec = kwh * elecFactor;
              const simElec = baseElec * (1 - whatIf.saveKwhPct / 100);
              const deltaElec = Math.round(baseElec - simElec);

              const simShip =
                shipBase * (1 - (whatIf.pickupSharePct / 100) * roadGain);
              const deltaShip = Math.round(shipBase - simShip);

              const deltaTotal = Math.max(0, deltaElec + deltaShip);

              return (
                <div className="grid lg:grid-cols-12 gap-4">
                  {/* LEFT: parameters with controls */}
                  <div className="lg:col-span-5 space-y-4">
                    <Card>
                      <div className="text-sm font-medium mb-2">Secteur</div>
                      <select
                        className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-slate-900"
                        value={sector}
                        onChange={(e) => setSector(e.target.value)}
                      >
                        <option value="ecommerce">E-commerce / retail</option>
                        <option value="cafe">Café / restauration</option>
                        <option value="saas">SaaS / services numériques</option>
                      </select>
                      <div className="mt-2 text-xs text-gray-500">
                        Facteur secteur actuel :{" "}
                        {(ECO_FACTORS.sectorKgPerEUR?.[sector] ?? 0).toFixed(2)}{" "}
                        kg/€
                      </div>
                    </Card>

                    <Card>
                      <div className="text-sm font-medium mb-3">
                        Hypothèses d’activité
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm flex items-center gap-2">
                          <Bolt className="w-4 h-4" /> kWh / mois (électricité)
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800"
                            onClick={() =>
                              setKwhMonth(
                                Math.max(0, (Number(kwhMonth) || 0) - 25)
                              )
                            }
                          >
                            −25
                          </button>
                          <input
                            type="number"
                            className="w-28 rounded border px-2 py-1 bg-white dark:bg-slate-900"
                            value={kwhMonth}
                            onChange={(e) => setKwhMonth(e.target.value)}
                          />
                          <button
                            className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800"
                            onClick={() =>
                              setKwhMonth(
                                Math.max(0, (Number(kwhMonth) || 0) + 25)
                              )
                            }
                          >
                            +25
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm flex items-center gap-2">
                          <Fuel className="w-4 h-4" /> Litres diesel / mois
                        </label>
                        <input
                          type="number"
                          className="w-28 rounded border px-2 py-1 bg-white dark:bg-slate-900"
                          value={dieselL}
                          onChange={(e) => setDieselL(e.target.value)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-sm flex items-center gap-2">
                          <Package className="w-4 h-4" /> kg / commande
                          (expédition)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          className="w-28 rounded border px-2 py-1 bg-white dark:bg-slate-900"
                          value={shipKgOrder}
                          onChange={(e) => setShipKgOrder(e.target.value)}
                        />
                      </div>

                      <div className="mt-3 text-xs text-gray-500">
                        Indicateur pédagogique. Pour un audit certifié : données
                        vérifiées (kWh, poids colis, modes transport,
                        fournisseurs).
                      </div>
                    </Card>

                    <Card>
                      <div className="text-sm font-medium mb-2">
                        Mini simulateur “quick wins”
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm">Électricité : –10% kWh</div>
                          <div className="text-sm font-medium">
                            ≈ {kg(deltaElec)}/mois
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            Expéditions : +20% relais/route
                          </div>
                          <div className="text-sm font-medium">
                            ≈ {kg(deltaShip)}/mois
                          </div>
                        </div>
                        <div className="pt-2 border-t flex items-center justify-between">
                          <div className="text-sm font-medium">
                            Gain total potentiel
                          </div>
                          <div className="text-sm font-bold">
                            {kg(deltaTotal)}/mois
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* RIGHT: visual decomposition */}
                  <div className="lg:col-span-7 space-y-4">
                    <Card>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">
                          Décomposition (kgCO₂e / mois)
                        </div>
                        <div className="text-xs text-gray-500">
                          Total : <b>{kg(total)}</b>
                        </div>
                      </div>

                      {/* Grid: left = bars, right = donut */}
                      <div className="mt-3 grid md:grid-cols-2 gap-5 items-start">
                        {/* LEFT — existing bars (kept) */}
                        <div className="space-y-3">
                          {[
                            {
                              key: "shipping",
                              label: "Expéditions",
                              icon: <Truck className="w-4 h-4" />,
                            },
                            {
                              key: "electricity",
                              label: "Électricité",
                              icon: <Bolt className="w-4 h-4" />,
                            },
                            {
                              key: "fuel",
                              label: "Carburant",
                              icon: <Fuel className="w-4 h-4" />,
                            },
                            {
                              key: "sector",
                              label: "Secteur × CA",
                              icon: <Building2 className="w-4 h-4" />,
                            },
                          ].map((row) => {
                            const val = decomp[row.key] || 0;
                            const p = share[row.key] || 0;
                            return (
                              <div key={row.key}>
                                <div className="flex items-center justify-between text-sm mb-1">
                                  <div className="flex items-center gap-2">
                                    {row.icon}
                                    <span>{row.label}</span>
                                  </div>
                                  <div className="font-medium">
                                    {kg(val)}{" "}
                                    <span className="text-xs text-gray-500">
                                      ({pct(p)})
                                    </span>
                                  </div>
                                </div>
                                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded">
                                  <div
                                    className={`h-2 rounded ${
                                      row.key === "shipping"
                                        ? "bg-teal-500"
                                        : row.key === "electricity"
                                        ? "bg-emerald-600"
                                        : row.key === "fuel"
                                        ? "bg-rose-500"
                                        : "bg-slate-500"
                                    }`}
                                    style={{ width: `${Math.min(100, p)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* RIGHT — donut pie (actionable sources only) */}
                        {(() => {
                          const pie = [
                            {
                              key: "electricity",
                              name: "Électricité",
                              value: decomp.electricity || 0,
                              color: "#059669",
                            }, // emerald-600
                            {
                              key: "fuel",
                              name: "Carburant",
                              value: decomp.fuel || 0,
                              color: "#f43f5e",
                            }, // rose-500
                            {
                              key: "shipping",
                              name: "Expéditions",
                              value: decomp.shipping || 0,
                              color: "#14b8a6",
                            }, // teal-500
                          ];
                          const varTotal = Math.max(
                            0,
                            pie.reduce((s, d) => s + d.value, 0)
                          );

                          return (
                            <div className="relative rounded-xl border bg-white dark:bg-slate-900 p-3">
                              <div className="text-xs text-gray-500 mb-1">
                                Répartition (sources actionnables)
                              </div>
                              <div className="h-52">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={pie}
                                      dataKey="value"
                                      nameKey="name"
                                      innerRadius={52}
                                      outerRadius={78}
                                      startAngle={90}
                                      endAngle={450}
                                      padAngle={3}
                                      cornerRadius={6}
                                    >
                                      {pie.map((entry, idx) => (
                                        <Cell
                                          key={entry.key}
                                          fill={entry.color}
                                        />
                                      ))}
                                    </Pie>
                                    <Tooltip
                                      formatter={(v, n) =>
                                        `${kg(v)} (${pct(
                                          (v / Math.max(1, varTotal)) * 100
                                        )})`
                                      }
                                    />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>

                              {/* Center label */}
                              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                                <div className="text-center">
                                  <div className="text-[11px] text-gray-500">
                                    Actionnable
                                  </div>
                                  <div className="text-sm font-semibold">
                                    {kg(varTotal)}
                                  </div>
                                </div>
                              </div>

                              {/* Legend */}
                              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                {pie.map((d) => (
                                  <span
                                    key={d.key}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-50 dark:bg-slate-800"
                                  >
                                    <span
                                      className="w-2 h-2 rounded-full"
                                      style={{ background: d.color }}
                                    />
                                    {d.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </Card>

                    <Card>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <Wand2 className="w-4 h-4" /> Actions rapides
                          (priorisées)
                        </div>
                        <div className="text-xs text-gray-500">
                          Basées sur votre profil actuel
                        </div>
                      </div>

                      <ul className="mt-3 space-y-2 text-sm">
                        <li className="flex items-start justify-between gap-3">
                          <div>Plan “veille/consignes” : –10% kWh</div>
                          <div className="font-medium">
                            ≈ {kg(deltaElec)}/mois
                          </div>
                        </li>
                        <li className="flex items-start justify-between gap-3">
                          <div>
                            Livraison relais/route +20% (vs. express/air)
                          </div>
                          <div className="font-medium">
                            ≈ {kg(deltaShip)}/mois
                          </div>
                        </li>
                        <li className="flex items-start justify-between gap-3">
                          <div>Packaging allégé / recyclé (à paramétrer)</div>
                          <div className="font-medium">—</div>
                        </li>
                      </ul>

                      <div className="mt-3 text-xs text-gray-500">
                        Pour chiffrer le ROI (payback/NPV), activez les
                        connecteurs transport/énergie et ajoutez les prix.
                      </div>
                    </Card>
                    <div className="lg:sticky lg:top-20">
                      <EcoAdvisorPanel
                        plan={aiPlan}
                        doneIds={doneIds}
                        toggle={toggleTodo}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
            {/* Right-docked IA advisor */}
          </Section>
        </div>
      </Section>

      {/* SUPPLIERS CLEAN SCORE */}
      <Section
        title="Fournisseurs — Clean Score"
        icon={<Store className="w-5 h-5" />}
      >
        {(() => {
          // --- DEMO SUPPLIERS when no bankingRows ---
          const DEMO_BANKING = [
            {
              date: "2025-08-03",
              outflow: 420.8,
              description: "EDF - Électricité Pro",
            },
            {
              date: "2025-08-05",
              outflow: 265.4,
              description: "TOTAL Station - Diesel",
            },
            {
              date: "2025-08-07",
              outflow: 389.9,
              description: "DHL Express - Shipping",
            },
            {
              date: "2025-08-09",
              outflow: 158.2,
              description: "Cartonnerie Lyonnaise - Packaging",
            },
            {
              date: "2025-08-12",
              outflow: 96.0,
              description: "OVHCloud - Hosting",
            },
            {
              date: "2025-08-15",
              outflow: 312.5,
              description: "La Poste Colissimo - Shipping",
            },
            {
              date: "2025-08-18",
              outflow: 189.0,
              description: "Mondial Relay - Shipping",
            },
            {
              date: "2025-08-20",
              outflow: 144.3,
              description: "Scaleway - Hosting",
            },
            {
              date: "2025-08-22",
              outflow: 510.0,
              description: "CartonPack - Emballage",
            },
            {
              date: "2025-08-25",
              outflow: 278.9,
              description: "UPS France - Shipping",
            },
          ];
          const source =
            bankingRows && bankingRows.length > 0 ? bankingRows : DEMO_BANKING;

          const agg = {};
          source.forEach((r) => {
            const name = (r.description || "Inconnu").toLowerCase();
            const out = Number(r.outflow || r.debit || 0);
            if (!(out > 0)) return;
            const { tag } = classifyTx(name, out);
            const key = name.replace(/\s+/g, " ").trim().slice(0, 38);
            agg[key] = agg[key] || { name: key, spend: 0, tags: {} };
            agg[key].spend += out;
            agg[key].tags[tag] = (agg[key].tags[tag] || 0) + out;
          });
          const rows = Object.values(agg)
            .sort((a, b) => b.spend - a.spend)
            .slice(0, 8);
          const usingDemo = !(bankingRows && bankingRows.length > 0);

          return (
            <>
              {usingDemo && (
                <div className="mb-3 text-xs rounded-md px-2 py-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 inline-flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                  Exemple chargé (aucune donnée bancaire réelle détectée)
                </div>
              )}
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left">Fournisseur</th>
                      <th>Spend</th>
                      <th>Tags</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const heavy =
                        (r.tags.fuel || 0) + (r.tags.logistics || 0);
                      const score = Math.max(
                        10,
                        100 - Math.round((heavy / (r.spend || 1)) * 100)
                      );
                      const tone =
                        score > 70
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : score > 40
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
                      return (
                        <tr key={r.name} className="border-t">
                          <td>{r.name}</td>
                          <td>{formatNumber(Math.round(r.spend))} €</td>
                          <td>{Object.keys(r.tags).join(", ")}</td>
                          <td>
                            <span className={`px-2 py-0.5 rounded ${tone}`}>
                              {score}/100
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
      </Section>
    </div>
  );
}

/* ============================
   COCKPIT (KPI + Alertes + Raccourcis)
============================ */
function Cockpit({ onGo }) {
  const [range, setRange] = useState(30); // 7/30/90 j
  const userIsPro = getUser().isPro;
  const importedSales = useDataset("sales")?.rows ?? [];

  // --- KPI VENTES (à partir des samples si rien n'est importé ici) ---
  const sales = useMemo(() => {
    const rows =
      userIsPro && importedSales && importedSales.length
        ? importedSales
        : Papa.parse(SAMPLE_SALES, { header: true, skipEmptyLines: true }).data;

    const clean = rows
      .filter(
        (r) => r.date && (r.qty ?? r.quantity ?? 1) && (r.price ?? r.amount)
      )
      .map((r) => ({
        date: toDateKey(r.date),
        qty: Number(r.qty ?? r.quantity ?? 1),
        price: Number(r.price ?? r.amount),
        product: r.product || "-",
        customer_id: r.customer_id || null,
        revenue: Number(r.qty ?? r.quantity ?? 1) * Number(r.price ?? r.amount),
      }));

    const byDay = {};
    const byProduct = {};
    clean.forEach((r) => {
      byDay[r.date] = (byDay[r.date] || 0) + r.revenue;
      byProduct[r.product] = (byProduct[r.product] || 0) + r.revenue;
    });

    const dates = Object.keys(byDay).sort();
    const series = dates.map((d) => ({ date: d, revenue: byDay[d] }));
    const spark = series.slice(-24).map((d) => ({ x: d.date, y: d.revenue }));

    const maxDate = dates[dates.length - 1];
    const last30cut = maxDate ? dateAddDays(maxDate, -30) : null;
    const last30 = series.filter((d) => !last30cut || d.date >= last30cut);
    const ca30 = last30.reduce((s, x) => s + x.revenue, 0);
    const basket = clean.length
      ? clean.reduce((s, x) => s + x.revenue, 0) / clean.length
      : 0;
    const unique = new Set(clean.map((x) => x.customer_id)).size;

    const growth =
      series.length >= 30
        ? (byDay[dates[dates.length - 1]] -
            byDay[dates[Math.max(0, dates.length - 31)]]) /
          Math.max(1, byDay[dates[Math.max(0, dates.length - 31)]])
        : 0;

    const top = Object.entries(byProduct)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)[0];

    return {
      series,
      ca30,
      basket,
      unique,
      growth,
      topName: top?.name || "-",
      spark,
    };
  }, [userIsPro, importedSales]);

  // --- KPI TRÉSORERIE (samples) ---
  const cash = useMemo(() => {
    const rows = Papa.parse(SAMPLE_CASH, {
      header: true,
      skipEmptyLines: true,
    }).data;
    const startBalance = 1000;
    const clean = rows
      .filter((r) => r.date)
      .map((r) => ({
        date: toDateKey(r.date),
        inflow: Number(r.inflow || 0),
        outflow: Number(r.outflow || 0),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    let bal = startBalance;
    const series = clean.map((r) => {
      const net = r.inflow - r.outflow;
      bal += net;
      return { ...r, net, balance: bal };
    });
    const spark = series.map((d) => ({ x: d.date, y: d.balance })).slice(-24);

    const tail = series.slice(-7);
    const avgNet = tail.length
      ? tail.reduce((s, x) => s + x.net, 0) / tail.length
      : 0;

    // projection naïve 30j pour runway
    const lastDate = series.length ? series[series.length - 1].date : null;
    const future = lastDate ? rangeDays(lastDate, 30) : [];
    let proj = bal;
    const all = [
      ...series,
      ...future.map((d) => ((proj += avgNet), { date: d, balance: proj })),
    ];
    const breach = all.find((p) => p.balance < 0);
    const todayIdx = series.length - 1;
    const breachIdx = breach
      ? all.findIndex((p) => p.date === breach.date)
      : -1;
    const runway = breach ? Math.max(0, breachIdx - todayIdx) : 30;

    return {
      lastBal: series.slice(-1)[0]?.balance ?? startBalance,
      avgNet,
      runway,
      breachDate: breach?.date || null,
      spark,
    };
  }, []);
  const [ecoDays, setEcoDays] = useState(null);
  useEffect(() => {
    const h = (e) => setEcoDays(e.detail?.daysToBreach ?? null);
    window.addEventListener("im:eco", h);
    return () => window.removeEventListener("im:eco", h);
  }, []);

  // --- Alertes synthétiques ---
  const alerts = useMemo(() => {
    const out = [];
    if (Number.isFinite(ecoDays)) {
      out.push({
        tone: ecoDays <= 7 ? "warn" : "pos",
        title: "Budget CO₂e",
        text: `Risque de dépassement dans ~${ecoDays} jours.`,
      });
    }

    if (cash.breachDate) {
      out.push({
        tone: "warn",
        title: "Alerte trésorerie",
        text: `Risque de découvert dans ~${cash.runway} jours (${cash.breachDate}).`,
      });
    } else {
      out.push({
        tone: "ok",
        title: "Trésorerie saine",
        text: "Solde projeté positif sur 30 jours.",
      });
    }
    if (sales.growth <= -5) {
      out.push({
        tone: "warn",
        title: "Ventes en baisse",
        text: `Tendance ${formatNumber(sales.growth, 1)}% sur la période.`,
      });
    } else if (sales.growth >= 5) {
      out.push({
        tone: "pos",
        title: "Opportunité ventes",
        text: `Tendance ${formatNumber(sales.growth, 1)}% — capitaliser sur ${
          sales.topName
        }.`,
      });
    }
    return out.slice(0, 2);
  }, [sales, cash]);
  // --- Encaissements (snapshot rapide)
  const inv = useMemo(() => parseInvoicesCsv(SAMPLE_INVOICES_CSV), []);
  const asOf = useMemo(() => new Date(), []);
  const aging = useMemo(() => computeAging(inv, asOf), [inv, asOf]);
  const dso = useMemo(() => computeDSO(inv, asOf), [inv, asOf]);
  // -- KPI dynamiques selon "range"
  const caRange = useMemo(() => {
    const s = sales.series || [];
    const last = s.slice(-Math.min(range, s.length));
    return Math.round(last.reduce((sum, d) => sum + (d.revenue || 0), 0));
  }, [sales, range]);

  // --- Snapshot "dernière visite"
  const prevSnap = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("im_snapshot") || "null");
    } catch {
      return null;
    }
  }, []);

  const changes = useMemo(() => {
    if (!prevSnap) return null;
    return {
      ca: caRange - (prevSnap.ca || 0),
      runway: (cash.runway || 0) - (prevSnap.runway || 0),
      dso: (dso || 0) - (prevSnap.dso || 0),
      overdue: (aging.overdueTotal || 0) - (prevSnap.overdue || 0),
    };
  }, [prevSnap, caRange, cash.runway, dso, aging.overdueTotal]);

  useEffect(() => {
    const snap = {
      ts: Date.now(),
      ca: caRange,
      runway: cash.runway || 0,
      dso: dso || 0,
      overdue: aging.overdueTotal || 0,
    };
    try {
      localStorage.setItem("im_snapshot", JSON.stringify(snap));
    } catch {}
  }, [caRange, cash.runway, dso, aging.overdueTotal]);

  return (
    <div className="space-y-5">
      <Section
        title="Cockpit (Live)"
        icon={
          <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-indigo-600 to-sky-500 text-white grid place-items-center">
            <Sparkles className="h-3 w-3" />
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <RangeChips value={range} onChange={setRange} />
            <Pill className="bg-indigo-100 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-200">
              Propulsé par IA (conseils & prévisions)
            </Pill>
            <AIPill
              className="ml-2 from-emerald-600 to-lime-500"
              label="Éco intégré"
            />
          </div>
        }
      >
        {/* KPI row */}
        <div className="grid md:grid-cols-3 gap-4 lg:sticky lg:top-20 z-10">
          <Card>
            <Stat
              label={`CA ${Math.min(
                range,
                sales.series?.length || range
              )} jours`}
              value={`${formatNumber(caRange, 0)} €`}
              note={
                sales.growth > 0
                  ? `↗ +${formatNumber(sales.growth, 1)}%`
                  : sales.growth < 0
                  ? `↘ ${formatNumber(sales.growth, 1)}%`
                  : "Stable"
              }
            />
            <MiniSparkline data={sales.spark} />
          </Card>
          <Card>
            <Stat
              label="Panier moyen"
              value={`${formatNumber(sales.basket, 2)} €`}
              note={`Top: ${sales.topName}`}
            />
            <MiniSparkline data={sales.spark} />
          </Card>
          <Card>
            <Stat
              label="Runway trésorerie"
              value={cash.breachDate ? `${cash.runway} jours` : "≥ 30 jours"}
              note={`${formatNumber(cash.lastBal, 0)} € · ${formatNumber(
                cash.avgNet,
                0
              )} €/j`}
            />
            <MiniSparkline data={cash.spark} />
          </Card>
        </div>

        {/* Alertes clés */}
        <div className="mt-3 grid md:grid-cols-2 gap-3">
          {alerts.map((a, i) => {
            const tone =
              a.tone === "warn"
                ? "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-100"
                : a.tone === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-100"
                : "bg-indigo-50 border-indigo-200 text-indigo-900 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-100";
            const Icon =
              a.tone === "warn"
                ? AlertTriangle
                : a.tone === "ok"
                ? CheckCircle2
                : TrendingUp;
            return (
              <div key={i} className={`rounded-xl border p-4 ${tone}`}>
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium">{a.title}</div>
                    <div className="text-sm">{a.text}</div>

                    {/* CTA contextuels */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {a.title.includes("trésorerie") && (
                        <>
                          <Button
                            size="sm"
                            variant="subtle"
                            onClick={() => onGo?.("cash")}
                          >
                            Ouvrir Trésorerie
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onGo?.("ar")}
                          >
                            Relancer top 5
                          </Button>
                        </>
                      )}
                      {a.title.includes("Ventes") ||
                      a.title.includes("Opportunité") ? (
                        <>
                          <Button
                            size="sm"
                            variant="subtle"
                            onClick={() => onGo?.("sales")}
                          >
                            Voir la tendance
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onGo?.("pricing")}
                          >
                            Ajuster les prix
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Depuis la dernière visite */}
        {changes && (
          <Card className="mt-3">
            <div className="text-sm font-semibold mb-1">
              Qu’est-ce qui a changé ?
            </div>
            <ul className="text-sm space-y-1">
              <li>
                CA ({Math.min(range, sales.series?.length || range)} j) :{" "}
                <b
                  className={
                    changes.ca >= 0 ? "text-emerald-600" : "text-rose-600"
                  }
                >
                  {changes.ca >= 0 ? "+" : ""}
                  {formatNumber(changes.ca, 0)} €
                </b>
              </li>
              <li>
                Runway trésorerie :{" "}
                <b
                  className={
                    changes.runway >= 0 ? "text-emerald-600" : "text-rose-600"
                  }
                >
                  {changes.runway >= 0 ? "+" : ""}
                  {formatNumber(changes.runway, 0)} j
                </b>
              </li>
              <li>
                DSO :{" "}
                <b
                  className={
                    changes.dso <= 0 ? "text-emerald-600" : "text-rose-600"
                  }
                >
                  {changes.dso >= 0 ? "+" : ""}
                  {formatNumber(changes.dso, 0)} j
                </b>
              </li>
              <li>
                Montant en retard :{" "}
                <b
                  className={
                    changes.overdue <= 0 ? "text-emerald-600" : "text-rose-600"
                  }
                >
                  {changes.overdue >= 0 ? "+" : ""}
                  {formatNumber(changes.overdue, 0)} €
                </b>
              </li>
            </ul>
          </Card>
        )}

        {/* Raccourcis géants vers les 2 sections */}
        <div className="mt-4 grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          <button
            onClick={() => onGo?.("sales")}
            className="group w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/60 hover:bg-white dark:hover:bg-gray-900 p-5 text-left transition shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white flex items-center justify-center shadow">
                <LineChartIcon className="w-6 h-6" />
              </div>
              <div>
                <div className="text-lg font-semibold">Ventes</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Historique, smart forecast, scénarios & PDF.
                </div>
              </div>
              <ArrowRight className="ml-auto w-5 h-5 opacity-70 group-hover:translate-x-1 transition" />
            </div>
          </button>

          <button
            onClick={() => onGo?.("cash")}
            className="group w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/60 hover:bg-white dark:hover:bg-gray-900 p-5 text-left transition shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <div className="text-lg font-semibold">
                  Trésorerie & Alertes
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Projection 30j, risques, plans d’action.
                </div>
              </div>
              <ArrowRight className="ml-auto w-5 h-5 opacity-70 group-hover:translate-x-1 transition" />
            </div>
          </button>
          <button
            onClick={() => onGo?.("ar")}
            className="group w-full rounded-2xl border border-gray-200 dark:border-gray-800 hover:bg-white dark:hover:bg-gray-900 p-5 text-left transition shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 text-white flex items-center justify-center shadow">
                <HandCoins className="w-6 h-6" />
              </div>
              <div>
                <div className="text-lg font-semibold">Encaissements</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  DSO, aging, relances (Stripe).
                </div>
              </div>
              <ArrowRight className="ml-auto w-5 h-5 opacity-70 group-hover:translate-x-1 transition" />
            </div>
          </button>

          <button
            onClick={() => onGo?.("pricing")}
            className="group w-full rounded-2xl border border-gray-200 dark:border-gray-800 hover:bg-white dark:hover:bg-gray-900 p-5 text-left transition shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center shadow">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <div className="text-lg font-semibold">Pricing</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Prix suggéré, garde-fous, concurrence.
                </div>
              </div>
              <ArrowRight className="ml-auto w-5 h-5 opacity-70 group-hover:translate-x-1 transition" />
            </div>
          </button>
          <button
            onClick={() => onGo?.("eco")}
            className="group w-full rounded-2xl border border-gray-200 dark:border-gray-800 hover:bg-white dark:hover:bg-gray-900 p-5 text-left transition shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 text-white flex items-center justify-center shadow">
                <Leaf className="w-6 h-6" />
              </div>
              <div>
                <div className="text-lg font-semibold">Éco-Label</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Badge A–E, intensité kg/€, Conseil IA.
                </div>
              </div>
              <ArrowRight className="ml-auto w-5 h-5 opacity-70 group-hover:translate-x-1 transition" />
            </div>
          </button>
        </div>
      </Section>
    </div>
  );
}
// === Nav UI (pills) =========================================================
function NavPill({ active, icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        "group relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm",
        "transition-all",
        active
          ? "bg-gray-900 text-white shadow ring-1 ring-black/10 dark:bg-gray-100 dark:text-gray-900"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800",
      ].join(" ")}
    >
      <Icon className="h-4 w-4 opacity-80 group-hover:opacity-100" />
      <span className="font-medium">{label}</span>
      {active && (
        <span className="absolute inset-0 rounded-xl ring-2 ring-indigo-500/70 -z-10" />
      )}
    </button>
  );
}

/* ============================
   MAIN
============================ */
export default function App() {
  // AVANT : const [tab, setTab] = useState("cockpit");
  const TAB_KEYS = new Set([
    "cockpit",
    "sales",
    "cash",
    "ar",
    "pricing",
    "connectors",
    "eco",
    "pro",
  ]);

  const initialTab = (() => {
    const h = (window.location.hash || "").replace(/^#/, "");
    return TAB_KEYS.has(h) ? h : "cockpit";
  })();

  const [tab, setTab] = useState(initialTab);

  // écoute le hash → change l’onglet
  useEffect(() => {
    const onHash = () => {
      const h = (window.location.hash || "").replace(/^#/, "");
      if (TAB_KEYS.has(h)) setTab(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // change l’URL quand on clique un onglet
  useEffect(() => {
    if (location.hash !== `#${tab}`) {
      history.replaceState(null, "", `#${tab}`);
    }
  }, [tab]);

  //  const { theme, setTheme } = useTheme();
  //  useEffect(() => {
  //    seedDemoIfNeeded();
  //  }, []);

  // === PATCH 2.6e START (smooth scroll) ===
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.scrollBehavior;
    root.style.scrollBehavior = "smooth";
    return () => {
      root.style.scrollBehavior = prev || "";
    };
  }, []);
  // === PATCH 2.6e END ===

  return (
    <MotionConfig reducedMotion="user">
      <_TailwindSafelist />
      <div className="min-h-screen w-screen overflow-x-hidden bg-white text-gray-900 dark:bg-gray-950 dark:text-white">
        {/* Landing – Partie 1 */}
        <Hero />
        <Features />

        {/* Ancre vers la démo */}
        <section
          id="demo"
          className="bg-white text-gray-900 dark:bg-transparent dark:text-white"
        >
          <header className="sticky top-0 z-10 border-b bg-white/70 dark:bg-gray-900/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:supports-[backdrop-filter]:bg-gray-900/50">
            <div className="w-full px-12 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 flex items-center justify-center shadow-sm">
                  <Sparkles className="h-4 w-4 text-white dark:text-gray-900" />
                </div>
                <div>
                  <div className="text-xl font-bold tracking-tight">
                    InsightMate · Tableau de bord
                  </div>
                  {!getUser().isPro && (
                    <span className="ml-3 text-xs px-2 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                      Démo lecture seule
                    </span>
                  )}
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    Data + Écologie • IA intégrée
                  </div>
                </div>
              </div>
              <nav className="flex-1 flex items-center gap-3 justify-end">
                {/* Groupe plein-large (s’adapte à la place dispo à droite du logo) */}
                <div className="w-full px-12 py-4 flex items-center justify-between">
                  {/* Nav pills à gauche (une seule ligne) */}
                  <nav className="flex items-center gap-2 overflow-x-auto">
                    <NavBigTab
                      active={tab === "cockpit"}
                      onClick={() => setTab("cockpit")}
                      icon={<Sparkles className="w-6 h-6" />}
                    >
                      Cockpit
                    </NavBigTab>

                    <NavBigTab
                      active={tab === "sales"}
                      onClick={() => setTab("sales")}
                      icon={<LineChartIcon className="w-5 h-5" />}
                    >
                      Ventes
                    </NavBigTab>

                    <NavBigTab
                      active={tab === "cash"}
                      onClick={() => setTab("cash")}
                      icon={<Wallet className="w-6 h-6" />}
                    >
                      Trésorerie & Alertes
                    </NavBigTab>

                    <NavBigTab
                      active={tab === "ar"}
                      onClick={() => setTab("ar")}
                      icon={<HandCoins className="w-6 h-6" />}
                    >
                      Encaissements
                    </NavBigTab>

                    <NavBigTab
                      active={tab === "pricing"}
                      onClick={() => setTab("pricing")}
                      icon={<TrendingUp className="w-6 h-6" />}
                    >
                      Pricing
                    </NavBigTab>
                    <NavBigTab
                      active={tab === "connectors"}
                      onClick={() => setTab("connectors")}
                      icon={<PlugZap className="w-5 h-5" />}
                    >
                      Connecteurs
                    </NavBigTab>
                  </nav>
                  <NavBigTab
                    active={tab === "eco"}
                    onClick={() => setTab("eco")}
                    icon={<Leaf className="w-6 h-6" />}
                  >
                    Éco-Label
                  </NavBigTab>

                  <NavBigTab
                    active={tab === "pro"}
                    onClick={() => setTab("pro")}
                    icon={<Shield className="w-6 h-6" />}
                  >
                    {getUser().isPro ? "Gérer abonnement" : "Accès Pro"}
                  </NavBigTab>

                  {/* Actions à droite */}
                  <div className="flex items-center gap-2">
                    <ThemeToggle />
                  </div>
                </div>
              </nav>
            </div>
          </header>

          <main className="w-screen px-12 py-6">
            <div className="w-full">
              {tab === "cockpit" && <Cockpit onGo={setTab} />}
              {tab === "sales" && <SalesDemo />}
              {tab === "cash" && <CashflowDemo />}
              {tab === "ar" && <EncaissementsDemo />}
              {tab === "pricing" && <PricingOptimizer />}
              {tab === "eco" && <EcoLabelPage />}
              {tab === "connectors" && (
                <PaywallGate feature="Connecteurs & Import de données">
                  <ConnectorsPage />
                </PaywallGate>
              )}
              {tab === "pro" && <AccessProPage />}
            </div>

            <Card className="mt-8 w-full">
              <h3 className="text-lg font-semibold mb-2">
                Comment ça marche :
              </h3>
              <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-200">
                <li>Charger un exemple pour tester instantanément.</li>
                <li>
                  Importer votre CSV puis ajuster la période (Du/Au) et le
                  lissage.
                </li>
                <li>
                  Observer les KPI, l’historique + la prévision, le top
                  produits, et les conseils.
                </li>
                <li>
                  Passer à l’onglet Trésorerie pour projeter le solde et
                  détecter un risque de découvert.
                </li>
                <li>
                  Activer l’IA complète pour des recommandations rédigées
                  (agrégats uniquement envoyés au serveur).
                </li>
              </ol>
            </Card>
          </main>

          {/* ===== À PROPOS (compact + allongé) ===== */}
          <section className="relative overflow-hidden py-12 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
            <div className="relative max-w-4xl mx-auto px-6">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.5 }}
                className="text-center mb-6"
              >
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                  À propos
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Qui construit InsightMate — et pourquoi.
                </p>
              </motion.div>

              {/* Card profil en ligne */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.5 }}
                className="mx-auto flex flex-col md:flex-row items-center md:items-start gap-6 rounded-xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 shadow-sm backdrop-blur px-6 py-6"
              >
                {/* Photo */}
                <motion.img
                  src="/me.jpg"
                  alt="Jeremy Duriez"
                  className="w-20 h-20 rounded-full object-cover border-2 border-white dark:border-gray-800 shadow"
                  initial={{ scale: 0.9, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true, amount: 0.7 }}
                  transition={{ duration: 0.4 }}
                />

                {/* Texte */}
                <div className="flex-1 text-center md:text-left">
                  <div>
                    <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Jeremy Duriez
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Fondateur&nbsp;de{" "}
                      <span className="font-medium">JDuriez</span> · Créateur
                      d’InsightMate
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 text-gray-700 dark:text-gray-200 leading-relaxed text-sm">
                    <p>
                      Je développe{" "}
                      <span className="font-medium">InsightMate</span> dans le
                      cadre de
                      <span className="font-medium"> JDuriez</span>, avec une
                      idée simple&nbsp;: aider les PME à tirer parti de leurs
                      données sans complexité inutile.
                    </p>
                    <p>
                      Mon approche&nbsp;: partir de vos chiffres, restituer
                      l’essentiel, et transformer ça en actions concrètes sur
                      ventes et trésorerie.
                    </p>
                  </div>

                  {/* Liens */}
                  <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-3">
                    <a
                      href="https://www.linkedin.com/in/jeremy-duriez"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-sm transition"
                    >
                      LinkedIn
                    </a>
                    <a
                      href="mailto:jeremy.duriez@example.com"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white text-xs font-medium transition"
                    >
                      ✉️ Me contacter
                    </a>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          <footer className="py-8 text-center text-xs text-gray-500 dark:text-gray-400 w-full">
            © 2025 InsightMate. Démo éducative.
          </footer>
        </section>
      </div>
    </MotionConfig>
  );
}
