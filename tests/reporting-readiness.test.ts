import test from "node:test";
import assert from "node:assert/strict";

import { renderReportHtml } from "@/lib/reporting";
import type { ReadinessSnapshotArtifact, UserReport } from "@/models/report";

const baseReport: UserReport = {
  id: "report-1",
  simulationId: "simulation-1",
  profileId: "profile-1",
  title: "Relatório final inicial do usuário (mock)",
  createdAt: "2026-03-24T15:00:00.000Z",
  updatedAt: "2026-03-24T15:00:00.000Z",
  summary: {
    executive: "Resumo executivo mock.",
    estimatedSavingsLabel: "R$ 1.000,00",
    decisionStatus: "review_required",
    scenarioLabel: "Cenário base",
  },
  premises: [
    {
      id: "premise-1",
      label: "Tipo de usuário declarado",
      description: "Informado localmente.",
      valueLabel: "Empresa",
      sourceRefs: ["onboarding-local"],
      explicitPlaceholder: false,
    },
  ],
  confidence: {
    level: "low",
    label: "Baixa",
    score: 0.4,
    rationale: "Ainda é um protótipo conservador.",
    drivers: ["Input manual preenchido"],
    blockers: ["Sem cobertura fiscal oficial"],
    reviewRecommendation: "Revisar manualmente antes de uso prático.",
  },
  alerts: [],
  gaps: [],
  explanation: {
    summary: "Contexto explicativo mock.",
    explicitPlaceholder: true,
    evidenceCount: 1,
    blocks: [
      {
        id: "block-1",
        title: "Bloco mock",
        summary: "Resumo mock.",
        explicitPlaceholder: true,
      },
    ],
    nextEvolutionNotes: ["Adicionar evolução futura com RAG local."],
  },
  footer: {
    disclaimer: "Relatório mock/placeholder gerado localmente.",
    mockVersion: "mock-report-v0.2",
    generatedAtLabel: "24/03/2026 15:00",
    localOnly: true,
  },
  export: {
    htmlFileName: "economizaia-relatorio.html",
    printReady: true,
    placeholderPdf: true,
  },
  sourceSimulation: {
    bundleId: "mvp-bundle-local-prototype",
    bundleVersion: "0.4.0-prototype-local",
    status: "partial",
  },
};

const readinessSnapshot: ReadinessSnapshotArtifact = {
  generatedAt: "2026-03-24T15:00:00.000Z",
  status: "pronto",
  statusLabel: "Pronto",
  summary: "Prontidão mínima atingida dentro da política mock.",
  checklist: [
    {
      id: "manual-minimum-readiness",
      label: "Prontidão mínima do input manual",
      done: true,
      detail: "Campos críticos ok.",
    },
  ],
  blockers: [],
  nextSteps: ["Gerar a simulação local.", "Salvar o relatório final local apenas como artefato mock revisado."],
  evidence: {
    flowModeLabel: "Modo rápido manual",
    userTypeLabel: "Empresa",
    activityTypeLabel: "Serviços digitais",
    periodLabel: "Mensal",
    confidenceLabel: "Baixa",
    bundleApprovalStatus: "reviewed_internal",
    bundleReviewStatus: "review_required",
    documentReviewPendingCount: 0,
    documentReviewConfirmedCount: 0,
    criticalMissingCount: 0,
    hasPersistedReport: false,
  },
};

test("relatório HTML inclui snapshot do gate de prontidão quando fornecido", () => {
  const html = renderReportHtml(baseReport, readinessSnapshot);

  assert.match(html, /Gate de prontidão/);
  assert.match(html, /Prontidão mínima atingida dentro da política mock/);
  assert.match(html, /Modo rápido manual/);
  assert.match(html, /review_required/);
});

test("relatório HTML mantém fallback quando snapshot do gate não é fornecido", () => {
  const html = renderReportHtml(baseReport);

  assert.match(html, /Nenhum snapshot de prontidão foi anexado a este relatório/);
});
