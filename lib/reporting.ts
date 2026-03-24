import { localDb } from "@/db/local-db";
import { formatCurrency } from "@/engine/types";
import type { AnonymousOnboardingProfile } from "@/models/onboarding";
import type { PersistedUserReport, ReportPremiseItem, UserReport } from "@/models/report";
import type { SimulationPremise, SimulationResult } from "@/models/domain";
import { activityTypeLabels, revenueRangeLabels, simulationPeriodLabels, userTypeLabels } from "@/lib/onboarding";
import { createId, nowIso } from "@/lib/document-utils";
import { explainWithLocalLlm, getLocalExplainerCapability, createLocalExplainerChatSession } from "@/lib/web-llm";
import { buildExplanationContext } from "@/rag";

const REPORT_STORAGE_KEY_PREFIX = "user_report";
const REPORT_MOCK_VERSION = "mock-report-v0.1";

function premiseValueToLabel(value: SimulationPremise["value"]) {
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (value === null || typeof value === "undefined" || value === "") return undefined;
  return String(value);
}

function mapPremises(simulation: SimulationResult, profile: AnonymousOnboardingProfile): ReportPremiseItem[] {
  const profilePremises: ReportPremiseItem[] = [
    {
      id: "premise-user-type",
      label: "Tipo de usuário declarado",
      description: "Informado no onboarding anônimo local.",
      valueLabel: userTypeLabels[profile.userType],
      sourceRefs: ["onboarding-local"],
      explicitPlaceholder: false,
    },
    {
      id: "premise-revenue-range",
      label: "Faixa de faturamento declarada",
      description: "Faixa usada apenas para orientar a simulação mock.",
      valueLabel: revenueRangeLabels[profile.revenueRange],
      sourceRefs: ["onboarding-local"],
      explicitPlaceholder: true,
    },
    {
      id: "premise-activity-type",
      label: "Tipo de atividade declarado",
      description: "Contexto de atividade informado no onboarding local-first.",
      valueLabel: activityTypeLabels[profile.activityType],
      sourceRefs: ["onboarding-local"],
      explicitPlaceholder: false,
    },
    {
      id: "premise-simulation-period",
      label: "Período da visualização",
      description: "Recorte solicitado para o relatório mock.",
      valueLabel: simulationPeriodLabels[profile.simulationPeriod],
      sourceRefs: ["onboarding-local"],
      explicitPlaceholder: true,
    },
  ];

  const auditPremises = simulation.audit.premises.map((premise) => ({
    id: premise.id,
    label: premise.label,
    description: premise.description,
    valueLabel: premiseValueToLabel(premise.value),
    sourceRefs: premise.sourceRefs,
    explicitPlaceholder: premise.explicitPlaceholder,
  }));

  return [...profilePremises, ...auditPremises];
}

