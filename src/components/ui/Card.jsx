// src/components/ui/Card.jsx
import React, { forwardRef } from "react";
import { motion } from "framer-motion";

// util local pour concaténer des classes
const cx = (...cls) => cls.filter(Boolean).join(" ");

const PADDINGS = {
  sm: "p-3",
  md: "p-5",
  lg: "p-7",
};

/**
 * Card
 * Props:
 * - as: "div" | "section" | React.ElementType (par défaut "div")
 * - className: classes additionnelles
 * - hover: bool (animation hover légère) — défaut: true
 * - padding: "sm" | "md" | "lg" — défaut: "md"
 * - elevated: bool (ombre plus marquée)
 * - title, subtitle, actions: en-tête optionnel
 */
const Card = forwardRef(function Card(
  {
    as = "div",
    className = "",
    hover = true,
    padding = "md",
    elevated = false,
    title,
    subtitle,
    actions,
    children,
    ...props
  },
  ref
) {
  const Comp = as;

  const base =
    "group relative rounded-2xl border border-gray-200/70 bg-white/70 " +
    "dark:bg-gray-900/60 dark:border-gray-800 backdrop-blur " +
    "transition-colors shadow-sm";

  const hoverAnim = hover ? { y: -2 } : undefined;

  const paddingCls = PADDINGS[padding] || PADDINGS.md;
  const elevationCls = elevated ? "shadow-md" : "shadow-sm";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.35 }}
      whileHover={hoverAnim}
      className={cx(base, elevationCls, paddingCls, className)}
    >
      {/* glow subtil au hover */}
      <span className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />

      <Comp ref={ref} {...props}>
        {(title || actions || subtitle) && (
          <header className="mb-3 flex items-start justify-between gap-3">
            <div>
              {title && (
                <h3 className="text-base font-semibold leading-6">{title}</h3>
              )}
              {subtitle && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
          </header>
        )}

        {children}
      </Comp>
    </motion.div>
  );
});

export default Card;
