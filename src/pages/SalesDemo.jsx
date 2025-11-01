// ANCHOR: FILE_TOP SalesDemo.jsx
// Page: Sales Demo (import + KPIs + Forecast + Actions + Preview)

import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { useTranslation } from "react-i18next";

import useDataset from "../hooks/useDataset";
import { formatNumber } from "../lib/format";
import { toDateKey, dateAddDays, rangeDays } from "../lib/date";
import {
  ses,
  holt,
  holtDamped,
  holtWintersAdditive,
  mape,
  detectWeeklySeasonality,
} from "../lib/forecast";

// UI (local components)
import Card from "../components/ui/Card";
import Section from "../components/ui/Section";
import Stat from "../components/ui/Stat";

// Recharts
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceArea,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ReferenceLine,
  LabelList,
  Cell,
} from "recharts";

// Framer Motion
import { motion, AnimatePresence } from "framer-motion";

// Icons (lucide-react)
import {
  Upload,
  FileDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Sparkles,
  Brain,
  Settings,
  Share2,
  Users,
  X,
  Download,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helper d'animation robuste                                         */
/* ------------------------------------------------------------------ */
function FadeIn({ children, delay = 0, immediate = false }) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    try {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    } catch {
      mq.addListener(apply);
      return () => mq.removeListener(apply);
    }
  }, []);

  if (reduced) return <>{children}</>;
  const common = {
    initial: { opacity: 0, y: 8 },
    transition: { duration: 0.28, delay, ease: [0.22, 1, 0.36, 1] },
  };
  if (immediate)
    return (
      <motion.div {...common} animate={{ opacity: 1, y: 0 }}>
        {children}
      </motion.div>
    );
  return (
    <motion.div
      {...common}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12, margin: "0px 0px -80px 0px" }}
    >
      {children}
    </motion.div>
  );
}

/* --------------------------- Helpers chiffrés --------------------------- */
const pct = (last, first) =>
  first > 0 ? ((last - first) / first) * 100 : last > 0 ? 100 : 0;

function linRegSlope(points) {
  const n = points.length;
  if (n < 2) return 0;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const y = Number(points[i].value || 0);
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const num = n * sumXY - sumX * sumY;
  const den = n * sumXX - sumX * sumX;
  return den !== 0 ? num / den : 0;
}

function sanitizePdfText(s = "") {
  return String(s).replace(/\s+/g, " ");
}

/* === DEMO WAVE: stronger daily revenue so CA30 isn't stuck at ~70€ === */
/* === DEMO WAVE: stronger daily revenue so CA30 isn't stuck at ~70€ === */
/**
 * Calibrates demo revenue to ~€5,000 and DISTRIBUTES it across REAL SKUs.
 * Result: global revenue ≈ €5k and "Top products" bars match it.
 */
function makeWavyDemoRows(rows = []) {
  const base = Array.isArray(rows) ? rows.slice() : [];
  // --- Compute current revenue in the sample
  const current = base.reduce((s, r) => {
    const q = Number(r?.qty || 0);
    const p = Number(r?.price || 0);
    return s + (isFinite(q * p) ? q * p : 0);
  }, 0);

  // --- Target total for realism
  const TARGET_TOTAL = 5000; // € — tweak if you want another baseline
  const gap = Math.max(0, TARGET_TOTAL - current);
  if (gap <= 0) return base;

  // --- Pick last date in the sample; if missing, use "today"
  const dates = base
    .map((r) => r?.date)
    .filter(Boolean)
    .sort();
  const end = dates.length ? new Date(dates[dates.length - 1]) : new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29); // 30-day window

  // --- Real SKUs used in your sample + relative weights
  const SKUS = [
    { name: "Café grain 1kg", price: 12.9, weight: 0.3 },
    { name: "Capsules espresso x10", price: 3.8, weight: 0.25 },
    { name: "Thé vert 100g", price: 5.9, weight: 0.15 },
    { name: "Tasse double paroi", price: 9.9, weight: 0.15 },
    { name: "Sirop caramel 75cl", price: 7.2, weight: 0.15 },
  ];

  // --- Build a smooth daily share (weekly + short ripple)
  const dayCount = 30;
  const rawShares = [];
  for (let i = 0; i < dayCount; i++) {
    const w1 = Math.sin((2 * Math.PI * i) / 7 + 0.7);
    const w2 = Math.sin((2 * Math.PI * i) / 3.5 + 0.2);
    rawShares.push(1 + 0.18 * w1 + 0.08 * w2);
  }
  const sumShares = rawShares.reduce((s, x) => s + x, 0) || 1;
  const shares = rawShares.map((x) => x / sumShares);

  // --- Distribute euros -> quantities per SKU with carry for precision
  const out = base.slice();
  const carry = SKUS.map(() => 0);

  for (let i = 0; i < dayCount; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dayKey = d.toISOString().slice(0, 10);
    const eurosToday = gap * shares[i];

    SKUS.forEach((sku, k) => {
      const need = eurosToday * sku.weight + carry[k];
      const qty = Math.floor(need / sku.price);
      carry[k] = need - qty * sku.price;

      if (qty > 0) {
        out.push({
          date: dayKey,
          order_id: `DEMO-${dayKey.replace(/-/g, "")}-${k}`,
          product: sku.name,
          qty,
          price: sku.price,
          customer_id: "DEMO",
        });
      }
    });
  }

  // --- Final top-up on the last day if rounding left a shortfall
  const added = out.reduce((s, r, idx) => {
    if (idx < base.length) return s;
    return s + Number(r.qty || 0) * Number(r.price || 0);
  }, 0);
  let diff = Math.round((gap - added) * 100) / 100;

  if (diff > 0.01) {
    // Use the cheapest SKU for the top-up
    const cheapestIdx = SKUS.reduce(
      (best, _, i, a) => (a[i].price < a[best].price ? i : best),
      0
    );
    const cheap = SKUS[cheapestIdx];
    const extraQty = Math.max(1, Math.round(diff / cheap.price));
    const lastKey = end.toISOString().slice(0, 10);
    out.push({
      date: lastKey,
      order_id: `DEMO-TOPUP-${lastKey}`,
      product: cheap.name,
      qty: extraQty,
      price: cheap.price,
      customer_id: "DEMO",
    });
  }

  return out;
}

const isDemoRow = (r = {}) => {
  const cid = String(r.customer_id || "");
  const oid = String(r.order_id || "");
  return cid === "DEMO" || /^DEMO-/.test(oid);
};
/* === END DEMO WAVE === */
/* === Parsing: KEEP demo rows so the graph/KPIs show healthy revenue === */

/* === Parsing: KEEP demo rows so the graph/KPIs show healthy revenue === */
function _parseBaseSalesRows(raw, imported) {
  const base = raw?.length
    ? raw
    : imported?.length
    ? imported
    : Papa.parse(SAMPLE_SALES, {
        header: true,
        skipEmptyLines: true,
        comments: "#",
      }).data;

  // ⬇️ Do NOT strip sentinel rows anymore – we want the wavy demo included.
  const core = base || [];

  return (core || [])
    .filter((r) => r.date && r.product && r.qty && r.price)
    .map((r) => ({
      date: new Date(r.date),
      dayKey: toDateKey(r.date),
      order_id: r.order_id,
      product: r.product,
      qty: Number(r.qty),
      price: Number(r.price),
      customer_id: r.customer_id || null,
      revenue: Number(r.qty) * Number(r.price),
    }));
}

