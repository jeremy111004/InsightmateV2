// ANCHOR: FILE_TOP RiskHub
import React, { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  Legend,
  Line, // NEW
} from "recharts";
import { motion } from "framer-motion";
import {
  Sparkles,
  Lightbulb,
  Users,
  PieChart,
  UploadCloud,
  Download,
} from "lucide-react";
import Papa from "papaparse";
import { useTranslation } from "react-i18next";

import useCashRiskEngine from "../hooks/usecashriskengine.jsx";

import RiskCard from "../components/risk/RiskCard";
import RiskRibbon from "../components/risk/RiskRibbon";
import ScenarioPanel from "../components/risk/ScenarioPanel";
import RiskAdvisor from "../components/risk/RiskAdvisor";
import Stat from "../components/risk/Stat";
import RiskGlossary from "../components/risk/RiskGlossary";
// at the top of src/pages/RiskHub.jsx (or wherever RiskHub is)
import LeakageRadarEmbed from "../components/LeakageRadarEmbed";
/** -------- Cash engine: AR(1) + Monte Carlo on daily net flows -------- **/

// util: parse date -> yyyy-mm-dd
const dd = (d) =>
  typeof d === "string"
    ? d.slice(0, 10)
    : new Date(d).toISOString().slice(0, 10);

// util: group by date and build NET INFLOW (cash in - cash out) from Radar rows
function dailyNetFromRadarRows(
  rows,
  { salesPct = 0, costsPct = 0, dsoDays = 0 } = {}
) {
  // radar rows: { date, qty, unit_price, unit_cost, discount, shipping_fee, shipping_cost }
  const byDay = new Map();
  for (const r of rows || []) {
    const day = dd(r.date);
    const qty = Math.max(0, Number(r.qty || 0));
    const price = Number(r.unit_price || 0);
    const cost = Number(r.unit_cost || 0);
    const discount = Math.max(0, Number(r.discount || 0));
    const fee = Number(r.shipping_fee ?? 0);
    const scost = Number(r.shipping_cost ?? 0);

    // line revenue actually received (price*qty - discount) + shipping fees collected
    const inc =
      Math.max(0, qty * price - discount) + (Number.isFinite(fee) ? fee : 0);
    // cash out: product cost + shipping cost
    const out = Math.max(0, qty * cost) + (Number.isFinite(scost) ? scost : 0);
    const net = inc - out;

    byDay.set(day, (byDay.get(day) || 0) + net);
  }
  const days = [...byDay.keys()].sort();
  return days.map((t) => ({ t, net: byDay.get(t) }));
}

// fit AR(1) on the net daily flow series (x_t = mu + phi*(x_{t-1}-mu) + eps*sigma)
function fitAR1(series) {
  if (!series.length) return { mu: 0, phi: 0, sigma: 0 };
  const x = series.map((d) => d.net);
  const n = x.length;
  const mu = x.reduce((s, v) => s + v, 0) / n;
  // OLS phi = cov(x_t - mu, x_{t-1} - mu) / var(x_{t-1} - mu)
  let num = 0,
    den = 0;
  for (let t = 1; t < n; t++) {
    const a = x[t] - mu;
    const b = x[t - 1] - mu;
    num += a * b;
    den += b * b;
  }
  const phi = den > 0 ? Math.max(-0.995, Math.min(0.995, num / den)) : 0;
  // residual sigma
  let s2 = 0;
  for (let t = 1; t < n; t++) {
    const xhat = mu + phi * (x[t - 1] - mu);
    s2 += (x[t] - xhat) ** 2;
  }
  const sigma = Math.sqrt(s2 / Math.max(1, n - 1));
  return { mu, phi, sigma };
}

