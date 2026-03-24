import type { IngestedDocument } from "@/models/documents";
import type { AuditEventKind, SimulationResult, TaxpayerProfile } from "@/models/domain";
import type { LocalAuditEvent } from "@/db/persistence-types";
import { createId, nowIso } from "@/lib/document-utils";

type AggregateType = LocalAuditEvent["aggregateType"];
type AuditStatus = LocalAuditEvent["status"];

function createAuditEvent(params: {
  aggregateId: string;
  aggregateType: AggregateType;
  kind: AuditEventKind;
  message: string;
  status?: AuditStatus;
  refs?: string[];
  metadata?: LocalAuditEvent["metadata"];
}): LocalAuditEvent {
  return {
    id: createId("audit_event"),
    timestamp: nowIso(),
    aggregateId: params.aggregateId,
    aggregateType: params.aggregateType,
    kind: params.kind,
    message: params.message,
    status: params.status ?? "info",
    refs: params.refs,
    metadata: params.metadata,
  };
}

export function createProfileSavedAuditEvent(profile: TaxpayerProfile): LocalAuditEvent {
  return createAuditEvent({
    aggregateId: profile.id,
    aggregateType: "profile",
    kind: "profile_validated",
    message: `Perfil local salvo para ${profile.businessName}.`,
    metadata: {
      regime: profile.regime,
      monthlyRevenue: profile.monthlyRevenue,
      state: profile.state ?? null,
    },
  });
}

export function createDocumentStoredAuditEvents(document: IngestedDocument): LocalAuditEvent[] {
  return [
    createAuditEvent({
      aggregateId: document.id,
      aggregateType: "document",
      kind: "premise_registered",
      message: `Documento ${document.originalFileName} registrado no fluxo local.`,
      metadata: {
        status: document.status,
        kind: document.kind,
        pages: document.pages.length,
      },
    }),
    createAuditEvent({
      aggregateId: document.id,
      aggregateType: "document",
      kind: "simulation_finished",
      message: "Pipeline documental placeholder concluído com trilha auditável local.",
      status: document.processingWarnings.length > 0 ? "warning" : "info",
      metadata: {
        warnings: document.processingWarnings.length,
        entities: document.entities.length,
        ocrJobs: document.ocrJobs.length,
      },
    }),
  ];
}

export function createSimulationAuditEvents(result: SimulationResult): LocalAuditEvent[] {
  const baseRefs = [result.bundleId, result.profileId, result.id];

  return [
    createAuditEvent({
      aggregateId: result.id,
      aggregateType: "simulation",
      kind: "simulation_started",
      message: "Simulação local iniciada a partir de perfil persistido no dispositivo.",
      refs: baseRefs,
      metadata: {
        status: result.status,
        bundleVersion: result.bundleVersion,
      },
    }),
    createAuditEvent({
      aggregateId: result.id,
      aggregateType: "simulation",
      kind: "bundle_selected",
      message: `Bundle ${result.bundleVersion} selecionado para a execução local.`,
      refs: [result.bundleId],
      metadata: {
        bundleId: result.bundleId,
      },
    }),
    createAuditEvent({
      aggregateId: result.id,
      aggregateType: "result",
      kind: "simulation_finished",
      message: "Resultado local persistido com resumo, premissas e timeline de auditoria.",
      status: result.status === "refused" ? "warning" : "info",
      refs: baseRefs,
      metadata: {
        decisionStatus: result.summary.decisionStatus,
        warnings: result.audit.warnings.length,
        missingData: result.audit.missingData.length,
      },
    }),
  ];
}
