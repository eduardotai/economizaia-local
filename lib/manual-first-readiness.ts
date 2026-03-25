import { starterRuleBundle } from "@/engine/starter-rule-bundle";
import { documentCanRunRuleEngine } from "@/lib/document-pipeline";
import { activityTypeLabels, flowModeLabels, simulationPeriodLabels, userTypeLabels } from "@/lib/onboarding";
import type { IngestedDocument } from "@/models/documents";
import type { SimulationResult } from "@/models/domain";
import type { AnonymousOnboardingProfile } from "@/models/onboarding";
import type { PersistedUserReport } from "@/models/report";

export type ReadinessStatus = "incompleto" | "revisavel" | "pronto" | "bloqueado" | "rascunho";

export interface ReadinessBlockingReason {
  code:
    | "CONSENT_REQUIRED"
    | "LOW_CONFIDENCE_CRITICAL_DATA"
    | "DOCUMENT_REVIEW_REQUIRED"
    | "BUNDLE_REVIEW_REQUIRED"
    | "BUNDLE_APPROVAL_REQUIRED"
    | "SIMULATION_NOT_READY"
    | "REPORT_NOT_READY";
  title: string;
  message: string;
  nextSteps: string[];
}

export interface ReadinessChecklistItem {
  id: string;
  label: string;
  done: boolean;
  detail: string;
}

export interface WorkspaceReadinessGate {
  status: ReadinessStatus;
  statusLabel: string;
  canGenerateSimulation: boolean;
  canGenerateFinalReport: boolean;
  summary: string;
  refusalTitle?: string;
  refusalMessage?: string;
  nextSteps: string[];
  blockers: ReadinessBlockingReason[];
  checklist: ReadinessChecklistItem[];
  evidence: {
    flowModeLabel: string;
    userTypeLabel: string;
    activityTypeLabel: string;
    periodLabel: string;
    confidenceLabel: string;
    bundleApprovalStatus: string;
    bundleReviewStatus: string;
    documentReviewPendingCount: number;
    documentReviewConfirmedCount: number;
    criticalMissingCount: number;
    hasPersistedReport: boolean;
  };
}

function normalizeCurrencyInput(value: string) {
  const normalized = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(normalized) ? normalized : NaN;
}

function hasManualRequiredFields(profile: AnonymousOnboardingProfile) {
  const quick = profile.quickManualInput;
  return {
    monthlyRevenue: quick.monthlyRevenue.trim().length > 0 && normalizeCurrencyInput(quick.monthlyRevenue) > 0,
    monthlyExpenses: quick.monthlyExpenses.trim().length > 0,
    currentRegime: quick.currentRegime !== "indefinido",
    activityDescription: quick.activityDescription.trim().length > 0,
    periodLabel: quick.periodLabel.trim().length > 0,
  };
}

function getCriticalMissingDataCount(simulation: SimulationResult | null) {
  if (!simulation) return 0;
  return simulation.audit.missingData.filter((gap) => gap.blocking).length;
}

function getDocumentEvidence(documents: IngestedDocument[]) {
  const reviewPending = documents.filter((document) => !documentCanRunRuleEngine(document));
  const reviewConfirmed = documents.filter((document) => documentCanRunRuleEngine(document));

  return {
    total: documents.length,
    reviewPending,
    reviewConfirmed,
  };
}

function getBundleBlockers() {
  const blockers: ReadinessBlockingReason[] = [];

  if (starterRuleBundle.bundleStatus !== "review_required") {
    blockers.push({
      code: "BUNDLE_REVIEW_REQUIRED",
      title: "Bundle fora da política mock esperada",
      message: "O bundle atual não está marcado como review_required, então o produto deve bloquear até o pacote voltar ao estado prudente esperado do MVP.",
      nextSteps: [
        "Revisar o metadata do bundle local.",
        "Confirmar que o pacote continua explicitamente mock/draft/review_required.",
        "Somente liberar a simulação final após a política mock estar consistente.",
      ],
    });
  }

  if (starterRuleBundle.review.approvalStatus !== "reviewed_internal") {
    blockers.push({
      code: "BUNDLE_APPROVAL_REQUIRED",
      title: "Bundle sem aprovação mock/revisão interna",
      message: "O pacote de regras não está no estado reviewed_internal exigido para este checkpoint, então a conclusão final permanece bloqueada.",
      nextSteps: [
        "Registrar revisão interna do bundle mock.",
        "Persistir reviewedBy e reviewedAt.",
        "Executar novamente o fluxo após a aprovação interna mock.",
      ],
    });
  }

  return blockers;
}

