// src/components/AIPill.jsx
import React, { forwardRef } from "react";
import { Sparkles } from "lucide-react";

const cx = (...cls) => cls.filter(Boolean).join(" ");

const VARIANTS = {
  gradient: "bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-sm",
  outline:
    "border border-indigo-500/40 text-indigo-700 dark:text-indigo-300 bg-white/70 dark:bg-gray-900/40",
  subtle:
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200",
};

const SIZES = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
};

const AIPill = forwardRef(function AIPill(
  {
    as = "span",
    className = "",
    label = "Propulsé par IA",
    variant = "gradient", // "gradient" | "outline" | "subtle"
    size = "md", // "sm" | "md" | "lg"
    icon: IconComp = Sparkles,
    ...props
  },
  ref
) {
  const Comp = as;
  const v = VARIANTS[variant] || VARIANTS.gradient;
  const s = SIZES[size] || SIZES.md;

  return (
    <Comp
      ref={ref}
      className={cx(
        "inline-flex items-center gap-1 rounded-full font-medium",
        v,
        s,
        className
      )}
      {...props}
    >
      {IconComp ? <IconComp className="w-3.5 h-3.5" aria-hidden /> : null}
      <span>{label}</span>
    </Comp>
  );
});

export default AIPill;
