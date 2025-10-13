import React from "react";
import { animate } from "framer-motion";

export default function Counter({
  from = 0,
  to = 0,
  duration = 1.2,
  decimals = 0,
  formatter, // (v) => string
  prefix = "",
  suffix = "",
}) {
  const [val, setVal] = React.useState(from);

  React.useEffect(() => {
    const controls = animate(from, to, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setVal(v),
    });
    return () => controls.stop();
  }, [from, to, duration]);

  const text = formatter ? formatter(val) : Number(val).toFixed(decimals);

  return (
    <span>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}
