import React from "react";
import { motion } from "framer-motion";

export default function KpiCard({ icon, title, value, desc, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{
        once: true,
        amount: 0.2, // déclenche plus tôt
        margin: "-10% 0px -10% 0px", // tolérance au-dessus/dessous
      }}
      transition={{ duration: 0.55, delay, ease: "easeOut" }}
      style={{ willChange: "transform, opacity" }} // hint perf / Safari
      className="rounded-2xl bg-white/8 backdrop-blur border border-white/12 p-6 text-white/90"
    >
      <div className="flex items-center gap-2 text-white">
        <span className="inline-grid place-items-center w-7 h-7 rounded-md bg-indigo-500/25 ring-1 ring-white/15">
          {icon}
        </span>
        <div className="font-medium">{title}</div>
      </div>
      <div className="mt-2 text-2xl md:text-3xl font-extrabold text-white">
        {value}
      </div>
      <div className="mt-1 text-sm text-white/75">{desc}</div>
    </motion.div>
  );
}
