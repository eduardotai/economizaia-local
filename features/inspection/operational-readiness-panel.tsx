"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, History, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { localDb } from "@/db/local-db";
import { evaluateOperationalReadiness } from "@/lib/operational-readiness";
import type { LocalAuditEvent, LocalSnapshot } from "@/db/persistence-types";
import type { IngestedDocument } from "@/models/documents";
import type { SimulationResult } from "@/models/domain";
import type { AnonymousOnboardingProfile } from "@/models/onboarding";
import type { PersistedUserReport } from "@/models/report";

interface OperationalReadinessPanelProps {
  profile: AnonymousOnboardingProfile | null;
  simulation: SimulationResult | null;
  persistedReport: PersistedUserReport | null;
  documents: IngestedDocument[];
}

export function OperationalReadinessPanel({ profile, simulation, persistedReport, documents }: OperationalReadinessPanelProps) {
  const [snapshots, setSnapshots] = useState<LocalSnapshot<unknown>[]>([]);
  const [auditEvents, setAuditEvents] = useState<LocalAuditEvent[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadEvidence() {
      const [storedSnapshots, storedAuditEvents] = await Promise.all([localDb.listSnapshots(), localDb.listAuditEvents()]);
      if (!mounted) return;
      setSnapshots(storedSnapshots);
      setAuditEvents(storedAuditEvents);
    }

    void loadEvidence();
    return () => {
      mounted = false;
    };
  }, [profile?.id, simulation?.id, persistedReport?.report.id, documents.length]);

  const readiness = useMemo(
    () => evaluateOperationalReadiness({ profile, simulation, persistedReport, documents, snapshots, auditEvents }),
    [profile, simulation, persistedReport, documents, snapshots, auditEvents],
  );

  const toneClass =
    readiness.status === "confiavel"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
      : readiness.status === "demonstravel"
        ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
        : "border-red-400/20 bg-red-400/10 text-red-100";

  return (
    <section id="operacao" className="space-y-6 scroll-mt-8">
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge variant="secondary">Confiabilidade operacional</Badge>
            <CardTitle>Readiness demonstrável do fluxo manual-first</CardTitle>
            <CardDescription className="leading-6">
              Painel local para mostrar que o MVP não só parece prudente: ele deixa evidências verificáveis de snapshots,
              auditoria, alinhamento do bundle e consistência entre simulação e relatório.
            </CardDescription>
          </div>
          <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>
            <div>Status operacional</div>
            <div className="mt-1 font-medium text-white">{readiness.statusLabel} · {readiness.score}%</div>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 text-sm ${toneClass}`}>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4" />
            <div className="space-y-2">
              <div className="font-medium">Resumo</div>
              <p>{readiness.summary}</p>
              <div className="text-xs opacity-90">
                Snapshots: {readiness.evidence.snapshotCount} · Auditoria: {readiness.evidence.auditEventCount} · Bundle: {readiness.evidence.bundleVersion}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <InfoMetric icon={<History className="h-4 w-4 text-sky-300" />} label="Snapshots locais" value={String(readiness.evidence.snapshotCount)} detail={readiness.evidence.latestSimulationSnapshotAt ?? "Sem simulação snapshotada"} />
          <InfoMetric icon={<ClipboardList className="h-4 w-4 text-violet-300" />} label="Eventos de auditoria" value={String(readiness.evidence.auditEventCount)} detail={readiness.evidence.latestAuditAt ?? "Sem auditoria ainda"} />
          <InfoMetric icon={<CheckCircle2 className="h-4 w-4 text-emerald-300" />} label="Relatório alinhado" value={readiness.evidence.reportMatchesSimulation ? "Sim" : readiness.evidence.reportGenerated ? "Não" : "N/A"} detail={readiness.evidence.reportGenerated ? "Verifica simulationId e bundleVersion do relatório" : "Relatório ainda não gerado"} />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {readiness.checklist.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border bg-background/50 p-4 text-sm">
              <div className="font-medium text-foreground">{item.done ? "OK" : "Pendente"} · {item.label}</div>
              <p className="mt-2 text-muted-foreground leading-6">{item.detail}</p>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

function InfoMetric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4 text-sm">
      <div className="flex items-center gap-2 font-medium text-white">
        {icon} {label}
      </div>
      <div className="mt-3 text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</div>
    </div>
  );
}