/* ----- RFM ----- */
function computeRFM(rawRows, imported) {
  const rows = _parseBaseSalesRows(rawRows, imported);
  if (!rows.length) return { segments: [], bySeg: {} };
  const maxDate = rows.reduce(
    (m, r) => (r.date > m ? r.date : m),
    rows[0].date
  );
  const byCust = new Map();
  for (const r of rows) {
    if (!byCust.has(r.customer_id)) byCust.set(r.customer_id, []);
    byCust.get(r.customer_id).push(r);
  }
  const arr = [];
  for (const [cid, list] of byCust) {
    list.sort((a, b) => a.date - b.date);
    const lastD = list[list.length - 1]?.date;
    const recencyDays = lastD
      ? Math.max(1, Math.round((maxDate - lastD) / 86400000))
      : 9999;
    const orders = new Set(list.map((x) => x.order_id)).size;
    const monetary = list.reduce((s, x) => s + x.revenue, 0);
    const aov = monetary / Math.max(1, orders);
    const topSku = (() => {
      const m = new Map();
      list.forEach((x) =>
        m.set(x.product, (m.get(x.product) || 0) + x.revenue)
      );
      return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
    })();
    arr.push({
      customer_id: cid,
      recencyDays,
      frequency: orders,
      monetary,
      aov,
      lastDate: lastD,
      topSku,
    });
  }

  const q = (xs, p) => {
    const a = [...xs].sort((x, y) => x - y);
    if (!a.length) return 0;
    const i = Math.min(
      a.length - 1,
      Math.max(0, Math.floor(p * (a.length - 1)))
    );
    return a[i];
  };
  const cuts = (xs) => [0.2, 0.4, 0.6, 0.8].map((p) => q(xs, p));
  const recs = arr.map((x) => x.recencyDays);
  const freqs = arr.map((x) => x.frequency);
  const mons = arr.map((x) => x.monetary);
  const [r1, r2, r3, r4] = cuts(recs);
  const [f1, f2, f3, f4] = cuts(freqs);
  const [m1, m2, m3, m4] = cuts(mons);
  const score = (v, [a, b, c, d], invert = false) => {
    const s = v <= a ? 1 : v <= b ? 2 : v <= c ? 3 : v <= d ? 4 : 5;
    return invert ? 6 - s : s;
  };
  const tag = (R, F, M) => {
    if (R >= 4 && F >= 4 && M >= 4) return "Champions";
    if (R >= 4 && F >= 3) return "Loyal";
    if (R <= 2 && F >= 3) return "At-Risk Loyal";
    if (R >= 3 && F <= 2 && M >= 3) return "Promising";
    if (R <= 2 && F <= 2) return "Hibernating";
    return "Regulars";
  };
  for (const c of arr) {
    c.R = score(c.recencyDays, [r1, r2, r3, r4], true);
    c.F = score(c.frequency, [f1, f2, f3, f4], false);
    c.M = score(c.monetary, [m1, m2, m3, m4], false);
    c.segment = tag(c.R, c.F, c.M);
  }
  const bySeg = arr.reduce((m, x) => {
    m[x.segment] = (m[x.segment] || 0) + 1;
    return m;
  }, {});
  return { segments: arr, bySeg };
}

/* ----- Affinity (pairs by order) ----- */
function buildAffinity(
  rawRows,
  imported,
  { minSupport = 2, minLift = 1.1 } = {}
) {
  const rows = _parseBaseSalesRows(rawRows, imported);
  const byOrder = new Map();
  for (const r of rows) {
    if (!byOrder.has(r.order_id)) byOrder.set(r.order_id, []);
    byOrder.get(r.order_id).push(r.product);
  }
  const totalOrders = byOrder.size || 1;
  const countP = new Map();
  const countPair = new Map();
  for (const [, prodsRaw] of byOrder) {
    const prods = [...new Set(prodsRaw)];
    for (const p of prods) countP.set(p, (countP.get(p) || 0) + 1);
    for (let i = 0; i < prods.length; i++) {
      for (let j = i + 1; j < prods.length; j++) {
        const a = prods[i],
          b = prods[j];
        const key = a < b ? `${a}||${b}` : `${b}||${a}`;
        const count = countPair.get(key) || 0;
        countPair.set(key, count + 1);
      }
    }
  }
  const edges = [];
  for (const [key, cAB] of countPair) {
    if (cAB < minSupport) continue;
    const [a, b] = key.split("||");
    const pA = (countP.get(a) || 0) / (totalOrders || 1);
    const pB = (countP.get(b) || 0) / (totalOrders || 1);
    const pAB = cAB / (totalOrders || 1);
    const lift = pAB / Math.max(1e-9, pA * pB);
    if (lift >= minLift)
      edges.push({ a, b, support: cAB, lift, score: cAB * lift });
  }
  edges.sort((x, y) => y.score - x.score);
  return edges;
}

/* ----- Cohorts (first-purchase month, retention %) ----- */
function buildCohorts(rawRows, imported) {
  const rows = _parseBaseSalesRows(rawRows, imported);
  const byCust = new Map();
  for (const r of rows) {
    if (!byCust.has(r.customer_id)) byCust.set(r.customer_id, []);
    byCust.get(r.customer_id).toString;
    byCust.get(r.customer_id).push(r);
  }
  const grid = new Map();
  for (const [cid, list] of byCust) {
    list.sort((a, b) => a.date - b.date);
    const first = list[0].date;
    const cohortKey = `${first.getFullYear()}-${String(
      first.getMonth() + 1
    ).padStart(2, "0")}`;
    for (const r of list) {
      const d = r.date;
      const offset =
        (d.getFullYear() - first.getFullYear()) * 12 +
        (d.getMonth() - first.getMonth());
      if (!grid.has(cohortKey)) grid.set(cohortKey, new Map());
      const cell = grid.get(cohortKey).get(offset) || new Set();
      cell.add(cid);
      grid.get(cohortKey).set(offset, cell);
    }
  }
  const out = [];
  for (const [cohort, m] of grid) {
    const base = m.get(0)?.size || 0;
    for (const [offset, set] of m) {
      const retention = offset === 0 ? 1 : base ? set.size / base : 0;
      out.push({ cohort, month: offset, retention });
    }
  }
  out.sort((a, b) => a.cohort.localeCompare(b.cohort) || a.month - b.month);
  return out;
}

/* ----- Weekday seasonality index ----- */
function weekdaySeasonality(rawRows, imported) {
  const rows = _parseBaseSalesRows(rawRows, imported);
  const sums = Array.from({ length: 7 }, () => 0);
  for (const r of rows) sums[r.date.getDay()] += r.revenue;
  const avg = sums.reduce((s, x) => s + x, 0) / Math.max(1, sums.length);
  return sums.map((sum, wd) => ({
    wd,
    label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][wd],
    index: avg ? sum / avg : 1,
    revenue: sum,
  }));
}

// Fallback IA local
async function getAdviceOrFallback(kind, summary, t) {
  const lines = [];
  lines.push(t("ai.summaryTitle"));
  if (summary?.kpis) {
    lines.push(
      t("ai.kpi.ca30", {
        v: formatNumber(summary.kpis.ca30, 0),
        cur: summary.currency,
      })
    );
    lines.push(
      t("ai.kpi.basket", {
        v: formatNumber(summary.kpis.basket, 2),
        cur: summary.currency,
      })
    );
    lines.push(
      t("ai.kpi.clients", { v: formatNumber(summary.kpis.unique, 0) })
    );
  }
  if (summary?.topProducts?.length) {
    const top = summary.topProducts[0];
    lines.push(t("ai.topProduct", { name: top.name }));
  }
  lines.push(t("ai.actions"));
  return lines.join("\n");
}

