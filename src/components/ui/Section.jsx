// src/components/ui/Section.jsx
import React, { forwardRef } from "react";
import { motion } from "framer-motion";
import Card from "./Card";

const cx = (...cls) => cls.filter(Boolean).join(" ");

const Section = forwardRef(function Section(
  {
    title,
    icon,
    subtitle, // optionnel : petite ligne sous le titre
    badge = "Live", // texte du badge (mettre null pour cacher)
    showBadge = true, // si false, masque le badge
    actions, // boutons à droite
    children,
    id, // pour ancrer la section
    className = "",
    ...props
  },
  ref
) {
  const titleId = id ? `${id}-title` : undefined;

  return (
    <Card ref={ref} className={cx("mb-6 group", className)} {...props}>
      {(title || actions || icon || subtitle || (showBadge && badge)) && (
        <div className="flex items-start justify-between mb-4 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.35 }}
            className="flex-1 min-w-0"
          >
            <div className="flex items-center gap-2">
              {icon ? <span aria-hidden>{icon}</span> : null}
              {title ? (
                <h2
                  id={titleId}
                  className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100 truncate"
                >
                  {title}
                </h2>
              ) : null}
              {showBadge && badge ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                  {badge}
                </span>
              ) : null}
            </div>
            {subtitle ? (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {subtitle}
              </p>
            ) : null}
          </motion.div>

          {actions ? (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="shrink-0 flex items-center gap-2"
            >
              {actions}
            </motion.div>
          ) : null}
        </div>
      )}

      {/* Contenu */}
      <div aria-labelledby={titleId}>{children}</div>
    </Card>
  );
});

export default Section;