// Monte Carlo simulation of cash paths
function simulateCash({
  lastCash, // current cash level
  ar, // {mu, phi, sigma} on net flows
  horizon = 60,
  nSim = 3000,
  seed = 42, // basic LCG for reproducibility
}) {
  const lcg = (() => {
    let s = seed >>> 0;
    return () => (s = (1664525 * s + 1013904223) >>> 0) / 2 ** 32;
  })();

  // pre-allocate paths: we only need percentiles, so store as transposed [day][sim]
  const byDay = Array.from({ length: horizon }, () => new Float64Array(nSim));
  for (let k = 0; k < nSim; k++) {
    let cash = lastCash;
    let xPrev = ar.mu; // start at mean for AR(1) innovation
    for (let d = 0; d < horizon; d++) {
      // Box-Muller for normal(0,1)
      const u1 = Math.max(1e-12, lcg());
      const u2 = Math.max(1e-12, lcg());
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const flow = ar.mu + ar.phi * (xPrev - ar.mu) + ar.sigma * z;
      xPrev = flow;
      cash += flow;
      byDay[d][k] = cash;
    }
  }

  // build p5/p50/p95 per day
  const p = (arr, q) => {
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
    // check overdraft on this path
    let under = false;
    for (let d = 0; d < horizon; d++) {
      if (byDay[d][k] < 0) {
        under = true;
        break;
      }
    }
    if (under) probOverdraftPaths++;
  }
  for (let d = 0; d < horizon; d++) {
    const slice = byDay[d];
    fan.push({
      t: dd(new Date(Date.now() + (d + 1) * 86400000)),
      p5: p(slice, 0.05),
      p50: p(slice, 0.5),
      p95: p(slice, 0.95),
    });
  }

  // risk KPIs
  const cfar = Math.min(...fan.map((x) => x.p5 - x.p50)); // loss vs median at 5th %
  const es = fan.reduce((s, x) => s + (x.p5 - x.p50), 0) / fan.length; // avg tail gap
  const probOverdraft = probOverdraftPaths / nSim;
  const idx = fan.findIndex((x) => x.p5 < 0);
  const runwayP5 = idx === -1 ? Infinity : idx + 1;

  return { fan, cfar, es, probOverdraft, runwayP5 };
}

// HHI helper from client shares (optional; keep 0 if none)
function computeHHI(shares = []) {
  // shares = [{name, share: 0..1}, ...]
  const h = shares.reduce((s, x) => s + (x.share || 0) ** 2, 0);
  return h; // 0..1
}

function euro(x) {
  const v = Math.round(x || 0);
  return `${v.toLocaleString()}€`;
}

// Demo sales rows (same schema the Radar expects)
const radarSampleRows = [
  {
    date: "2025-09-28",
    order_id: "A-1001",
    sku: "SKU-A",
    name: "Café grain 1kg",
    qty: 3,
    unit_price: 12.9,
    unit_cost: 9.5,
    discount: 4.5,
    shipping_fee: 3.9,
    shipping_cost: 4.5,
  },
  {
    date: "2025-09-29",
    order_id: "A-1002",
    sku: "SKU-A",
    name: "Café grain 1kg",
    qty: 2,
    unit_price: 12.9,
    unit_cost: 9.5,
    discount: 0.0,
    shipping_fee: 3.9,
    shipping_cost: 3.9,
  },
  {
    date: "2025-09-30",
    order_id: "A-1003",
    sku: "SKU-A",
    name: "Café grain 1kg",
    qty: 4,
    unit_price: 11.9,
    unit_cost: 9.5,
    discount: 3.6,
    shipping_fee: 3.9,
    shipping_cost: 4.2,
  },

  {
    date: "2025-10-01",
    order_id: "B-2001",
    sku: "SKU-B",
    name: "Thé vert 100g",
    qty: 6,
    unit_price: 6.2,
    unit_cost: 4.2,
    discount: 0.6,
    shipping_fee: 2.9,
    shipping_cost: 3.5,
  },
  {
    date: "2025-10-02",
    order_id: "B-2002",
    sku: "SKU-B",
    name: "Thé vert 100g",
    qty: 5,
    unit_price: 5.5,
    unit_cost: 4.2,
    discount: 0.0,
    shipping_fee: 2.9,
    shipping_cost: 2.6,
  },
  {
    date: "2025-10-03",
    order_id: "B-2003",
    sku: "SKU-B",
    name: "Thé vert 100g",
    qty: 4,
    unit_price: 6.9,
    unit_cost: 4.2,
    discount: 2.4,
    shipping_fee: 2.9,
    shipping_cost: 3.0,
  },

  {
    date: "2025-10-04",
    order_id: "C-3001",
    sku: "SKU-C",
    name: "Tasse double paroi",
    qty: 2,
    unit_price: 9.9,
    unit_cost: 7.2,
    discount: 0.0,
    shipping_fee: 2.5,
    shipping_cost: 4.0,
  },
  {
    date: "2025-10-05",
    order_id: "C-3002",
    sku: "SKU-C",
    name: "Tasse double paroi",
    qty: 3,
    unit_price: 8.9,
    unit_cost: 7.2,
    discount: 3.3,
    shipping_fee: 2.5,
    shipping_cost: 3.8,
  },
  {
    date: "2025-10-06",
    order_id: "C-3003",
    sku: "SKU-C",
    name: "Tasse double paroi",
    qty: 1,
    unit_price: 10.5,
    unit_cost: 7.2,
    discount: 0.0,
    shipping_fee: 2.5,
    shipping_cost: 2.4,
  },

  {
    date: "2025-10-07",
    order_id: "D-4001",
    sku: "SKU-D",
    name: "Filtres papier x100",
    qty: 10,
    unit_price: 2.9,
    unit_cost: 1.6,
    discount: 0.5,
    shipping_fee: 0.0,
    shipping_cost: 0.0,
  },
  {
    date: "2025-10-08",
    order_id: "D-4002",
    sku: "SKU-D",
    name: "Filtres papier x100",
    qty: 12,
    unit_price: 2.7,
    unit_cost: 1.6,
    discount: 0.0,
    shipping_fee: 0.0,
    shipping_cost: 0.0,
  },
  {
    date: "2025-10-09",
    order_id: "D-4003",
    sku: "SKU-D",
    name: "Filtres papier x100",
    qty: 8,
    unit_price: 2.4,
    unit_cost: 1.6,
    discount: 0.0,
    shipping_fee: 0.0,
    shipping_cost: 0.0,
  },
];

