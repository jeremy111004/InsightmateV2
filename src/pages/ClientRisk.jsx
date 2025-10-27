// ANCHOR: FILE_TOP ClientRisk.jsx
import React from "react";
import { motion } from "framer-motion";
import {
  Download,
  AlertTriangle,
  BarChart2,
  PieChart as PieIcon,
  Upload,
  Info,
  ArrowUpRight,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  CalendarDays,
  ListChecks,
} from "lucide-react";
import Papa from "papaparse";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart as RPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useTranslation } from "react-i18next";

/* =========================
   Helpers
========================= */
function eur(n, frac = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return Number(n).toLocaleString("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: frac,
    });
  } catch {
    return `${n}€`;
  }
}
const clamp01 = (x) => Math.max(0, Math.min(1, Number(x) || 0));
const toNum = (v, fb = 0) => {
  const n = Number(
    String(v ?? "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  );
  return Number.isFinite(n) ? n : fb;
};
const safeStr = (v, fb = "") => {
  const s = String(v ?? "").trim();
  return s.length ? s : fb;
};
function recoveryEstimate(c) {
  return Math.round(
    (Number(c.outstanding) || 0) * clamp01(c.probability_recovery)
  );
}
function csvDownload(filename, rows) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* =========================
   Smart Follow-Up Engine — core helpers
========================= */
const DAY_MS = 24 * 3600 * 1000;
const todayISO = () => new Date().toISOString().slice(0, 10);
const startOfWeekISO = (d) => {
  const dt = new Date(d);
  const day = dt.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // make Monday start
  const monday = new Date(dt.getTime() - diff * DAY_MS);
  return monday.toISOString().slice(0, 10);
};

/** Deterministic ETA rule of thumb:
 * - More overdue ⇒ sooner collection (if probability is decent).
 * - Lower probability ⇒ later expected date.
 * Result clamped to [3..90] days.
 */
function daysToExpectedPayment(c) {
  const overdue = Math.max(0, Number(c.overdue) || 0);
  const p = clamp01(c.probability_recovery);
  const base = 35 * (1 - p) + Math.max(0, 60 - overdue) / 2; // 0..~65
  const adj = base - Math.min(overdue, 45) / 3; // bring forward if very overdue
  return Math.min(90, Math.max(3, Math.round(adj)));
}

function expectedDateISO(c) {
  const d = daysToExpectedPayment(c);
  return new Date(Date.now() + d * DAY_MS).toISOString().slice(0, 10);
}

/** Weekly bucket = put the expected recovery into the week of expectedDate. */
function buildWeeklyRecoverySeries(clients, weeks = 8) {
  const map = new Map();
  const base = startOfWeekISO(new Date());
  const baseDate = new Date(base);
  for (let k = 0; k < weeks; k++) {
    const wk = new Date(baseDate.getTime() + k * 7 * DAY_MS)
      .toISOString()
      .slice(0, 10);
    map.set(wk, 0);
  }
  for (const c of clients) {
    const rec = recoveryEstimate(c);
    if (rec <= 0) continue;
    const eta = expectedDateISO(c);
    const wk = startOfWeekISO(eta);
    if (!map.has(wk)) continue; // outside horizon
    map.set(wk, (map.get(wk) || 0) + rec);
  }
  return Array.from(map.entries())
    .map(([week, amount]) => ({ week, amount }))
    .sort((a, b) => (a.week < b.week ? -1 : 1));
}

/** Suggested action = email if we have an email, else enrich contact. */
function suggestedAction(c) {
  const hasEmail = !!(c.email && String(c.email).includes("@"));
  if (!hasEmail) return "complete_contact";
  if ((Number(c.overdue) || 0) >= 60) return "call_then_email";
  if (clamp01(c.probability_recovery) < 0.5) return "call_email_plan";
  return "email_reminder";
}

/** Build Next-Actions CSV rows (top N by priority) */
function buildNextActions(filteredClients, t, topN = 50) {
  const rows = filteredClients.slice(0, topN).map((c) => {
    const expDate = expectedDateISO(c);
    const action = suggestedAction(c);
    const subject = t("priority.email.subjectWithId", {
      name: safeStr(c.name, t("priority.email.defaultClient")),
      id: safeStr(c.id),
    });
    const body = t("priority.email.body", {
      name: safeStr(c.name, t("priority.email.defaultGreeting")),
      amount: eur(c.outstanding),
      id: safeStr(c.id),
      overdue: Number(c.overdue) || 0,
    });
    return {
      id: c.id,
      name: c.name,
      email: c.email || "",
      overdue: Number(c.overdue) || 0,
      outstanding: Number(c.outstanding) || 0,
      probability_recovery: clamp01(c.probability_recovery),
      expected_recovery_eur: recoveryEstimate(c),
      expected_date: expDate,
      priority_score: c._priority ?? 0,
      suggested_action: action,
      email_subject: subject,
      email_body: body,
    };
  });
  return rows;
}

/* =========================
   Data — adapter localStorage -> clients
   Attendu: { id, name, email, overdue, outstanding, probability_recovery }
========================= */
const SAMPLE_CLIENTS = [
  {
    id: "C-001",
    name: "Boulangerie Paul",
    email: "contact@paulbakery.fr",
    overdue: 45,
    outstanding: 2400,
    probability_recovery: 0.7,
  },
  {
    id: "C-023",
    name: "Café du Port",
    email: "hello@cafeduport.com",
    overdue: 120,
    outstanding: 8200,
    probability_recovery: 0.35,
  },
  {
    id: "C-011",
    name: "Librairie Moderne",
    email: "info@libmoderne.fr",
    overdue: 10,
    outstanding: 600,
    probability_recovery: 0.9,
  },
  {
    id: "C-039",
    name: "Salon Coiffure Léo",
    email: "booking@leo-hair.fr",
    overdue: 75,
    outstanding: 3100,
    probability_recovery: 0.5,
  },
  {
    id: "C-055",
    name: "Atelier Mode",
    email: "contact@ateliermode.fr",
    overdue: 200,
    outstanding: 15200,
    probability_recovery: 0.2,
  },
];

function useRiskyClientsData() {
  return React.useMemo(() => {
    try {
      const raw = JSON.parse(
        localStorage.getItem("insightmate.datastore.v1") || "null"
      );
      const pay = raw?.payments || raw?.sales || [];
      if (Array.isArray(pay) && pay.length) {
        const map = new Map();
        for (const r of pay) {
          const id = safeStr(
            r.client_id || r.customer_id || r.client || r.id || "NA"
          );
          const name = safeStr(
            r.client_name || r.customer || r.name || `Client ${id}`
          );
          const email = safeStr(r.email || r.client_email || "");
          const amount = toNum(r.amount_due ?? r.amount ?? r.outstanding, 0);
          const overdue = toNum(r.overdue_days ?? r.days_overdue ?? r.delay, 0);
          const paid = Boolean(r.paid || r.settled);
          const rec = map.get(id) || {
            id,
            name,
            email,
            outstanding: 0,
            overdue: 0,
            invoices: 0,
            lateCnt: 0,
          };
          rec.outstanding += paid ? 0 : amount;
          rec.overdue = Math.max(rec.overdue, overdue);
          rec.invoices += 1;
          rec.lateCnt += overdue > 0 ? 1 : 0;
          map.set(id, rec);
        }
        const rows = Array.from(map.values()).map((c) => ({
          ...c,
          probability_recovery: clamp01(
            0.95 - c.overdue / 365 - Math.min(0.4, c.lateCnt * 0.05)
          ),
        }));
        return rows
          .filter((r) => r.outstanding > 0)
          .sort((a, b) => b.outstanding - a.outstanding);
      }
    } catch {}
    return SAMPLE_CLIENTS;
  }, []);
}

/* =========================
   Demo time-series (pour area chart)
========================= */
function buildPie(totalOutstanding, weightedRecovery, t) {
  const recovered = Math.max(0, Number(weightedRecovery) || 0);
  const unrecovered = Math.max(0, (Number(totalOutstanding) || 0) - recovered);
  return [
    { name: t("clientRisk:charts.pie.recoverable"), value: recovered },
    { name: t("clientRisk:charts.pie.remainingExposure"), value: unrecovered },
  ];
}
function demoSeries(n = 18, base = 40000) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const jitter = (Math.random() - 0.5) * (base * 0.08);
    const val = Math.max(0, base - i * (base * 0.04) + jitter);
    out.push({
      date: new Date(Date.now() - i * 24 * 3600 * 1000).toLocaleDateString(
        "fr-FR",
        { month: "short", day: "2-digit" }
      ),
      exposure: Math.round(val),
    });
  }
  return out;
}

