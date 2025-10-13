// src/components/LeakageRadarEmbed.jsx
import React, { Suspense, lazy } from "react";

// IMPORTANT: keep the .jsx extension for Vite
const LeakageRadar = lazy(() => import("../pages/LeakageRadar.jsx"));

export default function LeakageRadarEmbed({ initialRows = null }) {
  return (
    <div className="w-full h-[520px] rounded-xl overflow-hidden">
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center text-sm opacity-70">
            Chargement du Radar…
          </div>
        }
      >
        {/* Pass initialRows down so the page can pre-load them */}
        <LeakageRadar embedMode initialRows={initialRows} />
      </Suspense>
    </div>
  );
}
