"use client";

import { useEffect, useState } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { localDb } from "@/db/local-db";
import { runFakeSimulation } from "@/engine/fake-simulation";
import { createProfileSavedAuditEvent, createSimulationAuditEvents } from "@/lib/local-audit";
import { saveProfileSnapshot, saveSimulationSnapshot } from "@/lib/local-snapshots";
import type { SimulationResult } from "@/models/domain";

export function FakeSimulationPreview() {
  const [result, setResult] = useState<SimulationResult>(() => runFakeSimulation());

  useEffect(() => {
    let cancelled = false;

    async function persistPreview() {
      const nextResult = runFakeSimulation();
      const profile = {
        id: nextResult.profileId,
        businessName: "Estúdio Local de Serviços",
        regime: "simples" as const,
        monthlyRevenue: 18000,
        activityDescription: "Prestação de serviços recorrentes",
        city: "São Paulo",
        state: "SP",
      };

      await localDb.saveProfile(profile);
      await saveProfileSnapshot(profile);
      await localDb.appendAuditEvent(createProfileSavedAuditEvent(profile));

      await localDb.saveSimulation(nextResult);
      await localDb.saveSimulationResult(nextResult);
      await saveSimulationSnapshot(nextResult);
      await Promise.all(createSimulationAuditEvents(nextResult).map((event) => localDb.appendAuditEvent(event)));

      if (!cancelled) {
        setResult(nextResult);
      }
    }

    void persistPreview();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="space-y-5">
      <div>
        <CardTitle>Prévia de simulação local (mock)</CardTitle>
        <CardDescription className="mt-2 leading-6">
          Exemplo determinístico e local para validar o fluxo do starter. Não representa orientação fiscal oficial.
        </CardDescription>
      </div>

      <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-5">
        <div className="text-sm text-emerald-200">Cenário comparado</div>
        <div className="mt-2 text-3xl font-semibold text-white">{result.summary.estimatedSavingsLabel}</div>
        <p className="mt-2 text-sm leading-6 text-slate-300">{result.summary.narrative}</p>
      </div>

      <div className="space-y-3 text-sm text-muted-foreground">
        <div>
          <strong className="text-foreground">Status:</strong> {result.summary.decisionStatus}
        </div>
        <div>
          <strong className="text-foreground">Confiança:</strong> {result.summary.confidence.label} — {result.summary.confidence.rationale}
        </div>
        <div>
          <strong className="text-foreground">Premissas:</strong> {result.audit.premises.map((premise) => premise.label).join(" • ")}
        </div>
        <div>
          <strong className="text-foreground">Regras avaliadas:</strong> {result.audit.appliedRules.map((rule) => `${rule.title} [${rule.status}]`).join(" • ")}
        </div>
        <div>
          <strong className="text-foreground">Pendências:</strong> {result.audit.missingData.map((gap) => gap.label).join(" • ") || "Nenhuma pendência crítica neste mock."}
        </div>
      </div>
    </Card>
  );
}
