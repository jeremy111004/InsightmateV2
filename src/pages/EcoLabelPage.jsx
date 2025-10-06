// src/pages/EcoLabelPage.jsx
import { formatNumber } from "@/lib/format";
formatNumber(1234.56, 1);
import React, { useMemo, useState, useEffect } from "react";
import useDataset from "@/hooks/useDataset";
import {
  ECO_FACTORS,
  ECO_DEFAULTS,
  ecoGradeFromIntensity,
  computeIntensity,
  estimateCO2eFromBankTx,
  ecoExtractFromBank,
  classifyTx,
} from "@/lib/eco";
import { toDateKey } from "@/lib/date";
import { SAMPLE_SALES } from "@/data/samples";

import Button from "@/components/ui/Button";
import AINote from "@/components/AINote";
import Card from "@/components/ui/Card";
import Section from "@/components/ui/Section";
import MiniSparkline from "@/components/ui/MiniSparkline";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import {
  Leaf,
  Gauge,
  Bolt,
  Fuel,
  Package,
  Truck,
  Building2,
  Store,
  Sparkles,
  FileDown,
  Share2,
  Wand2,
} from "lucide-react";

/* ===== REMPLACEMENT PAPA — petit parseur CSV suffisant pour nos besoins =====
   - Supporte entêtes (header), quotes basiques, lignes vides ignorées.
   - Si l’entrée n’est pas une string (ex: array déjà parsé), renvoie [].
   - Objectif: NE JAMAIS invoquer FileReader/Blob côté navigateur ici.
*/

function parseCsvText(csvText) {
  if (typeof csvText !== "string") return [];
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (!lines.length) return [];

  // split “smart” : coupe sur virgules hors guillemets
  const splitSmart = (line) => {
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        // gérer double quotes
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (c === "," && !inQ) {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out.map((s) => s.replace(/^"(.*)"$/, "$1"));
  };

  const headers = splitSmart(lines[0]).map(
    (h) => h || `col_${Math.random().toString(36).slice(2, 6)}`
  );
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitSmart(lines[i]);
    if (cols.every((c) => c === "")) continue;
    const rec = {};
    headers.forEach((h, idx) => (rec[h] = cols[idx] ?? ""));
    rows.push(rec);
  }
  return rows;
}

// Helper global
const kg = (x) => `${formatNumber(Math.max(0, Math.round(x || 0)), 0)} kg`;

