import React from "react";

/** Hook IO robuste + fallback immédiat si déjà visible au mount */
function useOnceInView(options) {
  const ref = React.useRef(null);
  const [seen, setSeen] = React.useState(false);

  React.useEffect(() => {
    if (!ref.current || seen) return;

    // check immédiat au mount (Safari/zoom)
    const el = ref.current;
    const r = el.getBoundingClientRect();
    const inView =
      r.top <
        (window.innerHeight || document.documentElement.clientHeight) * 0.9 &&
      r.bottom > 0;
    if (inView) {
      setSeen(true);
      return;
    }

    // IO standard
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          obs.disconnect();
        }
      },
      {
        root: null,
        threshold: 0.12,
        rootMargin: "0px 0px -10% 0px",
        ...(options || {}),
      }
    );
    obs.observe(el);

    // petit kick tardif (cas limites Safari)
    const t = setTimeout(() => {
      if (!seen) {
        const rr = el.getBoundingClientRect();
        if (rr.top < window.innerHeight && rr.bottom > 0) setSeen(true);
      }
    }, 180);

    return () => {
      obs.disconnect();
      clearTimeout(t);
    };
  }, [seen, options]);

  return [ref, seen];
}

/** Reveal
 *  - mode="immediate" => animation au mount (sans IO)
 *  - mode="scroll"    => animation quand visible (avec IO)
 *  - delay (secondes) => légère mise en scène
 */
export default function Reveal({
  mode = "scroll",
  delay = 0,
  className = "",
  children,
}) {
  const [ref, seen] = useOnceInView();
  if (mode === "immediate") {
    return (
      <div
        className={`reveal-base animate-in ${className}`}
        style={{ "--delay": `${delay}s` }}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      ref={ref}
      className={`reveal-base reveal ${seen ? "is-visible" : ""} ${className}`}
      style={{ "--delay": `${delay}s` }}
    >
      {children}
    </div>
  );
}
