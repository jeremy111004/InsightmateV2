// ANCHOR: FILE_TOP RiskAdvisor (WOW)
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bot,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Mail,
  Phone,
  Clock,
  ClipboardCopy,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";

function euro(x) {
  const v = Math.round(x || 0);
  return `${v.toLocaleString()}€`;
}

// ---------- UI atoms
function Pill({ children }) {
  return (
    <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/70 dark:bg-gray-900/60 ring-1 ring-black/5">
      {children}
    </span>
  );
}

function Meter({ label, value }) {
  return (
    <div className="text-xs">
      <div className="flex justify-between">
        <span className="text-gray-500">{label}</span>
        <span className="font-medium">{value}%</span>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
        <div
          className="h-2 rounded-full"
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            background: "linear-gradient(90deg, #10b981, #34d399, #a7f3d0)",
          }}
        />
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:opacity-90"
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}

function copy(text, setState) {
  try {
    navigator?.clipboard?.writeText(text).then(() => setState("copied"));
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    setState("copied");
  }
  setTimeout(() => setState(null), 1600);
}

// ---------- Advice bubble
function AdviceBubble({
  tone = "ok",
  title,
  lines,
  impact = 80,
  effortH = 3,
  confidence = 75,
  email,
  callScript,
}) {
  const [copyState, setCopyState] = useState(null);
  const tones = {
    ok: {
      ring: "ring-emerald-300/60",
      from: "from-emerald-50",
      to: "to-white",
      icon: <CheckCircle2 size={16} />,
    },
    warn: {
      ring: "ring-amber-300/60",
      from: "from-amber-50",
      to: "to-white",
      icon: <AlertTriangle size={16} />,
    },
    risk: {
      ring: "ring-rose-300/60",
      from: "from-rose-50",
      to: "to-white",
      icon: <TrendingUp size={16} />,
    },
  };
  const t = tones[tone] || tones.ok;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`p-0.5 rounded-2xl bg-gradient-to-br ${t.from} ${t.to} ${t.ring}`}
      style={{
        boxShadow: "0 1px 0 rgba(16,24,40,.02), 0 1px 2px rgba(16,24,40,.06)",
      }}
    >
      <div className="rounded-2xl bg-white/70 dark:bg-gray-900/60 p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl ring-1 ring-black/10 bg-white dark:bg-gray-800 flex items-center justify-center">
            <Bot size={18} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              {t.icon}
              <span className="font-semibold">{title}</span>
            </div>

            <div className="mt-2 space-y-1 text-sm">
              {lines.map((l, i) => (
                <p key={i}>
                  <span className="font-semibold">{l.k}</span> {l.v}
                </p>
              ))}
            </div>

            {/* KPIs */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} />
                <Pill>
                  Impact estimé :{" "}
                  <span className="font-semibold">{impact}%</span>
                </Pill>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} />
                <Pill>
                  Effort : <span className="font-semibold">{effortH}h</span>
                </Pill>
              </div>
              <Meter label="Confiance" value={confidence} />
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButton
                icon={<Mail size={16} />}
                label={
                  copyState === "copied"
                    ? "Email copié !"
                    : "Copier email de relance"
                }
                onClick={() => copy(email, setCopyState)}
              />
              <ActionButton
                icon={<Phone size={16} />}
                label="Script d’appel"
                onClick={() => copy(callScript, setCopyState)}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------- Main component
