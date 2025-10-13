// src/pages/EcoLabelPage.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import useDataset from "@/hooks/useDataset";
import {
  ECO_FACTORS,
  ECO_DEFAULTS,
  ecoGradeFromIntensity,
  computeIntensity,
  estimateCO2eFromBankTx,
  ecoExtractFromBank,
} from "@/lib/eco";
import { toDateKey } from "@/lib/date";
import { SAMPLE_SALES } from "@/data/samples";
import { formatNumber } from "@/lib/format";

import Button from "@/components/ui/Button";
import AINote from "@/components/AINote";
import Section from "@/components/ui/Section";
import MiniSparkline from "@/components/ui/MiniSparkline";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
  ReferenceLine,
  Legend,
  ComposedChart,
  Bar,
} from "recharts";

import {
  Leaf,
  Sparkles,
  FileDown,
  ShieldQuestion,
  TrendingUp,
  Newspaper,
  ExternalLink,
  BadgePercent,
  Upload,
} from "lucide-react";
import { motion } from "framer-motion";

/* ====== STYLE “premium vert” ====== */
const ACCENT = "#10b981"; // emerald-500
const ACCENT_DARK = "#059669"; // emerald-600

/* === FACTEURS — réseau (kgCO2e/kWh) & proxy secteur === */
const GRID_REGIONS = { EU: 0.233, FR: 0.053, ES: 0.2 };
const SECTOR_OTHER_SHARE = 0.5;

