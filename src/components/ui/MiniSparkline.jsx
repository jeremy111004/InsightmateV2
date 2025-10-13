// src/components/ui/MiniSparkline.jsx
import React, { useMemo, useId } from "react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";

// Utilitaire classes
const cx = (...cls) => cls.filter(Boolean).join(" ");

function MiniSparkline({
  data = [], // peut être [1,2,3] ou [{y:1},{y:2}]
  className = "",
  height = 40, // hauteur du sparkline en px
}) {
  // Normalise: numbers[] -> [{y: n}]
  const series = useMemo(() => {
    if (!Array.isArray(data)) return [];
    if (data.length === 0) return [];
    if (typeof data[0] === "number") return data.map((y) => ({ y }));
    if (typeof data[0] === "object" && data[0] !== null) {
      // si la clé n'est pas 'y' mais 'value' ou autre, on tente d'inférer
      return data.map((d) => {
        if (typeof d.y === "number") return d;
        const val = Number(
          d.value ?? d.v ?? d.amount ?? d.revenue ?? Object.values(d)[0]
        );
        return { y: Number.isFinite(val) ? val : 0 };
      });
    }
    return [];
  }, [data]);

  const gradId = useId(); // évite conflits entre plusieurs charts

  if (!series.length) return null;

  return (
    <div
      className={cx("text-indigo-500 dark:text-indigo-400", className)}
      style={{ height }}
      aria-hidden
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={series}
          margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`spark-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="y"
            stroke="currentColor"
            strokeWidth={2}
            fill={`url(#spark-${gradId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default MiniSparkline;
