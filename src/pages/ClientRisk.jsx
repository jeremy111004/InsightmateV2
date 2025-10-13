import React from "react";
import { motion } from "framer-motion";
import {
  Mail,
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
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "\\n");
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
function buildPie(totalOutstanding, weightedRecovery) {
  const recovered = Math.max(0, Number(weightedRecovery) || 0);
  const unrecovered = Math.max(0, (Number(totalOutstanding) || 0) - recovered);
  return [
    { name: "Potentiel récupérable", value: recovered },
    { name: "Exposition restante", value: unrecovered },
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
    () => buildPie(totalOutstanding, weightedRecovery),
    [totalOutstanding, weightedRecovery]
  );

  return (
    <motion.div variants={staggerParent} initial="initial" animate="animate">
      <TechHeader />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Exposition totale"
          value={eur(totalOutstanding)}
          caption="Montant total en attente"
          Icon={BarChart2}
        />
        <StatCard
          title="Potentiel recouvrement"
          value={eur(weightedRecovery)}
          caption="Estimation pondérée"
          Icon={PieIcon}
        />
        <StatCard
          title="Clients à risque"
          value={highRiskCount}
          caption=">60j ou faible prob."
          Icon={AlertTriangle}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          variants={pop}
          className="bg-white/5 p-4 rounded-2xl ring-1 ring-white/10"
        >
          <h3 className="text-sm font-semibold mb-2">
            Répartition du potentiel
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
            Top 5 — potentiel par client
          </h3>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={top5Data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip formatter={(v) => eur(v)} />
                <Bar dataKey="_recovery" name="Potentiel" />
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
          Historique — exposition simulée
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
function buildMailto(c) {
  const subject = `Relance facture — ${safeStr(c.name, "Client")} (${safeStr(
    c.id
  )})`;
  const body = [
    `Bonjour ${safeStr(c.name, "Madame, Monsieur")},`,
    "",
    `Nous revenons vers vous concernant un impayé de ${eur(
      c.outstanding
    )} (facture ${safeStr(c.id)}).`,
    `Ancienneté: ${Number(c.overdue) || 0} jours.`,
    "",
    `Nous pouvons convenir d'un échéancier si nécessaire.`,
    "Merci de nous répondre sous 7 jours.",
    "",
    "Cordialement,",
    "L’équipe Finance",
  ].join("\n");
  const to = encodeURIComponent(safeStr(c.email, ""));
  return `mailto:${to}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}

function PriorityList({ clients, query, onQuery }) {
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

  function previewEmails() {
    const lines = filtered
      .slice(0, 50)
      .map(
        (c) =>
          `To: ${c.email || "(manquant)"} — ${c.name} — Est. ${eur(
            c._recovery
          )}`
      );
    const example = filtered[0] || { name: "Client", outstanding: 0 };
    const subject = `Relance facture — ${example.name}`;
    const body = [
      `Bonjour ${example.name},`,
      "",
      `Nous revenons vers vous concernant un impayé de ${eur(
        example.outstanding
      )}.`,
      "Nous pouvons convenir d'un échéancier si besoin.",
      "Merci de nous répondre sous 7 jours.",
      "",
      "Cordialement,",
      "L'équipe Finance",
    ].join("\n");
    const w = window.open("", "_blank", "width=720,height=680");
    if (!w) return alert("Autorisez les pop-ups pour prévisualiser.");
    w.document.body.style.fontFamily =
      'Inter, ui-sans-serif, system-ui, "Helvetica Neue"';
    w.document.title = "Prévisualisation emails — InsightMate";
    w.document.body.innerHTML = `
      <div style="padding:18px;">
        <h2>Prévisualisation des emails</h2>
        <p style="color:#667085">Destinataires (max 50 — filtre appliqué)</p>
        <pre style="background:#0f1724;padding:12px;border-radius:8px;color:#e6eef8">${escapeHtml(
          lines.join("\n")
        )}</pre>
        <p style="color:#667085;margin-top:12px">Template</p>
        <pre style="background:#0f1724;padding:12px;border-radius:8px;color:#e6eef8">${escapeHtml(
          `Subject: ${subject}\n\n${body}`
        )}</pre>
      </div>`;
  }

  function exportPotential() {
    csvDownload(
      "clients_priorites.csv",
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
            Priorités de relance{" "}
            <ArrowUpRight size={16} className="opacity-70" />
          </h3>
          <div className="text-xs text-slate-400">
            Tri par score (montant, retard, prob. récup). Clients:{" "}
            <b>{kpis.count}</b> • Dû total: <b>{eur(kpis.totalDue)}</b> •
            Potentiel: <b>{eur(kpis.totalRec)}</b>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Rechercher client/ID/email"
            className="px-3 py-2 rounded-xl bg-white/10 ring-1 ring-white/15 text-sm"
          />
          <button
            onClick={previewEmails}
            className="px-3 py-2 rounded-xl bg-emerald-600/90 text-white hover:opacity-95 text-sm flex items-center gap-2"
          >
            <Mail size={16} /> Prévisualiser
          </button>
          <button
            onClick={exportPotential}
            className="px-3 py-2 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 text-sm flex items-center gap-2"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Headers desktop */}
      <div className="hidden md:grid grid-cols-12 px-2 py-2 text-xs text-slate-400">
        <div className="col-span-5">Client</div>
        <div className="col-span-2">Retard (j)</div>
        <div className="col-span-2">Dû</div>
        <div className="col-span-2">Potentiel</div>
        <div className="col-span-1 text-right">Action</div>
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
                {c.email || "(email manquant)"}{" "}
                {(!c.email || !String(c.email).includes("@")) && (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <AlertTriangle size={12} /> email à compléter
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Score priorité: <b>{c._priority.toLocaleString("fr-FR")}</b> —
                Prob. récup:{" "}
                {(clamp01(c.probability_recovery) * 100).toFixed(0)}%
              </div>
            </div>
            <div className="col-span-2 text-sm">{Number(c.overdue) || 0}</div>
            <div className="col-span-2 text-sm">{eur(c.outstanding)}</div>
            <div className="col-span-2 text-sm">{eur(c._recovery)}</div>
            <div className="col-span-1 flex justify-end">
              <a
                href={buildMailto(c)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600/90 text-white hover:opacity-95"
              >
                <Mail size={14} /> Relancer
              </a>
            </div>
          </motion.div>
        ))}
        {!filtered.length && (
          <div className="text-xs text-slate-400 px-2 py-3">
            Aucun client ne correspond au filtre.
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
    setStatus({ state: "parsing", msg: "Parsing du CSV…" });
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (res) => {
        try {
          const data = Array.isArray(res.data) ? res.data : [];
          const rows = normalizeRows(data);
          if (!rows.length) {
            setStatus({
              state: "error",
              msg: "Aucune ligne valide trouvée (vérifie les colonnes).",
            });
            return;
          }
          onRows(rows); // <<< ÉCRASE le dataset courant
          setStatus({
            state: "ok",
            msg: `Import réussi — ${rows.length} lignes`,
          });
        } catch (e) {
          setStatus({ state: "error", msg: "Erreur lors du mapping du CSV." });
        }
      },
      error: () => setStatus({ state: "error", msg: "Erreur de parsing CSV." }),
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
    csvDownload("modele_clients_risque.csv", template);
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
            <Upload size={16} /> Ajoute ton CSV
          </h3>
          <p className="text-xs text-slate-300 mt-1">
            Colonnes supportées : <code>id</code>, <code>name</code>,{" "}
            <code>email</code>, <code>outstanding</code>, <code>overdue</code>,{" "}
            <code>probability_recovery</code> (0–1).
          </p>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <Info size={14} /> Minimum requis : <code>id</code>,{" "}
            <code>name</code>, <code>outstanding</code>. Idéal : ajouter{" "}
            <code>email</code> + <code>overdue</code>.
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
            <Download size={14} /> Modèle
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="px-3 py-2 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 text-sm"
          >
            Choisir un fichier
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
        Astuce : glisse-dépose ton fichier CSV ici.
      </div>
    </motion.div>
  );
}

/* =========================
   Liste clients (vue complémentaire)
========================= */
function ClientsList({ clients, query, onQuery }) {
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
        <h3 className="text-sm font-semibold">Clients signalés</h3>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-400">
            {filtered.length} trouvés
          </div>
          <button
            onClick={() => csvDownload("clients_list.csv", filtered)}
            className="px-3 py-2 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 text-sm flex items-center gap-2"
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className="mb-3">
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Rechercher client/ID/email"
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
                {c.email || "(email manquant)"} • {Number(c.overdue) || 0}j
                retard
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">{eur(c.outstanding)}</div>
              <div className="text-xs text-slate-400">
                Potentiel {eur(recoveryEstimate(c))}
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
    ? `CSV importé (${uploaded.length} lignes)`
    : "Démo / LocalStorage";
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
            <h1 className="text-2xl font-bold">
              Trésorerie — Clients à risque
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              KPIs + charts, liste priorisée (emails cliquables) & import CSV —
              rendu pro, tech & animé.
            </p>
            <div
              className={`mt-2 text-xs inline-flex items-center gap-2 ${sourceTone}`}
            >
              <FileSpreadsheet size={14} /> Source des données :{" "}
              <b>{sourceLabel}</b>
              {uploaded?.length ? (
                <button
                  onClick={resetDataset}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 ring-1 ring-white/15 hover:bg-white/15 ml-2"
                >
                  <RefreshCw size={12} /> Réinitialiser
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