export default function RiskAdvisor({ metrics }) {
  const items = useMemo(() => {
    const alphaPct = Math.round((metrics.alpha || 0.95) * 100);
    const horizon = metrics.horizon || 60;

    const baseEmail = (subject, body) =>
      `Objet : ${subject}

Bonjour,

Je vous propose une mise au point rapide sur nos conditions de paiement afin d'accélérer les règlements. 
${body}

Merci d’avance — cela nous permet d'assurer la continuité de service et des délais courts.

Bien cordialement,`;

    const baseCall = (body) =>
      `Pitch appel (90s):
- Intro: je vous appelle pour fluidifier nos délais de paiement et vous proposer une option simple.
- ${body}
- Clôture: je vous envoie l'email de confirmation maintenant, ok ?`;

    const out = [];

    // 1) Risque d'OD / runway tendu
    if (metrics.runwayP5 < 30 || metrics.probOverdraft > 0.2) {
      const prob = Math.round(metrics.probOverdraft * 100);
      out.push({
        tone: "warn",
        title: `Runway tendu (P5 ${
          isFinite(metrics.runwayP5) ? Math.round(metrics.runwayP5) : "∞"
        } j) — Prob(OD) ${prob}%`,
        lines: [
          { k: "PB:", v: `Trésorerie fragile sur ${horizon}j.` },
          {
            k: "Cause:",
            v: "Encaissements tardifs (DSO) + marge nette comprimée.",
          },
          {
            k: "Solution:",
            v: "Escompte -1% aux 5 plus gros clients pour paiement <15j + relances J+3/J+10.",
          },
          { k: "ROI:", v: "Runway +15–25 j, Prob(OD) -5 à -12 pts." },
        ],
        impact: 90,
        effortH: 4,
        confidence: 80,
        email: baseEmail(
          "Option d’escompte pour règlement anticipé",
          "Nous proposons une remise de 1% pour tout règlement sous 15 jours sur les prochaines factures. Cela vous garantit une continuité d’approvisionnement et un traitement prioritaire."
        ),
        callScript: baseCall(
          "Proposition d’escompte 1% pour règlement <15j + plan de relances cadré (J+3/J+10)."
        ),
      });
    }

    // 2) CFaR/ES élevés
    if (metrics.cfar > 0) {
      out.push({
        tone: "risk",
        title: `Cash à risque${alphaPct} à ${horizon}j = ${euro(
          metrics.cfar
        )} • ES = ${euro(metrics.es)}`,
        lines: [
          {
            k: "PB:",
            v: "Perte potentielle significative sur le cash à l’horizon.",
          },
          {
            k: "Cause:",
            v: "Volatilité des flux + marge en baisse sur SKUs non KVI.",
          },
          {
            k: "Solution:",
            v: "Hausse ciblée +3–4% sur non-KVI + pack 'éco' à marge stable.",
          },
          {
            k: "ROI:",
            v: `Réduction CFaR attendue 20–40% (~${euro(
              metrics.cfar * 0.2
            )}–${euro(metrics.cfar * 0.4)}).`,
          },
        ],
        impact: 75,
        effortH: 6,
        confidence: 72,
        email: baseEmail(
          "Mise à jour tarifaire ciblée (qualité de service inchangée)",
          "Nous ajustons de 3–4% les prix des références non KVI, tout en introduisant un pack 'éco' à marge stable. Votre offre et nos délais restent inchangés."
        ),
        callScript: baseCall(
          "Annoncer hausse ciblée (3–4%) sur non-KVI + alternative 'éco'."
        ),
      });
    }

    // 3) Concentration clients
    if (metrics.hhi > 0.2) {
      out.push({
        tone: "warn",
        title: `Concentration élevée — HHI ${metrics.hhi.toFixed(2)}`,
        lines: [
          { k: "PB:", v: "Dépendance à quelques comptes clés." },
          { k: "Cause:", v: "Part de CA concentrée (>0.2 HHI)." },
          {
            k: "Solution:",
            v: "Campagne canal direct (code -5%) ciblant 50 acheteurs récurrents.",
          },
          { k: "ROI:", v: "CA direct +8–15% / 60j, HHI → 0.15–0.18." },
        ],
        impact: 68,
        effortH: 8,
        confidence: 70,
        email: baseEmail(
          "Offre canal direct -5% (accès prioritaire)",
          "Nous lançons un code -5% sur le canal direct pour vos achats récurrents. Objectif : délai court, priorisation logistique et relation directe."
        ),
        callScript: baseCall(
          "Présenter le code -5% canal direct à la cible de 50 acheteurs récurrents."
        ),
      });
    }

    // 4) Cas serein
    if (!out.length) {
      out.push({
        tone: "ok",
        title: "Profil de risque maîtrisé",
        lines: [
          { k: "PB:", v: "Rien d’urgent — profil sain." },
          {
            k: "Cause:",
            v: "Runway confortable, faible Prob(OD), concentration modérée.",
          },
          {
            k: "Solution:",
            v: "Mettre en place alertes hebdo + backtesting exceptions VaR.",
          },
          { k: "ROI:", v: "Préservation marge et temps de pilotage." },
        ],
        impact: 50,
        effortH: 2,
        confidence: 85,
        email: baseEmail(
          "Confirmation rituels de pilotage hebdo",
          "Nous mettons en place une synthèse risque hebdomadaire et un suivi des exceptions VaR pour sécuriser la trajectoire."
        ),
        callScript: baseCall(
          "Valider avec le dirigeant un rituel hebdo + seuils d’alerte."
        ),
      });
    }

    return out.slice(0, 3);
  }, [metrics]);

  return (
    <div className="space-y-4">
      {items.map((a, i) => (
        <AdviceBubble key={i} {...a} />
      ))}
    </div>
  );
}
