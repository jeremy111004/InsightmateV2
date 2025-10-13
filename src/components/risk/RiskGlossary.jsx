// ANCHOR: FILE_TOP RiskGlossary
import React from "react";

function Row({ t, d }) {
  return (
    <div className="flex gap-4 py-2">
      <div className="w-48 font-semibold">{t}</div>
      <div className="flex-1 text-gray-600 dark:text-gray-300">{d}</div>
    </div>
  );
}

export default function RiskGlossary() {
  return (
    <div className="rounded-2xl ring-1 ring-gray-200 dark:ring-gray-800 p-5 bg-white dark:bg-gray-900">
      <h3 className="text-lg font-semibold mb-2">Comment c’est calculé ?</h3>
      <div className="text-sm">
        <Row
          t="Incréments de cash"
          d="Série journalière du cash net ≈ marge sur ventes + encaissements (payments) + flux bancaires."
        />
        <Row
          t="Modèle"
          d="AR(1) sur les incréments (μ, φ, σ estimés) → 3 000–8 000 trajectoires simulées sur 30–180 jours."
        />
        <Row
          t="Fan-chart"
          d="Les courbes représentent les quantiles p5, p50 (médiane), p95 des trajectoires simulées."
        />
        <Row
          t="CFaR / ES"
          d="Cash-flow-at-Risk et Expected Shortfall au quantile α : pertes potentielles sur ΔCash à l’horizon."
        />
        <Row
          t="Prob(Overdraft)"
          d="Part des trajectoires qui passent sous 0€ au moins une fois avant l’horizon."
        />
        <Row
          t="Runway P5"
          d="Quantile 5% du nombre de jours avant 0€ (si aucune trajectoire ne passe sous 0 → ∞)."
        />
        <Row
          t="HHI Clients"
          d="Indice de concentration calculé sur les parts de CA par client (0=très diversifié, >0.2=élevé)."
        />
        <Row
          t="Stress tests"
          d="Δ% ventes (scaling), Δ% coûts (réduit la marge), + jours DSO (retarde les encaissements)."
        />
      </div>
    </div>
  );
}
