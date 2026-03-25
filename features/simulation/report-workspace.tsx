"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Brain, Download, FileText, Lock, Printer, Save, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { localDb } from "@/db/local-db";
import { createSimulationAuditEvents } from "@/lib/local-audit";
import { saveReportSnapshot } from "@/lib/local-snapshots";
import { createId, nowIso } from "@/lib/document-utils";
import { buildUserReport, persistUserReport } from "@/lib/reporting";
import { generateReportPdf, downloadPdfBlob } from "@/lib/pdf-export";
import { buildAccountantExportPackage, buildAccountantCsv, downloadJsonExport, downloadCsvExport } from "@/lib/export-for-accountant";
import { explainWithLocalLlm, getLocalExplainerCapability, getWebLLMState, initializeLocalLlm, onWebLLMProgress } from "@/lib/web-llm";
import { evaluateWorkspaceReadiness, type WorkspaceReadinessGate } from "@/lib/readiness-gate";
import { evaluateOperationalReadiness } from "@/lib/operational-readiness";
import type { ReadinessSnapshotArtifact } from "@/models/report";
import type { LocalExplainerChatTurn } from "@/models/local-explainer";
import type { IngestedDocument } from "@/models/documents";
import type { SimulationResult } from "@/models/domain";
import type { AnonymousOnboardingProfile } from "@/models/onboarding";
import type { PersistedUserReport } from "@/models/report";

interface ReportWorkspaceProps {
  profile: AnonymousOnboardingProfile | null;
  simulation: SimulationResult | null;
  persistedReport: PersistedUserReport | null;
  documents: IngestedDocument[];
  onReportPersisted(report: PersistedUserReport): void;
}

function buildReadinessSnapshotArtifact(readinessGate: WorkspaceReadinessGate): ReadinessSnapshotArtifact {
  return {
    generatedAt: new Date().toISOString(),
    status: readinessGate.status,
    statusLabel: readinessGate.statusLabel,
    summary: readinessGate.summary,
    checklist: readinessGate.checklist.map((item) => ({
      id: item.id,
      label: item.label,
      done: item.done,
      detail: item.detail,
    })),
    blockers: readinessGate.blockers.map((blocker) => ({
      code: blocker.code,
      title: blocker.title,
      message: blocker.message,
      nextSteps: [...blocker.nextSteps],
    })),
    nextSteps: [...readinessGate.nextSteps],
    evidence: { ...readinessGate.evidence },
  };
}

