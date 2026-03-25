import assert from "node:assert/strict";

import { evaluateWorkspaceReadiness } from "@/lib/readiness-gate";
import { starterRuleBundle } from "@/engine/starter-rule-bundle";
import type { IngestedDocument } from "@/models/documents";
import type { SimulationResult } from "@/models/domain";
import type { AnonymousOnboardingProfile } from "@/models/onboarding";

function buildProfile(overrides: Partial<AnonymousOnboardingProfile> = {}): AnonymousOnboardingProfile {
  const now = new Date().toISOString();
  return {
    id: "profile-test",
    createdAt: now,
    updatedAt: now,
    userType: "mei",
    revenueRange: "de_15k_a_50k",
    activityType: "servicos_digitais",
    currentRegime: "simples",
    simulationPeriod: "mensal",
    consentLocalOnly: true,
    consentMockAwareness: true,
    appMode: "leve",
    flowMode: "manual_rapido",
    quickManualInput: {
      monthlyRevenue: "25000",
      monthlyExpenses: "3000",
      currentRegime: "simples",
      activityDescription: "Serviços digitais B2B",
      cnaeOrActivityCode: "6201-5/01",
      periodLabel: "Recorte mensal",
    },
    ...overrides,
  };
}

function buildSimulation(overrides: Partial<SimulationResult> = {}): SimulationResult {
  const now = new Date().toISOString();
  return {
    id: "sim-test",
    createdAt: now,
    profileId: "profile-test",
    bundleId: starterRuleBundle.id,
    bundleVersion: starterRuleBundle.version,
    status: "success",
    currentScenario: {
      id: "scenario-current",
      label: "Cenário atual",
      monthlyTaxEstimate: 1000,
      notes: ["placeholder"],
      confidence: {
        level: "moderate",
        score: 0.72,
        label: "Moderada",
        rationale: "Dados mínimos presentes.",
        drivers: ["input manual completo"],
        blockers: [],
      },
      placeholdersUsed: ["bundle local"],
    },
    summary: {
      estimatedSavings: 400,
      estimatedSavingsLabel: "R$ 400,00",
      narrative: "Leitura local mock.",
      decisionStatus: "completed",
      confidence: {
        level: "moderate",
        score: 0.72,
        label: "Moderada",
        rationale: "Dados mínimos presentes.",
        drivers: ["input manual completo"],
        blockers: [],
      },
    },
    audit: {
      premises: [],
      appliedRules: [],
      missingData: [],
      warnings: [],
      timeline: [],
    },
    ...overrides,
  };
}

function buildDocument(confirmed: boolean): IngestedDocument {
  const now = new Date().toISOString();
  return {
    id: confirmed ? "doc-confirmed" : "doc-pending",
    name: "NF teste",
    originalFileName: "nf.xml",
    kind: "xml",
    detectedMimeType: "text/xml",
    source: "upload",
    status: confirmed ? "manual_review_confirmed" : "ready_for_manual_review",
    createdAt: now,
    updatedAt: now,
    file: {
      mimeType: "text/xml",
      sizeInBytes: 123,
      lastModified: Date.now(),
    },
    pages: [],
    ocrJobs: [],
    entities: [],
    extractedFields: [],
    manualReview: {
      required: true,
      reviewedBy: confirmed ? "usuario_local" : "pendente",
      confirmed,
      reviewedAt: confirmed ? now : undefined,
      fields: [],
      notes: [],
      confirmedFieldCount: 0,
      totalFieldCount: 0,
    },
    auditTrail: [],
    processingWarnings: [],
    placeholder: true,
  };
}

const readyGate = evaluateWorkspaceReadiness({
  profile: buildProfile(),
  simulation: buildSimulation(),
  documents: [],
  persistedReport: null,
});
assert.equal(readyGate.status, "pronto");
assert.equal(readyGate.canGenerateFinalReport, true);

const blockedByConsent = evaluateWorkspaceReadiness({
  profile: buildProfile({ consentMockAwareness: false }),
  simulation: null,
  documents: [],
  persistedReport: null,
});
assert.equal(blockedByConsent.status, "bloqueado");
assert.equal(blockedByConsent.canGenerateSimulation, false);

const blockedByDocuments = evaluateWorkspaceReadiness({
  profile: buildProfile({ flowMode: "documentos" }),
  simulation: buildSimulation(),
  documents: [buildDocument(false)],
  persistedReport: null,
});
assert.equal(blockedByDocuments.status, "bloqueado");
assert.equal(blockedByDocuments.blockers.some((item) => item.code === "DOCUMENT_REVIEW_REQUIRED"), true);

const blockedByLowConfidence = evaluateWorkspaceReadiness({
  profile: buildProfile(),
  simulation: buildSimulation({
    status: "partial",
    summary: {
      estimatedSavings: 100,
      estimatedSavingsLabel: "R$ 100,00",
      narrative: "Dados insuficientes.",
      decisionStatus: "completed_with_gaps",
      confidence: {
        level: "low",
        score: 0.31,
        label: "Baixa",
        rationale: "Lacunas críticas abertas.",
        drivers: [],
        blockers: ["campos críticos ausentes"],
      },
    },
    audit: {
      premises: [],
      appliedRules: [],
      warnings: [],
      timeline: [],
      missingData: [
        {
          id: "gap-1",
          field: "monthlyRevenue",
          label: "Faturamento",
          description: "Campo crítico ausente",
          severity: "blocking",
          blocking: true,
          whyItMatters: "Afeta a leitura base",
          suggestedAction: "Revisar input manual",
        },
      ],
    },
  }),
  documents: [],
  persistedReport: null,
});
assert.equal(blockedByLowConfidence.status, "bloqueado");
assert.equal(blockedByLowConfidence.blockers.some((item) => item.code === "LOW_CONFIDENCE_CRITICAL_DATA"), true);

console.log("readiness-gate.spec.ts: ok");
