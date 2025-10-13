// src/components/ui/Modal.jsx
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

const cx = (...cls) => cls.filter(Boolean).join(" ");

const SIZES = {
  sm: "w-[min(92vw,520px)]",
  md: "w-[min(92vw,680px)]",
  lg: "w-[min(92vw,860px)]",
};

export default function Modal({
  open,
  title,
  children,
  onClose,
  size = "md",
  className = "",
  footer = null, // contenu pied de modale (boutons Actions)
  closeOnBackdrop = true, // fermer en cliquant le fond
  closeOnEsc = true, // fermer avec ESC
  initialFocus = true, // focus auto sur la modale
}) {
  const panelRef = useRef(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2)}`);

  // ESC pour fermer
  useEffect(() => {
    if (!open || !closeOnEsc) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeOnEsc, onClose]);

  // Focus initial + lock scroll
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (initialFocus) {
      // essaie de focus un élément focusable, sinon le panel
      const el =
        panelRef.current?.querySelector(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
        ) || panelRef.current;
      el?.focus?.();
    }
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open, initialFocus]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          aria-hidden={!open}
        >
          {/* Backdrop */}
          <motion.button
            type="button"
            aria-hidden
            onClick={closeOnBackdrop ? onClose : undefined}
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId.current : undefined}
            ref={panelRef}
            tabIndex={-1}
            className={cx(
              "relative rounded-2xl border border-gray-200 dark:border-gray-800",
              "bg-white dark:bg-gray-900 shadow-xl outline-none",
              SIZES[size] || SIZES.md,
              "p-5",
              className
            )}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()} // évite fermeture sur clic intérieur
          >
            <div className="flex items-center justify-between mb-3">
              {title ? (
                <div
                  id={titleId.current}
                  className="text-lg font-semibold leading-6"
                >
                  {title}
                </div>
              ) : (
                <span aria-hidden className="sr-only">
                  Modal
                </span>
              )}

              <button
                onClick={onClose}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
              >
                Fermer
              </button>
            </div>

            {/* Contenu */}
            <div>{children}</div>

            {/* Footer / actions */}
            {footer ? (
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-800">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