export function evaluateWorkspaceReadiness(params: {
  profile: AnonymousOnboardingProfile;
  simulation: SimulationResult | null;
  documents: IngestedDocument[];
  persistedReport: PersistedUserReport | null;
}): WorkspaceReadinessGate {
  const { profile, simulation, documents, persistedReport } = params;
  const manualFields = hasManualRequiredFields(profile);
  const documentEvidence = getDocumentEvidence(documents);
  const bundleBlockers = getBundleBlockers();
  const criticalMissingCount = getCriticalMissingDataCount(simulation);
  const confidenceLevel = simulation?.summary.confidence.level ?? "very_low";
  const lowConfidenceWithCriticalData = Boolean(simulation) && ["very_low", "low"].includes(confidenceLevel) && criticalMissingCount > 0;

  const checklist: ReadinessChecklistItem[] = [
    {
      id: "consent-local-only",
      label: "Aviso local-only aceito",
      done: profile.consentLocalOnly,
      detail: "Sem consentimento local-only o fluxo não deve gerar simulação nem relatório.",
    },
    {
      id: "consent-mock-awareness",
      label: "Aviso de mock/placeholder aceito",
      done: profile.consentMockAwareness,
      detail: "Garante que o usuário reconhece que o resultado não é cálculo fiscal oficial.",
    },
    {
      id: "manual-minimum-readiness",
      label: "Prontidão mínima do input manual",
      done: Object.values(manualFields).every(Boolean),
      detail: `Campos críticos: faturamento=${manualFields.monthlyRevenue ? "ok" : "pendente"}, despesas=${manualFields.monthlyExpenses ? "ok" : "pendente"}, regime=${manualFields.currentRegime ? "ok" : "pendente"}, atividade=${manualFields.activityDescription ? "ok" : "pendente"}, período=${manualFields.periodLabel ? "ok" : "pendente"}.`,
    },
    {
      id: "document-review",
      label: "Revisão documental obrigatória",
      done: profile.flowMode !== "documentos" || documentEvidence.reviewPending.length === 0,
      detail:
        profile.flowMode === "documentos"
          ? `${documentEvidence.reviewConfirmed.length} documento(s) revisado(s), ${documentEvidence.reviewPending.length} pendente(s).`
          : "Não aplicável ao modo manual rápido.",
    },
    {
      id: "bundle-policy",
      label: "Bundle mock aprovado/revisado conforme política",
      done: bundleBlockers.length === 0,
      detail: `bundleStatus=${starterRuleBundle.bundleStatus}, approvalStatus=${starterRuleBundle.review.approvalStatus}.`,
    },
    {
      id: "confidence-critical-data",
      label: "Confiança mínima sem lacunas críticas pendentes",
      done: !lowConfidenceWithCriticalData,
      detail:
        simulation
          ? `Confiança=${simulation.summary.confidence.label}; lacunas críticas=${criticalMissingCount}.`
          : "Aguardando simulação para avaliar confiança e lacunas críticas.",
    },
  ];

  const blockers: ReadinessBlockingReason[] = [];

  if (!profile.consentLocalOnly || !profile.consentMockAwareness) {
    blockers.push({
      code: "CONSENT_REQUIRED",
      title: "Faltam confirmações mínimas do fluxo",
      message: "Aceite os avisos de uso local-only e mock antes de gerar simulação ou relatório.",
      nextSteps: ["Marcar os dois checkboxes obrigatórios.", "Salvar o perfil local novamente."],
    });
  }

  if (profile.flowMode === "documentos" && documentEvidence.reviewPending.length > 0) {
    blockers.push({
      code: "DOCUMENT_REVIEW_REQUIRED",
      title: "Documento ainda não revisado",
      message: "Existe documento pendente de revisão manual. O cálculo final e o relatório final permanecem bloqueados.",
      nextSteps: [
        "Abrir cada documento pendente no workspace documental.",
        "Revisar e confirmar manualmente os campos extraídos.",
        "Voltar para a simulação somente após todos ficarem confirmados.",
      ],
    });
  }

  if (lowConfidenceWithCriticalData) {
    blockers.push({
      code: "LOW_CONFIDENCE_CRITICAL_DATA",
      title: "Confiança baixa com dados críticos faltando",
      message: "A simulação atual não atende a prontidão mínima: confiança baixa/ muito baixa combinada com lacunas críticas impede conclusão final.",
      nextSteps: [
        "Preencher ou corrigir os dados críticos faltantes.",
        "Refazer a simulação local.",
        "Só gerar relatório final quando a leitura estiver revisável ou pronta.",
      ],
    });
  }

  blockers.push(...bundleBlockers);

  const minimumInputReady = checklist.find((item) => item.id === "manual-minimum-readiness")?.done ?? false;
  const consentsReady = checklist.find((item) => item.id === "consent-local-only")?.done && checklist.find((item) => item.id === "consent-mock-awareness")?.done;
  const canGenerateSimulation = Boolean(consentsReady && minimumInputReady && blockers.length === 0);
  const canGenerateFinalReport = Boolean(canGenerateSimulation && simulation && simulation.status !== "refused");

  let status: ReadinessStatus = "rascunho";
  if (!consentsReady || !minimumInputReady) {
    status = "incompleto";
  }
  if (consentsReady && minimumInputReady) {
    status = simulation ? "revisavel" : "rascunho";
  }
  if (blockers.length > 0) {
    status = "bloqueado";
  }
  if (canGenerateFinalReport) {
    status = "pronto";
  }

  const statusLabelMap: Record<ReadinessStatus, string> = {
    incompleto: "Incompleto",
    revisavel: "Revisável",
    pronto: "Pronto",
    bloqueado: "Bloqueado",
    rascunho: "Rascunho",
  };

  const summaryMap: Record<ReadinessStatus, string> = {
    rascunho: "Rascunho local: o perfil existe, mas ainda não atingiu a prontidão mínima.",
    incompleto: "Insumos mínimos ainda não fechados. Complete os campos e confirmações obrigatórias.",
    revisavel: "A leitura local existe, mas ainda depende de revisão manual antes de virar conclusão final.",
    pronto: "Prontidão mínima atingida dentro da política mock: é possível salvar o relatório final local.",
    bloqueado: "O produto recusou avançar porque há bloqueios operacionais reais neste checkpoint.",
  };

  return {
    status,
    statusLabel: statusLabelMap[status],
    canGenerateSimulation,
    canGenerateFinalReport,
    summary: summaryMap[status],
    refusalTitle: blockers[0]?.title,
    refusalMessage: blockers[0]?.message,
    nextSteps: blockers.length
      ? Array.from(new Set(blockers.flatMap((blocker) => blocker.nextSteps)))
      : [
          "Gerar a simulação local.",
          "Revisar alertas, lacunas e premissas.",
          "Salvar o relatório final local apenas como artefato mock revisado.",
        ],
    blockers,
    checklist,
    evidence: {
      flowModeLabel: flowModeLabels[profile.flowMode],
      userTypeLabel: userTypeLabels[profile.userType],
      activityTypeLabel: activityTypeLabels[profile.activityType],
      periodLabel: simulationPeriodLabels[profile.simulationPeriod],
      confidenceLabel: simulation?.summary.confidence.label ?? "Aguardando leitura",
      bundleApprovalStatus: starterRuleBundle.review.approvalStatus,
      bundleReviewStatus: starterRuleBundle.bundleStatus,
      documentReviewPendingCount: documentEvidence.reviewPending.length,
      documentReviewConfirmedCount: documentEvidence.reviewConfirmed.length,
      criticalMissingCount,
      hasPersistedReport: Boolean(persistedReport),
    },
  };
}
