import assert from "node:assert/strict";

import { evaluateOperationalReadiness } from "@/lib/operational-readiness";
import type { LocalAuditEvent, LocalSnapshot } from "@/db/persistence-types";
import type { IngestedDocument } from "@/models/documents";
import type { SimulationResult } from "@/models/domain";
import type { AnonymousOnboardingProfile } from "@/models/onboarding";
import type { PersistedUserReport } from "@/models/report";

const now = new Date().toISOString();

const profile: AnonymousOnboardingProfile = {
  id: "profile-1",
  createdAt: now,
  updatedAt: now,
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
    monthlyRevenue: "22000",
    monthlyExpenses: "3000",
    currentRegime: "simples",
    activityDescription: "Serviços de software",
    cnaeOrActivityCode: "6201-5/01",
    periodLabel: "Recorte mensal",
  },
};

const simulation: SimulationResult = {
  id: "sim-1",
  createdAt: now,
  profileId: profile.id,
  bundleId: "mvp-bundle-local-prototype",
  bundleVersion: "0.4.0-prototype-local",
  status: "success",
  currentScenario: {
    id: "scenario-1",
    label: "Atual",
    monthlyTaxEstimate: 1000,
    notes: [],
    confidence: {
      level: "moderate",
      score: 0.7,
      label: "Moderada",
      rationale: "ok",
      drivers: ["dados presentes"],
      blockers: [],
    },
    placeholdersUsed: ["mock"],
  },
  suggestedScenario: undefined,
  summary: {
    estimatedSavings: 300,
    estimatedSavingsLabel: "R$ 300,00",
    narrative: "mock",
    decisionStatus: "completed",
    confidence: {
      level: "moderate",
      score: 0.7,
      label: "Moderada",
      rationale: "ok",
      drivers: ["dados presentes"],
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
};

const report: PersistedUserReport = {
  report: {
    id: "report-1",
    simulationId: simulation.id,
    profileId: profile.id,
    title: "Relatório",
    createdAt: now,
    updatedAt: now,
    summary: {
      executive: "Resumo",
      estimatedSavingsLabel: "R$ 300,00",
      decisionStatus: "completed",
      scenarioLabel: "Atual",
    },
    premises: [],
    confidence: {
      level: "moderate",
      label: "Moderada",
      score: 0.7,
      rationale: "ok",
      drivers: [],
      blockers: [],
    },
    alerts: [],
    gaps: [],
    footer: {
      disclaimer: "mock",
      mockVersion: "mock-report-v0.2",
      generatedAtLabel: "agora",
      localOnly: true,
    },
    export: {
      htmlFileName: "report.html",
      printReady: true,
      placeholderPdf: true,
    },
    sourceSimulation: {
      bundleId: simulation.bundleId,
      bundleVersion: simulation.bundleVersion,
      status: simulation.status,
    },
  },
  renderedHtml: "<html></html>",
};

const document: IngestedDocument = {
  id: "doc-1",
  name: "Doc",
  originalFileName: "doc.xml",
  kind: "xml",
  detectedMimeType: "text/xml",
  source: "upload",
  status: "manual_review_confirmed",
  createdAt: now,
  updatedAt: now,
  file: { mimeType: "text/xml", sizeInBytes: 100, lastModified: Date.now() },
  pages: [],
  ocrJobs: [],
  entities: [],
  extractedFields: [],
  manualReview: {
    required: true,
    reviewedBy: "usuario_local",
    confirmed: true,
    reviewedAt: now,
    fields: [],
    notes: [],
    confirmedFieldCount: 0,
    totalFieldCount: 0,
  },
  auditTrail: [],
  processingWarnings: [],
  placeholder: true,
};

const snapshots: LocalSnapshot<unknown>[] = [
  { id: "s1", scope: "profile", entityId: profile.id, createdAt: now, payload: profile, localOnly: true },
  { id: "s2", scope: "simulation", entityId: simulation.id, createdAt: now, payload: simulation, localOnly: true },
  { id: "s3", scope: "report", entityId: report.report.id, createdAt: now, payload: report, localOnly: true },
  { id: "s4", scope: "document", entityId: document.id, createdAt: now, payload: document, localOnly: true },
];

const auditEvents: LocalAuditEvent[] = [
  { id: "a1", timestamp: now, aggregateId: profile.id, aggregateType: "profile", kind: "profile_validated", message: "ok", status: "info" },
  { id: "a2", timestamp: now, aggregateId: simulation.id, aggregateType: "simulation", kind: "simulation_started", message: "ok", status: "info" },
  { id: "a3", timestamp: now, aggregateId: simulation.id, aggregateType: "result", kind: "simulation_finished", message: "ok", status: "info" },
];

const strong = evaluateOperationalReadiness({
  profile,
  simulation,
  persistedReport: report,
  documents: [document],
  snapshots,
  auditEvents,
});
assert.equal(strong.status, "confiavel");
assert.equal(strong.evidence.reportMatchesSimulation, true);

const weak = evaluateOperationalReadiness({
  profile,
  simulation,
  persistedReport: {
    ...report,
    report: {
      ...report.report,
      simulationId: "other-sim",
    },
  },
  documents: [],
  snapshots: [],
  auditEvents: [],
});
assert.equal(weak.evidence.reportMatchesSimulation, false);
assert.equal(weak.status, "fragil");

console.log("operational-readiness.spec.ts: ok");
