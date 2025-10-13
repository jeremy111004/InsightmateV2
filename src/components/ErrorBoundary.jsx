// src/components/ErrorBoundary.jsx
import React from "react";

/**
 * Props:
 * - fallback?: ReactNode | (err) => ReactNode
 * - onReset?: () => void
 * - resetKey?: any     // si cette valeur change, on efface l'erreur
 * - className?: string // classes pour le conteneur de fallback par défaut
 */
export default class ErrorBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { hasError: false, err: null, info: null };
  }

  static getDerivedStateFromError(err) {
    return { hasError: true, err };
  }

  componentDidCatch(err, info) {
    this.setState({ info });
    // Log minimal + intégration avec un éventuel collecteur global
    // (remplace/complète par ton outil d'observabilité si besoin)
    console.error("ErrorBoundary:", err, info);
    try {
      if (
        typeof window !== "undefined" &&
        typeof window.reportError === "function"
      ) {
        window.reportError(err);
      }
    } catch {}
  }

  componentDidUpdate(prevProps) {
    // Si la "clé de reset" change, on efface l'erreur
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ hasError: false, err: null, info: null });
    }
  }

  reset = () => {
    const { onReset } = this.props;
    if (typeof onReset === "function") {
      try {
        onReset();
      } catch {}
    }
    this.setState({ hasError: false, err: null, info: null });
  };

  render() {
    const { hasError, err } = this.state;
    const { children, fallback, className = "" } = this.props;

    if (!hasError) return children;

    // Fallback personnalisé (node ou fonction)
    if (fallback) {
      return typeof fallback === "function"
        ? fallback(err, this.reset)
        : fallback;
    }

    // Fallback par défaut
    return (
      <div
        className={`p-6 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 ${className}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold mb-1">Un module a planté.</div>
            <div className="opacity-80 text-sm">
              Ouvre la console pour le détail. L’app reste ouverte.
            </div>
          </div>
          <button
            onClick={this.reset}
            className="text-sm px-2 py-1 rounded-lg bg-white/70 dark:bg-gray-900/40 border border-red-200/70 dark:border-red-800/60 hover:bg-white"
            type="button"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }
}
