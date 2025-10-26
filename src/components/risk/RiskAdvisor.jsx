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
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("risk");

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
  const tt = tones[tone] || tones.ok;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`p-0.5 rounded-2xl bg-gradient-to-br ${tt.from} ${tt.to} ${tt.ring}`}
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
              {tt.icon}
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
                  {t("advisor.impact")} :{" "}
                  <span className="font-semibold">{impact}%</span>
                </Pill>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} />
                <Pill>
                  {t("advisor.effort")} :{" "}
                  <span className="font-semibold">{effortH}h</span>
                </Pill>
              </div>
              <Meter label={t("advisor.confidence")} value={confidence} />
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButton
                icon={<Mail size={16} />}
                label={
                  copyState === "copied"
                    ? t("advisor.ctaEmailCopied")
                    : t("advisor.ctaEmail")
                }
                onClick={() => copy(email, setCopyState)}
              />
              <ActionButton
                icon={<Phone size={16} />}
                label={t("advisor.ctaCall")}
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
  const { t } = useTranslation("risk");

  const items = useMemo(() => {
    const alphaPct = Math.round((metrics.alpha || 0.95) * 100);
    const horizon = metrics.horizon || 60;

    const baseEmail = (subject, body) =>
      `${t("advisor.email.subjectPrefix")} ${subject}

${t("advisor.email.greeting")}

${body}

${t("advisor.email.closing")}`;

    const baseCall = (body) =>
      `${t("advisor.call.pitchHeader")}
- ${t("advisor.call.intro")}
- ${body}
- ${t("advisor.call.close")}`;

    const out = [];

    // 1) Runway tight / overdraft risk
    if (metrics.runwayP5 < 30 || metrics.probOverdraft > 0.2) {
      const prob = Math.round(metrics.probOverdraft * 100);
      out.push({
        tone: "warn",
        title: t("advisor.runway.title", {
          runwayP5: isFinite(metrics.runwayP5)
            ? Math.round(metrics.runwayP5)
            : "∞",
          prob,
        }),
        lines: [
          { k: t("advisor.pb"), v: t("advisor.runway.pbText", { horizon }) },
          { k: t("advisor.cause"), v: t("advisor.runway.causeText") },
          { k: t("advisor.solution"), v: t("advisor.runway.solutionText") },
          { k: t("advisor.roi"), v: t("advisor.runway.roiText") }
        ],
        impact: 90,
        effortH: 4,
        confidence: 80,
        email: baseEmail(
          t("advisor.runway.email.subject"),
          t("advisor.runway.email.body")
        ),
        callScript: baseCall(t("advisor.runway.call.body")),
      });
    }

    // 2) High CFaR / ES
    if (metrics.cfar > 0) {
      out.push({
        tone: "risk",
        title: t("advisor.cfar.title", {
          alphaPct,
          horizon,
          cfar: euro(metrics.cfar),
          es: euro(metrics.es)
        }),
        lines: [
          { k: t("advisor.pb"), v: t("advisor.cfar.pbText") },
          { k: t("advisor.cause"), v: t("advisor.cfar.causeText") },
          { k: t("advisor.solution"), v: t("advisor.cfar.solutionText") },
          {
            k: t("advisor.roi"),
            v: t("advisor.cfar.roiText", {
              cfar20: euro(metrics.cfar * 0.2),
              cfar40: euro(metrics.cfar * 0.4)
            })
          }
        ],
        impact: 75,
        effortH: 6,
        confidence: 72,
        email: baseEmail(
          t("advisor.cfar.email.subject"),
          t("advisor.cfar.email.body")
        ),
        callScript: baseCall(t("advisor.cfar.call.body")),
      });
    }

    // 3) Customer concentration
    if (metrics.hhi > 0.2) {
      out.push({
        tone: "warn",
        title: t("advisor.conc.title", { hhi: metrics.hhi.toFixed(2) }),
        lines: [
          { k: t("advisor.pb"), v: t("advisor.conc.pbText") },
          { k: t("advisor.cause"), v: t("advisor.conc.causeText") },
          { k: t("advisor.solution"), v: t("advisor.conc.solutionText") },
          { k: t("advisor.roi"), v: t("advisor.conc.roiText") }
        ],
        impact: 68,
        effortH: 8,
        confidence: 70,
        email: baseEmail(
          t("advisor.conc.email.subject"),
          t("advisor.conc.email.body")
        ),
        callScript: baseCall(t("advisor.conc.call.body")),
      });
    }

    // 4) Calm case
    if (!out.length) {
      out.push({
        tone: "ok",
        title: t("advisor.ok.title"),
        lines: [
          { k: t("advisor.pb"), v: t("advisor.ok.pbText") },
          { k: t("advisor.cause"), v: t("advisor.ok.causeText") },
          { k: t("advisor.solution"), v: t("advisor.ok.solutionText") },
          { k: t("advisor.roi"), v: t("advisor.ok.roiText") }
        ],
        impact: 50,
        effortH: 2,
        confidence: 85,
        email: baseEmail(
          t("advisor.ok.email.subject"),
          t("advisor.ok.email.body")
        ),
        callScript: baseCall(t("advisor.ok.call.body")),
      });
    }

    return out.slice(0, 3);
  }, [metrics, t]);

  return (
    <div className="space-y-4">
      {items.map((a, i) => (
        <AdviceBubble key={i} {...a} />
      ))}
    </div>
  );
}