// Petit composant local pour la pastille de confiance
function ConfidencePill({ value = 0 }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const tone =
    v >= 70
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : v >= 40
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
      : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded ${tone}`}>
      Confiance {v}%
    </span>
  );
}

export default function EcoLabelPage() {
  // Datasets (le hook renvoie directement un tableau). S’il renvoie déjà des objets, on les garde.
  // Si jamais un connecteur te renvoie une STRING CSV, on la parse ici (et PAS avec Papa).
  const bankingRowsRaw = useDataset("banking") || [];
  const salesRowsRaw = useDataset("sales") || [];

  const bankingRows = Array.isArray(bankingRowsRaw)
    ? bankingRowsRaw
    : parseCsvText(String(bankingRowsRaw || ""));

  const salesRowsInput =
    Array.isArray(salesRowsRaw) && salesRowsRaw.length
      ? salesRowsRaw
      : // fallback SAMPLE_SALES (string CSV dans notre repo)
        parseCsvText(String(SAMPLE_SALES || ""));

  const auto = useMemo(
    () => ecoExtractFromBank(bankingRows, salesRowsInput),
    [bankingRows, salesRowsInput]
  );

  // 1) Données ventes (déjà préparées ci-dessus)
  const { last30Revenue, last30Orders } = useMemo(() => {
    const base = salesRowsInput || [];

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
  }, [salesRowsInput]);

  // 2) Paramètres utilisateur (démo prête)
  const [sector, setSector] = useState("ecommerce");
  const [kwhMonth, setKwhMonth] = useState("450");
  const [dieselL, setDieselL] = useState("60");
  const [shipKgOrder, setShipKgOrder] = useState(
    ECO_FACTORS.shippingKgPerOrder
  );

  // 3) Calculs principaux
  const sinceISO30 = toDateKey(Date.now() - 30 * 864e5);
  const txCarbon = useMemo(
    () => estimateCO2eFromBankTx(bankingRows, sinceISO30),
    [bankingRows, sinceISO30]
  );

  const demoMode =
    Number(last30Revenue) === 0 && !(bankingRows && bankingRows.length);
  const displayRevenue = demoMode ? 12500 : last30Revenue;
  const displayOrders = demoMode ? 320 : last30Orders;
  const displayConf = demoMode ? 65 : txCarbon?.confidence || 0;

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

  // Séries d’intensité (7/30/90j) pour sparkline
  const [ecoWindow, setEcoWindow] = useState(30);

  const salesDaily = useMemo(() => {
    const rows = (salesRowsInput || [])
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
  }, [salesRowsInput]);

  const intensitySeries = useMemo(() => {
    const sectorFactor = ECO_FACTORS.sectorKgPerEUR[sector] || 0;
    const elecPerDay =
      ((Number(kwhMonth) || 0) * ECO_FACTORS.electricityKgPerKWh) / 30;
    const fuelPerDay = ((Number(dieselL) || 0) * ECO_FACTORS.dieselKgPerL) / 30;

    return (salesDaily || []).map((d) => {
      const shipKgs = d.orders * (Number(shipKgOrder) || 0);
      const sectorKg = d.revenue * sectorFactor;
      const total = Math.max(0, sectorKg + shipKgs + elecPerDay + fuelPerDay);
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

  // Objectif & plan IA
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
      const part = Math.round(Math.min(remain * 0.4, remain));
      const perKwh = ECO_FACTORS.electricityKgPerKWh;
      const kwhDelta = Math.max(1, Math.ceil(part / Math.max(perKwh, 0.0001)));
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
      const part = Math.round(Math.min(needKg * 0.3, remain));
      const perL = ECO_FACTORS.dieselKgPerL;
      const lDelta = Math.max(1, Math.ceil(part / Math.max(perL, 0.0001)));
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
      const part = Math.round(Math.max(0, remain));
      const perOrderDelta = Math.max(
        1,
        Math.ceil(part / Math.max(last30Orders, 1))
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
          <MiniSparkline data={spark} />
        </div>
      </div>
    );
  }

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
                  (salesRowsInput || []).filter((r) => {
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

          {/* Comparateur secteur — compact */}
          <div className="mb-6 rounded-2xl border bg-white/70 dark:bg-slate-900/60 backdrop-blur p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                Intensité vs. secteur
              </div>
              <div className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Médiane secteur ~ {sectorMedian.toFixed(2)} kg/€
              </div>
            </div>

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
                    <div className="absolute inset-y-0 left-1/4 w-px bg-slate-300/60 dark:bg-slate-600/60" />
                    <div
                      className="absolute inset-y-0 left-1/2 w-px bg-slate-400/80 dark:bg-slate-500"
                      title="Médiane secteur"
                    />
                    <div className="absolute inset-y-0 left-3/4 w-px bg-slate-300/60 dark:bg-slate-600/60" />

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

          {/* KPIs */}
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
                  const { value } = computeIntensity({
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
                  const { value } = computeIntensity({
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

          {/* Paramètres & Impact (Live) */}
          <Section
            key={`${sector}-${kwhMonth}-${dieselL}-${shipKgOrder}-${displayRevenue}-${totalKg}`}
            title="Paramètres & Impact (Live)"
            icon={<Gauge className="w-5 h-5" />}
          >
            {(() => {
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

              // Mini simulateur (quick wins)
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
                  {/* LEFT: paramètres */}
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

                      <div className="mt-3 grid md:grid-cols-2 gap-5 items-start">
                        {/* LEFT — bars */}
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

                        {/* RIGHT — donut (sources actionnables) */}
                        {(() => {
                          const pie = [
                            {
                              key: "electricity",
                              name: "Électricité",
                              value: decomp.electricity || 0,
                              color: "#059669",
                            },
                            {
                              key: "fuel",
                              name: "Carburant",
                              value: decomp.fuel || 0,
                              color: "#f43f5e",
                            },
                            {
                              key: "shipping",
                              name: "Expéditions",
                              value: decomp.shipping || 0,
                              color: "#14b8a6",
                            },
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
                                      {pie.map((entry) => (
                                        <Cell
                                          key={entry.key}
                                          fill={entry.color}
                                        />
                                      ))}
                                    </Pie>
                                    <Tooltip
                                      formatter={(v) =>
                                        `${kg(v)} (${Math.round(
                                          (v / Math.max(1, varTotal)) * 100
                                        )}%)`
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
          </Section>
        </div>
      </Section>

      {/* SUPPLIERS CLEAN SCORE */}
      <Section
        title="Fournisseurs — Clean Score"
        icon={<Store className="w-5 h-5" />}
      >
        {(() => {
          // Démo si aucune donnée bancaire
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