/* =========================
   Animations
========================= */
const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
};
const pop = {
  initial: { opacity: 0, scale: 0.98, y: 6 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
};
const staggerParent = {
  initial: { opacity: 1 },
  animate: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

/* =========================
   UI small components
========================= */
function StatCard({ title, value, caption, Icon }) {
  return (
    <motion.div
      variants={pop}
      whileHover={{ y: -2 }}
      className="relative overflow-hidden bg-white/5 p-4 rounded-2xl shadow-sm ring-1 ring-white/10"
    >
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-gradient-to-br from-cyan-400/30 via-purple-400/30 to-fuchsia-400/30" />
      <div className="flex items-start gap-3 relative">
        <div className="p-2 bg-white/10 rounded-xl">
          {Icon && <Icon size={18} />}
        </div>
        <div>
          <div className="text-xs text-slate-300">{title}</div>
          <div className="text-xl font-semibold mt-1">{value}</div>
          {caption && (
            <div className="text-xs text-slate-400 mt-1">{caption}</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function TechHeader() {
  return (
    <div className="relative mb-4">
      <div className="h-[3px] w-full rounded-full overflow-hidden bg-white/10">
        <div className="h-full w-1/2 bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 animate-[bgpan_6s_linear_infinite]" />
      </div>
      <style>{`@keyframes bgpan{0%{transform:translateX(-100%)}50%{transform:translateX(50%)}100%{transform:translateX(200%)}}`}</style>
    </div>
  );
}

/* =========================
   Dashboard
========================= */
function RiskDashboard({ clients }) {
  const { t } = useTranslation("clientRisk");

  const totalOutstanding = React.useMemo(
    () => clients.reduce((s, c) => s + (Number(c.outstanding) || 0), 0),
    [clients]
  );
  const weightedRecovery = React.useMemo(
    () => clients.reduce((s, c) => s + recoveryEstimate(c), 0),
    [clients]
  );
  const highRiskCount = React.useMemo(
    () =>
      clients.filter(
        (c) =>
          (Number(c.overdue) || 0) > 60 || clamp01(c.probability_recovery) < 0.5
      ).length,
    [clients]
  );

  const top5Data = React.useMemo(
    () =>
      clients
        .map((c) => ({ ...c, _recovery: recoveryEstimate(c) }))
        .sort((a, b) => b._recovery - a._recovery)
        .slice(0, 5),
    [clients]
  );
  const pieData = React.useMemo(
    () => buildPie(totalOutstanding, weightedRecovery, t),
    [totalOutstanding, weightedRecovery, t]
  );

  return (
    <motion.div variants={staggerParent} initial="initial" animate="animate">
      <TechHeader />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          title={t("kpi.totalExposure.title")}
          value={eur(totalOutstanding)}
          caption={t("kpi.totalExposure.caption")}
          Icon={BarChart2}
        />
        <StatCard
          title={t("kpi.recoveryPotential.title")}
          value={eur(weightedRecovery)}
          caption={t("kpi.recoveryPotential.caption")}
          Icon={PieIcon}
        />
        <StatCard
          title={t("kpi.riskyClients.title")}
          value={highRiskCount}
          caption={t("kpi.riskyClients.caption")}
          Icon={AlertTriangle}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          variants={pop}
          className="bg-white/5 p-4 rounded-2xl ring-1 ring-white/10"
        >
          <h3 className="text-sm font-semibold mb-2">
            {t("charts.pie.title")}
          </h3>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <RPieChart>
                <Pie
                  data={pieData}
                  innerRadius={52}
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} (${Math.round(percent * 100)}%)`
                  }
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} />
                  ))}
                </Pie>
                <Legend />
              </RPieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          variants={pop}
          className="bg-white/5 p-4 rounded-2xl ring-1 ring-white/10"
        >
          <h3 className="text-sm font-semibold mb-2">
            {t("charts.top5.title")}
          </h3>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={top5Data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip formatter={(v) => eur(v)} />
                <Bar dataKey="_recovery" name={t("charts.top5.barName")} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <motion.div
        variants={pop}
        className="mt-6 bg-white/5 p-4 rounded-2xl ring-1 ring-white/10"
      >
        <h3 className="text-sm font-semibold mb-3">
          {t("charts.history.title")}
        </h3>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <AreaChart data={demoSeries(18, Math.max(20000, totalOutstanding))}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopOpacity={0.6} />
                  <stop offset="95%" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" />
              <YAxis />
              <CartesianGrid strokeDasharray="3 3" />
              <Tooltip formatter={(v) => eur(v)} />
              <Area
                type="monotone"
                dataKey="exposure"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#g1)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* =========================
   Priorités de relance — actions intégrées
========================= */
function priorityScore(c) {
  const overdue = Math.max(0, Number(c.overdue) || 0);
  const due = Math.max(0, Number(c.outstanding) || 0);
  const p = clamp01(c.probability_recovery);
  return Math.round(due * (1 - p) * (1 + overdue / 90));
}

function PriorityList({ clients, query, onQuery }) {
  const { t } = useTranslation("clientRisk");

  const enriched = React.useMemo(
    () =>
      clients
        .map((c) => ({
          ...c,
          _recovery: recoveryEstimate(c),
          _priority: priorityScore(c),
        }))
        .sort((a, b) => b._priority - a._priority),
    [clients]
  );

  const filtered = React.useMemo(() => {
    const q = (query || "").toLowerCase().trim();
    if (!q) return enriched;
    return enriched.filter((c) =>
      `${c.name} ${c.id} ${c.email}`.toLowerCase().includes(q)
    );
  }, [enriched, query]);

  const kpis = React.useMemo(() => {
    const totalDue = filtered.reduce(
      (s, c) => s + (Number(c.outstanding) || 0),
      0
    );
    const totalRec = filtered.reduce(
      (s, c) => s + (Number(c._recovery) || 0),
      0
    );
    return { count: filtered.length, totalDue, totalRec };
  }, [filtered]);

  function exportPotential() {
    csvDownload(
      t("csv.filenames.priorities"),
      filtered.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        overdue: c.overdue,
        outstanding: c.outstanding,
        probability_recovery: c.probability_recovery,
        recovery_est: c._recovery,
        priority_score: c._priority,
      }))
    );
  }

  // Export Next-Actions (Smart Follow-Up) — CSV only
  function exportNextActions() {
    const rows = buildNextActions(filtered, t, 50);
    csvDownload(t("csv.filenames.nextActions"), rows);
  }

  return (
    <motion.div
      variants={pop}
      initial="initial"
      animate="animate"
      className="bg-white/5 p-4 rounded-2xl ring-1 ring-white/10"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            {t("priority.title")}{" "}
            <ArrowUpRight size={16} className="opacity-70" />
          </h3>
          <div className="text-xs text-slate-400">
            {t("priority.subtitle")} {t("priority.clientsLabel")}{" "}
            <b>{kpis.count}</b> • {t("priority.totalDueLabel")}{" "}
            <b>{eur(kpis.totalDue)}</b> • {t("priority.potentialLabel")}{" "}
            <b>{eur(kpis.totalRec)}</b>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={t("priority.searchPlaceholder")}
            className="px-3 py-2 rounded-xl bg-white/10 ring-1 ring-white/15 text-sm"
          />
          <button
            onClick={exportNextActions}
            className="px-3 py-2 rounded-xl bg-emerald-700/20 ring-1 ring-emerald-500/30 hover:bg-emerald-700/30 text-emerald-200 text-sm flex items-center gap-2"
          >
            <ListChecks size={16} /> {t("follow.exportNextActions")}
          </button>
          <button
            onClick={exportPotential}
            className="px-3 py-2 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 text-sm flex items-center gap-2"
          >
            <Download size={16} /> {t("priority.exportBtn")}
          </button>
        </div>
      </div>

      {/* Headers desktop */}
      <div className="hidden md:grid grid-cols-12 px-2 py-2 text-xs text-slate-400">
        <div className="col-span-5">{t("priority.headers.client")}</div>
        <div className="col-span-2">{t("priority.headers.overdue")}</div>
        <div className="col-span-2">{t("priority.headers.due")}</div>
        <div className="col-span-2">{t("priority.headers.potential")}</div>
        <div className="col-span-1 text-right">
          {t("priority.headers.action")}
        </div>
      </div>

      <div className="space-y-2 max-h-[520px] overflow-auto">
        {filtered.map((c) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.005 }}
            transition={{ duration: 0.22 }}
            className="grid grid-cols-12 items-center gap-3 p-3 rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur"
          >
            <div className="col-span-5">
              <div className="font-semibold">
                {c.name}{" "}
                <span className="text-xs text-slate-400">• {c.id}</span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1">
                {c.email || t("priority.email.missing")}{" "}
                {(!c.email || !String(c.email).includes("@")) && (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <AlertTriangle size={12} />{" "}
                    {t("priority.email.completeHint")}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {t("priority.scoreLabel")}:{" "}
                <b>{c._priority.toLocaleString("fr-FR")}</b> —{" "}
                {t("priority.probAbbr")}{" "}
                {(clamp01(c.probability_recovery) * 100).toFixed(0)}%
              </div>
            </div>
            <div className="col-span-2 text-sm">{Number(c.overdue) || 0}</div>
            <div className="col-span-2 text-sm">{eur(c.outstanding)}</div>
            <div className="col-span-2 text-sm">{eur(recoveryEstimate(c))}</div>
            <div className="col-span-1 flex justify-end">
              {/* CSV-only page: no per-row email button */}
            </div>
          </motion.div>
        ))}
        {!filtered.length && (
          <div className="text-xs text-slate-400 px-2 py-3">
            {t("priority.noMatch")}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* =========================
   CSV Upload — CONNECTÉ (bouton + drag&drop) 
   -> onRows(rows) est appelé et écrase le dataset courant
========================= */
function CSVUploadCard({ onRows }) {
  const { t } = useTranslation("clientRisk");
  const fileRef = React.useRef(null);
  const dropRef = React.useRef(null);
  const [status, setStatus] = React.useState({ state: "idle", msg: "" }); // idle | parsing | ok | error

  // --- Parsing & mapping ---
  function normalizeRows(rowsRaw) {
    const rows = rowsRaw
      .map((r, idx) => {
        const id = safeStr(
          r.id || r.client_id || r.customer_id || r.client || `ROW-${idx + 1}`
        );
        const name = safeStr(
          r.name || r.client_name || r.customer || `Client ${id}`
        );
        const email = safeStr(r.email || r.client_email || "");
        const outstanding = toNum(r.outstanding ?? r.amount_due ?? r.amount, 0);
        const overdue = toNum(r.overdue ?? r.overdue_days ?? r.days_overdue, 0);
        const pr =
          r.probability_recovery ?? r.probability ?? r.p_recovery ?? null;
        const probability_recovery =
          pr == null || pr === ""
            ? clamp01(0.95 - overdue / 365)
            : clamp01(toNum(pr, 0));
        return { id, name, email, outstanding, overdue, probability_recovery };
      })
      .filter((r) => r.outstanding > 0);
    return rows;
  }

  function parseFile(file) {
    setStatus({ state: "parsing", msg: t("csv.status.parsing") });
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (res) => {
        try {
          const data = Array.isArray(res.data) ? res.data : [];
          const rows = normalizeRows(data);
          if (!rows.length) {
            setStatus({ state: "error", msg: t("csv.status.noValidRows") });
            return;
          }
          onRows(rows); // <<< ÉCRASE le dataset courant
          setStatus({
            state: "ok",
            msg: t("csv.status.ok", { count: rows.length }),
          });
        } catch (e) {
          setStatus({ state: "error", msg: t("csv.status.error.map") });
        }
      },
      error: () =>
        setStatus({ state: "error", msg: t("csv.status.error.parse") }),
    });
  }

  // --- File picker ---
  function onPickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    parseFile(f);
    e.target.value = ""; // reset pour pouvoir recharger le même fichier
  }

  // --- Drag & drop ---
  React.useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const over = (e) => {
      e.preventDefault();
      el.classList.add("ring-emerald-400");
    };
    const leave = (e) => {
      e.preventDefault();
      el.classList.remove("ring-emerald-400");
    };
    const drop = (e) => {
      e.preventDefault();
      el.classList.remove("ring-emerald-400");
      const file = e.dataTransfer?.files?.[0];
      if (file) parseFile(file);
    };
    el.addEventListener("dragover", over);
    el.addEventListener("dragleave", leave);
    el.addEventListener("drop", drop);
    return () => {
      el.removeEventListener("dragover", over);
      el.removeEventListener("dragleave", leave);
      el.removeEventListener("drop", drop);
    };
  }, []);

  function downloadTemplate() {
    const template = [
      {
        id: "C-1001",
        name: "Client Démo A",
        email: "clientA@example.com",
        outstanding: 2500,
        overdue: 45,
        probability_recovery: 0.6,
      },
      {
        id: "C-1002",
        name: "Client Démo B",
        email: "clientB@example.com",
        outstanding: 12000,
        overdue: 95,
        probability_recovery: 0.35,
      },
    ];
    csvDownload(t("csv.filename.template"), template);
  }

  return (
    <motion.div
      variants={pop}
      initial="initial"
      animate="animate"
      ref={dropRef}
      className="bg-white/5 p-4 rounded-2xl ring-1 ring-white/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Upload size={16} /> {t("csv.card.title")}
          </h3>
          <p
            className="text-xs text-slate-300 mt-1"
            dangerouslySetInnerHTML={{
              __html: t("csv.card.supportedColsHtml"),
            }}
          />
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <Info size={14} />{" "}
            <span
              dangerouslySetInnerHTML={{
                __html: t("csv.card.minimumColsHtml"),
              }}
            />
          </p>
          {/* Status */}
          {status.state === "parsing" && (
            <div className="mt-2 inline-flex items-center gap-2 text-xs text-cyan-300">
              <FileSpreadsheet size={14} className="animate-pulse" />{" "}
              {status.msg}
            </div>
          )}
          {status.state === "ok" && (
            <div className="mt-2 inline-flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle2 size={14} /> {status.msg}
            </div>
          )}
          {status.state === "error" && (
            <div className="mt-2 inline-flex items-center gap-2 text-xs text-rose-300">
              <XCircle size={14} /> {status.msg}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadTemplate}
            className="px-3 py-2 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 text-sm flex items-center gap-2"
          >
            <Download size={14} /> {t("csv.btn.template")}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="px-3 py-2 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 text-sm"
          >
            {t("csv.btn.chooseFile")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onPickFile}
          />
        </div>
      </div>
      <div className="mt-3 text-[11px] text-slate-400">
        {t("csv.hint.dropHere")}
      </div>
    </motion.div>
  );
}

/* =========================
   Smart Follow-Up Engine — UI block (weekly forecast + exports)
========================= */
function FollowUpEngine({ clients }) {
  const { t } = useTranslation("clientRisk");

  const enriched = React.useMemo(
    () =>
      clients
        .map((c) => ({
          ...c,
          _recovery: recoveryEstimate(c),
          _priority: priorityScore(c),
        }))
        .sort((a, b) => b._priority - a._priority),
    [clients]
  );

  const weeks = 8;
  const weekly = React.useMemo(
    () => buildWeeklyRecoverySeries(enriched, weeks),
    [enriched]
  );
  const next7 = React.useMemo(() => {
    const limit = new Date(Date.now() + 7 * DAY_MS).toISOString().slice(0, 10);
    return enriched
      .filter((c) => expectedDateISO(c) <= limit)
      .reduce((s, c) => s + recoveryEstimate(c), 0);
  }, [enriched]);
  const next30 = React.useMemo(() => {
    const limit = new Date(Date.now() + 30 * DAY_MS).toISOString().slice(0, 10);
    return enriched
      .filter((c) => expectedDateISO(c) <= limit)
      .reduce((s, c) => s + recoveryEstimate(c), 0);
  }, [enriched]);

  function exportWeeklyForecast() {
    csvDownload(
      t("csv.filenames.weeklyForecast"),
      weekly.map((r) => ({
        week_start: r.week,
        expected_cash_in: Math.round(r.amount),
      }))
    );
  }

  function exportNextActions() {
    const rows = buildNextActions(enriched, t, 50);
    csvDownload(t("csv.filenames.nextActions"), rows);
  }

  return (
    <motion.div
      variants={pop}
      initial="initial"
      animate="animate"
      className="bg-white/5 p-4 rounded-2xl ring-1 ring-white/10"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} />
          <h3 className="text-sm font-semibold">
            {t("follow.title", "Prévision d'encaissement (Smart Follow-Up)")}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportNextActions}
            className="px-3 py-2 rounded-xl bg-emerald-700/20 ring-1 ring-emerald-500/30 hover:bg-emerald-700/30 text-emerald-200 text-sm flex items-center gap-2"
          >
            <ListChecks size={16} />{" "}
            {t("follow.exportNextActions", "Exporter actions (top 50)")}
          </button>
          <button
            onClick={exportWeeklyForecast}
            className="px-3 py-2 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 text-sm flex items-center gap-2"
          >
            <Download size={16} />{" "}
            {t("follow.exportWeekly", "Exporter prévision hebdo")}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
        <StatCard
          title={t("follow.kpi.next7", "Encaissement 7j")}
          value={eur(next7)}
          caption={t("follow.kpi.next7.caption", "attendu (EV)")}
        />
        <StatCard
          title={t("follow.kpi.next30", "Encaissement 30j")}
          value={eur(next30)}
          caption={t("follow.kpi.next30.caption", "attendu (EV)")}
        />
        <StatCard
          title={t("follow.kpi.horizon", "Horizon")}
          value={`${weeks} ${t("follow.kpi.weeks", "sem.")}`}
          caption={t("follow.kpi.horizon.caption", "regroupement par semaine")}
        />
      </div>

      {/* Weekly forecast chart */}
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={weekly}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip formatter={(v) => eur(v)} />
            <Bar
              dataKey="amount"
              name={t("follow.chart.barName", "Encaissement attendu")}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-[11px] text-slate-400">
        {t(
          "follow.note",
          "Hypothèses simples et déterministes: date attendue = f(probabilité, retard). Ajustez votre CSV pour mettre à jour la prévision."
        )}
      </div>
    </motion.div>
  );
}

/* =========================
   Liste clients (vue complémentaire)
========================= */
function ClientsList({ clients, query, onQuery }) {
  const { t } = useTranslation("clientRisk");

  const filtered = React.useMemo(() => {
    const q = (query || "").toLowerCase().trim();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.name} ${c.id} ${c.email}`.toLowerCase().includes(q)
    );
  }, [clients, query]);

  return (
    <motion.div
      variants={pop}
      initial="initial"
      animate="animate"
      className="bg-white/5 p-4 rounded-2xl ring-1 ring-white/10"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{t("clientsList.title")}</h3>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-400">
            {t("clientsList.found", { count: filtered.length })}
          </div>
          <button
            onClick={() => csvDownload(t("csv.filenames.clients"), filtered)}
            className="px-3 py-2 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 text-sm flex items-center gap-2"
          >
            <Download size={16} /> {t("clientsList.export")}
          </button>
        </div>
      </div>

      <div className="mb-3">
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t("clientsList.searchPlaceholder")}
          className="w-full px-3 py-2 rounded-xl bg-white/10 ring-1 ring-white/15"
        />
      </div>

      <div className="space-y-3 max-h-[420px] overflow-auto">
        {filtered.map((c) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white/10 ring-1 ring-white/15"
          >
            <div>
              <div className="font-semibold">
                {c.name}{" "}
                <span className="text-xs text-slate-400">• {c.id}</span>
              </div>
              <div className="text-xs text-slate-400">
                {c.email || t("priority.email.missing")} •{" "}
                {t("clientsList.delayLabel", { days: Number(c.overdue) || 0 })}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">{eur(c.outstanding)}</div>
              <div className="text-xs text-slate-400">
                {t("clientsList.potentialPrefix")}
                {eur(recoveryEstimate(c))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* =========================
   Page wrapper (FULL — CSV import remplace la démo)
========================= */
export default function ClientRisk() {
  const { t } = useTranslation("clientRisk");
  const baseClients = useRiskyClientsData();
  const [uploaded, setUploaded] = React.useState(null); // <<< quand défini, remplace la démo
  const [query, setQuery] = React.useState(""); // filtre partagé

  // clients utilisés partout
  const clients = React.useMemo(
    () => (uploaded?.length ? uploaded : baseClients),
    [uploaded, baseClients]
  );

  // info source
  const sourceLabel = uploaded?.length
    ? t("page.dataSource.csv", { count: uploaded.length })
    : t("page.dataSource.demo");
  const sourceTone = uploaded?.length ? "text-emerald-300" : "text-slate-400";

  function resetDataset() {
    setUploaded(null);
  }

  return (
    <div className="p-6">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-6"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("page.title")}</h1>
            <p className="text-sm text-slate-400 mt-1">{t("page.tagline")}</p>
            <div
              className={`mt-2 text-xs inline-flex items-center gap-2 ${sourceTone}`}
            >
              <FileSpreadsheet size={14} /> {t("page.dataSourceLabel")}{" "}
              <b>{sourceLabel}</b>
              {uploaded?.length ? (
                <button
                  onClick={resetDataset}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 ring-1 ring-white/15 hover:bg-white/15 ml-2"
                >
                  <RefreshCw size={12} /> {t("page.btn.reset")}
                </button>
              ) : null}
            </div>
          </div>
          <div className="w-full md:w-[520px]">
            {/* Quand on charge un CSV, setUploaded(rows) ÉCRASE la démo */}
            <CSVUploadCard onRows={setUploaded} />
          </div>
        </div>
      </motion.header>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <RiskDashboard clients={clients} />
        </div>

        {/* NEW: Smart Follow-Up Engine block */}
        <div className="col-span-12">
          <FollowUpEngine clients={clients} />
        </div>

        <div className="col-span-12">
          <PriorityList clients={clients} query={query} onQuery={setQuery} />
        </div>

        <div className="col-span-12">
          <ClientsList clients={clients} query={query} onQuery={setQuery} />
        </div>
      </div>
    </div>
  );
}

// ANCHOR: FILE_BOTTOM
