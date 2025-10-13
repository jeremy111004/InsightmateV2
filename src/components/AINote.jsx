// src/components/AINote.jsx
import React, { forwardRef } from "react";
import { Info } from "lucide-react";

const cx = (...cls) => cls.filter(Boolean).join(" ");

const TONES = {
  info: "text-gray-600 dark:text-gray-300",
  neutral: "text-gray-500 dark:text-gray-400",
  warn: "text-amber-700 dark:text-amber-300",
  danger: "text-red-700 dark:text-red-300",
  success: "text-green-700 dark:text-green-300",
};

const BG = {
  info: "",
  neutral: "",
  warn: "bg-amber-50/60 dark:bg-amber-900/20 px-2 py-1 rounded-lg",
  danger: "bg-red-50/70 dark:bg-red-900/20 px-2 py-1 rounded-lg",
  success: "bg-green-50/70 dark:bg-green-900/20 px-2 py-1 rounded-lg",
};

const AINote = forwardRef(function AINote(
  {
    className = "",
    text = "Conseils générés automatiquement. Agrégats uniquement envoyés au serveur. Ne remplace pas un avis financier.",
    tone = "neutral", // "info" | "neutral" | "warn" | "danger" | "success"
    icon: IconComp = Info, // passer null pour masquer l’icône
    children, // si fourni, remplace 'text'
    ...props
  },
  ref
) {
  const colorCls = TONES[tone] || TONES.neutral;
  const bgCls = BG[tone] || BG.neutral;

  return (
    <div
      ref={ref}
      className={cx(
        "mt-1.5 flex items-start gap-1.5 text-[11px] leading-4",
        colorCls,
        bgCls,
        className
      )}
      role="note"
      {...props}
    >
      {IconComp ? (
        <IconComp
          className="w-3.5 h-3.5 mt-0.5 opacity-70 shrink-0"
          aria-hidden
        />
      ) : null}
      <span>{children ?? text}</span>
    </div>
  );
});

export default AINote;
