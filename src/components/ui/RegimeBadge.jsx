// src/components/RegimeBadge.jsx
import React from "react";

export default function RegimeBadge({ regime }) {
  const map = {
    HIGH: "bg-emerald-100 text-emerald-700 border-emerald-300",
    MID: "bg-amber-100 text-amber-700 border-amber-300",
    LOW: "bg-rose-100 text-rose-700 border-rose-300",
  };
  const label =
    { HIGH: "Demande forte", MID: "Normale", LOW: "Faible" }[regime] || "—";
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-semibold border ${
        map[regime] || "bg-gray-100 text-gray-600 border-gray-300"
      }`}
    >
      {label}
    </span>
  );
}
