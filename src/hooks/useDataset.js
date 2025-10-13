// src/hooks/useDataset.js
import React from "react";
import { loadDataset } from "../lib/datastore";

/**
 * useDataset(kind, options?)
 * - kind: "sales" | "banking" | "payments" | "accounting" | ...
 * - options.fallback: any[]  -> utilisé si le datastore ne renvoie rien
 * - options.select:  (rows) => any[]  -> projection/transform facultative
 * - options.deps:    any[]   -> deps supplémentaires pour recomputer select
 *
 * Renvoie un tableau (jamais undefined).
 */
export default function useDataset(
  kind,
  { fallback = [], select, deps = [] } = {}
) {
  const get = React.useCallback(() => {
    try {
      const rows = loadDataset(kind) || [];
      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      console.warn("[useDataset] load error for", kind, e);
      return [];
    }
  }, [kind]);

  const [rows, setRows] = React.useState(() => {
    const initial = get();
    return initial.length ? initial : fallback;
  });

  // Met à jour le state seulement si la référence ou la longueur change
  const setIfChanged = React.useCallback((next) => {
    setRows((prev) => {
      if (prev === next) return prev;
      if (Array.isArray(prev) && Array.isArray(next) && prev.length === next.length) {
        // Heuristique légère: même longueur -> évite un re-render inutile
        // (si tu veux du deep-compare, remplace ici, mais attention au coût)
        return prev;
      }
      return next;
    });
  }, []);

  // Rafraîchissement sur évènements
  React.useEffect(() => {
    const refresh = () => {
      const next = get();
      if (!next.length && fallback?.length) {
        setIfChanged(fallback);
      } else {
        setIfChanged(next);
      }
    };

    // 1) Évènement custom émis par setDatastore (im:datastore)
    window.addEventListener("im:datastore", refresh);

    // 2) Évènement storage (autres onglets)
    const onStorage = (e) => {
      // Si tu connais la clé exacte (ex: 'insightmate.datastore.v1'), filtre ici
      // if (e.key !== 'insightmate.datastore.v1') return;
      refresh();
    };
    window.addEventListener("storage", onStorage);

    // 3) Rafraîchit à l'activation d'onglet (utile après long idle)
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // premier refresh “montage”
    refresh();

    return () => {
      window.removeEventListener("im:datastore", refresh);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [get, setIfChanged, fallback]);

  // Projection facultative
  const selected = React.useMemo(() => {
    try {
      return typeof select === "function" ? select(rows) ?? [] : rows;
    } catch (e) {
      console.warn("[useDataset] select error:", e);
      return rows;
    }
  }, [rows, select, ...deps]);

  return Array.isArray(selected) ? selected : [];
}

/**
 * Helper: useDatasetSafe(kind, fallback?)
 * Toujours renvoie un tableau non vide si fallback fourni.
 */
export function useDatasetSafe(kind, fallback = []) {
  return useDataset(kind, { fallback });
}
