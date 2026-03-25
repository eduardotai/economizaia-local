import test from "node:test";
import assert from "node:assert/strict";

import { evaluateWorkspaceReadiness } from "@/lib/manual-first-readiness";
import { runFakeSimulation, runInsufficientDataSimulation } from "@/engine/fake-simulation";
import type { AnonymousOnboardingProfile } from "@/models/onboarding";
import type { IngestedDocument } from "@/models/documents";

function buildProfile(overrides: Partial<AnonymousOnboardingProfile> = {}): AnonymousOnboardingProfile {
  return {
    id: "profile-test",
    createdAt: "2026-03-24T15:00:00.000Z",
    updatedAt: "2026-03-24T15:00:00.000Z",
    userType: "empresa",
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
      monthlyExpenses: "3500",
      currentRegime: "simples",
      activityDescription: "Serviços digitais recorrentes",
      cnaeOrActivityCode: "6201-5/01",
      periodLabel: "Mensal",
    },
    ...overrides,
  };
}

function buildPendingDocument(): IngestedDocument {
  return {
    id: "doc-1",
    name: "nfse-marco",
    originalFileName: "nfse-marco.pdf",
    kind: "pdf",
    detectedMimeType: "application/pdf",
    source: "upload",
    status: "ready_for_manual_review",
    createdAt: "2026-03-24T15:00:00.000Z",
    updatedAt: "2026-03-24T15:00:00.000Z",
    file: {
      objectUrl: "blob:mock",
      mimeType: "application/pdf",
      sizeInBytes: 1200,
      lastModified: 1711280000000,
    },
    pages: [],
    ocrJobs: [],
    entities: [],
    extractedFields: [],
    manualReview: {
      required: true,
      reviewedBy: "pendente",
      confirmed: false,
      fields: [],
      notes: [],
      confirmedFieldCount: 0,
      totalFieldCount: 0,
    },
    processingWarnings: [],
    auditTrail: [],
    placeholder: true,
  };
}

test("manual-first pronto quando consentimentos e campos mínimos estão ok", () => {
  const gate = evaluateWorkspaceReadiness({
    profile: buildProfile(),
    simulation: runFakeSimulation(),
    documents: [],
    persistedReport: null,
  });

  assert.equal(gate.status, "pronto");
  assert.equal(gate.canGenerateSimulation, true);
  assert.equal(gate.canGenerateFinalReport, true);
  assert.equal(gate.blockers.length, 0);
});

test("bloqueia quando consentimentos mínimos não foram aceitos", () => {
  const gate = evaluateWorkspaceReadiness({
    profile: buildProfile({ consentLocalOnly: false, consentMockAwareness: false }),
    simulation: null,
    documents: [],
    persistedReport: null,
  });

  assert.equal(gate.status, "bloqueado");
  assert.equal(gate.canGenerateSimulation, false);
  assert.ok(gate.blockers.some((blocker) => blocker.code === "CONSENT_REQUIRED"));
});

test("bloqueia fluxo documental com revisão humana pendente", () => {
  const gate = evaluateWorkspaceReadiness({
    profile: buildProfile({ flowMode: "documentos" }),
    simulation: runFakeSimulation(),
    documents: [buildPendingDocument()],
    persistedReport: null,
  });

  assert.equal(gate.status, "bloqueado");
  assert.ok(gate.blockers.some((blocker) => blocker.code === "DOCUMENT_REVIEW_REQUIRED"));
});

test("bloqueia quando há confiança baixa com lacunas críticas", () => {
  const gate = evaluateWorkspaceReadiness({
    profile: buildProfile({
      quickManualInput: {
        monthlyRevenue: "1000",
        monthlyExpenses: "",
        currentRegime: "indefinido",
        activityDescription: "",
        cnaeOrActivityCode: "",
        periodLabel: "Mensal",
      },
    }),
    simulation: runInsufficientDataSimulation(),
    documents: [],
    persistedReport: null,
  });

  assert.equal(gate.status, "bloqueado");
  assert.ok(gate.blockers.some((blocker) => blocker.code === "LOW_CONFIDENCE_CRITICAL_DATA"));
});
