// src/components/ui/NavPill.jsx
import React, { forwardRef } from "react";

const cx = (...cls) => cls.filter(Boolean).join(" ");

const BASE =
  "group relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-all";
const ACTIVE =
  "bg-gray-900 text-white shadow ring-1 ring-black/10 dark:bg-gray-100 dark:text-gray-900";
const INACTIVE =
  "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800";
const DISABLED = "opacity-60 pointer-events-none";

const NavPill = forwardRef(function NavPill(
  {
    as = "button",
    active = false,
    icon, // ReactNode OR component (e.g., Home)
    label,
    onClick,
    className = "",
    disabled = false,
    ...props
  },
  ref
) {
  const Comp = as;
  const typeProp =
    typeof Comp === "string" && Comp === "button" ? { type: "button" } : {};
  const roleProp =
    typeof Comp === "string" && Comp !== "button" ? { role: "button" } : {};

  // Render icon both for component and node usage
  let IconEl = null;
  if (icon) {
    if (typeof icon === "function") {
      const IconComp = icon;
      IconEl = (
        <IconComp
          className="h-4 w-4 opacity-80 group-hover:opacity-100"
          aria-hidden
        />
      );
    } else {
      IconEl = (
        <span
          className="h-4 w-4 opacity-80 group-hover:opacity-100"
          aria-hidden
        >
          {icon}
        </span>
      );
    }
  }

  return (
    <Comp
      ref={ref}
      onClick={onClick}
      className={cx(
        BASE,
        active ? ACTIVE : INACTIVE,
        disabled && DISABLED,
        className
      )}
      aria-pressed={active || undefined}
      aria-current={active ? "page" : undefined}
      aria-disabled={disabled || undefined}
      {...typeProp}
      {...roleProp}
      {...props}
    >
      {IconEl}
      {label && <span className="font-medium">{label}</span>}
      {active && (
        <span
          className="absolute inset-0 rounded-xl ring-2 ring-indigo-500/70 -z-10"
          aria-hidden
        />
      )}
    </Comp>
  );
});

export default NavPill;