function downloadHtmlFile(fileName: string, html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function openPrintPreview(html: string) {
  const previewWindow = window.open("", "_blank", "noopener,noreferrer,width=1024,height=768");

  if (!previewWindow) {
    window.alert("Não foi possível abrir a prévia de impressão neste navegador.");
    return;
  }

  previewWindow.document.open();
  previewWindow.document.write(html);
  previewWindow.document.close();
  previewWindow.focus();
  previewWindow.print();
}

export function ReportWorkspace({ profile, simulation, persistedReport, documents, onReportPersisted }: ReportWorkspaceProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Awaited<ReturnType<typeof localDb.listSnapshots>>>([]);
  const [auditEvents, setAuditEvents] = useState<Awaited<ReturnType<typeof localDb.listAuditEvents>>>([]);
  const [webllmState, setWebllmState] = useState(getWebLLMState());
  const [webllmProgress, setWebllmProgress] = useState<{ pct: number; text: string } | null>(null);
  const [chatTurns, setChatTurns] = useState<LocalExplainerChatTurn[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    return onWebLLMProgress((pct, text) => {
      setWebllmProgress({ pct, text });
      setWebllmState(getWebLLMState());
    });
  }, []);

  async function handleActivateWebLLM() {
    setWebllmState("loading");
    setWebllmProgress({ pct: 0, text: "Iniciando download do modelo…" });
    const ok = await initializeLocalLlm();
    setWebllmState(getWebLLMState());
    if (!ok) setStatusMessage("Não foi possível carregar o modelo local. Verifique se o navegador suporta WebGPU (Chrome/Edge).");
    else setStatusMessage("Modelo local carregado. Gere o relatório para usar explicações por IA.");
  }

  async function handleDownloadPdf() {
    if (!persistedReport) return;
    setIsGeneratingPdf(true);
    setStatusMessage("Gerando PDF…");
    try {
      const blob = await generateReportPdf(persistedReport.report, persistedReport.readinessSnapshot);
      if (blob) {
        const fileName = persistedReport.report.export.htmlFileName.replace(".html", ".pdf");
        downloadPdfBlob(blob, fileName);
        setStatusMessage("PDF gerado e baixado localmente.");
      } else {
        setStatusMessage("Não foi possível gerar o PDF. Use a opção de impressão como alternativa.");
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  function handleExportForAccountant(format: "json" | "csv") {
    if (!profile || !simulation) return;
    const pkg = buildAccountantExportPackage({ profile, simulation, documents, persistedReport });
    if (format === "json") {
      downloadJsonExport(pkg);
      setStatusMessage("Pacote JSON exportado localmente para o contador.");
    } else {
      downloadCsvExport(buildAccountantCsv(pkg));
      setStatusMessage("Planilha CSV exportada localmente para o contador.");
    }
  }

  async function handleChatSend() {
    const question = chatInput.trim();
    if (!question || !simulation || isChatLoading) return;

    const userTurn: LocalExplainerChatTurn = {
      id: createId("chat_turn"),
      role: "user",
      content: question,
      createdAt: nowIso(),
      explicitPlaceholder: false,
    };

    setChatTurns((prev) => [...prev, userTurn]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const mode = webllmState === "ready" ? "ai" : "light";
      const response = await explainWithLocalLlm({
        simulation,
        reportId: persistedReport?.report.id,
        channel: "chat",
        mode,
        userPrompt: question,
      });

      const assistantTurn: LocalExplainerChatTurn = {
        id: createId("chat_turn"),
        role: "assistant",
        content: response.answer,
        createdAt: nowIso(),
        explicitPlaceholder: response.explicitPlaceholder,
      };

      setChatTurns((prev) => [...prev, assistantTurn]);
    } catch {
      const errorTurn: LocalExplainerChatTurn = {
        id: createId("chat_turn"),
        role: "assistant",
        content: "Não foi possível processar a pergunta. Tente novamente.",
        createdAt: nowIso(),
        explicitPlaceholder: true,
      };
      setChatTurns((prev) => [...prev, errorTurn]);
    } finally {
      setIsChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  const aiCapability = getLocalExplainerCapability("ai");

  const report = useMemo(() => persistedReport?.report ?? null, [persistedReport]);
  const readinessGate: WorkspaceReadinessGate | null = useMemo(() => {
    if (!profile) return null;
    return evaluateWorkspaceReadiness({ profile, simulation, documents, persistedReport });
  }, [profile, simulation, documents, persistedReport]);

  const operationalReadiness = useMemo(
    () => evaluateOperationalReadiness({ profile, simulation, persistedReport, documents, snapshots, auditEvents }),
    [profile, simulation, persistedReport, documents, snapshots, auditEvents],
  );

  async function handleGenerateReport() {
    if (!profile || !simulation || !readinessGate) return;

    if (!readinessGate.canGenerateFinalReport) {
      setStatusMessage(readinessGate.refusalMessage ?? "Relatório final bloqueado até concluir a revisão manual e a prontidão mínima.");
      return;
    }

    if (persistedReport && !operationalReadiness.evidence.reportMatchesSimulation) {
      setStatusMessage("Existe um relatório salvo que não corresponde à simulação vigente. Gere novamente para manter a demonstração consistente.");
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const nextReport = await buildUserReport({
        profile,
        simulation,
        readinessSnapshot: buildReadinessSnapshotArtifact(readinessGate),
      });
      await persistUserReport(nextReport);
      await saveReportSnapshot(nextReport);

      const auditEvents = createSimulationAuditEvents(simulation);
      await Promise.all(auditEvents.map((event) => localDb.appendAuditEvent(event)));

      onReportPersisted(nextReport);
      setSnapshots(await localDb.listSnapshots());
      setAuditEvents(await localDb.listAuditEvents());
      setStatusMessage("Relatório salvo localmente com snapshot do gate e trilha auditável atualizados.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section id="relatorio" className="space-y-6 scroll-mt-8">
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge variant="secondary">Relatório local</Badge>
            <CardTitle>Relatório estruturado com exportação local e contexto de evidência</CardTitle>
            <CardDescription className="leading-6">
              Gera uma versão inicial do relatório, salva localmente e exporta HTML pronto para impressão.
              <strong> PDF continua sendo a impressão do navegador</strong> neste checkpoint. A camada de IA permanece explicativa e controlada.
            </CardDescription>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <div>Persistência</div>
            <div className="mt-1 font-medium text-white">Local-only no navegador</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-violet-400/20 bg-violet-400/10 p-4 text-sm text-violet-50">
            <div className="font-medium">Fechamento ideal da demo</div>
            <ol className="mt-2 space-y-1 text-violet-100/90">
              <li>1. Mostre o gate final e por que ele pode bloquear a saída.</li>
              <li>2. Gere o relatório apenas quando a revisão obrigatória estiver coerente.</li>
              <li>3. Termine baixando HTML ou abrindo a impressão para reforçar a entrega local.</li>
            </ol>
          </div>

          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-100">
            <div className="font-medium text-white">Status das regras usadas nesta leitura</div>
            <div className="mt-3 space-y-1 text-sm">
              <div><strong>Bundle:</strong> {simulation?.bundleId ?? "mvp-bundle-local-prototype"}</div>
              <div><strong>Versão:</strong> {simulation?.bundleVersion ?? "n/d"}</div>
              <div><strong>Status:</strong> protótipo local / mock / review_required</div>
              <div><strong>Aprovação:</strong> reviewed_internal neste checkpoint</div>
            </div>
            <p className="mt-3 text-xs leading-5 text-emerald-50/90">
              Este bloco existe para dar visibilidade ao estado do pacote de regras sem sugerir homologação fiscal oficial.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            disabled={
              !profile ||
              !simulation ||
              isSaving ||
              !readinessGate?.canGenerateFinalReport ||
              Boolean(persistedReport && !operationalReadiness.evidence.reportMatchesSimulation)
            }
            onClick={() => void handleGenerateReport()}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Gerando relatório..." : "Gerar e salvar relatório local"}
          </Button>
          {webllmState === "ready" ? (
            <Button variant="outline" disabled className="border-emerald-400/30 text-emerald-300">
              <Brain className="mr-2 h-4 w-4" /> IA local ativa
            </Button>
          ) : webllmState === "loading" ? (
            <Button variant="outline" disabled>
              <Brain className="mr-2 h-4 w-4 animate-pulse" />
              {webllmProgress ? `${Math.round(webllmProgress.pct * 100)}%` : "Carregando modelo…"}
            </Button>
          ) : aiCapability.availability === "unavailable" ? (
            <Button variant="outline" disabled title={aiCapability.detail}>
              <Brain className="mr-2 h-4 w-4" /> WebGPU indisponível
            </Button>
          ) : (
            <Button variant="outline" onClick={() => void handleActivateWebLLM()} title={aiCapability.detail}>
              <Brain className="mr-2 h-4 w-4" /> Ativar IA local (~2GB)
            </Button>
          )}
          <Button
            variant="outline"
            disabled={!persistedReport}
            onClick={() => {
              if (!persistedReport) return;
              downloadHtmlFile(persistedReport.report.export.htmlFileName, persistedReport.renderedHtml);
              setStatusMessage("HTML do relatório baixado localmente.");
            }}
          >
            <Download className="mr-2 h-4 w-4" /> Baixar HTML
          </Button>
          <Button
            variant="outline"
            disabled={!persistedReport || isGeneratingPdf}
            onClick={() => void handleDownloadPdf()}
          >
            <Download className="mr-2 h-4 w-4" />
            {isGeneratingPdf ? "Gerando PDF…" : "Baixar PDF"}
          </Button>
          <Button
            variant="outline"
            disabled={!persistedReport}
            onClick={() => {
              if (!persistedReport) return;
              openPrintPreview(persistedReport.renderedHtml);
              setStatusMessage("Prévia de impressão aberta em uma nova janela.");
            }}
          >
            <Printer className="mr-2 h-4 w-4" /> Imprimir / salvar em PDF
          </Button>
          <Button
            variant="outline"
            disabled={!profile || !simulation}
            onClick={() => handleExportForAccountant("json")}
            title="Exporta JSON auditável com todos os dados da simulação para revisão por contador"
          >
            <Download className="mr-2 h-4 w-4" /> Exportar JSON (contador)
          </Button>
          <Button
            variant="outline"
            disabled={!profile || !simulation}
            onClick={() => handleExportForAccountant("csv")}
            title="Exporta planilha CSV com perfil, simulação, premissas e alertas para revisão por contador"
          >
            <Download className="mr-2 h-4 w-4" /> Exportar CSV (contador)
          </Button>
        </div>

        {aiCapability.availability === "unavailable" ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">
            <div className="mb-2 flex items-center gap-2 font-medium text-white">
              <AlertTriangle className="h-4 w-4" /> IA local indisponível — WebGPU não detectado
            </div>
            <p className="leading-6">
              A explicação por IA local requer <strong>WebGPU</strong>, disponível no <strong>Chrome 113+</strong> ou <strong>Edge 113+</strong> (desktop).
              Firefox e Safari ainda não suportam. Em dispositivos móveis, o suporte pode variar.
            </p>
            <p className="mt-2 leading-6">
              Todas as outras funcionalidades — simulação, documentos, relatório e exportação — continuam operando normalmente em modo leve, sem IA generativa.
            </p>
          </div>
        ) : null}

        {webllmState === "loading" && webllmProgress ? (
          <div className="space-y-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-violet-400 transition-all duration-300"
                style={{ width: `${Math.round(webllmProgress.pct * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{webllmProgress.text}</p>
          </div>
        ) : null}

        {readinessGate ? (
          <div className={`rounded-2xl border p-4 text-sm ${readinessGate.status === "pronto" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : readinessGate.status === "bloqueado" ? "border-red-400/20 bg-red-400/10 text-red-100" : "border-amber-400/20 bg-amber-400/10 text-amber-100"}`}>
            <div className="mb-3 rounded-2xl border border-current/10 bg-background/40 p-3 text-xs opacity-95">
              Etapa final: quando este gate estiver liberado, gere o relatório local, exporte o HTML e use a impressão do navegador para demonstrar a saída final sem backend remoto.
            </div>
            <div className="flex items-start gap-3">
              {readinessGate.status === "bloqueado" ? <AlertTriangle className="mt-0.5 h-4 w-4" /> : <Lock className="mt-0.5 h-4 w-4" />}
              <div className="space-y-2">
                <div className="font-medium">Gate final do relatório: {readinessGate.statusLabel}</div>
                <p>{readinessGate.summary}</p>
                {readinessGate.refusalTitle ? <p><strong>{readinessGate.refusalTitle}:</strong> {readinessGate.refusalMessage}</p> : null}
                <ul className="list-disc space-y-1 pl-5">
                  {readinessGate.nextSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                  {persistedReport && !operationalReadiness.evidence.reportMatchesSimulation ? (
                    <li>Existe um relatório salvo para outra simulação/bundle. Gere novamente antes de exportar para manter a evidência consistente.</li>
                  ) : null}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        {statusMessage ? <p className="text-sm text-emerald-200">{statusMessage}</p> : null}
      </Card>

      {report ? (
        <Card className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge>Prévia do relatório</Badge>
              <CardTitle className="mt-2">{report.title}</CardTitle>
              <CardDescription className="mt-2 leading-6">
                Versão local persistida neste dispositivo com resumo executivo, premissas, confiança, alertas, lacunas,
                status de capability e resposta explicativa conservadora.
              </CardDescription>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm">
              <div className="text-muted-foreground">Versão</div>
              <div className="mt-1 font-medium text-white">{report.footer.mockVersion}</div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center gap-2 font-medium text-white">
                <FileText className="h-4 w-4 text-sky-300" /> Resumo executivo
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{report.summary.executive}</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Economia estimada (mock): {report.summary.estimatedSavingsLabel}</li>
                <li>Status: {report.summary.decisionStatus}</li>
                <li>Cenário: {report.summary.scenarioLabel}</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
              <div className="font-medium text-white">Confiança</div>
              <p className="mt-3">
                {report.confidence.label} ({report.confidence.score})
              </p>
              <p className="mt-2 leading-6">{report.confidence.rationale}</p>
              <div className="mt-3">
                <div className="font-medium text-white">Drivers</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {report.confidence.drivers.map((driver) => (
                    <li key={driver}>{driver}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
              <div className="font-medium text-white">Premissas</div>
              <ul className="mt-3 space-y-3">
                {report.premises.map((premise) => (
                  <li key={premise.id} className="rounded-2xl border border-border bg-muted/20 p-3">
                    <div className="font-medium text-white">{premise.label}</div>
                    <div className="mt-1">{premise.description}</div>
                    {premise.valueLabel ? <div className="mt-1">Valor: {premise.valueLabel}</div> : null}
                    {premise.explicitPlaceholder ? <div className="mt-1 text-amber-200">Marcado como mock/placeholder.</div> : null}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
              <div className="font-medium text-white">Alertas e lacunas</div>
              <div className="mt-3 space-y-3">
                {report.alerts.map((alert) => (
                  <div key={alert.id} className="rounded-2xl border border-border bg-muted/20 p-3">
                    <div className="font-medium text-white">{alert.title}</div>
                    <div className="mt-1">{alert.message}</div>
                  </div>
                ))}
                {report.gaps.map((gap) => (
                  <div key={gap.id} className="rounded-2xl border border-border bg-muted/20 p-3">
                    <div className="font-medium text-white">{gap.label}</div>
                    <div className="mt-1">{gap.description}</div>
                    <div className="mt-1 text-amber-200">Ação sugerida: {gap.suggestedAction}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {report && persistedReport?.readinessSnapshot ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-100">
              <div className="font-medium text-white">Snapshot do gate anexado ao relatório</div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-current/10 bg-background/30 p-3">
                  <div>Status: {persistedReport.readinessSnapshot.statusLabel}</div>
                  <div className="mt-1">Resumo: {persistedReport.readinessSnapshot.summary}</div>
                  <div className="mt-1">Fluxo: {persistedReport.readinessSnapshot.evidence.flowModeLabel}</div>
                  <div className="mt-1">Confiança: {persistedReport.readinessSnapshot.evidence.confidenceLabel}</div>
                </div>
                <div className="rounded-2xl border border-current/10 bg-background/30 p-3">
                  <div>Docs revisados: {persistedReport.readinessSnapshot.evidence.documentReviewConfirmedCount}</div>
                  <div className="mt-1">Docs pendentes: {persistedReport.readinessSnapshot.evidence.documentReviewPendingCount}</div>
                  <div className="mt-1">Lacunas críticas: {persistedReport.readinessSnapshot.evidence.criticalMissingCount}</div>
                  <div className="mt-1">Bundle: {persistedReport.readinessSnapshot.evidence.bundleReviewStatus} / {persistedReport.readinessSnapshot.evidence.bundleApprovalStatus}</div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
              <div className="font-medium text-white">Contexto explicativo local</div>
              <p className="mt-3 leading-6">{report.explanation?.summary ?? "Contexto explicativo ainda não gerado."}</p>
              <p className="mt-2">Evidências recuperadas: {report.explanation?.evidenceCount ?? 0}</p>
              <div className="mt-3 space-y-3">
                {report.explanation?.blocks.length ? (
                  report.explanation.blocks.map((block) => (
                    <div key={block.id} className="rounded-2xl border border-border bg-muted/20 p-3">
                      <div className="font-medium text-white">{block.title}</div>
                      <div className="mt-1">{block.summary}</div>
                      {block.explicitPlaceholder ? <div className="mt-1 text-amber-200">Marcado como mock/placeholder.</div> : null}
                    </div>
                  ))
                ) : (
                  <p>Nenhum bloco de contexto disponível.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
              <div className="font-medium text-white">Capability da IA local</div>
              <div className="mt-3 space-y-2">
                <p>Modo: {report.localExplainerCapability?.mode ?? "N/A"}</p>
                <p>Status: {report.localExplainerCapability?.statusLabel ?? "N/A"}</p>
                <p>Provider: {report.localExplainerCapability?.provider ?? "N/A"}</p>
                <p>Disponibilidade: {report.localExplainerCapability?.availability ?? "N/A"}</p>
                <p>Ativação: {report.localExplainerCapability?.activationLabel ?? "N/A"}</p>
                <p>{report.localExplainerCapability?.detail ?? "Capability ainda não registrada."}</p>
              </div>
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3 text-amber-100">
                A cadeia interna de raciocínio não é exibida. A futura explicação deve vir de RAG local e contexto auditável. Nada aqui representa cálculo fiscal oficial.
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
              <div className="font-medium text-white">Resposta local estruturada do explainer</div>
              <p className="mt-3 leading-6">{report.localExplainerResponse?.summary ?? "Nenhuma resposta local gerada."}</p>
              <div className="mt-3 rounded-2xl border border-sky-400/20 bg-sky-400/5 p-3">
                <div className="font-medium text-white">Status comunicado ao usuário</div>
                <div className="mt-2 space-y-1 text-xs leading-6">
                  <div>Modo: {report.localExplainerResponse?.capabilityStatus.modeLabel ?? "N/A"}</div>
                  <div>Provider: {report.localExplainerResponse?.capabilityStatus.providerLabel ?? "N/A"}</div>
                  <div>Prontidão: {report.localExplainerResponse?.capabilityStatus.readinessLabel ?? "N/A"}</div>
                  <div>Comportamento: {report.localExplainerResponse?.capabilityStatus.behaviorLabel ?? "N/A"}</div>
                </div>
              </div>
              <div className="mt-3 rounded-2xl border border-border bg-muted/20 p-3">
                <div className="font-medium text-white">Âncora local / evidências</div>
                <div className="mt-2 text-xs leading-6">
                  <div>Bundle: {report.localExplainerResponse?.evidenceAnchor.bundleVersion ?? "N/A"}</div>
                  <div>Status da simulação: {report.localExplainerResponse?.evidenceAnchor.simulationStatus ?? "N/A"}</div>
                  <div>Evidências recuperadas: {report.localExplainerResponse?.evidenceAnchor.retrievalEvidenceCount ?? 0}</div>
                  <div>Blocos de contexto: {report.localExplainerResponse?.evidenceAnchor.retrievalBlockCount ?? 0}</div>
                  <div>Alertas: {report.localExplainerResponse?.evidenceAnchor.warningCount ?? 0}</div>
                  <div>Lacunas: {report.localExplainerResponse?.evidenceAnchor.gapCount ?? 0}</div>
                </div>
              </div>
              <p className="mt-3 text-amber-200">{report.localExplainerResponse?.disclaimer}</p>
              <div className="mt-3 rounded-2xl border border-border bg-muted/20 p-3">
                <div className="font-medium text-white">Contrato anti-alucinação</div>
                <div className="mt-2 text-xs leading-6">{report.localExplainerResponse?.promptContract.scaffoldPrompt ?? "Não disponível."}</div>
              </div>
              <div className="mt-3 space-y-3">
                {(report.localExplainerResponse?.sections ?? []).map((section) => (
                  <div key={section.heading} className="rounded-2xl border border-border bg-muted/20 p-3">
                    <div className="font-medium text-white">{section.heading}</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {section.body.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                {(report.localExplainerResponse?.evidence ?? []).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border bg-muted/20 p-3">
                    <div className="font-medium text-white">{item.title}</div>
                    <div className="mt-1">{item.summary}</div>
                  </div>
                ))}
              </div>
              {report.localExplainerResponse?.refusal ? (
                <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-3 text-rose-100">
                  <div className="flex items-center gap-2 font-medium text-white">
                    <AlertTriangle className="h-4 w-4" /> {report.localExplainerResponse.refusal.title}
                  </div>
                  <p className="mt-2 leading-6">{report.localExplainerResponse.refusal.message}</p>
                  <div className="mt-3">
                    <div className="font-medium text-white">Itens faltantes</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {report.localExplainerResponse.refusal.missingItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-3">
                    <div className="font-medium text-white">Ações requeridas</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {report.localExplainerResponse.refusal.requiredActions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
              <div className="font-medium text-white">Chat com explainer local</div>
              <p className="mt-2 leading-6 text-xs">
                {webllmState === "ready"
                  ? "Modelo local ativo — respostas geradas por IA no dispositivo."
                  : "Modo leve — respostas estruturadas sem IA generativa. Ative o modelo para respostas mais detalhadas."}
              </p>
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                {(report.localExplainerChat?.turns ?? []).map((turn) => (
                  <div key={turn.id} className={`rounded-2xl border p-3 ${turn.role === "user" ? "border-sky-400/20 bg-sky-400/5" : turn.role === "assistant" ? "border-border bg-muted/20" : "border-amber-400/20 bg-amber-400/5 text-xs"}`}>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{turn.role === "user" ? "Você" : turn.role === "assistant" ? "Explainer" : "Sistema"}</div>
                    <div className="mt-1 whitespace-pre-wrap">{turn.content}</div>
                  </div>
                ))}
                {chatTurns.map((turn) => (
                  <div key={turn.id} className={`rounded-2xl border p-3 ${turn.role === "user" ? "border-sky-400/20 bg-sky-400/5" : "border-border bg-muted/20"}`}>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{turn.role === "user" ? "Você" : "Explainer"}</div>
                    <div className="mt-1 whitespace-pre-wrap">{turn.content}</div>
                  </div>
                ))}
                {isChatLoading ? (
                  <div className="rounded-2xl border border-border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Explainer</div>
                    <div className="mt-1 animate-pulse">Analisando...</div>
                  </div>
                ) : null}
                <div ref={chatEndRef} />
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleChatSend(); } }}
                  placeholder="Pergunte sobre a simulação…"
                  disabled={!simulation || isChatLoading}
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!simulation || !chatInput.trim() || isChatLoading}
                  onClick={() => void handleChatSend()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
            <div className="font-medium text-white">Evolução planejada</div>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              {(report.explanation?.nextEvolutionNotes ?? []).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-amber-100">
              {(report.localExplainerResponse?.followUps ?? []).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">
            <strong>Disclaimer:</strong> {report.footer.disclaimer}
          </div>
        </Card>
      ) : (
        <Card>
          <CardTitle>Relatório ainda não gerado</CardTitle>
          <CardDescription className="mt-2 leading-6">
            Gere primeiro uma leitura local e depois salve o relatório para liberar a exportação HTML e a impressão.
          </CardDescription>
        </Card>
      )}
    </section>
  );
}
