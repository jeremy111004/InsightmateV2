// src/pages/LeakageRadar.jsx
import React from "react";
import Papa from "papaparse";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { useTranslation } from "react-i18next";

/* ---------- utils ---------- */
function toNum(v, fb = null) {
  const n = Number(
    String(v ?? "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  );
  return Number.isFinite(n) ? n : fb;
}
function median(a) {
  const s = [...a].sort((x, y) => x - y);
  const n = s.length;
  if (!n) return NaN;
  const m = Math.floor(n / 2);
  return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function mad(a) {
  const m = median(a);
  const d = a.map((x) => Math.abs(x - m));
  return median(d) * 1.4826;
}
function shortLabel(str, max = 18) {
  const s = String(str || "");
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

function normRow(r) {
  const qty = Math.max(0, toNum(r.qty, 0));
  const price = toNum(r.unit_price, 0);
  const cost = toNum(r.unit_cost, 0);
  const discount = Math.max(0, toNum(r.discount, 0));
  const fee = toNum(r.shipping_fee, null);
  const scost = toNum(r.shipping_cost, null);
  const base = Math.max(1e-9, qty * Math.max(0, price));
  const netUnit = qty > 0 ? Math.max(0, price - discount / qty) : price;
  const discPct = Math.max(0, Math.min(1.5, base > 0 ? discount / base : 0));
  const lineRev = Math.max(0, qty * price - discount);
  const unitMargin = netUnit - cost;
  const lineMargin = qty * unitMargin;
  return {
    date: r.date ? String(r.date) : null,
    order_id: r.order_id ? String(r.order_id) : null,
    sku: String(r.sku || "").trim() || "(unknown)",
    name: r.name || String(r.sku || "").trim() || "(no name)",
    qty,
    unit_price: price,
    unit_cost: cost,
    discount,
    net_unit_price: netUnit,
    line_revenue: lineRev,
    unit_margin: unitMargin,
    line_margin: lineMargin,
    discount_pct: discPct,
    shipping_fee: fee,
    shipping_cost: scost,
  };
}

function analyze(rows, { targetMarginPct = 0.3, driftPct = 0.15 } = {}) {
  const clean = rows.filter(
    (r) => r.qty > 0 && r.unit_price >= 0 && r.unit_cost >= 0
  );
  const bySku = new Map();
  const byDay = new Map();
  let leakUC = 0,
    leakERO = 0,
    leakSHIP = 0,
    leakDISC = 0;
  const skuStats = [];

  const addDay = (dateKey, key, val) => {
    if (!dateKey || !val) return;
    if (!byDay.has(dateKey))
      byDay.set(dateKey, { date: dateKey, uc: 0, ero: 0, disc: 0, ship: 0 });
    byDay.get(dateKey)[key] += val;
  };

  for (const r of clean) {
    if (!bySku.has(r.sku)) bySku.set(r.sku, []);
    bySku.get(r.sku).push(r);
  }

  for (const [sku, arr] of bySku.entries()) {
    const prices = arr.map((x) => x.unit_price);
    const discs = arr.map((x) => x.discount_pct);
    const medPrice = median(prices);
    const medDisc = median(discs);
    const discMad = mad(discs);

    let sUC = 0,
      sERO = 0,
      sOD = 0,
      sDRIFT = 0,
      sSHIP = 0;

    for (const r of arr) {
      const d = r.date ? String(r.date).slice(0, 10) : null;

      if (r.net_unit_price < r.unit_cost) {
        const v = r.qty * (r.unit_cost - r.net_unit_price);
        sUC += v;
        leakUC += v;
        addDay(d, "uc", v);
      }

      const targetPrice = r.unit_cost * (1 + targetMarginPct);
      if (r.net_unit_price < targetPrice) {
        const v = r.qty * (targetPrice - r.net_unit_price);
        sERO += v;
        leakERO += v;
        addDay(d, "ero", v);
      }

      const thr = medDisc + 3 * discMad;
      if (discMad > 0 && r.discount_pct > thr) {
        const base = r.qty * r.unit_price;
        const expected = (base * (1 - medDisc)) / Math.max(1, r.qty);
        if (expected > r.net_unit_price) {
          const v = r.qty * (expected - r.net_unit_price);
          sOD += v;
          leakDISC += v;
          addDay(d, "disc", v);
        }
      }

      if (
        medPrice > 0 &&
        Math.abs(r.unit_price - medPrice) / medPrice > driftPct
      ) {
        const aligned = medPrice - r.discount / Math.max(1, r.qty);
        if (aligned > r.net_unit_price) {
          const v = r.qty * (aligned - r.net_unit_price);
          sDRIFT += v;
          leakDISC += v;
          addDay(d, "disc", v);
        }
      }

      if (
        Number.isFinite(r.shipping_cost) &&
        Number.isFinite(r.shipping_fee) &&
        r.shipping_cost > r.shipping_fee
      ) {
        const v = r.shipping_cost - r.shipping_fee;
        sSHIP += v;
        leakSHIP += v;
        addDay(d, "ship", v);
      }
    }

    const name = arr[0]?.name || sku;
    const qty = arr.reduce((s, x) => s + x.qty, 0);
    const rev = arr.reduce((s, x) => s + x.line_revenue, 0);
    const mrg = arr.reduce((s, x) => s + x.line_margin, 0);

    skuStats.push({
      sku,
      name,
      qty,
      revenue: rev,
      margin: mrg,
      leak_under_cost: +sUC.toFixed(2),
      leak_erosion: +sERO.toFixed(2),
      leak_discount: +sOD.toFixed(2),
      leak_price_drift: +sDRIFT.toFixed(2),
      leak_shipping: +sSHIP.toFixed(2),
      leak_total: +(sUC + sERO + sOD + sDRIFT + sSHIP).toFixed(2),
      med_price: medPrice,
      med_discount: medDisc,
      disc_mad: discMad,
    });
  }

  const kpi = {
    leakUnderCost: +leakUC.toFixed(2),
    leakErosion: +leakERO.toFixed(2),
    leakShipping: +leakSHIP.toFixed(2),
    leakDiscount: +leakDISC.toFixed(2),
    leakTotal: +(leakUC + leakERO + leakSHIP + leakDISC).toFixed(2),
  };

  const topUnderCost = [...skuStats]
    .sort((a, b) => b.leak_under_cost - a.leak_under_cost)
    .slice(0, 20);
  const topErosion = [...skuStats]
    .sort((a, b) => b.leak_erosion - a.leak_erosion)
    .slice(0, 20);
  const topDiscount = [...skuStats]
    .sort(
      (a, b) =>
        b.leak_discount +
        b.leak_price_drift -
        (a.leak_discount + a.leak_price_drift)
    )
    .slice(0, 20);

  const series = [...byDay.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  series.forEach((o) => {
    o.total = +(o.uc + o.ero + o.disc + o.ship).toFixed(2);
    o.uc = +o.uc.toFixed(2);
    o.ero = +o.ero.toFixed(2);
    o.disc = +o.disc.toFixed(2);
    o.ship = +o.ship.toFixed(2);
  });

  return { kpi, topUnderCost, topErosion, topDiscount, series, skuStats };
}

/* ---------- UI ---------- */
export default function LeakageRadar({
  embedMode = false,
  initialRows = null,
}) {
  const { t, i18n } = useTranslation("risk");

  const [rawRows, setRawRows] = React.useState([]);
  const [res, setRes] = React.useState(null);
  const [targetMarginPct, setTargetMarginPct] = React.useState(0.3);
  const [driftPct, setDriftPct] = React.useState(0.15);
  const [loading, setLoading] = React.useState(false);
  const [fs, setFs] = React.useState(false);

  // Refs
  const hostRef = React.useRef(null);
  const contentRef = React.useRef(null);

  // locale-aware number formatter
  const nf0 = React.useMemo(() => {
    const map =
      i18n.language === "fr"
        ? "fr-FR"
        : i18n.language === "es"
        ? "es-ES"
        : "en-US";
    return new Intl.NumberFormat(map, { maximumFractionDigits: 0 });
  }, [i18n.language]);

  const handleCSV = (file) => {
    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (out) => {
        const rows = (out.data || []).map(normRow);
        setRawRows(rows);
        setRes(analyze(rows, { targetMarginPct, driftPct }));
        setLoading(false);
      },
      error: () => setLoading(false),
    });
  };
  const recompute = () => {
    if (!rawRows.length) return;
    setRes(analyze(rawRows, { targetMarginPct, driftPct }));
  };
  const loadSample = () => {
    const normalized = buildSampleRawRows().map(normRow);
    setRawRows(normalized);
    setRes(analyze(normalized, { targetMarginPct, driftPct }));
  };

  React.useEffect(() => {
    if (initialRows && initialRows.length) {
      const normalized = initialRows.map(normRow);
      setRawRows(normalized);
      setRes(analyze(normalized, { targetMarginPct, driftPct }));
    } else if (embedMode) {
      const normalized = buildSampleRawRows().map(normRow);
      setRawRows(normalized);
      setRes(analyze(normalized, { targetMarginPct, driftPct }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⬇️ Unlock parent containers that clamp height or hide overflow
  React.useEffect(() => {
    const root = hostRef.current;
    if (!root) return;

    const unlock = () => {
      let node = root.parentElement;
      for (let i = 0; i < 6 && node; i++) {
        const cs = getComputedStyle(node);
        if (
          cs.overflow === "hidden" ||
          cs.overflowY === "hidden" ||
          cs.maxHeight !== "none"
        ) {
          node.style.overflow = "visible";
          node.style.overflowY = "visible";
          node.style.maxHeight = "none";
          node.style.height = "auto";
        }
        node = node.parentElement;
      }
    };

    unlock();

    const ro = new ResizeObserver(unlock);
    ro.observe(root);
    if (contentRef.current) ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, []);

  // Fullscreen helpers
  const toggleFS = async () => {
    try {
      if (!document.fullscreenElement) {
        await hostRef.current?.requestFullscreen();
        setFs(true);
      } else {
        await document.exitFullscreen();
        setFs(false);
      }
    } catch {
      /* ignore */
    }
  };

  const kpiCards = res
    ? [
        {
          key: "underCost",
          value: res.kpi.leakUnderCost,
          color: "bg-rose-100 text-rose-900 border-rose-200",
        },
        {
          key: "erosion",
          value: res.kpi.leakErosion,
          color: "bg-amber-100 text-amber-900 border-amber-200",
        },
        {
          key: "discount",
          value: res.kpi.leakDiscount,
          color: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200",
        },
        {
          key: "shipping",
          value: res.kpi.leakShipping,
          color: "bg-cyan-100 text-cyan-900 border-cyan-200",
        },
        {
          key: "total",
          value: res.kpi.leakTotal,
          color: "bg-emerald-100 text-emerald-900 border-emerald-200",
          bold: true,
        },
      ]
    : [];

  const pieData = res
    ? [
        { name: t("leakage.kpi.underCost"), value: res.kpi.leakUnderCost },
        { name: t("leakage.kpi.erosion"), value: res.kpi.leakErosion },
        { name: t("leakage.kpi.discount"), value: res.kpi.leakDiscount },
        { name: t("leakage.kpi.shipping"), value: res.kpi.leakShipping },
      ]
    : [];

  const topBarData = res
    ? [...res.skuStats]
        .sort((a, b) => b.leak_total - a.leak_total)
        .slice(0, 12)
        .map((x) => ({
          label: shortLabel(x.name || x.sku, 18),
          labelFull: x.name || x.sku,
          leak: +x.leak_total.toFixed(2),
        }))
    : [];

  const tsData = res ? res.series : [];

  return (
    <section
      ref={hostRef}
      className={`${
        embedMode
          ? "bg-transparent h-full"
          : "py-8 min-h-screen bg-white text-gray-900 dark:bg-gray-900 dark:text-white"
      }`}
      style={{
        overflow: "visible",
        "--c-cyan": "#22d3ee",
        "--c-blue": "#0ea5e9",
        "--c-violet": "#7c3aed",
        "--c-fuchsia": "#d946ef",
        "--c-emerald": "#10b981",
        "--c-amber": "#f59e0b",
        "--c-rose": "#ef4444",
        "--grid": "rgba(148,163,184,0.28)",
      }}
    >
      {/* Main wrapper */}
      <div
        ref={contentRef}
        className="w-full px-4 lg:px-6"
        style={{ overflow: "visible" }}
      >
        {!embedMode && (
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">
                {t("leakage.header.title")}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {t("leakage.header.subtitle")}
              </p>
            </div>
            <button
              onClick={toggleFS}
              className="text-xs px-3 py-1 rounded-full border hover:shadow-sm"
              title={
                fs
                  ? t("leakage.header.fullscreenExit")
                  : t("leakage.header.fullscreenEnter")
              }
            >
              {fs
                ? t("leakage.header.fullscreenExit")
                : t("leakage.header.fullscreenEnter")}
            </button>
          </header>
        )}

        {/* Controls */}
        <div className="rounded-2xl border px-4 py-3 bg-gray-50/70 dark:bg-white/5 mb-4 w-full min-w-0">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
            {t("leakage.controls.title")}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm">
              {t("leakage.controls.targetMargin")}
              <input
                type="number"
                min="0"
                max="90"
                step="1"
                value={Math.round(targetMarginPct * 100)}
                onChange={(e) =>
                  setTargetMarginPct(
                    Math.max(0, Math.min(0.9, Number(e.target.value) / 100))
                  )
                }
                className="ml-2 w-20 px-2 py-1 rounded-xl border bg-white dark:bg-gray-900"
              />
            </label>
            <label className="text-sm">
              {t("leakage.controls.priceDrift")}
              <input
                type="number"
                min="5"
                max="80"
                step="1"
                value={Math.round(driftPct * 100)}
                onChange={(e) =>
                  setDriftPct(
                    Math.max(0.05, Math.min(0.8, Number(e.target.value) / 100))
                  )
                }
                className="ml-2 w-20 px-2 py-1 rounded-xl border bg-white dark:bg-gray-900"
              />
            </label>
            <button
              onClick={recompute}
              disabled={!rawRows.length}
              className="px-3 py-2 rounded-xl border transition-transform active:scale-[0.98] hover:shadow-sm"
            >
              {t("leakage.controls.recompute")}
            </button>
            <label className="inline-flex items-center px-3 py-2 rounded-xl border cursor-pointer transition-transform active:scale-[0.98] hover:shadow-sm">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) =>
                  e.target.files?.[0] && handleCSV(e.target.files[0])
                }
              />
              {t("leakage.controls.importCsv")}
            </label>
            <button
              onClick={loadSample}
              className="px-3 py-2 rounded-xl border bg-emerald-600 text-white transition-transform active:scale-[0.98] hover:shadow-sm"
            >
              {t("leakage.controls.loadSample")}
            </button>
            <button
              onClick={downloadSampleCSV}
              className="px-3 py-2 rounded-xl border transition-transform active:scale-[0.98] hover:shadow-sm"
              title={t("leakage.controls.downloadTemplate")}
            >
              {t("leakage.controls.downloadTemplate")}
            </button>
          </div>

          {/* File help */}
          <div className="mt-3 text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed">
            <div className="font-medium text-[11px] uppercase tracking-wide mb-1">
              {t("leakage.fileHelp.title")}
            </div>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t("leakage.fileHelp.csvNote")}</li>
              <li>{t("leakage.fileHelp.decimalsNote")}</li>
              <li>{t("leakage.fileHelp.rowNote")}</li>
              <li>
                {t("leakage.fileHelp.headersTitle")}{" "}
                <code>{t("leakage.fileHelp.headersList")}</code>
              </li>
            </ul>
            <div className="mt-2 font-mono text-[11px] bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-2 overflow-x-auto">
              {t("leakage.fileHelp.headersList")}
              <br />
              {t("leakage.fileHelp.exampleRow")}
            </div>
          </div>
        </div>

        {/* KPI cards */}
        {res && (
          <div className="mb-6 grid grid-cols-12 gap-3">
            {kpiCards.map((k, i) => (
              <div
                key={i}
                className={`col-span-6 md:col-span-3 lg:col-span-2 rounded-2xl border px-5 py-4 shadow-sm bg-white dark:bg-zinc-900/60 ${k.color}`}
                style={{ borderColor: "rgba(0,0,0,0.08)" }}
              >
                <div className="text-[11px] uppercase tracking-wide opacity-70">
                  {t(`leakage.kpi.${k.key}`)}
                </div>
                <div
                  className={`text-[28px] leading-none mt-1 font-extrabold ${
                    k.bold ? "underline decoration-2" : ""
                  }`}
                >
                  {nf0.format(Math.round(k.value))} €
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Donut + Bar */}
        {res && (
          <div className="grid grid-cols-12 gap-6 items-start">
            {/* PIE */}
            <div className="col-span-12 lg:col-span-5 rounded-2xl border p-4 bg-white/70 dark:bg-white/5">
              <h4 className="font-medium mb-2">
                {t("leakage.charts.splitTitle")}
              </h4>
              <div className="h-[360px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart
                    margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
                  >
                    <defs>
                      <filter
                        id="pieGlow"
                        x="-50%"
                        y="-50%"
                        width="200%"
                        height="200%"
                      >
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <radialGradient id="pie0" cx="50%" cy="50%" r="65%">
                        <stop
                          offset="0%"
                          stopColor="var(--c-cyan)"
                          stopOpacity="0.95"
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--c-blue)"
                          stopOpacity="0.85"
                        />
                      </radialGradient>
                      <radialGradient id="pie1" cx="50%" cy="50%" r="65%">
                        <stop
                          offset="0%"
                          stopColor="var(--c-amber)"
                          stopOpacity="0.95"
                        />
                        <stop
                          offset="100%"
                          stopColor="#fbbf24"
                          stopOpacity="0.85"
                        />
                      </radialGradient>
                      <radialGradient id="pie2" cx="50%" cy="50%" r="65%">
                        <stop
                          offset="0%"
                          stopColor="var(--c-fuchsia)"
                          stopOpacity="0.95"
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--c-violet)"
                          stopOpacity="0.85"
                        />
                      </radialGradient>
                      <radialGradient id="pie3" cx="50%" cy="50%" r="65%">
                        <stop
                          offset="0%"
                          stopColor="var(--c-emerald)"
                          stopOpacity="0.95"
                        />
                        <stop
                          offset="100%"
                          stopColor="#34d399"
                          stopOpacity="0.85"
                        />
                      </radialGradient>
                    </defs>

                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="55%"
                      outerRadius="80%"
                      isAnimationActive
                      animationDuration={700}
                      animationEasing="ease-out"
                      labelLine={false}
                      label={(d) =>
                        `${d.name} (${nf0.format(Math.round(d.value))} €)`
                      }
                    >
                      {pieData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={`url(#pie${i % 4})`}
                          stroke="rgba(0,0,0,0.06)"
                          style={{ filter: "url(#pieGlow)" }}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => `${nf0.format(Math.round(v))} €`}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* BAR */}
            <div className="col-span-12 lg:col-span-7 rounded-2xl border p-4 bg-white/70 dark:bg-white/5">
              <h4 className="font-medium mb-2">
                {t("leakage.charts.topLeaksTitle")}
              </h4>
              <div className="h-[360px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topBarData}
                    margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
                  >
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="var(--c-cyan)" />
                        <stop offset="100%" stopColor="var(--c-violet)" />
                      </linearGradient>
                      <filter
                        id="barGlow"
                        x="-50%"
                        y="-50%"
                        width="200%"
                        height="200%"
                      >
                        <feGaussianBlur
                          stdDeviation="2.5"
                          result="coloredBlur"
                        />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis tickFormatter={(v) => nf0.format(v)} />
                    <Tooltip
                      formatter={(v) => `${nf0.format(Math.round(v))} €`}
                      labelFormatter={(label, payload) =>
                        payload?.[0]?.payload?.labelFull || label
                      }
                    />
                    <Bar
                      dataKey="leak"
                      name={t("leakage.charts.barLeakName")}
                      isAnimationActive
                      animationDuration={700}
                      animationEasing="ease-out"
                      fill="url(#barGrad)"
                      stroke="rgba(0,0,0,0.06)"
                      radius={[8, 8, 0, 0]}
                      style={{ filter: "url(#barGlow)" }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Time series */}
        {res && res.series?.length > 0 && (
          <div className="mt-6 rounded-2xl border p-4 bg-white/70 dark:bg-white/5">
            <h4 className="font-medium mb-2">
              {t("leakage.charts.timeseriesTitle")}
            </h4>
            <div className="h-[360px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={tsData}
                  margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
                >
                  <defs>
                    <linearGradient id="lineTotal" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--c-cyan)" />
                      <stop offset="100%" stopColor="var(--c-blue)" />
                    </linearGradient>
                    <linearGradient id="lineUC" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--c-rose)" />
                      <stop offset="100%" stopColor="#fb7185" />
                    </linearGradient>
                    <linearGradient id="lineERO" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--c-amber)" />
                      <stop offset="100%" stopColor="#fbbf24" />
                    </linearGradient>
                    <linearGradient id="lineDISC" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--c-fuchsia)" />
                      <stop offset="100%" stopColor="var(--c-violet)" />
                    </linearGradient>
                    <linearGradient id="lineSHIP" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--c-emerald)" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                    <filter
                      id="lineGlow"
                      x="-50%"
                      y="-50%"
                      width="200%"
                      height="200%"
                    >
                      <feGaussianBlur stdDeviation="2.2" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(v) => nf0.format(v)} />
                  <Tooltip
                    formatter={(v, n) => [`${nf0.format(Math.round(v))} €`, n]}
                  />
                  <Legend />

                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Total"
                    dot={false}
                    isAnimationActive
                    animationDuration={650}
                    stroke="url(#lineTotal)"
                    strokeWidth={3}
                    strokeLinecap="round"
                    style={{ filter: "url(#lineGlow)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="uc"
                    name={t("leakage.kpi.underCost")}
                    dot={false}
                    isAnimationActive
                    animationDuration={600}
                    stroke="url(#lineUC)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    style={{ filter: "url(#lineGlow)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ero"
                    name={t("leakage.kpi.erosion")}
                    dot={false}
                    isAnimationActive
                    animationDuration={600}
                    stroke="url(#lineERO)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    style={{ filter: "url(#lineGlow)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="disc"
                    name={t("leakage.kpi.discount")}
                    dot={false}
                    isAnimationActive
                    animationDuration={600}
                    stroke="url(#lineDISC)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    style={{ filter: "url(#lineGlow)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ship"
                    name={t("leakage.kpi.shipping")}
                    dot={false}
                    isAnimationActive
                    animationDuration={600}
                    stroke="url(#lineSHIP)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    style={{ filter: "url(#lineGlow)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {!res && !loading && (
          <div className="mt-6 rounded-2xl border p-6 text-sm text-gray-600 dark:text-gray-300 bg-gray-50/60 dark:bg-white/5">
            {t("leakage.empty.prompt")}
          </div>
        )}
        {loading && (
          <div className="mt-6 text-sm opacity-70">
            {t("leakage.empty.loading")}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- samples ---------- */
function buildSampleRawRows() {
  const today = new Date();
  const d = (o) =>
    new Date(today.getTime() - o * 86400000).toISOString().slice(0, 10);
  return [
    {
      date: d(12),
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
      date: d(11),
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
      date: d(10),
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
      date: d(9),
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
      date: d(8),
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
      date: d(7),
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
      date: d(6),
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
      date: d(5),
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
      date: d(4),
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
      date: d(3),
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
      date: d(2),
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
      date: d(1),
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
}
function downloadSampleCSV() {
  const csv = Papa.unparse(buildSampleRawRows());
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ventes_sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}
