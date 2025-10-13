// src/pages/CashflowDemo.jsx
import React, { useMemo, useState, useRef } from "react";
import useDataset from "@/hooks/useDataset";
import { formatNumber } from "@/lib/format";
import { toDateKey, rangeDays } from "@/lib/date";
import {
  detectWeeklySeasonality,
  ses,
  holt,
  holtDamped,
  holtWintersAdditive,
} from "@/lib/forecast";
import { importCSVFile } from "@/lib/csv";

import Card from "@/components/ui/Card";
import Section from "@/components/ui/Section";
import Stat from "@/components/ui/Stat";

import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  ReferenceArea,
} from "recharts";

import { Upload, Shield } from "lucide-react";

function CashflowDemo() {
  const [startBalance, setStartBalance] = useState(1000);
  const [currency, setCurrency] = useState("€");
  const chartRef = useRef(null);

  // Live data from datastore
  const bankRows = useDataset("banking"); // {date, inflow, outflow, ...}
  const payRows = useDataset("payments"); // {date, net|gross|fee, ...}

  // Optional: file override via upload
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

    // 2) Normalize payments rows (treat “net” as inflow; fallback to gross)
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
      prev.inflow += Number(x.inflow || 0);
      prev.outflow += Number(x.outflow || 0);
      byDay.set(x.date, prev);
    }
    return Array.from(byDay.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [bankRows, payRows, overrideRows]);

  // Scénarios (futur only)
  const SCENARIOS = {
    normal: { encPct: 0, decPct: 0, label: "Normal" },
    prudent: { encPct: -5, decPct: 2, label: "Prudent" },
    severe: { encPct: -10, decPct: 5, label: "Sévère" },
    optimist: { encPct: 5, decPct: 0, label: "Optimiste" },
  };
  const [scenario, setScenario] = useState("normal");

  async function handleUpload(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const data = await importCSVFile(f);
      // attend colonnes: date, inflow, outflow (noms tolérants)
      const mapped = (data || [])
        .map((r) => ({
          date: toDateKey(r.date || r.Date || r.DATE),
          inflow: Number(r.inflow ?? r.Inflow ?? r.credit ?? r.Credit ?? 0),
          outflow: Number(r.outflow ?? r.Outflow ?? r.debit ?? r.Debit ?? 0),
        }))
        .filter((x) => x.date);
      setOverrideRows(mapped);
    } catch {
      alert(
        "Échec d’import CSV. Assure-toi que le fichier a les colonnes date,inflow,outflow."
      );
    }
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

    const encPct = (SCENARIOS[scenario].encPct || 0) / 100;
    const decPct = (SCENARIOS[scenario].decPct || 0) / 100;
    const leverPerDay = avgIn * encPct - avgOut * decPct;

    const baseNetFut = (chosen.out.forecast || []).slice(0, futureDates.length);
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

      let sdDay =
        Number.isFinite(hi) && Number.isFinite(lo) ? (hi - lo) / (2 * z) : sd;
      sdDay = Math.max(1e-6, sdDay);

      const prob = normalCdf((0 - mu) / sdDay); // P(solde<0)
      if (Number.isFinite(prob) && prob > maxProb) {
        maxProb = prob;
        peakDate = p.date;
      }
    }

    const probPct = Math.round((maxProb || 0) * 100);

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
      probPct,
      peakDate,
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
    probPct,
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
  const yDomain = useMemo(() => {
    if (!series.length) return ["auto", "auto"];

    let minY = Math.min(...series.map((p) => p.balance));
    let maxY = Math.max(...series.map((p) => p.balance));

    if (!futureDates || !futureDates.length) {
      const pad = Math.max(200, (maxY - minY) * 0.08);
      return [Math.floor(minY - pad), Math.ceil(maxY + pad)];
    }

    const z = 1.64; // ~90%
    Object.entries({
      normal: { encPct: 0, decPct: 0 },
      prudent: { encPct: -5, decPct: 2 },
      severe: { encPct: -10, decPct: 5 },
      optimist: { encPct: 5, decPct: 0 },
    }).forEach(([, def]) => {
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
                value={`${formatNumber(
                  medianFinal < 0 ? Math.abs(medianFinal) : 0,
                  0
                )} ${currency}`}
                note="À ajouter au solde actuel si la médiane passe sous 0"
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
                      : formatNumber(v, 0)
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

                {forecastStart && chartData.length > 0 && (
                  <ReferenceArea
                    x1={forecastStart}
                    x2={chartData[chartData.length - 1].date}
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

export default CashflowDemo;