/* --- CSV fallback (si un connecteur renvoie une string) --- */
function parseCsvText(csvText) {
  if (typeof csvText !== "string") return [];
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (!lines.length) return [];
  const splitSmart = (line) => {
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (c === "," && !inQ) {
        out.push(cur);
        cur = "";
      } else cur += c;
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

/* --- UI helpers --- */
const kg = (x) => `${formatNumber(Math.max(0, Math.round(x || 0)), 0)} kg`;
const fmt = (x, d = 0) =>
  Number.isFinite(x)
    ? x.toLocaleString(undefined, { maximumFractionDigits: d })
    : "—";

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

function DataHealthBar({ measured = 0, param = 0, proxy = 0 }) {
  const sum = Math.max(1, measured + param + proxy);
  const m = Math.round((measured / sum) * 100);
  const p = Math.round((param / sum) * 100);
  const x = Math.round((proxy / sum) * 100);
  return (
    <div className="w-full">
      <div className="flex h-2 rounded overflow-hidden">
        <div className="bg-emerald-500" style={{ width: `${m}%` }} />
        <div className="bg-indigo-500" style={{ width: `${p}%` }} />
        <div className="bg-slate-400" style={{ width: `${x}%` }} />
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Mesuré {m}%
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-indigo-500" /> Paramétré {p}%
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-400" /> Proxy {x}%
        </span>
      </div>
    </div>
  );
}

/* ---------- CONSEILLER IA PAYSAGE  ---------- */
function IAAdvisorLandscape({ actions = [] }) {
  const list = actions.slice(0, 3);
  return (
    <motion.div
      initial={{ y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="rounded-3xl border bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-5 shadow-[0_6px_30px_-12px_rgba(2,6,23,0.25)] ring-1 ring-black/5 relative overflow-hidden"
    >
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 0.25 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6 }}
        className="pointer-events-none absolute -inset-1 blur-2xl"
        style={{
          background:
            "radial-gradient(60% 60% at 10% 10%, rgba(16,185,129,.18), transparent 60%), radial-gradient(60% 60% at 90% 90%, rgba(99,102,241,.16), transparent 60%)",
        }}
      />
      <div className="flex items-center justify-between relative">
        <div className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600" /> Conseiller IA — 3
          actions priorisées
        </div>
        <div className="text-xs text-slate-500">
          Problème → Cause → Solution
        </div>
      </div>

      <div className="mt-3 grid md:grid-cols-3 gap-3 relative">
        {list.map((a, idx) => (
          <motion.div
            initial={false}
            key={a.id}
            whileHover={{ y: -2 }}
            className="rounded-2xl border bg-white/80 dark:bg-slate-900/80 p-4 ring-1 ring-black/5 hover:ring-emerald-500 transition"
          >
            <div className="text-[11px] uppercase tracking-wide text-emerald-700">
              Conseil {idx + 1}
            </div>
            <div className="mt-0.5 font-semibold leading-snug">{a.problem}</div>

            <div className="mt-2 text-[12px]">
              <div className="text-slate-500">
                <span className="font-medium text-slate-700">Cause · </span>
                {a.cause}
              </div>
              <div className="mt-1">
                <span className="font-medium">Solution · </span>
                {a.solution}
              </div>
            </div>

            {a.impactKg > 0 && (
              <div className="mt-3">
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                  Impact estimé : ~{a.impactKg.toLocaleString()} kg / 30j
                </span>
              </div>
            )}
          </motion.div>
        ))}
        {!list.length && (
          <div className="text-sm text-slate-500">Aucune action priorisée.</div>
        )}
      </div>

      <div className="mt-3 text-[11px] text-slate-500 relative">
        Chiffrages ordre de grandeur. Affinez via connecteurs énergie/transport
        et validation expert.
      </div>
    </motion.div>
  );
}

/* ---------- Presse (sélection courte) ---------- */
const PRESS_SELECTION = [
  {
    title: "Entreprises : passer à l’action pour réduire les émissions",
    source: "ADEME",
    date: "2024–2025",
    url: "https://agirpourlatransition.ademe.fr/entreprises/passer-a-laction",
    tagline:
      "Parcours d’actions et aides pour PME/ETI (sobriété, efficacité, mobilité).",
    thumbnail: null,
  },
  {
    title: "Le trop lent démarrage de la décarbonation industrielle en France",
    source: "Le Monde",
    date: "18 sept. 2025",
    url: "https://www.lemonde.fr/economie/article/2025/09/18/en-france-le-trop-lent-demarrage-de-la-decarbonation-industrielle_6641615_3234.html",
    tagline: "État des lieux 2025 et enjeux d’investissement.",
    thumbnail: null,
  },
  {
    title: "Net-zero supply chains: where to start",
    source: "The Economist Impact",
    date: "2025",
    url: "https://impact.economist.com/projects/next-gen-supply-chains/article/navigating-the-path-to-net-zero-supply-chains/",
    tagline: "Prioriser les postes Scope 3 et outiller le suivi fournisseurs.",
    thumbnail: null,
  },
];

function getFavicon(url) {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch {
    return `https://www.google.com/s2/favicons?domain=example.com&sz=64`;
  }
}

function PressBox({ items = PRESS_SELECTION }) {
  return (
    <Section
      title="Sélection — Presse & insights"
      icon={<Newspaper className="w-5 h-5" />}
    >
      <div className="grid md:grid-cols-3 gap-3">
        {items.map((it, i) => (
          <a
            key={i}
            href={it.url}
            target="_blank"
            rel="noreferrer"
            className="group flex items-start gap-3 rounded-2xl border p-3 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl ring-1 ring-black/5 hover:ring-2 hover:ring-emerald-500 transition relative overflow-hidden"
          >
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.2 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6 }}
              className="pointer-events-none absolute -inset-1 blur-2xl"
              style={{
                background:
                  "radial-gradient(60% 60% at 0% 0%, rgba(16,185,129,.12), transparent 60%)",
              }}
            />
            <img
              src={it.thumbnail || getFavicon(it.url)}
              alt=""
              className="w-10 h-10 rounded-md object-cover border"
              loading="lazy"
            />
            <div className="min-w-0 relative">
              <div className="text-xs text-slate-500">
                {it.source} • {it.date}
              </div>
              <div className="mt-0.5 font-medium leading-snug line-clamp-2">
                {it.title}
              </div>
              {it.tagline && (
                <div className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                  {it.tagline}
                </div>
              )}
              <div className="mt-1 text-xs text-emerald-700 group-hover:underline inline-flex items-center gap-1">
                Ouvrir <ExternalLink className="w-3.5 h-3.5" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </Section>
  );
}

/* ---------- Aides & subventions ---------- */
function SubsidyBox({ totalKg, electricityDeltaKwhMonth = 0, tCO2eYear }) {
  const programs = [
    {
      key: "diag",
      title: "Diag Décarbon’Action (Bpifrance + ADEME)",
      coverage:
        "Subvention ~40% du diagnostic (pack ~10 000€ HT → reste à charge ~6 000€)",
      criteria: [
        "Entreprise en France",
        "< 500 salariés",
        "> 1 an d’activité",
        "Pas de bilan GES < 5 ans",
      ],
      link: "https://www.bpifrance.fr/catalogue-offres/diag-decarbonaction",
      potential: "≈ 4 000 € sur le diagnostic",
      tag: "Diagnostic subventionné",
    },
    {
      key: "cee",
      title: "CEE — Certificats d’économies d’énergie",
      coverage:
        "Prime variable selon opérations (isolation, éclairage, process…).",
      criteria: [
        "Toutes tailles",
        "Travaux éligibles / fiches standardisées",
        "Prime versée par un obligé (fournisseur d’énergie)",
      ],
      link: "https://opera-energie.com/prime-energie/",
      potential:
        electricityDeltaKwhMonth > 0
          ? `Élec évitée ≈ ${(
              electricityDeltaKwhMonth * 12
            ).toLocaleString()} kWh/an → prime à simuler`
          : "Montant à simuler selon travaux",
      tag: "Prime travaux",
    },
    {
      key: "fondsChaleur",
      title: "ADEME — Fonds/Contrat Chaleur Renouvelable",
      coverage:
        "Subvention CAPEX projets chaleur EnR&R (PAC, biomasse, géothermie…)",
      criteria: ["Entreprises/collectivités/asso", "Projet EnR&R éligible"],
      link: "https://agir.ademe.fr/aides-financieres/2025/contrat-chaleur-renouvelable",
      potential: "À étudier si poste chaleur/fuel significatif",
      tag: "Invest capex",
    },
    {
      key: "eu",
      title: "UE — LIFE / Innovation Fund (projets ambitieux)",
      coverage:
        "Financement projets de décarbonation/énergie propre (appels annuels).",
      criteria: ["Projet démonstrateur / industriel", "Calendrier d’appel"],
      link: "https://cinea.ec.europa.eu/life-calls-proposals-2025_en",
      potential:
        tCO2eYear >= 1000
          ? "Potentiel (sites > ~1 ktCO₂/an ou projets pionniers)"
          : "Probablement hors scope pour petites structures",
      tag: "Appels UE",
    },
  ];

  return (
    <Section
      title="Aides & subventions éligibles (vue rapide)"
      icon={<BadgePercent className="w-5 h-5" />}
    >
      <div className="mb-2 text-sm text-slate-600">
        Vos émissions actuelles ≈ <b>{fmt(totalKg)}</b> kgCO₂e / 30j (soit ~
        <b>{fmt(tCO2eYear, 2)}</b> tCO₂e/an).
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        {programs.map((p) => (
          <a
            key={p.key}
            href={p.link}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border p-3 bg-white/70 dark:bg-slate-900/60 hover:ring-2 hover:ring-emerald-500 transition relative overflow-hidden"
          >
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.18 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6 }}
              className="pointer-events-none absolute -inset-1 blur-2xl"
              style={{
                background:
                  "radial-gradient(60% 60% at 100% 0%, rgba(16,185,129,.14), transparent 60%)",
              }}
            />
            <div className="text-xs uppercase tracking-wide text-emerald-700">
              {p.tag}
            </div>
            <div className="mt-1 font-semibold relative">{p.title}</div>
            <div className="mt-1 text-xs text-slate-600">{p.coverage}</div>
            <ul className="mt-2 text-[11px] text-slate-600 list-disc pl-4 space-y-1">
              {p.criteria.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
            <div className="mt-2 text-xs">
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                Gain potentiel : {p.potential}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-emerald-700 inline-flex items-center gap-1">
              Ouvrir <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </a>
        ))}
      </div>
      <AINote
        className="mt-3"
        text="Estimation indicative. Les barèmes et critères évoluent selon l’opération, la région et le calendrier d’appel. Utilisez vos connecteurs facture/compteurs pour des dossiers solides."
      />
    </Section>
  );
}

/* ---------- EXECUTIVE SUMMARY + COURBE AVEC FORECAST ---------- */
function ExecutiveSummarySection({
  totalKg,
  intensity,
  sectorMedian,
  electricity,
  fuel,
  shipping,
  displayConf,
  spark = [],
  aiPlan = [],
  targetIntensity = null,
}) {
  const hasInt = Number.isFinite(intensity) && sectorMedian > 0;

  // Composition donut
  const comp = [
    {
      key: "Électricité",
      value: Math.max(0, electricity || 0),
      color: ACCENT_DARK,
    },
    { key: "Carburant", value: Math.max(0, fuel || 0), color: "#ef4444" },
    { key: "Expéditions", value: Math.max(0, shipping || 0), color: "#14b8a6" },
  ];
  const totalVar = Math.max(
    1,
    comp.reduce((s, d) => s + d.value, 0)
  );
  const pct = (v) => Math.round((Math.max(0, v) / totalVar) * 100);

  // Baseline (<= 60 pts) + Forecast (30j)
  const base =
    spark && spark.length
      ? spark.map((p, i) => ({ i, y: p.y, type: "baseline" }))
      : Array.from({ length: 60 }).map((_, i) => ({
          i,
          y: Math.max(
            0.2,
            (sectorMedian || 0.6) * (0.85 + Math.sin(i / 9) * 0.08)
          ),
          type: "baseline",
        }));
  const lastY = base.length ? base[base.length - 1].y : sectorMedian || 0.6;

  // Impact cumulé des conseils → ratio amélioration plafonné
  const monthlySavingsKg = aiPlan.reduce((s, a) => s + (a.impactKg || 0), 0);
  const currentMonthKg = Math.max(1, totalKg);
  const improvementRatio = Math.max(
    0,
    Math.min(0.45, monthlySavingsKg / currentMonthKg)
  );

  // Montée en charge douce (easeInOut cubic)
  const ease = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const forecastHorizon = 30;
  const forecast = Array.from({ length: forecastHorizon }).map((_, k) => {
    const t = ease((k + 1) / forecastHorizon);
    const targetY = lastY * (1 - improvementRatio);
    const y = lastY + (targetY - lastY) * t;
    return { i: base.length + k, y, type: "forecast" };
  });
  const chartData = [...base, ...forecast];

  return (
    <Section
      title="Résumé dirigeant (30 jours)"
      icon={<TrendingUp className="w-5 h-5" />}
      actions={
        <div className="text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-900" /> Baseline
          </span>
          <span className="inline-flex items-center gap-1 ml-3">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: ACCENT_DARK }}
            />{" "}
            Forecast (avec conseils)
          </span>
        </div>
      }
    >
      {/* ligne 1 : 3 tuiles compactes */}
      <div className="grid lg:grid-cols-12 gap-5">
        {/* Ce mois-ci */}
        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          whileHover={{ y: -2 }}
          className="lg:col-span-4 rounded-3xl border bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-5 shadow-[0_6px_30px_-12px_rgba(2,6,23,0.25)] ring-1 ring-black/5 relative overflow-hidden"
        >
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 0.25 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            className="pointer-events-none absolute -inset-1 blur-2xl"
            style={{
              background:
                "radial-gradient(60% 60% at 90% 10%, rgba(16,185,129,.15), transparent 60%)",
            }}
          />
          <div className="text-sm text-slate-600 relative">Ce mois-ci</div>
          <div className="mt-1 text-4xl font-semibold tracking-tight relative">
            {fmt(totalKg)} <span className="text-xl">kgCO₂e</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 relative">
            Confiance : {fmt(displayConf)}%
          </div>
          <div className="mt-3 h-14 relative">
            <MiniSparkline data={spark} />
          </div>
        </motion.div>

        {/* Intensité & jauge */}
        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.03 }}
          whileHover={{ y: -2 }}
          className="lg:col-span-4 rounded-3xl border bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-5 shadow-[0_6px_30px_-12px_rgba(2,6,23,0.25)] ring-1 ring-black/5"
        >
          <div className="text-sm text-slate-600">Intensité actuelle</div>
          <div className="mt-1 text-2xl font-semibold">
            {hasInt ? fmt(intensity, 2) : "—"}{" "}
            <span className="text-base">kg/€</span>
          </div>
          <div className="w-full h-40">
            <ResponsiveContainer>
              <RadialBarChart
                innerRadius="65%"
                outerRadius="100%"
                startAngle={180}
                endAngle={0}
                data={[{ name: "value", value: hasInt ? intensity : 0 }]}
              >
                <RadialBar
                  dataKey="value"
                  minAngle={4}
                  clockWise
                  cornerRadius={24}
                  fill="#0f172a"
                  background={{ fill: "rgba(2,6,23,.06)" }}
                  domain={[0, Math.max(0.01, (sectorMedian || 0) * 2)]}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex gap-4 text-[11px] text-slate-500">
            <span>médiane : {fmt(sectorMedian, 2)} kg/€</span>
            {Number.isFinite(targetIntensity) && (
              <span>cible : {fmt(targetIntensity, 2)} kg/€</span>
            )}
          </div>
        </motion.div>

        {/* Donut composition */}
        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.06 }}
          whileHover={{ y: -2 }}
          className="lg:col-span-4 rounded-3xl border bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-5 shadow-[0_6px_30px_-12px_rgba(2,6,23,0.25)] ring-1 ring-black/5 relative overflow-hidden"
        >
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 0.22 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            className="pointer-events-none absolute -inset-1 blur-2xl"
            style={{
              background:
                "radial-gradient(60% 60% at 0% 100%, rgba(20,184,166,.15), transparent 60%)",
            }}
          />
          <div className="text-sm text-slate-600">
            Composition des émissions
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 relative">
            <div className="h-40">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={comp}
                    dataKey="value"
                    nameKey="key"
                    innerRadius={52}
                    outerRadius={78}
                    startAngle={90}
                    endAngle={450}
                    padAngle={3}
                    cornerRadius={6}
                  >
                    {comp.map((d) => (
                      <Cell key={d.key} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${fmt(v)} kg`, n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="text-sm space-y-2">
              {comp.map((d) => (
                <li
                  key={d.key}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: d.color }}
                    />
                    {d.key}
                  </span>
                  <span className="font-medium">
                    {fmt(d.value)} kg • {pct(d.value)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>

      {/* ligne 2 : courbe + conseiller */}
      <div className="mt-5 grid xl:grid-cols-12 gap-5">
        {/* Courbe */}
        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="xl:col-span-7 rounded-3xl border bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-5 shadow-[0_6px_30px_-12px_rgba(2,6,23,0.25)] ring-1 ring-black/5 relative overflow-hidden"
        >
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 0.2 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            className="pointer-events-none absolute -inset-1 blur-2xl"
            style={{
              background:
                "radial-gradient(60% 60% at 100% 100%, rgba(99,102,241,.16), transparent 60%)",
            }}
          />
          <div className="flex items-center justify-between relative">
            <div className="text-sm text-slate-600">
              Tendance d’intensité (90 jours) & scénario
            </div>
            <div className="text-[11px] text-slate-500">kg/€</div>
          </div>
          <div className="mt-2 h-56 relative">
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gBase" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity={0.28} />
                    <stop
                      offset="100%"
                      stopColor="#0f172a"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                  <linearGradient id="gForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0.06} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.22} />
                <XAxis
                  dataKey="i"
                  tick={false}
                  domain={["dataMin", "dataMax"]}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => v.toFixed(2)}
                />
                {Number.isFinite(sectorMedian) && sectorMedian > 0 && (
                  <ReferenceLine
                    y={sectorMedian}
                    stroke="#64748b"
                    strokeDasharray="3 3"
                    label={{
                      value: "Médiane secteur",
                      position: "right",
                      fill: "#64748b",
                      fontSize: 10,
                    }}
                  />
                )}
                {Number.isFinite(targetIntensity) && (
                  <ReferenceLine
                    y={targetIntensity}
                    stroke={ACCENT_DARK}
                    strokeDasharray="4 2"
                    label={{
                      value: "Cible",
                      position: "right",
                      fill: ACCENT_DARK,
                      fontSize: 10,
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey={(d) => (d.type === "baseline" ? d.y : null)}
                  stroke="#0f172a"
                  fill="url(#gBase)"
                  dot={false}
                  connectNulls={false}
                  name="Baseline"
                />
                <Area
                  type="monotone"
                  dataKey={(d) => (d.type === "forecast" ? d.y : null)}
                  stroke={ACCENT_DARK}
                  strokeDasharray="6 4"
                  fill="url(#gForecast)"
                  dot={false}
                  connectNulls={false}
                  name="Forecast (avec conseils)"
                />
                <Tooltip
                  formatter={(v, n, p) => [
                    `${Number(v).toFixed(3)} kg/€`,
                    p.payload.type === "forecast" ? "Forecast" : "Baseline",
                  ]}
                  labelFormatter={(l) =>
                    l < base.length
                      ? `J-${base.length - l}`
                      : `J+${l - base.length + 1}`
                  }
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Hypothèses forecast : adoption progressive des 3 conseils sur 30j
            (montée en charge lissée), impact max plafonné à 45% / mois pour
            rester crédible. Ajusté automatiquement si données réelles
            disponibles.
          </div>
        </motion.div>

        {/* Conseiller IA paysage */}
        <div className="xl:col-span-5">
          <IAAdvisorLandscape actions={aiPlan} />
        </div>
      </div>
    </Section>
  );
}

/* ---------- Mini table preview ---------- */
function TablePreview({ rows = [], title = "Aperçu", max = 25 }) {
  const cols = rows.length ? Object.keys(rows[0]) : [];
  return (
    <div className="rounded-2xl border bg-white/60 dark:bg-slate-900/60 backdrop-blur p-3">
      <div className="text-sm font-medium mb-2">{title}</div>
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
            {rows.slice(0, max).map((r, i) => (
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
          Aperçu ({Math.min(rows.length, max)} / {rows.length})
        </div>
      </div>
    </div>
  );
}

/* ===================== PAGE ===================== */
export default function EcoLabelPage() {
  /* --- Demo CSVs loaded by default on first visit --- */
  const DEMO_SALES_CSV = `date,order_id,product,qty,price
2025-09-18,3001,Café filtre 500g,2,8.50
2025-09-18,3002,Thermos 500ml,1,19.90
2025-09-19,3003,Thé sencha 100g,3,6.20
2025-09-20,3004,Capsules espresso x10,2,4.10
2025-09-21,3005,Tasse en céramique,1,9.90
2025-09-23,3006,Café grain 1kg,1,13.50
2025-09-24,3007,Sucre morceaux 1kg,2,2.10
2025-09-26,3008,Filtre papier x100,3,2.60
2025-09-28,3009,Thé earl grey 100g,2,6.50
2025-09-30,3010,Moulin manuel,1,34.00
2025-10-02,3011,Capsules lungo x10,3,3.90
2025-10-04,3012,Biscotti amande,2,3.60
2025-10-06,3013,Sirop vanille 75cl,1,7.90
2025-10-08,3014,Gobelet thermique 350ml,1,14.90
2025-10-10,3015,Lait d'avoine 1L,2,2.60
2025-10-12,3016,Expresso bio 250g,2,4.90
`;
  const DEMO_BANK_CSV = `date,amount,label
2025-09-20,145.30,TotalEnergies - Diesel utilitaire
2025-09-22,89.90,Colissimo - Expéditions e-commerce
2025-09-25,312.40,EDF - Électricité boutique
2025-09-28,158.70,TotalEnergies - Diesel livraison
2025-10-01,102.50,UPS - Shipping charges
2025-10-03,58.30,Papeterie du Centre - Fournitures
2025-10-04,298.10,EDF - Électricité entrepôt
2025-10-06,29.90,SaaS Outil - Abonnement mensuel
2025-10-08,74.20,GLS - Expéditions
2025-10-11,46.80,La Poste - Colissimo
`;

  const demoSalesRows = useMemo(() => parseCsvText(DEMO_SALES_CSV), []);
  const demoBankRows = useMemo(() => parseCsvText(DEMO_BANK_CSV), []);

  /* --- Données (connecteurs) --- */
  const bankingRowsRaw = useDataset("banking") || [];
  const salesRowsRaw = useDataset("sales") || [];

  const bankingRowsBase = Array.isArray(bankingRowsRaw)
    ? bankingRowsRaw
    : parseCsvText(String(bankingRowsRaw || ""));
  const salesRowsBase =
    Array.isArray(salesRowsRaw) && salesRowsRaw.length
      ? salesRowsRaw
      : parseCsvText(String(SAMPLE_SALES || ""));

  /* --- CSV upload overrides --- */
  const fileInputRef = useRef(null);
  const [uploadedSalesRows, setUploadedSalesRows] = useState(null);
  const [uploadedBankRows, setUploadedBankRows] = useState(null);

  // On first mount, if nothing connected or uploaded, load demo
  useEffect(() => {
    const noSales = !(salesRowsBase && salesRowsBase.length);
    const noBank = !(bankingRowsBase && bankingRowsBase.length);
    if (noSales && !uploadedSalesRows) setUploadedSalesRows(demoSalesRows);
    if (noBank && !uploadedBankRows) setUploadedBankRows(demoBankRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detectCsvKind = (rows) => {
    if (!Array.isArray(rows) || !rows.length) return "sales";
    const keys = Object.keys(rows[0] || {}).map((k) => k.toLowerCase());
    const has = (k) => keys.includes(k);
    const any = (...ks) => ks.some((k) => has(k));
    if (has("amount") || has("montant")) return "bank";
    if (has("qty") && any("price", "unit_price", "amount", "total"))
      return "sales";
    return has("price") || has("qty") ? "sales" : "bank";
  };

  const handleCsvUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const parsed = parseCsvText(text);
      const kind = detectCsvKind(parsed);
      if (kind === "bank") setUploadedBankRows(parsed);
      else setUploadedSalesRows(parsed);
    } catch (err) {
      console.error("[CSV] Read error:", err);
      alert("Impossible de lire le CSV.");
    } finally {
      e.target.value = "";
    }
  };

  // Final inputs (upload overrides connectors; if still empty, demo kicks in)
  const bankingRows = useMemo(
    () =>
      (uploadedBankRows?.length
        ? uploadedBankRows
        : bankingRowsBase?.length
        ? bankingRowsBase
        : demoBankRows) || [],
    [uploadedBankRows, bankingRowsBase, demoBankRows]
  );

  const salesRowsInput = useMemo(
    () =>
      (uploadedSalesRows?.length
        ? uploadedSalesRows
        : salesRowsBase?.length
        ? salesRowsBase
        : demoSalesRows) || [],
    [uploadedSalesRows, salesRowsBase, demoSalesRows]
  );

  /* --- Auto-extraction (banque → paramètres) --- */
  const auto = useMemo(
    () => ecoExtractFromBank(bankingRows, salesRowsInput),
    [bankingRows, salesRowsInput]
  );

  /* --- Ventes 30j --- */
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
    return {
      last30Revenue: last30.reduce((s, r) => s + r.qty * r.price, 0),
      last30Orders: last30.length,
    };
  }, [salesRowsInput]);

  /* --- États UI --- */
  const [sector, setSector] = useState("ecommerce");
  const [kwhMonth, setKwhMonth] = useState("450");
  const [dieselL, setDieselL] = useState("60");
  const [shipKgOrder, setShipKgOrder] = useState(
    ECO_FACTORS.shippingKgPerOrder
  );
  const [gridRegion, setGridRegion] = useState("EU");

  const elecFactor =
    GRID_REGIONS[gridRegion] ?? ECO_FACTORS.electricityKgPerKWh;

  /* --- Banque 30j --- */
  const sinceISO30 = toDateKey(Date.now() - 30 * 864e5);
  const txCarbon = useMemo(
    () => estimateCO2eFromBankTx(bankingRows, sinceISO30),
    [bankingRows, sinceISO30]
  );

  const demoMode =
    Number(last30Revenue) === 0 && !(bankingRows && bankingRows.length);
  const displayOrders = demoMode ? 320 : last30Orders;
  const displayConf = demoMode ? 65 : txCarbon?.confidence || 0;

  /* --- Emissions (mesuré > paramétré > proxy) --- */
  const sectorFactor = ECO_FACTORS.sectorKgPerEUR[sector] || 0;
  const sectorEmissions = sectorFactor * last30Revenue;

  const electricityBase = (Number(kwhMonth) || 0) * elecFactor;
  const fuelBase = (Number(dieselL) || 0) * (ECO_FACTORS.dieselKgPerL ?? 2.68);
  const shippingBase = (Number(last30Orders) || 0) * (Number(shipKgOrder) || 0);

  const bankElectricity = txCarbon?.byTag?.electricity ?? null;
  const bankFuel = txCarbon?.byTag?.fuel ?? null;
  const bankShipping = txCarbon?.byTag?.shipping ?? null;

  const electricity = bankElectricity ?? electricityBase;
  const fuel = bankFuel ?? fuelBase;
  const shipping = bankShipping ?? shippingBase;

  const sectorOther = Math.max(
    0,
    sectorEmissions - (electricity + fuel + shipping) * SECTOR_OTHER_SHARE
  );

  const totalKg = Math.max(
    0,
    Math.round(electricity + fuel + shipping + sectorOther)
  );
  const intensity = last30Revenue > 0 ? totalKg / last30Revenue : Infinity;
  const { grade } = ecoGradeFromIntensity(intensity);

  /* --- Séries intensité (pour spark) --- */
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
      byDay[r.date].orders += 1;
    });
    return Object.keys(byDay)
      .sort()
      .map((d) => ({ date: d, ...byDay[d] }));
  }, [salesRowsInput]);

  const intensitySeries = useMemo(() => {
    const elecPerDay = ((Number(kwhMonth) || 0) * elecFactor) / 30;
    const fuelPerDay = ((Number(dieselL) || 0) * ECO_FACTORS.dieselKgPerL) / 30;
    const sectorPerEUR = sectorFactor;
    return (salesDaily || []).map((d) => {
      const shipKgs = d.orders * (Number(shipKgOrder) || 0);
      const sectorKg = d.revenue * sectorPerEUR;
      const total = Math.max(0, sectorKg + shipKgs + elecPerDay + fuelPerDay);
      const inten = d.revenue > 0 ? total / d.revenue : null;
      return {
        date: d.date,
        intensity: inten,
        totalKg: total,
        revenue: d.revenue,
        elecKg: elecPerDay,
        fuelKg: fuelPerDay,
        shipKg: shipKgs,
        sectorKg,
      };
    });
  }, [salesDaily, sectorFactor, shipKgOrder, kwhMonth, dieselL, elecFactor]);

  const ecoSpark = useMemo(
    () =>
      (intensitySeries || [])
        .filter((p) => Number.isFinite(p.intensity))
        .slice(-ecoWindow)
        .map((p) => ({ x: p.date, y: Number(p.intensity.toFixed(3)) })),
    [intensitySeries, ecoWindow]
  );

  /* --- Conseils IA enrichis (PB → Cause → Solution) --- */
  const aiPlan = useMemo(() => {
    const out = [];
    // Électricité
    if ((electricity || 0) > 0) {
      const perKwh = elecFactor;
      const kwhDelta = Math.ceil(
        ((electricity || 0) * 0.25) / Math.max(perKwh, 0.0001)
      ); // -25%
      out.push({
        id: "elec",
        problem: "Électricité parmi les 3 premiers postes",
        cause: `Conso estimée ≈ ${fmt(
          (electricity || 0) / Math.max(perKwh, 0.0001),
          0
        )} kWh/mois ; facteur réseau ${fmt(elecFactor, 3)} kg/kWh`,
        solution:
          "Plan éco-conso (-25 %) : consignes & veille, sous-comptage, PPA/GO à moyen terme, LED & pilotage HVAC.",
        impactKg: Math.round(kwhDelta * perKwh),
        kwhDelta,
      });
    }
    // Carburant
    if ((fuel || 0) > 0) {
      const perL = ECO_FACTORS.dieselKgPerL;
      const lDelta = Math.ceil((fuel * 0.25) / Math.max(perL, 0.0001));
      out.push({
        id: "fuel",
        problem: "Carburant élevé (Scope 1)",
        cause: `Consommation ≈ ${fmt((fuel || 0) / perL, 0)} L/mois de diesel`,
        solution:
          "Optimiser tournées, augmenter taux de remplissage, bascule progressive vers véhicules électrifiés.",
        impactKg: Math.round(lDelta * perL),
        lDelta,
      });
    }
    // Shipping
    if ((last30Orders || 0) > 0) {
      const perOrder = Number(shipKgOrder) || 0;
      const deltaOrder = Math.max(1, Math.ceil(perOrder * 0.3)); // -30%/commande
      out.push({
        id: "ship",
        problem: "Empreinte expéditions perfectible",
        cause: `Moyenne ~${fmt(perOrder, 2)} kg/commande`,
        solution:
          "Plus de relais/route, packaging allégé, regroupement & règles anti-express/air par défaut.",
        impactKg: deltaOrder * last30Orders,
        perOrderDelta: deltaOrder,
      });
    }
    return out;
  }, [electricity, fuel, shipKgOrder, last30Orders, elecFactor]);

  /* --- RENDER --- */
  const sectorMedian = sectorFactor || 0;
  const tCO2eYear = (totalKg * 12) / 1000;

  // Build daily components (last 30 days) for stacked viz
  const dailyComp30 = useMemo(() => {
    const sinceISO = toDateKey(Date.now() - 30 * 864e5);
    const rows = intensitySeries.filter((d) => d.date >= sinceISO);
    return rows.map((d) => {
      const baseOther = Math.max(
        0,
        d.sectorKg - (d.elecKg + d.fuelKg + d.shipKg) * SECTOR_OTHER_SHARE
      );
      return {
        date: d.date,
        Électricité: d.elecKg,
        Carburant: d.fuelKg,
        Expéditions: d.shipKg,
        Autres: baseOther,
      };
    });
  }, [intensitySeries]);

  return (
    <div className="max-w-7xl mx-auto px-3 md:px-4">
      <Section
        title="Éco-Label (estimation pédagogique)"
        icon={<Leaf className="w-5 h-5 text-emerald-600" />}
        actions={
          <div className="flex items-center gap-2">
            {/* Export méthodo */}
            <Button
              variant="subtle"
              size="sm"
              onClick={() => {
                const payload = {
                  gridRegion,
                  electricityFactor: elecFactor,
                  composition: { electricity, fuel, shipping, sectorOther },
                  measuredKg:
                    (txCarbon?.byTag?.electricity ?? 0) +
                    (txCarbon?.byTag?.fuel ?? 0) +
                    (txCarbon?.byTag?.shipping ?? 0),
                  paramKg:
                    (txCarbon?.byTag?.electricity == null
                      ? electricityBase
                      : 0) +
                    (txCarbon?.byTag?.fuel == null ? fuelBase : 0) +
                    (txCarbon?.byTag?.shipping == null ? shippingBase : 0),
                  proxyKg: sectorOther,
                  confidence: displayConf,
                  sector: { key: sector, factor: sectorFactor },
                  totals: {
                    last30Revenue,
                    last30Orders,
                    totalKg,
                    intensity: Number.isFinite(intensity)
                      ? +intensity.toFixed(3)
                      : null,
                  },
                  generatedAt: new Date().toISOString(),
                  windowDays: 30,
                  factorsVersion: "IM-0.4",
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

            {/* Ajouter un CSV (bank or sales, auto) */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              whileHover={{ y: -1 }}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm ring-1 ring-emerald-400/40"
              title="Importer un CSV ventes ou banque"
            >
              <Upload className="w-4 h-4" />
              Ajouter un CSV
            </motion.button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvUpload}
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>
        }
      >
        {/* Aide format CSV */}
        <div className="text-[11.5px] text-slate-500 -mt-2 mb-3">
          Format attendu — <b>Ventes</b>: <code>date, qty, price</code> (+
          optionnels:
          <code>order_id, product</code>). <b>Banque</b>:{" "}
          <code>date, amount, label</code>. CSV UTF-8 avec en-tête.
        </div>

        {/* Bandeau + connectivité */}
        <div className="flex items-start gap-4 mb-4">
          <motion.div
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${
              ecoGradeFromIntensity(intensity).color
            } text-2xl font-bold shadow relative overflow-hidden`}
          >
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.18 }}
              className="pointer-events-none absolute -inset-1 blur-lg"
              style={{
                background:
                  "radial-gradient(60% 60% at 50% 50%, rgba(255,255,255,.8), transparent 60%)",
              }}
            />
            {ecoGradeFromIntensity(intensity).grade}
          </motion.div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <div className="text-lg font-semibold">Éco-Label InsightMate</div>
              <ConfidencePill value={displayConf} />
              <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600">
                <ShieldQuestion className="w-3 h-3" />
                Bande d’incertitude incluse
              </span>
            </div>

            <div className="mt-1 text-sm text-gray-700 dark:text-gray-200">
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
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`px-2 py-0.5 rounded ${
                  (salesRowsInput?.length || 0) > 0
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                }`}
              >
                Ventes{" "}
                {(salesRowsInput?.length || 0) > 0
                  ? "connectées"
                  : "manquantes"}
              </span>
              <span
                className={`px-2 py-0.5 rounded ${
                  (bankingRows?.length || 0) > 0
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                }`}
              >
                Banque{" "}
                {(bankingRows?.length || 0) > 0 ? "connectée" : "manquante"}
              </span>
            </div>

            <div className="mt-2">
              <DataHealthBar
                measured={
                  (txCarbon?.byTag?.electricity ?? 0) +
                  (txCarbon?.byTag?.fuel ?? 0) +
                  (txCarbon?.byTag?.shipping ?? 0)
                }
                param={
                  (txCarbon?.byTag?.electricity == null ? electricityBase : 0) +
                  (txCarbon?.byTag?.fuel == null ? fuelBase : 0) +
                  (txCarbon?.byTag?.shipping == null ? shippingBase : 0)
                }
                proxy={sectorOther}
              />
            </div>
          </div>
        </div>

        {/* Executive summary (single view, toggle removed) */}
        <ExecutiveSummarySection
          totalKg={totalKg}
          intensity={intensity}
          sectorMedian={sectorMedian}
          electricity={electricity}
          fuel={fuel}
          shipping={shipping}
          displayConf={displayConf}
          spark={ecoSpark}
          aiPlan={aiPlan}
          targetIntensity={
            ecoGradeFromIntensity(intensity).grade === "A" ||
            ecoGradeFromIntensity(intensity).grade === "B"
              ? 0.2
              : ecoGradeFromIntensity(intensity).grade === "C"
              ? 0.5
              : ecoGradeFromIntensity(intensity).grade === "D"
              ? 1.0
              : 1.5
          }
        />

        {/* Aides + Presse */}
        <SubsidyBox
          totalKg={totalKg}
          electricityDeltaKwhMonth={
            aiPlan.find((a) => a.id === "elec")?.kwhDelta || 0
          }
          tCO2eYear={(totalKg * 12) / 1000}
        />
        <PressBox />

        {/* ====== NEW MODULE: Décomposition quotidienne (30j) ====== */}
        <Section
          title="Décomposition quotidienne (30 jours)"
          icon={<Sparkles className="w-5 h-5" />}
          actions={
            <div className="text-xs text-slate-500">
              Ventilation ~élec/fuel/expéditions/autres par jour
            </div>
          }
        >
          <div className="rounded-2xl border bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-4">
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={dailyComp30}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v, n) => [`${formatNumber(v, 0)} kg`, n]}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Électricité"
                  stackId="kg"
                  fill={ACCENT_DARK}
                  stroke={ACCENT_DARK}
                  fillOpacity={0.35}
                />
                <Area
                  type="monotone"
                  dataKey="Carburant"
                  stackId="kg"
                  fill="#ef4444"
                  stroke="#ef4444"
                  fillOpacity={0.25}
                />
                <Area
                  type="monotone"
                  dataKey="Expéditions"
                  stackId="kg"
                  fill="#14b8a6"
                  stroke="#14b8a6"
                  fillOpacity={0.25}
                />
                <Area
                  type="monotone"
                  dataKey="Autres"
                  stackId="kg"
                  fill="#64748b"
                  stroke="#64748b"
                  fillOpacity={0.2}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="mt-2 text-[11px] text-slate-500">
              Approche pédagogique: allocation journalière simple (élec & fuel
              répartis /30, expéditions par commandes, proxy secteur
              proportionnel au CA).
            </div>
          </div>
        </Section>

        {/* ====== NEW MODULE: Aperçu des fichiers importés ====== */}
        <Section
          title="Aperçu des fichiers importés"
          icon={<Upload className="w-5 h-5" />}
        >
          <div className="grid md:grid-cols-2 gap-4">
            <TablePreview rows={salesRowsInput} title="Ventes (CSV actif)" />
            <TablePreview rows={bankingRows} title="Banque (CSV actif)" />
          </div>
        </Section>
      </Section>
    </div>
  );
}
