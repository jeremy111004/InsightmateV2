// src/components/ui/RangeChips.jsx
import React, { forwardRef, useCallback } from "react";

const cx = (...cls) => cls.filter(Boolean).join(" ");

const SIZE = {
  sm: "text-[11px] px-2 py-0.5",
  md: "text-xs px-2.5 py-1",
  lg: "text-sm px-3 py-1.5",
};

const BASE =
  "rounded-full border transition select-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 " +
  "bg-white/60 dark:bg-gray-900/60 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-800 " +
  "hover:bg-white dark:hover:bg-gray-900";

const ACTIVE = "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-600";

const DISABLED = "opacity-60 pointer-events-none";

/**
 * RangeChips
 * Props:
 * - value: number | string (valeur active)
 * - onChange: (v) => void
 * - options: [{ v: number|string, label: string }]
 * - size: "sm" | "md" | "lg"
 * - disabled: boolean
 * - className: string
 */
const RangeChips = forwardRef(function RangeChips(
  {
    value,
    onChange,
    options = [
      { v: 7, label: "7j" },
      { v: 30, label: "30j" },
      { v: 90, label: "90j" },
    ],
    size = "md",
    disabled = false,
    className = "",
    ...props
  },
  ref
) {
  const idx = Math.max(
    0,
    options.findIndex((o) => String(o.v) === String(value))
  );

  const onKeyDown = useCallback(
    (e) => {
      if (disabled || !options.length) return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const next = (idx + dir + options.length) % options.length;
        onChange?.(options[next].v);
      }
    },
    [disabled, idx, options, onChange]
  );

  return (
    <div
      ref={ref}
      className={cx("inline-flex items-center gap-1.5", className)}
      role="tablist"
      aria-label="Plage temporelle"
      onKeyDown={onKeyDown}
      {...props}
    >
      {options.map((o) => {
        const active = String(o.v) === String(value);
        return (
          <button
            key={String(o.v)}
            type="button"
            onClick={() => !disabled && onChange?.(o.v)}
            className={cx(
              "px-0 py-0 inline-flex items-center justify-center",
              SIZE[size] || SIZE.md,
              BASE,
              active && ACTIVE,
              disabled && DISABLED
            )}
            aria-pressed={active || undefined}
            aria-current={active ? "true" : undefined}
            aria-disabled={disabled || undefined}
            role="tab"
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
});

export default RangeChips;
