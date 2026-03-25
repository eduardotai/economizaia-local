import { starterRuleBundle } from "@/engine/starter-rule-bundle";
import type { IngestedDocument } from "@/models/documents";
import type { AnonymousOnboardingProfile } from "@/models/onboarding";
import type { PersistedUserReport } from "@/models/report";
import type { SimulationResult } from "@/models/domain";
import type { LocalSnapshot, LocalAuditEvent } from "@/db/persistence-types";
import { documentCanRunRuleEngine } from "@/lib/document-pipeline";

export interface OperationalReadinessEvidence {
  snapshotCount: number;
  auditEventCount: number;
  latestProfileSnapshotAt?: string;
  latestSimulationSnapshotAt?: string;
  latestReportSnapshotAt?: string;
  latestDocumentSnapshotAt?: string;
  latestAuditAt?: string;
  bundleVersion: string;
  bundleApprovalStatus: string;
  bundleReviewStatus: string;
  reportGenerated: boolean;
  reportMatchesSimulation: boolean;
  simulationRefused: boolean;
  documentReviewConfirmedCount: number;
  documentReviewPendingCount: number;
}

export interface OperationalChecklistItem {
  id: string;
  label: string;
  done: boolean;
  detail: string;
}

export interface OperationalReadinessSummary {
  score: number;
  status: "fragil" | "demonstravel" | "confiavel";
  statusLabel: string;
  summary: string;
  checklist: OperationalChecklistItem[];
  evidence: OperationalReadinessEvidence;
}

function getLatestSnapshot(scope: string, snapshots: LocalSnapshot<unknown>[]) {
  return snapshots.find((snapshot) => snapshot.scope === scope) ?? null;
}