function ChartTooltip({ active, payload, label }) {
  const { t } = useTranslation("risk");
  if (!active || !payload?.length) return null;
  const map = Object.fromEntries(payload.map((p) => [p.dataKey, p.value]));
  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-800 p-3 text-sm">
      <div className="font-medium mb-1">{label}</div>
      <div>
        {t("tooltip.p95")}:{" "}
        <span className="font-semibold">{euro(map.p95)}</span>
      </div>
      <div>
        {t("tooltip.median")}:{" "}
        <span className="font-semibold">{euro(map.p50)}</span>
      </div>
      <div>
        {t("tooltip.mc")}: <span className="font-semibold">{euro(map.mc)}</span>
      </div>
      <div>
        {t("tooltip.p5")}: <span className="font-semibold">{euro(map.p5)}</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">{t("tooltip.note")}</div>
    </div>
  );
}

export default function RiskHub() {
  const { t } = useTranslation("risk");

  // ---- CSV Upload state (keeps logic intact; we just feed realRows to the engine) ----
  const fileInputRef = React.useRef(null);
  const [realRows, setRealRows] = React.useState(
    typeof window !== "undefined" ? window.__REAL_SALES__ || null : null
  );

  // Engine (identique à avant, on passe realRows/démo)
  const {
    params,
    setParams,
    stress,
    setStress,
    metrics,
    fanSeries,
    recompute,
  } = useCashRiskEngine({
    demoRows: radarSampleRows,
    realRows,
    initialCash: 12000,
  });

  // Normalisation légère des colonnes pour tolérer quelques variantes usuelles
  const normalizeRow = (r) => ({
    date: r.date || r.Date || r.DATE,
    order_id:
      r.order_id ?? r.orderId ?? r.orderID ?? r.commande ?? r.Commande ?? "",
    sku: r.sku ?? r.SKU ?? r.product_sku ?? r.ProductSKU ?? "",
    name: r.name ?? r.product ?? r.Product ?? r.Nom ?? "",
    qty: Number(r.qty ?? r.quantity ?? r.Qty ?? r.Quantité ?? 0),
    unit_price: Number(r.unit_price ?? r.price ?? r.unitPrice ?? 0),
    unit_cost: Number(r.unit_cost ?? r.cost ?? r.unitCost ?? 0),
    discount: Number(r.discount ?? r.remise ?? r.Remise ?? 0),
    shipping_fee: Number(r.shipping_fee ?? r.frais_livraison ?? 0),
    shipping_cost: Number(r.shipping_cost ?? r.cout_livraison ?? 0),
  });

  const handleCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (res) => {
        try {
          const rows = (res.data || [])
            .map(normalizeRow)
            .filter((r) => r.date && !Number.isNaN(new Date(r.date).getTime()));
          if (!rows.length) throw new Error(t("csv.invalidRows"));
          setRealRows(rows);
          if (typeof window !== "undefined") window.__REAL_SALES__ = rows;
          recompute();
        } catch (err) {
          console.error(err);
          alert(t("csv.invalid"));
        }
      },
      error: (err) => {
        console.error(err);
        alert(t("csv.parseError"));
      },
    });
  };

  const triggerUpload = () => fileInputRef.current?.click();

  const downloadSampleCSV = () => {
    const headers = [
      "date",
      "order_id",
      "sku",
      "name",
      "qty",
      "unit_price",
      "unit_cost",
      "discount",
      "shipping_fee",
      "shipping_cost",
    ];
    const lines = [
      headers.join(","),
      ...radarSampleRows.map((r) => headers.map((h) => r[h]).join(",")),
    ].join("\n");
    const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "riskhub_exemple.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ==== SAFE HHI + DEMO CLIENT SHARES (fallback) ====
  const demoClientShares = [
    { name: "Client A", share: 0.28 },
    { name: "Client B", share: 0.22 },
    { name: "Client C", share: 0.17 },
    { name: "Client D", share: 0.12 },
    { name: "Client E", share: 0.1 },
    { name: "Autres", share: 0.11 },
  ];

  const shares = (
    metrics?.shares?.length ? metrics.shares : demoClientShares
  ).map((s) => ({
    name: s.name ?? "—",
    share: Math.max(0, Math.min(1, Number(s.share) || 0)),
  }));

  const hhiFromShares = shares.reduce((sum, s) => sum + s.share * s.share, 0);
  const hhiValue =
    Number.isFinite(metrics?.hhi) && metrics.hhi > 0
      ? Number(metrics.hhi)
      : hhiFromShares;
  const hhiLabel = Number.isFinite(hhiValue) ? hhiValue.toFixed(2) : "—";

  // === WOW "evasives" around the true line ==================================
  // We generate 4 "splayed" lines around the median using the fan width,
  // with a subtle sinusoidal jitter to look like sampled Monte Carlo paths.
  const series = useMemo(() => {
    const EV1 = 0.35; // outer offset as fraction of band width
    const EV2 = 0.2; // inner offset
    const JIT = 0.06; // jitter magnitude as fraction of width
    const FREQ = 0.35; // jitter frequency

    return (fanSeries || []).map((d, i) => {
      const width = d.p95 - d.p5;
      const j = Math.sin(i * FREQ) * JIT * width;
      const j2 = Math.cos(i * (FREQ * 0.8)) * (JIT * 0.6) * width;

      return {
        ...d,
        mc: d.p50, // central Monte Carlo line (median path)
        mcUp1: d.p50 + EV1 * width + j,
        mcUp2: d.p50 + EV2 * width - j2,
        mcDn1: d.p50 - EV1 * width - j,
        mcDn2: d.p50 - EV2 * width + j2,
        // pedagogic bands kept:
        stress: d.p50 - 0.4 * width,
        opti: d.p50 + 0.4 * width,
      };
    });
  }, [fanSeries]);

  return (
    <div
      className="p-4 md:p-6 space-y-6"
      style={{
        "--col-p95": "#22c55e",
        "--col-p50": "#0ea5e9",
        "--col-p5": "#ef4444",
        "--col-mc": "#111827", // Monte Carlo (median)
        "--col-sp1": "#6366f1", // evasive outer
        "--col-sp2": "#94a3b8", // evasive inner
      }}
    >
      {/* TOP BAR: Upload + Sample (tech/McKinsey style) */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl border bg-white/70 dark:bg-white/5 backdrop-blur px-4 py-3 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="min-w-[240px]">
          <div className="font-medium">{t("topbar.title")}</div>
          <div className="text-xs text-gray-500">
            {t("topbar.csvExpected")}{" "}
            <span className="font-mono">
              date, order_id, sku, name, qty, unit_price, unit_cost, discount,
              shipping_fee, shipping_cost
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadSampleCSV}
            className="px-3 py-2 rounded-xl border hover:shadow-sm active:scale-[0.99] transition flex items-center gap-2"
          >
            <Download size={16} />
            {t("topbar.downloadSample")}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleCSV}
          />
          <button
            onClick={triggerUpload}
            className="px-3 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black hover:opacity-90 active:scale-[0.99] transition flex items-center gap-2"
          >
            <UploadCloud size={16} />
            {t("topbar.uploadCsv")}
          </button>
        </div>
      </motion.div>

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("header.title")}</h1>
          <p className="text-gray-500">{t("header.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {metrics.isDemo && (
            <span className="px-3 py-1 rounded-xl text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
              {t("header.modeDemo")}
            </span>
          )}
          <RiskRibbon
            runwayP5={metrics.runwayP5}
            probOverdraft={metrics.probOverdraft}
            hhi={hhiValue}
          />
        </div>
      </div>

      {/* KPI STRIP */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="grid grid-cols-2 md:grid-cols-5 gap-3"
      >
        <Stat
          label={t("kpi.cfar", {
            alphaPct: Math.round((params.alpha || 0.95) * 100),
            horizon: params.horizon,
          })}
          value={euro(metrics.cfar)}
        />
        <Stat label={t("kpi.es")} value={euro(metrics.es)} />
        <Stat
          label={t("kpi.probOverdraft")}
          value={`${Math.round(metrics.probOverdraft * 100)}%`}
        />
        <Stat
          label={t("kpi.runway")}
          value={
            isFinite(metrics.runwayP5)
              ? `${Math.round(metrics.runwayP5)} j`
              : "∞"
          }
        />
        <Stat label={t("kpi.hhi")} value={hhiLabel} />
      </motion.div>

      {/* MAIN CHART */}
      <RiskCard
        title={t("chart.title")}
        subtitle={t("chart.subtitle", {
          horizon: params.horizon,
          alphaPct: Math.round((params.alpha || 0.95) * 100),
          nSim: params.nSim.toLocaleString(),
        })}
        right={
          <div className="text-right text-sm">
            <div>
              {t("chart.cfar")}{" "}
              <span className="font-semibold">{euro(metrics.cfar)}</span>
            </div>
            <div>
              {t("chart.es")}{" "}
              <span className="font-semibold">{euro(metrics.es)}</span>
            </div>
          </div>
        }
        icon={<Sparkles size={18} />}
        className="overflow-hidden"
      >
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={series}
              margin={{ left: 8, right: 8, top: 12, bottom: 8 }}
            >
              <defs>
                <linearGradient id="grad-p95" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--col-p95)"
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--col-p95)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
                <linearGradient id="grad-p50" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--col-p50)"
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--col-p50)"
                    stopOpacity={0.08}
                  />
                </linearGradient>
                <linearGradient id="grad-p5" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--col-p5)"
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--col-p5)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" />
              <YAxis
                tickFormatter={(v) =>
                  v >= 0
                    ? `€${(v / 1000).toFixed(0)}k`
                    : `-€${Math.abs(v / 1000).toFixed(0)}k`
                }
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend verticalAlign="top" height={24} />
              <ReferenceLine y={0} stroke="#9AA1A9" strokeDasharray="4 4" />

              {/* Fan areas */}
              <Area
                name={t("legend.p95Optimistic")}
                type="monotone"
                dataKey="p95"
                stroke="var(--col-p95)"
                fill="url(#grad-p95)"
                isAnimationActive
                animationBegin={100}
                animationDuration={900}
              />
              <Area
                name={t("legend.median")}
                type="monotone"
                dataKey="p50"
                stroke="var(--col-p50)"
                fill="url(#grad-p50)"
                isAnimationActive
                animationBegin={150}
                animationDuration={900}
              />
              <Area
                name={t("legend.p5Conservative")}
                type="monotone"
                dataKey="p5"
                stroke="var(--col-p5)"
                fill="url(#grad-p5)"
                isAnimationActive
                animationBegin={200}
                animationDuration={900}
              />

              {/* Monte Carlo central line */}
              <Line
                name={t("legend.mc")}
                type="monotone"
                dataKey="mc"
                stroke="var(--col-mc)"
                strokeWidth={2}
                dot={false}
                isAnimationActive
                animationBegin={160}
                animationDuration={900}
              />

              {/* EVASIVE LINES (spaghetti feel) */}
              <Line
                name={t("legend.mcOuterPlus")}
                type="monotone"
                dataKey="mcUp1"
                stroke="var(--col-sp1)"
                strokeDasharray="6 6"
                strokeOpacity={0.6}
                strokeWidth={1.25}
                dot={false}
                isAnimationActive
                animationBegin={180}
                animationDuration={900}
              />
              <Line
                name={t("legend.mcInnerPlus")}
                type="monotone"
                dataKey="mcUp2"
                stroke="var(--col-sp2)"
                strokeDasharray="3 6"
                strokeOpacity={0.55}
                strokeWidth={1.1}
                dot={false}
                isAnimationActive
                animationBegin={180}
                animationDuration={900}
              />
              <Line
                name={t("legend.mcOuterMinus")}
                type="monotone"
                dataKey="mcDn1"
                stroke="var(--col-sp1)"
                strokeDasharray="6 6"
                strokeOpacity={0.6}
                strokeWidth={1.25}
                dot={false}
                isAnimationActive
                animationBegin={180}
                animationDuration={900}
              />
              <Line
                name={t("legend.mcInnerMinus")}
                type="monotone"
                dataKey="mcDn2"
                stroke="var(--col-sp2)"
                strokeDasharray="3 6"
                strokeOpacity={0.55}
                strokeWidth={1.1}
                dot={false}
                isAnimationActive
                animationBegin={180}
                animationDuration={900}
              />

              {/* Pedagogic guides */}
              <Area
                name={t("legend.stress")}
                type="monotone"
                dataKey="stress"
                stroke="#ef4444"
                strokeDasharray="6 6"
                fillOpacity={0}
                isAnimationActive
              />
              <Area
                name={t("legend.optimistic")}
                type="monotone"
                dataKey="opti"
                stroke="#22c55e"
                strokeDasharray="6 6"
                fillOpacity={0}
                isAnimationActive
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </RiskCard>

      {/* NEW LAYOUT FOR 3 BLOCKS */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Stress & Simulation (wide) */}
        <div className="col-span-12 lg:col-span-7">
          <RiskCard
            title={t("block.stressSim.title")}
            subtitle={t("block.stressSim.subtitle")}
            tone="brand"
            icon={<Sparkles size={18} />}
          >
            <ScenarioPanel
              stress={stress}
              setStress={setStress}
              params={params}
              setParams={setParams}
              onRun={() => recompute()}
            />
          </RiskCard>
        </div>

        {/* Right: Conseiller IA (sticky) */}
        <div className="col-span-12 lg:col-span-5">
          <div className="lg:sticky lg:top-20">
            <RiskCard
              title={t("block.advisor.title")}
              subtitle={t("block.advisor.subtitle")}
              tone="mint"
              icon={<Lightbulb size={18} />}
            >
              <RiskAdvisor metrics={metrics} />
            </RiskCard>
          </div>
        </div>

        {/* Revenue Leakage Radar */}
        <div className="col-span-12">
          <div className="mt-6 rounded-2xl border overflow-hidden bg-white/70 dark:bg-white/5">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <PieChart size={18} />
                <div>
                  <div className="font-medium">{t("radar.title")}</div>
                  <div className="text-xs text-gray-500">
                    {t("radar.subtitle")}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4">
              <LeakageRadarEmbed initialRows={radarSampleRows} />
              <div className="mt-3 text-[11px] text-gray-500">
                {t("radar.tip")}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom full-width: Concentration */}
        <div className="col-span-12">
          <RiskCard
            title={t("clients.title")}
            subtitle={`HHI ${hhiLabel}`}
            icon={<Users size={18} />}
          >
            <ul className="space-y-3">
              {shares.length ? (
                shares.map((s, i) => (
                  <li key={i} className="flex items-center gap-4">
                    <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-semibold">
                      {s.name?.slice(0, 1) || "?"}
                    </div>
                    <div className="w-48 text-sm text-gray-600 dark:text-gray-300 truncate">
                      {s.name}
                    </div>
                    <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                      <div
                        className="h-2"
                        style={{
                          width: `${Math.round(s.share * 100)}%`,
                          background:
                            "linear-gradient(90deg, var(--col-p50), #38bdf8)",
                        }}
                      />
                    </div>
                    <div className="w-12 text-right text-sm tabular-nums">
                      {Math.round(s.share * 100)}%
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-500">{t("clients.none")}</li>
              )}
            </ul>
          </RiskCard>
        </div>
      </div>

      {/* EDUCATION */}
      <RiskGlossary />
    </div>
  );
}
