// src/components/ui/Stat.jsx
import React from "react";
import { motion } from "framer-motion";

const cx = (...cls) => cls.filter(Boolean).join(" ");

export default function Stat({
  label,
  value,
  note,
  className = "",
  prefix, // ex: "€"
  suffix, // ex: "%"
  trend, // "up" | "down" | null
  trendLabel, // ex: "+12% vs LW"
}) {
  const trendCls =
    trend === "up"
      ? "text-green-600 dark:text-green-400"
      : trend === "down"
      ? "text-red-600 dark:text-red-400"
      : "text-gray-500 dark:text-gray-400";

  return (
    <div className={cx("flex flex-col", className)}>
      {label && (
        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </div>
      )}

      <div className="relative inline-block">
        <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {prefix ? <span className="opacity-70 mr-0.5">{prefix}</span> : null}
          {value}
          {suffix ? <span className="opacity-70 ml-0.5">{suffix}</span> : null}
        </div>

        {/* Shimmer une seule fois à l’apparition */}
        <motion.span
          initial={{ x: "-120%", opacity: 0 }}
          whileInView={{ x: "120%", opacity: 1 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -inset-x-2 rounded-lg"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
          }}
        />
      </div>

      <div className="flex items-center gap-2 mt-0.5">
        {trend && (
          <span className={cx("text-xs font-medium", trendCls)}>
            {trend === "up" ? "▲" : "▼"}
          </span>
        )}
        {note && <div className="text-xs text-gray-400">{note}</div>}
        {trendLabel && !note && (
          <div className={cx("text-xs", trendCls)}>{trendLabel}</div>
        )}
      </div>
    </div>
  );
}
