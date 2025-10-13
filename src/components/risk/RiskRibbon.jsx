// ANCHOR: FILE_TOP RiskRibbon
import React from "react";

function Chip({ label, value, tone = "ok" }) {
  const tones = {
    ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    warn: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    bad: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    info: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  };
  return (
    <span
      className={`px-3 py-1 rounded-xl text-sm font-medium ${
        tones[tone] || tones.info
      } mr-2`}
    >
      <span className="opacity-70 mr-1">{label}</span>
      {value}
    </span>
  );
}

export default function RiskRibbon({ runwayP5, probOverdraft, hhi }) {
  const runwayTone = !isFinite(runwayP5)
    ? "ok"
    : runwayP5 >= 60
    ? "ok"
    : runwayP5 >= 30
    ? "warn"
    : "bad";
  const probTone =
    probOverdraft <= 0.1 ? "ok" : probOverdraft <= 0.3 ? "warn" : "bad";
  const hhiTone = hhi <= 0.12 ? "ok" : hhi <= 0.2 ? "warn" : "bad";

  return (
    <div className="flex flex-wrap gap-2">
      <Chip
        label="Runway P5"
        value={isFinite(runwayP5) ? `${Math.round(runwayP5)} j` : "∞"}
        tone={runwayTone}
      />
      <Chip
        label="Prob(Overdraft)"
        value={`${Math.round(probOverdraft * 100)}%`}
        tone={probTone}
      />
      <Chip label="HHI Clients" value={hhi.toFixed(2)} tone={hhiTone} />
    </div>
  );
}
