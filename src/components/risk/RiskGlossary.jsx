// src/components/risk/RiskGlossary.jsx
import React from "react";
import { useTranslation } from "react-i18next";

export default function RiskGlossary() {
  const { t } = useTranslation("risk");

  const rows = [
    ["increments", "increments"],
    ["model", "model"],
    ["fan", "fan"],
    ["cfar", "cfar"],
    ["prob", "prob"],
    ["runway", "runway"],
    ["hhi", "hhi"],
    ["stress", "stress"],
  ];

  return (
    <div className="rounded-2xl border p-5 bg-white/70 dark:bg-white/5">
      <h3 className="text-lg font-semibold mb-3">{t("glossary.title")}</h3>
      <dl className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
        {rows.map(([key]) => (
          <div key={key} className="grid grid-cols-[180px,1fr] gap-3">
            <dt className="font-semibold">
              {t(`glossary.items.${key}.label`)}
            </dt>
            <dd className="text-gray-600 dark:text-gray-300">
              {t(`glossary.items.${key}.text`)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
