// src/pages/ConnectorsPage.jsx
import React, { useState, useEffect } from "react";
import ConnectFlow from "@/components/connectors/ConnectFlow";
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AIPill from "@/components/AIPill";

import {
  CONNECTOR_CATALOG,
  getConnectorsState,
  setConnectorsState,
  getConnectorLog,
  pushConnectorLog,
} from "@/lib/connectorsStore";

import { PlugZap, Info } from "lucide-react";

// Libellés jolis pour le journal
const DATASETS = {
  sales: "ventes",
  payments: "encaissements",
  banking: "banque",
};

// Carte d’un connecteur
function ConnectorTile({ c, state = {}, onConnect, onDisconnect, onPreview }) {
  const connected = state?.status === "connected";
  const note = state?.notes || "";

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="shrink-0">{c.icon}</span>
          <div className="font-medium">{c.name}</div>
        </div>
        <span
          className={
            "text-xs px-2 py-0.5 rounded-full " +
            (connected
              ? "bg-emerald-100 text-emerald-700"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300")
          }
        >
          {connected ? "Connecté" : "Non connecté"}
        </span>
      </div>

      <div className="text-sm text-gray-500 dark:text-gray-400">{c.desc}</div>
      {note && (
        <div className="text-xs text-gray-500 dark:text-gray-400">{note}</div>
      )}

      <div className="mt-1 flex flex-wrap gap-2">
        <Button onClick={() => onConnect(c.id)}>
          {connected ? "Resynchroniser" : "Connecter"}
        </Button>
        {(c.id === "csv" || c.id === "sheets") && (
          <Button variant="subtle" onClick={() => onPreview(c.id)}>
            Aperçu / Import
          </Button>
        )}
        {connected && (
          <Button variant="ghost" onClick={() => onDisconnect(c.id)}>
            Déconnecter
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function ConnectorsPage() {
  const [state, setState] = useState(getConnectorsState());
  const [log, setLog] = useState(getConnectorLog());

  // === Flow modal (ConnectFlow) ===
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowConnector, setFlowConnector] = useState(null);

  useEffect(() => {
    const onChange = () => {
      setState(getConnectorsState());
      setLog(getConnectorLog());
    };
    // Écoute les changements émis par setConnectorsState/pushConnectorLog
    window.addEventListener("im:connectors", onChange);
    return () => window.removeEventListener("im:connectors", onChange);
  }, []);

  const openFlow = (id) => {
    const c = CONNECTOR_CATALOG.find((x) => x.id === id);
    setFlowConnector(c || null);
    setFlowOpen(true);
  };
  const closeFlow = () => {
    setFlowOpen(false);
    setFlowConnector(null);
  };

  const onConnect = (id) => openFlow(id);

  const onDisconnect = (id) => {
    const prev = getConnectorsState();
    const next = { ...(prev || {}) };
    next[id] = { ...(next[id] || {}), status: "disconnected", mode: null };
    setConnectorsState(next);
    pushConnectorLog({ level: "warn", msg: `Connecteur ${id} déconnecté.` });
    setState(next);
    setLog(getConnectorLog());
  };

  const onPreview = (id) => openFlow(id);

  // Callback quand le flow se termine (connexion OU import validé)
  // { mode, rows, dataset, count } viennent de <ConnectFlow onDone={...} />
  const onFlowDone = ({ mode, rows, dataset, count }) => {
    const id = flowConnector?.id;
    if (!id) return;

    const prev = getConnectorsState();
    const next = { ...(prev || {}) };
    next[id] = {
      ...(next[id] || {}),
      status: "connected",
      mode: mode || next[id]?.mode || "oauth",
      lastSync: new Date().toISOString(),
      notes: dataset
        ? `Synchro ${DATASETS[dataset] || dataset}: ${count} lignes`
        : next[id]?.notes || "",
    };
    setConnectorsState(next);

    if (dataset) {
      pushConnectorLog({
        level: "info",
        msg: `Import ${flowConnector?.name} · ${
          DATASETS[dataset] || dataset
        } — ${count} lignes.`,
      });
    } else {
      pushConnectorLog({
        level: "info",
        msg: `Connecteur ${flowConnector?.name} connecté (mode ${mode}).`,
      });
    }

    setState(next);
    setLog(getConnectorLog());
    closeFlow();
  };

  const groups = [
    { title: "Banque & Paiements", ids: ["bank_fr", "stripe"] },
    {
      title: "Ventes / E-commerce",
      ids: ["shopify", "prestashop", "woocommerce"],
    },
    { title: "Comptabilité / Facturation", ids: ["pennylane", "sage"] },
    { title: "Imports rapides", ids: ["sheets", "csv"] },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <Section
        title="Connecteurs"
        icon={<PlugZap className="w-6 h-6 text-indigo-600" />}
        actions={<AIPill label="Onboarding 30s" />}
      >
        <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Branchez vos outils en 2 clics. Lecture seule d’abord; écriture
          activable plus tard.
        </div>

        {groups.map((g) => (
          <div key={g.title} className="mb-6">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              {g.title}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {g.ids.map((id) => {
                const c = CONNECTOR_CATALOG.find((x) => x.id === id);
                return (
                  <ConnectorTile
                    key={id}
                    c={c}
                    state={state?.[id]}
                    onConnect={onConnect}
                    onDisconnect={onDisconnect}
                    onPreview={onPreview}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </Section>

      <Section
        title="Journal de synchronisation"
        icon={<Info className="w-5 h-5 text-indigo-600" />}
      >
        {log.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Aucun événement pour le moment.
          </div>
        ) : (
          <div className="space-y-2">
            {log
              .slice(-50)
              .reverse()
              .map((e, i) => (
                <div key={i} className="text-sm">
                  <span className="text-gray-400">
                    {new Date(e.at || e.ts || Date.now()).toLocaleString()} —{" "}
                  </span>
                  <span
                    className={
                      e.level === "warn"
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-gray-800 dark:text-gray-100"
                    }
                  >
                    {e.msg}
                  </span>
                </div>
              ))}
          </div>
        )}
      </Section>

      {/* === Modal de connexion / import === */}
      <ConnectFlow
        open={flowOpen}
        connector={flowConnector}
        onClose={closeFlow}
        onDone={onFlowDone}
      />
    </div>
  );
}
