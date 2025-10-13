// src/components/ui/Button.jsx
import React, { forwardRef } from "react";
import { motion } from "framer-motion";

// util local pour concaténer des classes
const cx = (...cls) => cls.filter(Boolean).join(" ");

const SIZES = {
  sm: "px-3.5 py-1.5 text-sm",
  md: "px-5 py-2.5 text-base",
  lg: "px-6 py-3 text-lg",
};

const VARIANTS = {
  solid:
    "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-400 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus:ring-indigo-300",
  subtle:
    "bg-gray-100 text-gray-900 hover:bg-gray-200 ring-1 ring-gray-300 focus:ring-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:ring-gray-700 dark:focus:ring-gray-600",
  ghost:
    "text-gray-700 hover:bg-gray-100 focus:ring-gray-300 dark:text-gray-300 dark:hover:bg-gray-800 dark:focus:ring-gray-600",
};

const BASE =
  "inline-flex items-center gap-2 rounded-2xl font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ring-offset-white dark:ring-offset-gray-950 disabled:opacity-60 transition-colors";

// Petit spinner minimaliste en CSS utilitaire
function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

/**
 * Button
 * Props:
 * - as: "button" | "a" | React.ElementType (par défaut "button")
 * - variant: "solid" | "subtle" | "ghost"
 * - size: "sm" | "md" | "lg"
 * - icon: ReactNode (icône)
 * - iconPosition: "left" | "right"
 * - loading: boolean
 * - disabled: boolean
 */
const Button = forwardRef(function Button(
  {
    as = "button",
    className = "",
    variant = "solid",
    size = "md",
    icon,
    iconPosition = "left",
    loading = false,
    disabled = false,
    children,
    ...props
  },
  ref
) {
  const Comp = as;
  const sizeCls = SIZES[size] || SIZES.md;
  const variantCls = VARIANTS[variant] || VARIANTS.solid;
  const isDisabled = disabled || loading;

  // Évite les submits involontaires si c'est un <button>
  const typeProp =
    typeof Comp === "string" && Comp === "button" ? { type: "button" } : {};

  // Accessibilité
  const a11y = {
    "aria-busy": loading ? true : undefined,
    "aria-disabled": isDisabled ? true : undefined,
  };

  const content = (
    <>
      {loading && <Spinner />}
      {!loading && icon && iconPosition === "left" ? <span>{icon}</span> : null}
      <span>{children}</span>
      {!loading && icon && iconPosition === "right" ? (
        <span>{icon}</span>
      ) : null}
    </>
  );

  return (
    <motion.div
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      className="inline-block"
    >
      <Comp
        ref={ref}
        className={cx(BASE, sizeCls, variantCls, className)}
        {...typeProp}
        {...a11y}
        disabled={
          typeof Comp === "string" && Comp === "button" ? isDisabled : undefined
        }
        // Si as="a", laisse la prop disabled de côté, c'est aria-disabled qui compte
        {...props}
      >
        {content}
      </Comp>
    </motion.div>
  );
});

export default Button;