// Mini preview table autonome
function TablePreview({ rows = [] }) {
  const { t } = useTranslation("sales");
  const cols = rows.length ? Object.keys(rows[0]) : [];
  return (
    <div className="overflow-auto rounded-xl border relative">
      <div
        className="pointer-events-none absolute -inset-1 rounded-2xl blur-lg opacity-30"
        style={{
          background:
            "radial-gradient(60% 60% at 20% 0%, rgba(59,130,246,0.10), transparent 70%), radial-gradient(60% 60% at 90% 100%, rgba(16,185,129,0.12), transparent 70%)",
        }}
      />
      <table className="min-w-full text-sm relative">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {cols.map((c) => (
              <th key={c} className="p-2 text-left font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 30).map((r, i) => (
            <tr key={i} className="border-t">
              {cols.map((c) => (
                <td key={c} className="p-2">
                  {String(r[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-[11px] text-gray-500 p-2">{t("preview.footer")}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DEMO CSV (pairs + retention signals)                              */
/* ------------------------------------------------------------------ */
const SAMPLE_SALES = `date,order_id,product,qty,price,customer_id
2025-08-01,1001,Café grain 1kg,1,12.90,C001
2025-08-01,1001,Filtres papier x100,1,2.60,C001
2025-08-01,1001,Sirop caramel 75cl,1,7.20,C001
2025-08-01,1002,Thé vert 100g,2,5.90,C002
2025-08-02,1003,Café grain 1kg,2,12.90,C003
2025-08-03,1004,Capsules espresso x10,3,3.80,C002
2025-08-03,1004,Tasse double paroi,1,9.90,C002
2025-08-04,1005,Sirop caramel 75cl,1,7.20,C004
2025-08-04,1006,Filtres papier x100,2,2.60,C001
2025-08-05,1007,Sucre morceaux 1kg,3,1.90,C005
2025-08-06,1008,Tasse double paroi,1,9.90,C002
2025-08-06,1009,Moulin manuel,1,34.00,C006
2025-08-07,1010,Café grain 1kg,1,12.90,C007
2025-08-07,1010,Capsules espresso x10,1,3.80,C007
2025-08-08,1011,Thé vert 100g,1,5.90,C008
2025-08-09,1012,Capsules espresso x10,2,3.80,C002
2025-08-09,1012,Sirop caramel 75cl,1,7.20,C002
2025-08-10,1013,Sirop caramel 75cl,2,7.20,C004
2025-08-11,1014,Café grain 1kg,1,12.90,C009
2025-08-11,1014,Thé vert 100g,1,5.90,C009
2025-08-11,1014,Sucre morceaux 1kg,1,1.90,C009
2025-08-12,1015,Moulin manuel,1,34.00,C010
2025-08-12,1015,Café grain 1kg,1,12.90,C010
2025-08-13,1016,Capsules espresso x10,2,3.80,C011
2025-08-13,1016,Thé vert 100g,1,5.90,C011
2025-08-14,1017,Café grain 1kg,1,12.90,C012
2025-08-14,1017,Tasse double paroi,1,9.90,C012

# Repeat pairs (support >= 2)
2025-08-15,1018,Café grain 1kg,1,12.90,C003
2025-08-15,1018,Filtres papier x100,1,2.60,C003
2025-08-16,1019,Capsules espresso x10,2,3.80,C004
2025-08-16,1019,Tasse double paroi,1,9.90,C004

# Sept purchases (retention M+1)
2025-09-02,1020,Café grain 1kg,1,12.90,C001
2025-09-02,1020,Filtres papier x100,1,2.60,C001
2025-09-05,1022,Capsules espresso x10,2,3.80,C002
2025-09-05,1022,Tasse double paroi,1,9.90,C002
2025-09-10,1025,Café grain 1kg,1,12.90,C003
2025-09-10,1025,Filtres papier x100,1,2.60,C003
2025-09-12,1026,Sirop caramel 75cl,1,7.20,C004
2025-09-18,1028,Thé vert 100g,2,5.90,C009

# Oct purchases (retention M+2)
2025-10-01,1030,Café grain 1kg,1,12.90,C007
2025-10-01,1030,Filtres papier x100,1,2.60,C007
2025-10-03,1031,Café grain 1kg,1,12.90,C001
2025-10-06,1034,Capsules espresso x10,1,3.80,C012
2025-10-06,1034,Tasse double paroi,1,9.90,C012
2025-10-09,1036,Thé vert 100g,1,5.90,C002
2025-10-12,1038,Sirop caramel 75cl,1,7.20,C003
`;

function SalesDemo() {
  const { t } = useTranslation("sales");

  const [rows, setRows] = useState(() => {
    const parsed = Papa.parse(SAMPLE_SALES, {
      header: true,
      skipEmptyLines: true,
      comments: "#",
    }).data;
    return makeWavyDemoRows(parsed); // keep demo rows in series
  });

  const [isDemoData, setIsDemoData] = useState(true);

  const chartRef = useRef(null);
  const [currency, setCurrency] = useState("€");
  const [smooth, setSmooth] = useState(14);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [useFullAI, setUseFullAI] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [lastCallAt, setLastCallAt] = useState(0);

  const importedSales = useDataset("sales");

  const fileInputRef = useRef(null);

  function loadSample() {
    const parsed = Papa.parse(SAMPLE_SALES, {
      header: true,
      skipEmptyLines: true,
      comments: "#",
    }).data;
    setRows(makeWavyDemoRows(parsed));
    setIsDemoData(true);
  }

  function handleUpload(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = (res.data || []).filter((r) => r?.date && r?.product);
        setRows(data);
        setIsDemoData(false);
      },
      error: () => {
        alert(t("upload.errorParse"));
      },
    });
    e.target.value = "";
  }

  function onDropFile(ev) {
    ev.preventDefault();
    const f = ev.dataTransfer?.files?.[0];
    if (!f) return;
    const pseudoEvt = { target: { files: [f], value: "" } };
    handleUpload(pseudoEvt);
  }
  function onDragOver(ev) {
    ev.preventDefault();
  }

  const COLORS = {
    hist: "#3B82F6", // blue-500
    ci: "#94A3B8", // slate-400
    central: "#06B6D4", // cyan-500
    opti: "#10B981", // emerald-500
    prud: "#D97706", // amber-600
  };

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
    change,
  } = useMemo(() => {
    const usingUserRows = rows && rows.length;
    const usingImported = importedSales && importedSales.length;

    const baseRows = usingUserRows
      ? rows
      : usingImported
      ? importedSales
      : makeWavyDemoRows(
          Papa.parse(SAMPLE_SALES, {
            header: true,
            skipEmptyLines: true,
            comments: "#",
          }).data
        );

    // ⬇️ NO demo-strip – keep wavy "Demo Waver" lines in aggregation
    const baseRowsFiltered = baseRows || [];

    const clean = (baseRowsFiltered || [])
      .filter((r) => r.date && r.qty && r.price)
      .map((r) => ({
        date: toDateKey(r.date),
        qty: Number(r.qty),
        price: Number(r.price),
        product: r.product || "-",
        customer_id: r.customer_id || null,
        revenue: Number(r.qty) * Number(r.price),
      }));

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

    const first = series[0]?.revenue || 0;
    const last = series[series.length - 1]?.revenue || 0;
    const change = pct(last, first);

    const last30cut = maxDate ? dateAddDays(maxDate, -30) : null;
    const last30 = series.filter((d) => !last30cut || d.date >= last30cut);
    const ca30 = last30.reduce((s, x) => s + x.revenue, 0);
    const basket = clean.length
      ? clean.reduce((s, x) => s + x.revenue, 0) / clean.length
      : 0;
    const unique = new Set(clean.map((x) => x.customer_id)).size;

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

    const fitted = chosen.out.fitted || [];
    const alignedLen = Math.min(values.length, fitted.length);
    const residuals = [];
    for (let i = 0; i < alignedLen; i++) residuals.push(values[i] - fitted[i]);

    // léger biais récent hors saison
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

    const movingAverage = (arr, k = 3) => {
      if (!arr.length) return [];
      const out = [];
      for (let i = 0; i < arr.length; i++) {
        const a = Math.max(0, i - Math.floor(k / 2));
        const b = Math.min(arr.length, i + Math.ceil(k / 2));
        const slice = arr.slice(a, b);
        out.push(slice.reduce((s, x) => s + x, 0) / slice.length);
      }
      return out;
    };

    // central + subtle demo wiggle
    let central = movingAverage(chosen.out.forecast.slice(), 3);
    {
      const amp = !seasonInfo.detected ? 0.05 : 0.03;
      const ripple = !seasonInfo.detected ? 0.02 : 0.01;
      central = central.map((f, i) => {
        const w1 = Math.sin((2 * Math.PI * i) / 7);
        const w2 = Math.sin((2 * Math.PI * i) / 3.5);
        return f * (1 + amp * w1 + ripple * w2);
      });
    }

    const cutIdx = Math.floor(values.length * 0.7);
    const recentMean =
      values.slice(cutIdx).reduce((s, x) => s + x, 0) /
      Math.max(1, values.length - cutIdx);
    const globalMean =
      values.reduce((s, x) => s + x, 0) / Math.max(1, values.length);
    const recentDelta = globalMean ? (recentMean - globalMean) / globalMean : 0;
    const ampScenario = Math.min(
      0.2,
      Math.max(0.08, Math.abs(recentDelta) * 0.6)
    );
    const optimistic = central.map((v) => v * (1 + ampScenario));
    const prudent = central.map((v) =>
      Math.max(0, v * (1 - ampScenario * 0.7))
    );

    // CI 95% (slightly tempered for nicer demo)
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
    const z = 1.8; // a bit tighter than 1.96 for aesthetics

    const last30Mean =
      series
        .filter((d) => {
          const last30cut = maxDate ? dateAddDays(maxDate, -30) : null;
          return !last30cut || d.date >= last30cut;
        })
        .reduce((s, x) => s + x.revenue, 0) /
        Math.max(
          1,
          series.filter((d) => {
            const last30cut = maxDate ? dateAddDays(maxDate, -30) : null;
            return !last30cut || d.date >= last30cut;
          }).length
        ) ||
      values.slice(-7).reduce((s, x) => s + x, 0) /
        Math.max(1, Math.min(7, values.length));

    const forecastSeries = futureDates.map((d, i) => {
      const f = Math.max(0, central[i] || 0);
      const growth = Math.sqrt(i + 1);
      let span = z * baseSd * 0.55 * growth;
      const maxSpan = Math.max(last30Mean * 0.5, baseSd * 1.8);
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

    const mapeVal = mape(
      values.slice(1),
      (fitted || []).slice(0, values.length - 1)
    );
    let quality = {
      level: "moyen",
      text: "Pas de motif clair, tendance lissée.",
      icon: "★",
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

    const forecastLabel = t("chart.forecastLabel");

    const productsTop5 = Object.entries(byProduct)
      .map(([name, revenue]) => ({ name, revenue }))
      .filter((p) => !/^\s*demo/i.test(p.name))
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
      change,
    };
  }, [rows, importedSales, t]);

  const rfm = useMemo(
    () => computeRFM(rows, importedSales),
    [rows, importedSales]
  );
  const affinityTop = useMemo(
    () =>
      buildAffinity(rows, importedSales, {
        minSupport: 2,
        minLift: 1.1,
      }).slice(0, 10),
    [rows, importedSales]
  );
  const cohorts = useMemo(
    () => buildCohorts(rows, importedSales),
    [rows, importedSales]
  );
  const weekdayIdx = useMemo(
    () => weekdaySeasonality(rows, importedSales),
    [rows, importedSales]
  );

  const rfmSummary = useMemo(() => {
    const order = [
      "Champions",
      "Loyal",
      "Promising",
      "Regulars",
      "At-Risk Loyal",
      "Hibernating",
    ];
    return order.map((k) => ({ segment: k, count: rfm.bySeg?.[k] || 0 }));
  }, [rfm]);

  const cohortsMatrix = useMemo(() => {
    const maxMonth = 5;
    const cohKeys = [...new Set(cohorts.map((c) => c.cohort))].sort();
    return cohKeys.map((key) => ({
      cohort: key,
      cells: Array.from({ length: maxMonth + 1 }, (_, m) => {
        const cell = cohorts.find((x) => x.cohort === key && x.month === m);
        return { m, retention: cell ? cell.retention : 0 };
      }),
    }));
  }, [cohorts]);

  const hasRealCohorts = useMemo(
    () =>
      Array.isArray(cohortsMatrix) &&
      cohortsMatrix.some((row) =>
        row.cells?.some((c) => (c?.retention || 0) > 0)
      ),
    [cohortsMatrix]
  );

  const demoCohortsMatrix = useMemo(() => {
    const base = [
      { cohort: "2025-04", seed: 0.95 },
      { cohort: "2025-05", seed: 0.9 },
      { cohort: "2025-06", seed: 0.88 },
      { cohort: "2025-07", seed: 0.84 },
      { cohort: "2025-08", seed: 0.92 },
      { cohort: "2025-09", seed: 0.87 },
    ];
    const wobble = (m, k) => Math.sin((m + 1) * (k + 1)) * 0.04;
    return base.map((row, k) => ({
      cohort: row.cohort,
      cells: Array.from({ length: 6 }, (_, m) => {
        const dec = Math.pow(row.seed, m);
        const val = Math.max(
          0,
          Math.min(1, (m === 0 ? 1 : dec) + wobble(m, k))
        );
        return { m, retention: Number(val.toFixed(3)) };
      }),
    }));
  }, []);

  const displayCohorts = hasRealCohorts ? cohortsMatrix : demoCohortsMatrix;

  const filteredSeries = useMemo(() => {
    if (!dailySeries.length) return [];
    return dailySeries.filter((p) => {
      if (dateFrom && p.date < dateFrom) return false;
      if (dateTo && p.date > dateTo) return false;
      return true;
    });
  }, [dailySeries, dateFrom, dateTo]);

  const forecastText = useMemo(() => {
    if (!forecastSeries?.length || !filteredSeries?.length) return null;

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
    const msg = t("forecast.msg", {
      sign: growth >= 0 ? "+" : "",
      growth: formatNumber(growth, 1),
      unc: formatNumber(uncertaintyPct, 0),
      tone,
    });

    return { msg, growth, uncertaintyPct, tone };
  }, [forecastSeries, filteredSeries, t]);

  useEffect(() => {
    if (!dateFrom && minDate) setDateFrom(minDate);
    if (!dateTo && maxDate) setDateTo(maxDate);
  }, [minDate, maxDate]);

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
          t("advice.local.uptrend", { change: formatNumber(change, 1) })
        );
      if (change < -10)
        out.push(
          t("advice.local.downtrend", { change: formatNumber(change, 1) })
        );
      if (Math.abs(slope) < 0.01) out.push(t("advice.local.stable"));

      const names = [
        t("weekdays.0"),
        t("weekdays.1"),
        t("weekdays.2"),
        t("weekdays.3"),
        t("weekdays.4"),
        t("weekdays.5"),
        t("weekdays.6"),
      ];
      const byWeekday = Array.from({ length: 7 }, () => 0);
      filteredSeries.forEach((d) => {
        byWeekday[new Date(d.date).getDay()] += d.revenue;
      });
      const minIdx = byWeekday.indexOf(Math.min(...byWeekday));
      out.push(t("advice.local.slowDay", { day: names[minIdx] }));
    }
    if (productsTop5 && productsTop5.length) {
      const top = productsTop5[0];
      out.push(t("advice.local.topProduct", { name: top.name }));
      if (productsTop5.length >= 2) {
        const runner = productsTop5[1];
        out.push(
          t("advice.local.bundle", { top: top.name, other: runner.name })
        );
      }
    }
    return out;
  }, [filteredSeries, productsTop5, t]);

  const topActions = useMemo(() => {
    if (!tips || !tips.length) return [];
    const boost = (txt) => {
      let score = 0;
      const s = txt.toLowerCase();
      if (s.includes("tendance baissière") || s.includes("downtrend"))
        score += 5;
      if (s.includes("jour creux") || s.includes("slow day")) score += 3;
      if (s.includes("bundle")) score += 2;
      if (s.includes("promo") || s.includes("prix") || s.includes("price"))
        score += 2;
      if (
        s.includes("fidelité") ||
        s.includes("fidélité") ||
        s.includes("loyalty")
      )
        score += 1;
      return score;
    };
    const ranked = tips
      .map((t, i) => ({ t, i, score: boost(t) }))
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .map((x) => x.t);
    return ranked.slice(0, 2);
  }, [tips]);

  function buildSalesSummary() {
    return {
      currency,
      smooth,
      period: { from: dateFrom, to: dateTo },
      kpis: {
        ca30: Math.round(kpis?.ca30 || 0),
        basket: Number(kpis?.basket || 0),
        unique: Number(kpis?.unique || 0),
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
      const txt = await getAdviceOrFallback("sales", summary, t);
      setAiText(txt);
    } finally {
      setAiLoading(false);
    }
  }

  async function exportOnePagerPDF() {
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 36;
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      doc.setFillColor(31, 41, 55);
      doc.rect(0, 0, pageW, 64, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text(t("pdf.headerTitle"), margin, 32);
      doc.setFontSize(10);
      doc.setTextColor(209, 213, 219);
      doc.text(t("pdf.headerSubtitle"), margin, 48);

      const y0 = 88;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      const cf = (v, d = 0) => formatNumber(v || 0, d);
      const changeTxt =
        typeof change === "number"
          ? change >= 0
            ? t("kpi.changeUp", { v: formatNumber(change, 1) })
            : t("kpi.changeDown", { v: formatNumber(change, 1) })
          : "—";
      const kpiLines = [
        t("pdf.kpi.ca30", {
          v: cf(kpis?.ca30, 0),
          cur: currency,
          change: changeTxt,
        }),
        t("pdf.kpi.basket", { v: cf(kpis?.basket, 2), cur: currency }),
        t("pdf.kpi.unique", { v: cf(kpis?.unique, 0) }),
      ];
      doc.text(kpiLines, margin, y0);

      const y1 = y0 + 56;
      const ftxt = forecastText
        ? t("pdf.forecast", {
            sign: forecastText.growth >= 0 ? "+" : "",
            growth: formatNumber(forecastText.growth, 1),
            unc: formatNumber(forecastText.uncertaintyPct, 0),
          })
        : t("pdf.forecastNA");
      doc.text(ftxt, margin, y1);

      const y2 = y1 + 28;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.text(t("actions.title"), margin, y2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(55, 65, 81);
      const actions = (Array.isArray(topActions) ? topActions : tips).slice(
        0,
        3
      );
      const bullet = actions.length
        ? actions.map((tline) => `• ${sanitizePdfText(tline)}`)
        : [`• ${t("actions.none")}`];
      doc.text(bullet, margin, y2 + 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(t("pdf.footer"), margin, pageH - 24);

      doc.save("InsightMate_OnePager.pdf");
    } catch (e) {
      console.error("[Export PDF] Erreur", e);
      alert(t("pdf.errorExport"));
    }
  }

  const [rfmSelected, setRfmSelected] = useState(null);

  const rfmSelectedRows = useMemo(() => {
    if (!rfmSelected) return [];
    const src = Array.isArray(rfm?.segments) ? rfm.segments : [];
    return src
      .filter((c) => c.segment === rfmSelected)
      .map((c) => ({
        customer_id: c.customer_id || "-",
        lastDate: c.lastDate
          ? new Date(c.lastDate).toISOString().slice(0, 10)
          : "-",
        recencyDays: c.recencyDays ?? "",
        orders: c.frequency ?? "",
        revenue: c.monetary ?? 0,
        aov: c.aov ?? 0,
        topSku: c.topSku || "-",
      }));
  }, [rfmSelected, rfm]);

  function closeRfmModal() {
    setRfmSelected(null);
  }

  function exportRfmSegmentCSV() {
    if (!rfmSelectedRows.length) return;
    const header = [
      "customer_id",
      "last_date",
      "recency_days",
      "orders",
      "revenue",
      "aov",
      "top_sku",
    ];
    const lines = rfmSelectedRows.map((r) =>
      [
        r.customer_id,
        r.lastDate,
        r.recencyDays,
        r.orders,
        r.revenue,
        r.aov,
        r.topSku,
      ]
        .map((x) =>
          typeof x === "string" && x.includes(",") ? `"${x}"` : String(x)
        )
        .join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download(`RFM_${rfmSelected || "segment"}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div id="demo" className="space-y-4">
      <FadeIn immediate>
        <Section
          title={t("import.title")}
          icon={<Upload className="w-5 h-5" />}
          actions={
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="px-3 py-2 rounded-xl bg-gray-100 text-sm"
                aria-label={t("import.currency.aria")}
              >
                <option value="€">{t("import.currency.eur")}</option>
                <option value="$">{t("import.currency.usd")}</option>
                <option value="£">{t("import.currency.gbp")}</option>
              </select>

              <button
                className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm"
                onClick={loadSample}
              >
                {t("import.loadSample")}
              </button>

              <a
                className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm flex items-center gap-2"
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(
                  SAMPLE_SALES
                )}`}
                download="sample_sales.csv"
              >
                <FileDown className="w-4 h-4" /> {t("import.downloadSample")}
              </a>

              <motion.button
                id="btn-upload-csv"
                whileTap={{ scale: 0.98 }}
                whileHover={{ y: -1 }}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm ring-1 ring-indigo-400/30"
                title={t("import.upload.title")}
              >
                <Upload className="w-4 h-4" />
                {t("import.upload.cta")}
              </motion.button>
            </div>
          }
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleUpload}
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
          />

          <div
            onDrop={onDropFile}
            onDragOver={onDragOver}
            className="mt-2 rounded-xl border border-dashed p-3 text-xs text-gray-500 dark:text-gray-400"
            title={t("import.drop.title")}
          >
            {t("import.drop.hint")}
          </div>

          <div className="grid md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t("import.altSelect.label")}
              </label>
              <input
                type="file"
                accept=".csv,text/csv"
                aria-label={t("import.altSelect.aria")}
                onChange={handleUpload}
                className="block"
              />
              <p className="text-sm text-gray-500 mt-2">
                {t("import.requiredCols.label")}{" "}
                <code>date, order_id, product, qty, price, customer_id</code>
              </p>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-500">
                  {t("filters.smooth")}
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
                <label className="block text-xs text-gray-500">
                  {t("filters.from")}
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 rounded-xl border"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">
                  {t("filters.to")}
                </label>
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

        {/* KPIs */}
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          <FadeIn immediate delay={0.02}>
            <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18 }}>
              <Card>
                <Stat
                  label={t("kpi.ca30.label")}
                  value={`${formatNumber(kpis?.ca30 || 0, 0)} ${currency}`}
                  note={
                    change > 0
                      ? t("kpi.changeUp", { v: formatNumber(change, 1) })
                      : change < 0
                      ? t("kpi.changeDown", { v: formatNumber(change, 1) })
                      : t("kpi.stable")
                  }
                />
              </Card>
            </motion.div>
          </FadeIn>
          <FadeIn immediate delay={0.06}>
            <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18 }}>
              <Card>
                <Stat
                  label={t("kpi.basket.label")}
                  value={`${formatNumber(kpis?.basket || 0, 2)} ${currency}`}
                  note={t("kpi.basket.note")}
                />
              </Card>
            </motion.div>
          </FadeIn>
          <FadeIn immediate delay={0.1}>
            <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18 }}>
              <Card>
                <Stat
                  label={t("kpi.clients.label")}
                  value={formatNumber(kpis?.unique || 0, 0)}
                  note={t("kpi.clients.note")}
                />
              </Card>
            </motion.div>
          </FadeIn>
        </div>
      </FadeIn>

      {/* RFM */}
      <FadeIn>
        <Section title={t("rfm.title")} icon={<Settings className="w-5 h-5" />}>
          <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {rfmSummary.map((s) => (
              <button
                key={s.segment}
                onClick={() => setRfmSelected(s.segment)}
                className="group rounded-xl border bg-white dark:bg-gray-900 p-3 text-center shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all outline-none focus:ring-2 ring-indigo-400/50"
                title={t("rfm.title")}
              >
                <div className="text-[11px] uppercase tracking-wide text-gray-500 flex items-center justify-center gap-1">
                  <Users className="w-3.5 h-3.5 opacity-70" />
                  {s.segment}
                </div>
                <div className="text-3xl font-semibold mt-1">
                  {formatNumber(s.count || 0, 0)}
                </div>
                <div className="mt-1 text-[11px] text-indigo-700/80 dark:text-indigo-300/80 opacity-0 group-hover:opacity-100 transition-opacity">
                  {t("common.view") || "View"}
                </div>
              </button>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-2">{t("rfm.subtitle")}</div>
        </Section>
      </FadeIn>

      {/* RFM Modal */}
      {rfmSelected && (
        <div
          className="fixed inset-0 z-50"
          aria-modal="true"
          role="dialog"
          onClick={closeRfmModal}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="absolute left-1/2 top-8 -translate-x-1/2 w-[min(1100px,92vw)] max-h-[84vh] overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl ring-1 ring-black/5"
          >
            <div className="px-4 sm:px-6 py-3 border-b bg-gray-50/70 dark:bg-gray-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <div className="text-sm font-semibold">
                  {rfmSelected} — {formatNumber(rfmSelectedRows.length, 0)}{" "}
                  {t("kpi.clients.label") || "clients"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportRfmSegmentCSV}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                  title="Export CSV"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>
                <button
                  onClick={closeRfmModal}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-200/70 dark:hover:bg-gray-700/60"
                  aria-label="Close"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-auto">
              {rfmSelectedRows.length === 0 ? (
                <div className="text-sm text-gray-500">
                  {t("common.empty") || "No clients in this segment."}
                </div>
              ) : (
                <div className="overflow-auto rounded-xl border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                      <tr>
                        <th className="p-2 text-left font-medium">
                          Customer ID
                        </th>
                        <th className="p-2 text-left font-medium">
                          {t("common.lastPurchase") || "Last purchase"}
                        </th>
                        <th className="p-2 text-right font-medium">
                          {t("common.recency") || "Recency (d)"}
                        </th>
                        <th className="p-2 text-right font-medium">
                          {t("common.orders") || "Orders"}
                        </th>
                        <th className="p-2 text-right font-medium">
                          {t("common.revenue") || "Revenue"}
                        </th>
                        <th className="p-2 text-right font-medium">AOV</th>
                        <th className="p-2 text-left font-medium">Top SKU</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rfmSelectedRows.map((r) => (
                        <tr key={r.customer_id} className="border-t">
                          <td className="p-2 font-medium">{r.customer_id}</td>
                          <td className="p-2">{r.lastDate}</td>
                          <td className="p-2 text-right">{r.recencyDays}</td>
                          <td className="p-2 text-right">{r.orders}</td>
                          <td className="p-2 text-right">
                            {formatNumber(r.revenue, 0)} {currency}
                          </td>
                          <td className="p-2 text-right">
                            {formatNumber(r.aov, 0)} {currency}
                          </td>
                          <td className="p-2">{r.topSku}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="text-[11px] text-gray-500 mt-2">
                {t("rfm.subtitle")}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Actions */}
      {topActions.length > 0 && (
        <FadeIn>
          <Card className="border-emerald-200/60 bg-emerald-50/70 dark:bg-emerald-900/20 relative overflow-hidden">
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.35 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6 }}
              className="pointer-events-none absolute -inset-1 blur-2xl"
              style={{
                background:
                  "radial-gradient(50% 60% at 100% 0%, rgba(16,185,129,0.25), transparent 60%)",
              }}
            />
            <div className="flex items-start justify-between gap-3 relative">
              <div>
                <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
                  {t("actions.title")}
                </div>
                <ul className="space-y-1">
                  {topActions.map((tline, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-emerald-900 dark:text-emerald-100"
                    >
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-none" />
                      <span>{tline}</span>
                    </li>
                  ))}
                </ul>
                <div className="text-xs text-emerald-800/80 dark:text-emerald-200/70 mt-2">
                  {t("actions.subtitle")}
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
                      ?.writeText(`${t("actions.clipboardTitle")}\n${txt}`)
                      .catch(() => {});
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs bg-white/80 dark:bg-emerald-900/40 hover:bg-white ring-1 ring-emerald-300/50 text-emerald-900 dark:text-emerald-100"
                >
                  <ClipboardCopy className="w-4 h-4" /> {t("common.copy")}
                </button>
              </div>
            </div>
          </Card>
        </FadeIn>
      )}

      {/* Forecast */}
      <FadeIn>
        <Section
          title={t("forecast.sectionTitle")}
          icon={<TrendingUp className="w-5 h-5" />}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
              <Sparkles className="w-3.5 h-3.5" /> {t("forecast.badge.smart")}
            </span>

            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
              {quality?.icon} {t("forecast.quality.prefix")} {quality?.level}
              {quality?.mape && isFinite(quality.mape) ? (
                <span className="opacity-70">
                  {" "}
                  · {t("forecast.quality.mape")} {formatNumber(quality.mape, 1)}
                  %
                </span>
              ) : null}
            </span>

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
                  title={t("forecast.growthTitle")}
                >
                  {forecastText.growth >= 0 ? "↗" : "↘"}{" "}
                  {formatNumber(forecastText.growth, 1)}%
                </span>
                <span
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"
                  title={t("forecast.uncertaintyTitle")}
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> ±
                  {formatNumber(forecastText.uncertaintyPct, 0)}%
                </span>
              </>
            )}
          </div>

          <div
            id="forecastCard"
            data-forecast-card
            ref={chartRef}
            className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 bg-white dark:bg-gray-900 relative overflow-hidden"
          >
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.25 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6 }}
              className="pointer-events-none absolute -inset-2 blur-2xl"
              style={{
                background:
                  "radial-gradient(60% 60% at 10% 10%, rgba(99,102,241,0.15), transparent 60%), radial-gradient(60% 60% at 100% 90%, rgba(34,211,238,0.12), transparent 60%)",
              }}
            />

            <ResponsiveContainer width="100%" height={420}>
              <LineChart data={[...filteredSeries, ...forecastSeries]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v, name) => {
                    const n = String(name || "");
                    if (
                      n === t("forecast.legend.historical") ||
                      n === forecastLabel ||
                      n.includes(t("forecast.legend.scenarioKeyword")) ||
                      n.includes(t("forecast.legend.bandKeyword"))
                    ) {
                      return `${formatNumber(v, 0)} ${currency}`;
                    }
                    return v;
                  }}
                />
                <Legend />

                {/* Historical */}
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name={t("forecast.legend.historical")}
                  dot={false}
                  strokeWidth={2.6}
                  stroke={COLORS.hist}
                  activeDot={{ r: 3 }}
                />

                {/* CI */}
                <Line
                  type="monotone"
                  dataKey="ci_lo"
                  name={t("forecast.legend.ciLo")}
                  dot={false}
                  strokeWidth={1.2}
                  strokeDasharray="2 4"
                  strokeOpacity={0.7}
                  stroke={COLORS.ci}
                />
                <Line
                  type="monotone"
                  dataKey="ci_hi"
                  name={t("forecast.legend.ciHi")}
                  dot={false}
                  strokeWidth={1.2}
                  strokeDasharray="2 4"
                  strokeOpacity={0.7}
                  stroke={COLORS.ci}
                />

                {/* Scenarios + central */}
                <Line
                  type="basis"
                  dataKey="forecast_lo"
                  name={t("forecast.legend.scenarioPrudent")}
                  strokeDasharray="4 4"
                  dot={false}
                  strokeWidth={2}
                  stroke={COLORS.prud}
                />
                <Line
                  type="basis"
                  dataKey="forecast"
                  name={forecastLabel}
                  strokeDasharray="6 4"
                  dot={false}
                  strokeWidth={3.2}
                  stroke={COLORS.central}
                />
                <Line
                  type="basis"
                  dataKey="forecast_hi"
                  name={t("forecast.legend.scenarioOptimistic")}
                  strokeDasharray="4 4"
                  dot={false}
                  strokeWidth={2}
                  stroke={COLORS.opti}
                />

                {forecastStart && (
                  <ReferenceArea
                    x1={forecastStart}
                    x2={(forecastSeries.slice(-1)[0] || {}).date}
                    strokeOpacity={0.06}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300 relative">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-200">
                ● {t("forecast.chips.historical")}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-900 dark:bg-cyan-900/20 dark:text-cyan-200">
                ● {t("forecast.chips.central")}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">
                ● {t("forecast.chips.optimistic")}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                ● {t("forecast.chips.prudent")}
              </span>

              {forecastText && (
                <span className="ml-auto text-right">
                  <span className="font-medium">
                    {forecastText.growth >= 0 ? "↗" : "↘"}{" "}
                    {formatNumber(forecastText.growth, 1)}%
                  </span>{" "}
                  {t("forecast.summaryTail", {
                    unc: formatNumber(forecastText.uncertaintyPct, 0),
                  })}
                </span>
              )}
            </div>
          </div>
        </Section>
      </FadeIn>

      {/* Top products */}
      <FadeIn>
        <Section title={t("top.title")} icon={<Settings className="w-5 h-5" />}>
          {(() => {
            const PALETTE = [
              "#334155",
              "#475569",
              "#64748B",
              "#94A3B8",
              "#CBD5E1",
            ];
            const topData = (productsTop5 || []).map((d, i) => ({
              name: String(d?.name ?? "-"),
              revenue: Math.max(0, Number(d?.revenue) || 0),
              _color: PALETTE[i % PALETTE.length],
            }));
            if (!topData.length) {
              return (
                <div className="text-sm text-gray-500">{t("top.empty")}</div>
              );
            }
            return (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={topData}
                  margin={{ left: 8, right: 8, top: 12, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `${formatNumber(v, 0)} ${currency}`}
                  />
                  <Tooltip
                    formatter={(v) => `${formatNumber(v, 0)} ${currency}`}
                    labelFormatter={(l) => l}
                  />
                  <Bar
                    dataKey="revenue"
                    name={t("top.barName")}
                    radius={[8, 8, 0, 0]}
                  >
                    <LabelList
                      dataKey="revenue"
                      position="top"
                      formatter={(v) => `${formatNumber(v, 0)} ${currency}`}
                      className="text-xs"
                    />
                    {topData.map((d, i) => (
                      <Cell key={i} fill={d._color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            );
          })()}
        </Section>
      </FadeIn>

      {/* Next-Best-Bundle */}
      <FadeIn>
        <Section
          title={t("bundle.title")}
          icon={<Settings className="w-5 h-5" />}
        >
          {affinityTop.length === 0 ? (
            <div className="text-sm text-gray-500">{t("bundle.empty")}</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              <div className="rounded-xl border p-3 bg-white dark:bg-gray-900">
                <div className="text-xs text-gray-500 mb-2">
                  {t("bundle.topPairs")}
                </div>
                <ul className="divide-y">
                  {affinityTop.map((e, i) => (
                    <li
                      key={i}
                      className="py-2 flex items-center justify-between"
                    >
                      <div className="text-sm">
                        <span className="font-medium">{e.a}</span>
                        <span className="opacity-70"> × </span>
                        <span className="font-medium">{e.b}</span>
                        <span className="ml-2 text-xs text-gray-500">
                          {t("common.support")} {e.support}
                        </span>
                      </div>
                      <div className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-900 dark:bg-indigo-900/20 dark:text-indigo-200">
                        {t("common.lift")} {formatNumber(e.lift, 2)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border p-3 bg-white dark:bg-gray-900">
                <div className="text-sm mb-1 font-medium">
                  {t("bundle.howto.title")}
                </div>
                <ul className="text-sm list-disc ml-5 space-y-1">
                  <li>{t("bundle.howto.item1")}</li>
                  <li>{t("bundle.howto.item2")}</li>
                  <li>{t("bundle.howto.item3")}</li>
                </ul>
              </div>
            </div>
          )}
        </Section>
      </FadeIn>

      {/* Cohorts */}
      <FadeIn>
        <Section
          title={t("cohorts.title")}
          icon={<TrendingUp className="w-5 h-5" />}
        >
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
              {isDemoData ? t("cohorts.badge.demo") : t("cohorts.badge.live")} ·{" "}
              {t("cohorts.badge.hint")}
            </span>
            <span className="ml-auto text-gray-500">
              {t("cohorts.badge.higher")}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-[13px] border rounded-2xl overflow-hidden relative">
              <colgroup>
                <col style={{ width: 160 }} />
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <col key={i} />
                ))}
              </colgroup>

              <div
                aria-hidden
                className="pointer-events-none absolute -inset-1 rounded-3xl blur-xl opacity-25"
                style={{
                  background:
                    "radial-gradient(50% 60% at 10% 10%, rgba(99,102,241,0.08), transparent 60%), radial-gradient(50% 60% at 100% 90%, rgba(16,185,129,0.10), transparent 60%)",
                }}
              />

              <thead className="relative bg-gray-50/80 backdrop-blur dark:bg-gray-800/60">
                <tr>
                  <th className="p-2 text-left font-medium">
                    {t("cohorts.table.cohort")}
                  </th>
                  {[0, 1, 2, 3, 4, 5].map((m) => (
                    <th key={m} className="p-2 text-center font-medium">
                      {t("cohorts.table.mprefix")}
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="relative">
                {displayCohorts.map((row, rIdx) => (
                  <tr
                    key={row.cohort}
                    className={
                      "border-t " +
                      (rIdx % 2 ? "bg-gray-50/30 dark:bg-gray-900/20" : "")
                    }
                  >
                    <td className="p-3 font-semibold text-gray-800 dark:text-gray-100">
                      {row.cohort}
                    </td>
                    {row.cells.map((c) => {
                      const p = Math.min(100, Math.max(0, c.retention * 100));
                      return (
                        <td key={c.m} className="p-2 align-middle">
                          <div className="h-12 w-full rounded-xl bg-gray-100/70 dark:bg-gray-800/60 overflow-hidden relative ring-1 ring-gray-200/60 dark:ring-gray-700/60">
                            <div
                              className="h-full rounded-xl transition-[width] duration-500"
                              style={{
                                width: `${p}%`,
                                background:
                                  "linear-gradient(90deg, rgba(59,130,246,.95) 0%, rgba(16,185,129,.95) 100%)",
                              }}
                              title={t("cohorts.table.retainedTitle", {
                                p: p.toFixed(0),
                              })}
                            />
                            <div className="absolute inset-0 flex items-center justify-end pr-2">
                              <span className="text-[12px] font-semibold text-gray-800 dark:text-gray-100 drop-shadow-[0_1px_0_rgba(255,255,255,0.35)] dark:drop-shadow-none">
                                {p.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {!hasRealCohorts && (
              <div className="text-xs text-gray-500 mt-2">
                {t("cohorts.demoNote")}
              </div>
            )}
          </div>
        </Section>
      </FadeIn>

      {/* Seasonality */}
      <FadeIn>
        <Section
          title={t("seasonality.title")}
          icon={<Sparkles className="w-5 h-5" />}
        >
          {(() => {
            const wdata = weekdayIdx.map((d) => ({
              wd: d.wd,
              label: t(`weekdays.${d.wd}`),
              pct: (d.index || 0) * 100,
              revenue: d.revenue || 0,
            }));

            if (!wdata.length) {
              return (
                <div className="text-sm text-gray-500">
                  {t("seasonality.empty")}
                </div>
              );
            }

            const best = wdata.reduce(
              (a, b) => (b.pct > a.pct ? b : a),
              wdata[0]
            );
            const worst = wdata.reduce(
              (a, b) => (b.pct < a.pct ? b : a),
              wdata[0]
            );
            const weekendMean =
              [0, 6].reduce(
                (s, i) => s + (wdata.find((x) => x.wd === i)?.pct || 0),
                0
              ) / 2 || 0;
            const weekdayMean =
              [1, 2, 3, 4, 5].reduce(
                (s, i) => s + (wdata.find((x) => x.wd === i)?.pct || 0),
                0
              ) / 5 || 0;
            const weekendLift = weekdayMean
              ? (weekendMean / weekdayMean - 1) * 100
              : 0;

            const maxPct = Math.max(
              120,
              Math.max(...wdata.map((x) => x.pct)) + 10
            );
            const isBest = (d) => d.wd === best.wd;
            const isWorst = (d) => d.wd === worst.wd;

            return (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">
                    {t("seasonality.kpi.best", {
                      day: best.label,
                      v: formatNumber(best.pct - 100, 0),
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-50 text-rose-900 dark:bg-rose-900/20 dark:text-rose-200">
                    {t("seasonality.kpi.worst", {
                      day: worst.label,
                      v: formatNumber(100 - worst.pct, 0),
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 text-indigo-900 dark:bg-indigo-900/20 dark:text-indigo-200">
                    {t("seasonality.kpi.weekendLift", {
                      sign: weekendLift >= 0 ? "+" : "",
                      v: formatNumber(weekendLift, 0),
                    })}
                  </span>
                  <span className="ml-auto text-gray-500 text-xs">
                    {t("seasonality.hint")}
                  </span>
                </div>

                <div className="grid lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 rounded-xl border p-3 bg-white dark:bg-gray-900">
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart
                        data={wdata}
                        margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis
                          domain={[0, maxPct]}
                          tickFormatter={(v) => `${formatNumber(v, 0)}%`}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip
                          formatter={(val, name) => {
                            if (name === t("seasonality.tooltip.pct")) {
                              return [
                                `${formatNumber(val, 0)}%`,
                                t("seasonality.tooltip.pct"),
                              ];
                            }
                            if (name === t("seasonality.tooltip.rev")) {
                              return [
                                `${formatNumber(val, 0)} ${currency}`,
                                t("seasonality.tooltip.rev"),
                              ];
                            }
                            return [val, name];
                          }}
                        />
                        <ReferenceLine y={100} strokeDasharray="4 4" />
                        <Bar
                          dataKey="pct"
                          name={t("seasonality.tooltip.pct")}
                          radius={[8, 8, 0, 0]}
                          isAnimationActive
                          fill="#6366F1"
                        >
                          <LabelList
                            dataKey="pct"
                            position="top"
                            formatter={(v) => `${formatNumber(v, 0)}%`}
                            className="text-xs"
                          />
                          {wdata.map((d, i) => (
                            <Cell
                              key={`c-${i}`}
                              fill={
                                isBest(d)
                                  ? "#10B981"
                                  : isWorst(d)
                                  ? "#EF4444"
                                  : "#6366F1"
                              }
                              opacity={isWorst(d) ? 0.85 : 1}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-2 text-xs text-gray-500">
                      {t("seasonality.legend")}
                    </div>
                  </div>

                  <div className="rounded-xl border p-3 bg-white dark:bg-gray-900">
                    <ResponsiveContainer width="100%" height={320}>
                      <RadarChart
                        cx="50%"
                        cy="50%"
                        outerRadius="80%"
                        data={wdata}
                      >
                        <PolarGrid />
                        <PolarAngleAxis
                          dataKey="label"
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          formatter={(val) => `${formatNumber(val, 0)}%`}
                          labelFormatter={(l) => l}
                        />
                        <Radar
                          name={t("seasonality.radar")}
                          dataKey="pct"
                          stroke="#6366F1"
                          fill="#6366F1"
                          fillOpacity={0.35}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                    <div className="text-xs text-gray-500 mt-2">
                      {t("seasonality.tip")}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </Section>
      </FadeIn>

      {/* Advice */}
      <FadeIn>
        <Section
          title={t("advice.sectionTitle")}
          icon={<Brain className="w-5 h-5" />}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                <Sparkles className="w-3.5 h-3.5" />
                {t("advice.badge")}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t("advice.basedOn")}
              </span>
            </div>

            <div className="relative inline-flex p-1 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setUseFullAI(false)}
                className={
                  "relative z-10 px-3 py-1.5 text-sm rounded-xl " +
                  (!useFullAI
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-500")
                }
              >
                {t("advice.toggle.local")}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!useFullAI) {
                    setUseFullAI(true);
                    setTimeout(() => {
                      if (!aiLoading) askFullAI();
                    }, 150);
                  }
                }}
                className={
                  "relative z-10 px-3 py-1.5 text-sm rounded-xl flex items-center gap-1 " +
                  (useFullAI
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-500")
                }
              >
                <Sparkles className="w-4 h-4" /> {t("advice.toggle.ai")}
              </button>

              <motion.span
                layout
                transition={{ type: "spring", stiffness: 350, damping: 26 }}
                className="absolute top-1 bottom-1 w-1/2 rounded-xl bg-white dark:bg-gray-900 shadow-sm"
                style={{ left: useFullAI ? "50%" : 0 }}
              />
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
                      {t("advice.ai.title")}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {t("advice.ai.subtitle")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={askFullAI}
                      disabled={aiLoading}
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60"
                    >
                      {aiLoading
                        ? t("advice.ai.loading")
                        : t("advice.ai.regenerate")}
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
                      {t("common.copy")}
                    </button>
                  </div>
                </div>

                <div className="text-sm leading-6 whitespace-pre-wrap text-gray-800 dark:text-gray-100">
                  {aiLoading ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-3 rounded bg-gray-200/80 dark:bg-gray-700/60 w-11/12" />
                      <div className="h-3 rounded bg-gray-200/80 dark:bg-gray-700/60 w-9/12" />
                      <div className="h-3 rounded bg-gray-200/80 dark:bg-gray-700/60 w-10/12" />
                    </div>
                  ) : (
                    aiText || t("advice.ai.hint")
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
                  : [t("advice.local.none")]
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
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5">
                          {isWarning ? (
                            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
                          ) : (
                            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
                          )}
                        </span>
                        <p className="text-sm md:text-base leading-snug">
                          {tip}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard?.writeText(tip);
                            } catch {}
                          }}
                          className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-white/40 hover:bg-white/70 text-gray-900 dark:bg_black/30 dark:hover:bg-black/50 dark:text-white"
                        >
                          <ClipboardCopy className="w-3.5 h-3.5" />
                          {t("common.copy")}
                        </button>
                        <button
                          onClick={() => alert(t("common.shareAlert"))}
                          className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          {t("common.share")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </Section>
      </FadeIn>

      {/* Table Preview */}
      <FadeIn>
        <Section
          title={t("preview.title")}
          icon={<Sparkles className="w-5 h-5" />}
        >
          <TablePreview
            rows={
              isDemoData
                ? Papa.parse(SAMPLE_SALES, {
                    header: true,
                    skipEmptyLines: true,
                    comments: "#",
                  }).data
                : rows
            }
          />
        </Section>
      </FadeIn>
    </div>
  );
}

export default SalesDemo;
