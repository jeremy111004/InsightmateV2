// ANCHOR: FILE_TOP ScenarioPanel
import React from "react";
import { SlidersHorizontal, RefreshCw } from "lucide-react";

export default function ScenarioPanel({
  stress,
  setStress,
  params,
  setParams,
  onRun,
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
        <SlidersHorizontal size={16} />
        <span>Paramètres & Stress tests</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stress */}
        <div className="rounded-xl p-4 ring-1 ring-gray-200 dark:ring-gray-800 bg-white/60 dark:bg-gray-900/60">
          <ChipRange
            label="Ventes (Δ%)"
            min={-40}
            max={+40}
            step={1}
            value={stress.salesPct}
            onChange={(v) => setStress((s) => ({ ...s, salesPct: v }))}
          />
          <ChipRange
            label="Coûts (Δ%)"
            min={0}
            max={+40}
            step={1}
            value={stress.costPct}
            onChange={(v) => setStress((s) => ({ ...s, costPct: v }))}
          />
          <ChipRange
            label="DSO (+ jours)"
            min={0}
            max={30}
            step={1}
            value={stress.dsoDeltaDays}
            onChange={(v) => setStress((s) => ({ ...s, dsoDeltaDays: v }))}
          />
        </div>

        {/* Simulation */}
        <div className="rounded-xl p-4 ring-1 ring-gray-200 dark:ring-gray-800 bg-white/60 dark:bg-gray-900/60">
          <ChipRange
            label="Horizon (jours)"
            min={30}
            max={180}
            step={5}
            value={params.horizon}
            onChange={(v) => setParams((p) => ({ ...p, horizon: v }))}
          />
          <ChipRange
            label="Alpha (VaR/ES)"
            min={90}
            max={99}
            step={1}
            value={Math.round((params.alpha || 0.95) * 100)}
            onChange={(v) => setParams((p) => ({ ...p, alpha: v / 100 }))}
          />
          <ChipRange
            label="Simulations"
            min={1000}
            max={8000}
            step={500}
            value={params.nSim}
            onChange={(v) => setParams((p) => ({ ...p, nSim: v }))}
          />
        </div>
      </div>

      <button
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:opacity-90"
        onClick={() => onRun?.()}
      >
        <RefreshCw size={16} />
        Recalculer
      </button>
    </div>
  );
}

function ChipRange({ label, min, max, step, value, onChange }) {
  return (
    <label className="block mb-4">
      <div className="flex justify-between mb-1">
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {label}
        </span>
        <span className="px-2 py-0.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 tabular-nums">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange?.(Number(e.target.value))}
        className="w-full accent-gray-900 dark:accent-white"
      />
    </label>
  );
}
