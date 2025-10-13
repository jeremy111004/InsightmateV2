// ANCHOR: FILE_TOP Stat
import React from "react";

export default function Stat({ label, value, sub }) {
  return (
    <div className="rounded-2xl ring-1 ring-gray-200 dark:ring-gray-800 bg-white dark:bg-gray-900 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-2xl md:text-3xl font-bold tabular-nums">
        {value}
      </div>
      {sub ? <div className="text-sm text-gray-500 mt-1">{sub}</div> : null}
    </div>
  );
}