function buildExecutiveSummary(simulation: SimulationResult, profile: AnonymousOnboardingProfile) {
  const currentScenarioLabel = simulation.currentScenario.label;
  const estimatedSavingsLabel = simulation.summary.estimatedSavingsLabel || formatCurrency(simulation.summary.estimatedSavings);
  const userLabel = userTypeLabels[profile.userType];

  return [
    `Resumo mock para ${userLabel}: o cenário atual \"${currentScenarioLabel}\" indica ${estimatedSavingsLabel} como economia potencial apenas ilustrativa.`,
    `A decisão do motor local está em \"${simulation.summary.decisionStatus}\" com confiança \"${simulation.summary.confidence.label}\".`,
    "Este texto não representa cálculo fiscal oficial e serve apenas como síntese estruturada do protótipo local-first.",
  ].join(" ");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderList(items: string[]) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

export function renderReportHtml(report: UserReport) {
  const premiseItems = report.premises
    .map(
      (premise) => `
        <li>
          <strong>${escapeHtml(premise.label)}</strong><br />
          ${escapeHtml(premise.description)}
          ${premise.valueLabel ? `<div><em>Valor:</em> ${escapeHtml(premise.valueLabel)}</div>` : ""}
          <div><em>Origem:</em> ${escapeHtml(premise.sourceRefs.join(", ") || "não informada")}</div>
          ${premise.explicitPlaceholder ? '<div><strong>Marcado como mock/placeholder.</strong></div>' : ""}
        </li>`,
    )
    .join("");

  const alertItems = report.alerts.length
    ? report.alerts
        .map(
          (alert) => `
            <li>
              <strong>${escapeHtml(alert.title)}</strong> (${escapeHtml(alert.severity)})<br />
              ${escapeHtml(alert.message)}
              ${alert.requiresHumanReview ? "<div><em>Requer revisão humana.</em></div>" : ""}
            </li>`,
        )
        .join("")
    : "<li>Nenhum alerta adicional registrado neste relatório mock.</li>";

  const gapItems = report.gaps.length
    ? report.gaps
        .map(
          (gap) => `
            <li>
              <strong>${escapeHtml(gap.label)}</strong> (${escapeHtml(gap.severity)})<br />
              ${escapeHtml(gap.description)}
              <div><em>Ação sugerida:</em> ${escapeHtml(gap.suggestedAction)}</div>
            </li>`,
        )
        .join("")
    : "<li>Nenhuma lacuna adicional registrada neste relatório mock.</li>";

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(report.title)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 32px; color: #111827; background: #f8fafc; }
      main { max-width: 920px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 20px; }
      h1, h2, h3 { color: #0f172a; }
      .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #dcfce7; color: #166534; font-size: 12px; font-weight: 700; }
      .section { margin-top: 28px; }
      .muted { color: #475569; }
      .panel { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; margin-top: 12px; }
      ul { padding-left: 20px; }
      li { margin-bottom: 12px; }
      footer { margin-top: 32px; font-size: 12px; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 16px; }
      @media print { body { background: #fff; padding: 0; } main { max-width: none; border-radius: 0; box-shadow: none; padding: 0; } }
    </style>
  </head>
  <body>
    <main>
      <span class="badge">Relatório local mock/placeholder</span>
      <h1>${escapeHtml(report.title)}</h1>
      <p class="muted">Gerado em ${escapeHtml(report.footer.generatedAtLabel)} · versão ${escapeHtml(report.footer.mockVersion)}</p>

      <section class="section">
        <h2>Resumo executivo</h2>
        <div class="panel">
          <p>${escapeHtml(report.summary.executive)}</p>
          <p><strong>Economia estimada (mock):</strong> ${escapeHtml(report.summary.estimatedSavingsLabel)}</p>
          <p><strong>Status da decisão:</strong> ${escapeHtml(report.summary.decisionStatus)}</p>
          <p><strong>Cenário analisado:</strong> ${escapeHtml(report.summary.scenarioLabel)}</p>
        </div>
      </section>

      <section class="section">
        <h2>Premissas</h2>
        <ul>${premiseItems}</ul>
      </section>

      <section class="section">
        <h2>Confiança</h2>
        <div class="panel">
          <p><strong>Nível:</strong> ${escapeHtml(report.confidence.label)} (${report.confidence.score})</p>
          <p>${escapeHtml(report.confidence.rationale)}</p>
          <h3>Fatores positivos</h3>
          <ul>${renderList(report.confidence.drivers)}</ul>
          <h3>Bloqueios e restrições</h3>
          <ul>${renderList(report.confidence.blockers.length ? report.confidence.blockers : ["Sem bloqueios adicionais explicitados."])}</ul>
          ${report.confidence.reviewRecommendation ? `<p><strong>Recomendação:</strong> ${escapeHtml(report.confidence.reviewRecommendation)}</p>` : ""}
        </div>
      </section>

      <section class="section">
        <h2>Alertas e lacunas</h2>
        <div class="panel">
          <h3>Alertas</h3>
          <ul>${alertItems}</ul>
          <h3>Lacunas</h3>
          <ul>${gapItems}</ul>
        </div>
      </section>

      <section class="section">
        <h2>Contexto explicativo local</h2>
        <div class="panel">
          <p>${escapeHtml(report.explanation?.summary ?? "Contexto explicativo ainda não gerado.")}</p>
          <p><strong>Evidências recuperadas:</strong> ${report.explanation?.evidenceCount ?? 0}</p>
          <h3>Blocos de contexto</h3>
          <ul>${
            report.explanation?.blocks.length
              ? report.explanation.blocks
                  .map(
                    (block) => `
                      <li>
                        <strong>${escapeHtml(block.title)}</strong><br />
                        ${escapeHtml(block.summary)}
                        ${block.explicitPlaceholder ? "<div><em>Marcado como mock/placeholder.</em></div>" : ""}
                      </li>`,
                  )
                  .join("")
              : "<li>Nenhum bloco de contexto disponível.</li>"
          }</ul>
          <h3>Capability do local explainer</h3>
          <ul>
            <li><strong>Modo:</strong> ${escapeHtml(report.localExplainerCapability?.mode ?? "N/A")}</li>
            <li><strong>Status:</strong> ${escapeHtml(report.localExplainerCapability?.statusLabel ?? "N/A")}</li>
            <li><strong>Provider:</strong> ${escapeHtml(report.localExplainerCapability?.provider ?? "N/A")}</li>
            <li><strong>Disponibilidade:</strong> ${escapeHtml(report.localExplainerCapability?.availability ?? "N/A")}</li>
            <li><strong>Ativação:</strong> ${escapeHtml(report.localExplainerCapability?.activationLabel ?? "N/A")}</li>
            <li>${escapeHtml(report.localExplainerCapability?.detail ?? "Capability ainda não registrada.")}</li>
          </ul>
          <p><strong>Privacidade:</strong> chain-of-thought é interno/privado. O contexto explicativo futuro deve vir de RAG local.</p>
          <h3>Resposta local mock</h3>
          <p>${escapeHtml(report.localExplainerResponse?.answer ?? "Nenhuma resposta local gerada.")}</p>
          <p><strong>Disclaimer do explainer:</strong> ${escapeHtml(report.localExplainerResponse?.disclaimer ?? "Sem disclaimer adicional.")}</p>
          <p><strong>Prompt scaffold:</strong> ${escapeHtml(report.localExplainerResponse?.promptContract.scaffoldPrompt ?? "Não disponível.")}</p>
          <h3>Chat placeholder</h3>
          <ul>${
            report.localExplainerChat?.turns.length
              ? report.localExplainerChat.turns
                  .map(
                    (turn) => `
                      <li>
                        <strong>${escapeHtml(turn.role)}</strong><br />
                        ${escapeHtml(turn.content)}
                      </li>`,
                  )
                  .join("")
              : "<li>Nenhuma sessão de chat placeholder disponível.</li>"
          }</ul>
          <h3>Próxima evolução técnica</h3>
          <ul>${renderList([
            ...(report.explanation?.nextEvolutionNotes ?? []),
            ...(report.localExplainerResponse?.followUps ?? []),
          ])}</ul>
        </div>
      </section>

      <footer>
        <div><strong>Disclaimer:</strong> ${escapeHtml(report.footer.disclaimer)}</div>
        <div><strong>Escopo:</strong> Persistência local neste dispositivo = ${report.footer.localOnly ? "sim" : "não"}.</div>
        <div><strong>Exportação:</strong> HTML pronto para impressão. PDF continua como placeholder explícito neste checkpoint.</div>
      </footer>
    </main>
  </body>
</html>`;
}

export async function buildUserReport(params: { simulation: SimulationResult; profile: AnonymousOnboardingProfile }): Promise<PersistedUserReport> {
  const { simulation, profile } = params;
  const now = nowIso();
  const reportId = createId(REPORT_STORAGE_KEY_PREFIX);

  const explanationContext = buildExplanationContext({
    simulationId: simulation.id,
    reportId,
    query: [
      simulation.summary.narrative,
      simulation.summary.confidence.rationale,
      ...simulation.audit.warnings.map((warning) => warning.title),
      ...simulation.audit.missingData.map((gap) => gap.label),
    ].join(" "),
    tags: ["mock", "placeholder", "revisão humana", "rag local"],
  });

  const localExplainerCapability = getLocalExplainerCapability("light");
  const localExplainerResponse = await explainWithLocalLlm({
    simulation: {
      id: simulation.id,
      summary: simulation.summary,
      audit: simulation.audit,
      currentScenario: simulation.currentScenario,
      status: simulation.status,
      bundleVersion: simulation.bundleVersion,
    },
    reportId,
    channel: "report",
    mode: "light",
    explanationContext,
  });
  const localExplainerChat = await createLocalExplainerChatSession({
    simulation: {
      id: simulation.id,
      summary: simulation.summary,
      audit: simulation.audit,
      currentScenario: simulation.currentScenario,
      status: simulation.status,
      bundleVersion: simulation.bundleVersion,
    },
    reportId,
    mode: "light",
  });

  const report: UserReport = {
    id: reportId,
    simulationId: simulation.id,
    profileId: simulation.profileId,
    title: "Relatório final inicial do usuário (mock)",
    createdAt: now,
    updatedAt: now,
    summary: {
      executive: buildExecutiveSummary(simulation, profile),
      estimatedSavingsLabel: simulation.summary.estimatedSavingsLabel || formatCurrency(simulation.summary.estimatedSavings),
      decisionStatus: simulation.summary.decisionStatus,
      scenarioLabel: simulation.currentScenario.label,
    },
    localExplainerCapability,
    localExplainerResponse,
    localExplainerChat,
    premises: mapPremises(simulation, profile),
    confidence: {
      level: simulation.summary.confidence.level,
      label: simulation.summary.confidence.label,
      score: simulation.summary.confidence.score,
      rationale: simulation.summary.confidence.rationale,
      drivers: simulation.summary.confidence.drivers,
      blockers: simulation.summary.confidence.blockers ?? [],
      reviewRecommendation: simulation.summary.confidence.reviewRecommendation,
    },
    alerts: simulation.audit.warnings,
    gaps: simulation.audit.missingData,
    explanationContext,
    explanation: {
      summary: explanationContext.userFacingSummary,
      explicitPlaceholder: true,
      evidenceCount: explanationContext.retrieval.evidences.length,
      blocks: explanationContext.blocks.map((block) => ({
        id: block.id,
        title: block.title,
        summary: block.summary,
        explicitPlaceholder: block.explicitPlaceholder,
      })),
      nextEvolutionNotes: explanationContext.nextEvolutionNotes,
    },
    footer: {
      disclaimer:
        "Relatório mock/placeholder gerado localmente. Não constitui cálculo fiscal oficial, parecer tributário, recomendação contábil ou validação normativa.",
      mockVersion: REPORT_MOCK_VERSION,
      generatedAtLabel: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(now)),
      localOnly: true,
    },
    export: {
      htmlFileName: `economizaia-relatorio-${simulation.id}.html`,
      printReady: true,
      placeholderPdf: true,
    },
    sourceSimulation: {
      bundleId: simulation.bundleId,
      bundleVersion: simulation.bundleVersion,
      status: simulation.status,
    },
  };

  return {
    report,
    renderedHtml: renderReportHtml(report),
  };
}

export async function persistUserReport(persistedReport: PersistedUserReport) {
  await localDb.saveUserReport(persistedReport);
  return persistedReport;
}
