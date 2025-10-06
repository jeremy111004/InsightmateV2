// src/pages/SalesDemo.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { jsPDF } from "jspdf";

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

// UI (tes composants locaux)
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
} from "recharts";

// Framer Motion
import { motion, AnimatePresence } from "framer-motion";

// Icônes (lucide-react)
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
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helper d'animation robuste
      - immediate=true  -> apparaît au mount (AUCUN observer)
      - immediate=false -> apparaît when-in-view (observer fiable)
      - coupe élégamment si prefers-reduced-motion
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
      // Safari < 14
      mq.addListener(apply);
      return () => mq.removeListener(apply);
    }
  }, []);

  if (reduced) return <>{children}</>;

  const common = {
    initial: { opacity: 0, y: 8 },
    transition: {
      duration: 0.28,
      delay,
      ease: [0.22, 1, 0.36, 1],
    },
  };

  if (immediate) {
    // Pas d'IntersectionObserver → aucun risque de "page blanche"
    return (
      <motion.div {...common} animate={{ opacity: 1, y: 0 }}>
        {children}
      </motion.div>
    );
  }

  // Révélation lors de l’entrée dans le viewport (one-shot, seuil bas)
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

// Fallback IA local
async function getAdviceOrFallback(kind, summary) {
  const lines = [];
  lines.push("Résumé exécutif (IA locale) :");
  if (summary?.kpis) {
    lines.push(
      `• CA 30j: ${formatNumber(summary.kpis.ca30, 0)} ${summary.currency}`
    );
    lines.push(
      `• Panier moyen: ${formatNumber(summary.kpis.basket, 2)} ${
        summary.currency
      }`
    );
    lines.push(`• Clients: ${formatNumber(summary.kpis.unique, 0)}`);
  }
  if (summary?.topProducts?.length) {
    const top = summary.topProducts[0];
    lines.push(`• Produit leader: ${top.name}`);
  }
  lines.push(
    "Actions: pousse best-sellers, traite le jour creux avec une offre, et teste une promo courte (-10%)."
  );
  return lines.join("\n");
}

// Mini preview table autonome
function TablePreview({ rows = [] }) {
  const cols = rows.length ? Object.keys(rows[0]) : [];
  return (
    <div className="overflow-auto rounded-xl border">
      <table className="min-w-full text-sm">
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
      <div className="text-[11px] text-gray-500 p-2">
        Aperçu (30 lignes max)
      </div>
    </div>
  );
}

