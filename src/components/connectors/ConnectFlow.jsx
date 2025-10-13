// src/components/connectors/ConnectFlow.jsx
// [ANCHOR: CONNECT_FLOW]
import React, { useEffect, useRef, useState } from "react";
import { Sparkles, FileDown } from "lucide-react";

import { normalizePreview, importCSVFile, importFromURL } from "../../lib/csv";
import { detectDatasetKind } from "../../lib/detectKind";
import { setDatastore } from "../../lib/datastore";

import Button from "../ui/Button";
import Modal from "../ui/Modal";

/**
 * Petit tableau d'aperçu autonome (10 lignes par défaut)
 */
function TablePreview({ rows, max = 10 }) {
  const list = Array.isArray(rows) ? rows.slice(0, max) : [];
  if (!list.length) return null;

  // Déduit les colonnes à partir des clés rencontrées
  const cols = Array.from(
    list.reduce((set, r) => {
      if (r && typeof r === "object") {
        Object.keys(r).forEach((k) => set.add(k));
      }
      return set;
    }, new Set())
  );

  return (
    <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900/40">
          <tr>
            {cols.map((c) => (
              <th
                key={c}
                className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-200"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => (
            <tr
              key={i}
              className="odd:bg-white even:bg-gray-50/50 dark:odd:bg-gray-950 dark:even:bg-gray-900/40"
            >
              {cols.map((c) => (
                <td key={c} className="px-3 py-2 whitespace-nowrap">
                  {r?.[c] != null ? String(r[c]) : ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * ConnectFlow
 * - Modes: "oauth" | "fichier" | "url"
 * - onDone({ mode, rows, dataset, count })
 */
export default function ConnectFlow({ open, connector, onClose, onDone }) {
  const [mode, setMode] = useState(null); // "oauth" | "fichier" | "url"
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState([]);
  const fileRef = useRef(null);
  const [url, setUrl] = useState("");

  // Choix auto du mode selon le connector sélectionné
  useEffect(() => {
    if (!connector) {
      setMode(null);
      setRows([]);
      setPreview([]);
      setUrl("");
      return;
    }
    const id = connector?.id;
    if (
      [
        "shopify",
        "stripe",
        "bank_fr",
        "pennylane",
        "sage",
        "prestashop",
        "woocommerce",
      ].includes(id)
    ) {
      setMode("oauth");
    } else if (id === "csv") {
      setMode("fichier");
    } else if (id === "sheets") {
      setMode("url");
    } else {
      setMode("oauth");
    }
    setRows([]);
    setPreview([]);
    setUrl("");
  }, [connector, open]);

  // Simule un OAuth (mock)
  const doOAuth = async () => {
    if (!connector) return;
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      onDone?.({ mode: "oauth", rows: [], dataset: null, count: 0 });
    } finally {
      setBusy(false);
    }
  };

  // Sélecteur de fichier
  const pickFile = () => fileRef.current?.click();

  // Import depuis fichier CSV
  const onFile = async (e) => {
    const f = e?.target?.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const data = await importCSVFile(f);
      setRows(Array.isArray(data) ? data : []);
      setPreview(normalizePreview(Array.isArray(data) ? data : []));
    } catch (err) {
      console.error("CSV import error:", err);
      alert("Échec de l’import du fichier CSV.");
    } finally {
      setBusy(false);
    }
  };

  // Import depuis URL (CSV/Sheets publié en CSV)
  const importUrl = async () => {
    if (!url) return;
    setBusy(true);
    try {
      const data = await importFromURL(url);
      setRows(Array.isArray(data) ? data : []);
      setPreview(normalizePreview(Array.isArray(data) ? data : []));
    } catch (e) {
      console.error("URL import error:", e);
      alert("Échec de l’import. Vérifie que l’URL pointe vers un CSV public.");
    } finally {
      setBusy(false);
    }
  };

  // Validation → sauvegarde dans le datastore
  const confirmSync = () => {
    if (!connector) return;
    const detected = detectDatasetKind(rows); // "sales" | "payments" | "banking" | "accounting" | etc.
    setDatastore((prev) => {
      const next = { ...prev };
      const cid = connector.id;
      next[cid] = next[cid] || {};
      next[cid][detected] = rows;
      return next;
    });
    onDone?.({ mode, rows, dataset: detected, count: rows.length });
  };

  return (
    <Modal
      open={!!open}
      title={`Connexion — ${connector?.name || ""}`}
      onClose={onClose}
    >
      {!connector ? null : (
        <div className="space-y-4">
          {/* Choix rapide (affiché mais présélectionné) */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={mode === "oauth" ? "solid" : "subtle"}
              onClick={() => setMode("oauth")}
            >
              OAuth / App Store
            </Button>
            <Button
              size="sm"
              variant={mode === "fichier" ? "solid" : "subtle"}
              onClick={() => setMode("fichier")}
            >
              Importer un fichier (CSV)
            </Button>
            <Button
              size="sm"
              variant={mode === "url" ? "solid" : "subtle"}
              onClick={() => setMode("url")}
            >
              Coller une URL (CSV/Sheets)
            </Button>
          </div>

          {/* Panneau selon mode */}
          {mode === "oauth" && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Nous allons ouvrir une fenêtre de consentement {connector.name}.
                Lecture seule d’abord.
              </div>
              <Button onClick={doOAuth} icon={<Sparkles className="w-4 h-4" />}>
                Continuer
              </Button>
              {busy && <div className="text-sm mt-2">Connexion…</div>}
            </div>
          )}

          {mode === "fichier" && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={onFile}
                className="hidden"
              />
              <Button
                variant="subtle"
                onClick={pickFile}
                icon={<FileDown className="w-4 h-4" />}
              >
                Choisir un fichier CSV
              </Button>
              {busy && <div className="text-sm">Import en cours…</div>}
              {preview.length > 0 && (
                <>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Aperçu (10 lignes)
                  </div>
                  <TablePreview rows={preview} max={10} />
                  <div className="flex justify-end">
                    <Button onClick={confirmSync}>
                      Valider la synchro ({rows.length} lignes)
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {mode === "url" && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://... (CSV public ou Google Sheets publié en CSV)"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60"
              />
              <div className="flex gap-2">
                <Button variant="subtle" onClick={importUrl}>
                  Charger l’aperçu
                </Button>
                {busy && <span className="text-sm mt-2">Chargement…</span>}
              </div>
              {preview.length > 0 && (
                <>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Aperçu (10 lignes)
                  </div>
                  <TablePreview rows={preview} max={10} />
                  <div className="flex justify-end">
                    <Button onClick={confirmSync}>
                      Valider la synchro ({rows.length} lignes)
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
