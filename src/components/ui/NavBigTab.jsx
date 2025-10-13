// src/components/ui/NavBigTab.jsx
import React, { forwardRef } from "react";

const cx = (...cls) => cls.filter(Boolean).join(" ");

const BASE =
  "inline-flex items-center gap-2 rounded-xl border text-[15px] " +
  "font-medium py-2 px-3.5 whitespace-nowrap transition-colors";

const ACTIVE =
  "bg-white text-gray-900 border-gray-300 shadow-sm ring-2 ring-indigo-500/30 " +
  "dark:bg-gray-800 dark:text-white dark:border-gray-700";

const INACTIVE =
  "bg-gray-100 text-gray-800 hover:bg-gray-200 border-transparent " +
  "dark:bg-gray-800/70 dark:text-gray-200 dark:hover:bg-gray-800/90";

const DISABLED = "opacity-60 pointer-events-none";

const NavBigTab = forwardRef(function NavBigTab(
  {
    as = "button",
    active = false,
    onClick,
    icon,
    children,
    badge, // nombre/texte optionnel à droite
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
      {icon && <span aria-hidden>{icon}</span>}
      <span>{children}</span>
      {badge != null && (
        <span className="ml-1 inline-flex items-center justify-center text-xs px-1.5 py-0.5 rounded-md bg-gray-200 dark:bg-gray-700">
          {badge}
        </span>
      )}
    </Comp>
  );
});

export default NavBigTab;