// Échantillon CSV simple
const SAMPLE_SALES = `date,order_id,product,qty,price,customer_id
2025-08-01,1001,Café grain 1kg,1,12.90,C001
2025-08-01,1002,Thé vert 100g,2,5.90,C002
2025-08-02,1003,Café grain 1kg,2,12.90,C003
2025-08-03,1004,Capsules espresso x10,3,3.80,C002
2025-08-04,1005,Sirop caramel 75cl,1,7.20,C004
2025-08-04,1006,Filtres papier x100,2,2.60,C001
2025-08-05,1007,Sucre morceaux 1kg,3,1.90,C005
2025-08-06,1008,Tasse double paroi,1,9.90,C002
2025-08-06,1009,Moulin manuel,1,34.00,C006
2025-08-07,1010,Café grain 1kg,1,12.90,C007
2025-08-08,1011,Thé vert 100g,1,5.90,C008
2025-08-09,1012,Capsules espresso x10,2,3.80,C002
2025-08-10,1013,Sirop caramel 75cl,2,7.20,C004
`;

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

  // Données importées (si présentes)
  const importedSales = useDataset("sales");

  function loadSample() {
    const parsed = Papa.parse(SAMPLE_SALES, {
      header: true,
      skipEmptyLines: true,
    }).data;
    setRows(parsed);
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
      },
    });
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
    change,
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

    // Change global
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

    // Forecast
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

    // Lissage & scénarios
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
    let central = chosen.out.forecast.slice();
    if (!chosen.season) {
      central = movingAverage(central, 3).map(
        (f, i) => f * (1 + 0.02 * Math.sin((i / 7) * Math.PI))
      );
    } else {
      central = movingAverage(central, 3);
    }

    const cutIdx = Math.floor(values.length * 0.7);
    const recentMean =
      values.slice(cutIdx).reduce((s, x) => s + x, 0) /
      Math.max(1, values.length - cutIdx);
    const globalMean =
      values.reduce((s, x) => s + x, 0) / Math.max(1, values.length);
    const recentDelta = globalMean ? (recentMean - globalMean) / globalMean : 0;
    const amp = Math.min(0.2, Math.max(0.08, Math.abs(recentDelta) * 0.6));
    const optimistic = central.map((v) => v * (1 + amp));
    const prudent = central.map((v) => Math.max(0, v * (1 - amp * 0.7)));

    // Bornes 95%
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
      let span = z * baseSd * 0.6 * growth;
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

    // Qualité
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
      change,
    };
  }, [rows, importedSales]);

  // Filtre période
  const filteredSeries = useMemo(() => {
    if (!dailySeries.length) return [];
    return dailySeries.filter((p) => {
      if (dateFrom && p.date < dateFrom) return false;
      if (dateTo && p.date > dateTo) return false;
      return true;
    });
  }, [dailySeries, dateFrom, dateTo]);

  // Résumé textuel forecast
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

  // Conseils locaux
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

  const topActions = useMemo(() => {
    if (!tips || !tips.length) return [];
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
      const txt = await getAdviceOrFallback("sales", summary);
      setAiText(txt);
    } finally {
      setAiLoading(false);
    }
  }

  // Export PDF (version simple autonome)
  async function exportOnePagerPDF() {
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 36;
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // Header
      doc.setFillColor(31, 41, 55);
      doc.rect(0, 0, pageW, 64, "F");
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

      const y0 = 88;
      // KPIs
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      const cf = (v, d = 0) => formatNumber(v || 0, d);
      const changeTxt =
        typeof change === "number"
          ? change >= 0
            ? `↗ +${formatNumber(change, 1)}%`
            : `↘ ${formatNumber(change, 1)}%`
          : "—";
      const kpiLines = [
        `CA 30 jours: ${cf(kpis?.ca30, 0)} ${currency} (${changeTxt})`,
        `Panier moyen: ${cf(kpis?.basket, 2)} ${currency}`,
        `Clients uniques (30j): ${cf(kpis?.unique, 0)}`,
      ];
      doc.text(kpiLines, margin, y0);

      // Forecast résumé
      const y1 = y0 + 56;
      const ftxt = forecastText
        ? `Prévision 30j : ${forecastText.growth >= 0 ? "+" : ""}${formatNumber(
            forecastText.growth,
            1
          )}% · Incertitude ±${formatNumber(forecastText.uncertaintyPct, 0)}%`
        : "Prévision 30j : n/a";
      doc.text(ftxt, margin, y1);

      // Actions
      const y2 = y1 + 28;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.text("À faire cette semaine", margin, y2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(55, 65, 81);
      const actions = (Array.isArray(topActions) ? topActions : tips).slice(
        0,
        3
      );
      const bullet = actions.length
        ? actions.map((t) => `• ${sanitizePdfText(t)}`)
        : ["• Aucune action priorisée"];
      doc.text(bullet, margin, y2 + 18);

      // Footer
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
      console.error("[Export PDF] Erreur", e);
      alert("Export PDF impossible.");
    }
  }

  return (
    <div id="demo" className="space-y-4">
      {/* FOLD INITIAL → apparaît immédiatement */}
      <FadeIn immediate>
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

        <div className="grid md:grid-cols-3 gap-4 mt-4">
          <FadeIn immediate delay={0.02}>
            <Card>
              <Stat
                label="CA 30 jours"
                value={`${formatNumber(kpis?.ca30 || 0, 0)} ${currency}`}
                note={
                  change > 0
                    ? `↗ +${formatNumber(change, 1)}%`
                    : change < 0
                    ? `↘ ${formatNumber(change, 1)}%`
                    : "Stable"
                }
              />
            </Card>
          </FadeIn>
          <FadeIn immediate delay={0.06}>
            <Card>
              <Stat
                label="Panier moyen"
                value={`${formatNumber(kpis?.basket || 0, 2)} ${currency}`}
                note="Sur les commandes"
              />
            </Card>
          </FadeIn>
          <FadeIn immediate delay={0.1}>
            <Card>
              <Stat
                label="Clients uniques"
                value={formatNumber(kpis?.unique || 0, 0)}
                note="30 derniers jours"
              />
            </Card>
          </FadeIn>
        </div>
      </FadeIn>

      {/* À partir d’ici : révélation au scroll (fiable + once) */}
      {topActions.length > 0 && (
        <FadeIn>
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
        </FadeIn>
      )}

      <FadeIn>
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
          {/* Bandeau micro-métriques */}
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
              <Sparkles className="w-3.5 h-3.5" /> Smart forecast
            </span>

            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
              {quality?.icon} Qualité : {quality?.level}
              {quality?.mape && isFinite(quality.mape) ? (
                <span className="opacity-70">
                  {" "}
                  · MAPE ≈ {formatNumber(quality.mape, 1)}%
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
                  title="Croissance moyenne prévue vs 14 derniers jours"
                >
                  {forecastText.growth >= 0 ? "↗" : "↘"}{" "}
                  {formatNumber(forecastText.growth, 1)}%
                </span>
                <span
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"
                  title="Incertitude moyenne (±)"
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> ±
                  {formatNumber(forecastText.uncertaintyPct, 0)}%
                </span>
              </>
            )}
          </div>

          {/* Graphe */}
          <div
            id="forecastCard"
            data-forecast-card
            ref={chartRef}
            className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 bg-white dark:bg-gray-900"
          >
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={[...filteredSeries, ...forecastSeries]}>
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
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Historique"
                  dot={false}
                  strokeWidth={2.5}
                />
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
                <Line
                  type="basis"
                  dataKey="forecast_lo"
                  name="Scénario prudent"
                  strokeDasharray="3 3"
                  dot={false}
                  strokeWidth={1.8}
                />
                <Line
                  type="basis"
                  dataKey="forecast"
                  name={forecastLabel}
                  strokeDasharray="6 4"
                  dot={false}
                  strokeWidth={2.6}
                />
                <Line
                  type="basis"
                  dataKey="forecast_hi"
                  name="Scénario optimiste"
                  strokeDasharray="3 3"
                  dot={false}
                  strokeWidth={1.8}
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
      </FadeIn>

      <FadeIn>
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
      </FadeIn>

      <FadeIn>
        <Section title="Conseiller" icon={<Brain className="w-5 h-5" />}>
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
                Conseils locaux
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
                <Sparkles className="w-4 h-4" /> IA personnalisée
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

                <div className="text-sm leading-6 whitespace-pre-wrap text-gray-800 dark:text-gray-100">
                  {aiLoading ? (
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
                          className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-white/40 hover:bg-white/70 text-gray-900 dark:bg-black/30 dark:hover:bg-black/50 dark:text-white"
                        >
                          <ClipboardCopy className="w-3.5 h-3.5" />
                          Copier
                        </button>
                        <button
                          onClick={() =>
                            alert("Fonction “Partager” à connecter")
                          }
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
      </FadeIn>

      <FadeIn>
        <Section
          title="Aperçu des données"
          icon={<Sparkles className="w-5 h-5" />}
        >
          <TablePreview
            rows={
              rows && rows.length
                ? rows
                : Papa.parse(SAMPLE_SALES, {
                    header: true,
                    skipEmptyLines: true,
                  }).data
            }
          />
        </Section>
      </FadeIn>
    </div>
  );
}

export default SalesDemo;