export function evaluateOperationalReadiness(params: {
  profile: AnonymousOnboardingProfile | null;
  simulation: SimulationResult | null;
  persistedReport: PersistedUserReport | null;
  documents: IngestedDocument[];
  snapshots: LocalSnapshot<unknown>[];
  auditEvents: LocalAuditEvent[];
}): OperationalReadinessSummary {
  const { profile, simulation, persistedReport, documents, snapshots, auditEvents } = params;

  const latestProfileSnapshot = getLatestSnapshot("profile", snapshots);
  const latestSimulationSnapshot = getLatestSnapshot("simulation", snapshots);
  const latestReportSnapshot = getLatestSnapshot("report", snapshots);
  const latestDocumentSnapshot = getLatestSnapshot("document", snapshots);
  const latestAuditAt = auditEvents[0]?.timestamp;

  const reviewConfirmedCount = documents.filter((document) => documentCanRunRuleEngine(document)).length;
  const reviewPendingCount = documents.filter((document) => !documentCanRunRuleEngine(document)).length;
  const reportMatchesSimulation = Boolean(
    persistedReport && simulation && persistedReport.report.simulationId === simulation.id && persistedReport.report.sourceSimulation.bundleVersion === simulation.bundleVersion,
  );

  const checklist: OperationalChecklistItem[] = [
    {
      id: "bundle-reviewed",
      label: "Bundle mock com revisão interna explícita",
      done: starterRuleBundle.bundleStatus === "review_required" && starterRuleBundle.review.approvalStatus === "reviewed_internal",
      detail: `bundleStatus=${starterRuleBundle.bundleStatus}; approvalStatus=${starterRuleBundle.review.approvalStatus}; version=${starterRuleBundle.version}.`,
    },
    {
      id: "profile-snapshot",
      label: "Snapshot local do perfil salvo",
      done: Boolean(profile && latestProfileSnapshot?.entityId === profile.id),
      detail: latestProfileSnapshot ? `Último snapshot de perfil em ${latestProfileSnapshot.createdAt}.` : "Nenhum snapshot de perfil encontrado.",
    },
    {
      id: "simulation-snapshot",
      label: "Snapshot local da simulação salvo",
      done: Boolean(simulation && latestSimulationSnapshot?.entityId === simulation.id),
      detail: latestSimulationSnapshot ? `Último snapshot de simulação em ${latestSimulationSnapshot.createdAt}.` : "Nenhum snapshot de simulação encontrado.",
    },
    {
      id: "audit-trail",
      label: "Trilha de auditoria local disponível",
      done: auditEvents.length >= 3,
      detail: auditEvents.length ? `${auditEvents.length} evento(s) registrados; último em ${latestAuditAt}.` : "Nenhum evento de auditoria encontrado.",
    },
    {
      id: "document-review-state",
      label: "Estado documental coerente com revisão manual",
      done: reviewPendingCount === 0,
      detail:
        reviewPendingCount === 0
          ? `${reviewConfirmedCount} documento(s) confirmados; nenhuma pendência documental aberta.`
          : `${reviewConfirmedCount} documento(s) confirmados; ${reviewPendingCount} pendente(s) ainda exigem revisão manual antes de uso prático.`,
    },
    {
      id: "report-snapshot",
      label: "Relatório persistido com snapshot local",
      done: Boolean(persistedReport && latestReportSnapshot?.entityId === persistedReport.report.id),
      detail: latestReportSnapshot ? `Último snapshot de relatório em ${latestReportSnapshot.createdAt}.` : "Nenhum snapshot de relatório encontrado.",
    },
    {
      id: "report-links-simulation",
      label: "Relatório aponta para a simulação vigente",
      done: reportMatchesSimulation || !persistedReport,
      detail: persistedReport
        ? reportMatchesSimulation
          ? "Relatório e simulação atual estão alinhados por simulationId e bundleVersion."
          : "Relatório salvo não corresponde à simulação atual. Gere novamente para evitar divergência demonstrável."
        : "Ainda sem relatório salvo.",
    },
  ];

  const completed = checklist.filter((item) => item.done).length;
  const score = Math.round((completed / checklist.length) * 100);

  let status: OperationalReadinessSummary["status"] = "fragil";
  if (score >= 85) status = "confiavel";
  else if (score >= 55) status = "demonstravel";

  const statusLabelMap: Record<OperationalReadinessSummary["status"], string> = {
    fragil: "Frágil",
    demonstravel: "Demonstrável",
    confiavel: "Confiável",
  };

  const summaryMap: Record<OperationalReadinessSummary["status"], string> = {
    fragil: "A operação local existe, mas ainda carece de evidências suficientes para uma demo confiável do fluxo manual-first.",
    demonstravel: "Há evidências locais suficientes para demonstrar prudência operacional, com espaço para reforçar snapshots, alinhamento e relatório final.",
    confiavel: "O checkpoint atual já demonstra confiabilidade operacional conservadora: snapshots, auditoria e alinhamento entre bundle, simulação e relatório.",
  };

  return {
    score,
    status,
    statusLabel: statusLabelMap[status],
    summary: summaryMap[status],
    checklist,
    evidence: {
      snapshotCount: snapshots.length,
      auditEventCount: auditEvents.length,
      latestProfileSnapshotAt: latestProfileSnapshot?.createdAt,
      latestSimulationSnapshotAt: latestSimulationSnapshot?.createdAt,
      latestReportSnapshotAt: latestReportSnapshot?.createdAt,
      latestDocumentSnapshotAt: latestDocumentSnapshot?.createdAt,
      latestAuditAt,
      bundleVersion: starterRuleBundle.version,
      bundleApprovalStatus: starterRuleBundle.review.approvalStatus,
      bundleReviewStatus: starterRuleBundle.bundleStatus,
      reportGenerated: Boolean(persistedReport),
      reportMatchesSimulation,
      simulationRefused: simulation?.status === "refused",
      documentReviewConfirmedCount: reviewConfirmedCount,
      documentReviewPendingCount: reviewPendingCount,
    },
  };
}
