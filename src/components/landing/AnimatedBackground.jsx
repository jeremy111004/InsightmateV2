// src/components/landing/AnimatedBackground.jsx
import React from "react";

export default function AnimatedBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* halos doux */}
      <div
        className="absolute -top-40 -left-48 w-[55vw] h-[55vw] rounded-full blur-2xl opacity-[0.10]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(99,102,241,0.55), transparent 70%)",
        }}
      />
      <div
        className="absolute -bottom-56 -right-48 w-[55vw] h-[55vw] rounded-full blur-2xl opacity-[0.08]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(34,197,94,0.55), transparent 70%)",
        }}
      />
      {/* grille légère */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.05] text-white"
        viewBox="0 0 1200 800"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id="grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="1200" height="800" fill="url(#grid)" />
      </svg>
    </div>
  );
}
