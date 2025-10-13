// src/components/ui/Pill.jsx
import React, { forwardRef } from "react";

const cx = (...cls) => cls.filter(Boolean).join(" ");

const VARIANTS = {
  gray: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  green: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  indigo:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
};

const SIZES = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
};

const Pill = forwardRef(function Pill(
  {
    as = "span",
    className = "",
    variant = "gray",
    size = "md",
    icon, // ReactNode optionnel
    iconPosition = "left",
    children,
    ...props
  },
  ref
) {
  const Comp = as;
  const v = VARIANTS[variant] || VARIANTS.gray;
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
      {icon && iconPosition === "left" && (
        <span className="inline-flex items-center" aria-hidden>
          {icon}
        </span>
      )}
      <span>{children}</span>
      {icon && iconPosition === "right" && (
        <span className="inline-flex items-center" aria-hidden>
          {icon}
        </span>
      )}
    </Comp>
  );
});

export default Pill;
