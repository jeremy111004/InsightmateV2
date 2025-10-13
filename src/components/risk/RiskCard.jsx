// ANCHOR: FILE_TOP RiskCard
import React from "react";

export default function RiskCard({
  title,
  subtitle,
  right,
  icon = null,
  tone = "neutral",
  className = "",
  children,
}) {
  const tones = {
    neutral: "bg-white dark:bg-gray-900 ring-gray-200 dark:ring-gray-800",
    brand:
      "bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-900 ring-sky-200/70 dark:ring-sky-900/40",
    mint: "bg-gradient-to-b from-emerald-50 to-white dark:from-gray-900 dark:to-gray-900 ring-emerald-200/70 dark:ring-emerald-900/40",
  };

  return (
    <div
      className={`rounded-2xl shadow-sm ring-1 p-5 ${
        tones[tone] || tones.neutral
      } ${className}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {icon ? (
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-white/70 dark:bg-gray-800/60 ring-1 ring-black/5">
              {icon}
            </div>
          ) : null}
          <div>
            <h3 className="text-lg font-semibold leading-tight">{title}</h3>
            {subtitle && (
              <p className="text-sm text-gray-500 leading-tight">{subtitle}</p>
            )}
          </div>
        </div>
        {right}
      </div>
      <div>{children}</div>
    </div>
  );
}
