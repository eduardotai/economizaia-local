"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Printer, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { localDb } from "@/db/local-db";
import { createSimulationAuditEvents } from "@/lib/local-audit";
import { saveReportSnapshot } from "@/lib/local-snapshots";
import { buildUserReport, persistUserReport } from "@/lib/reporting";
import type { SimulationResult } from "@/models/domain";
import type { AnonymousOnboardingProfile } from "@/models/onboarding";
import type { PersistedUserReport } from "@/models/report";

interface ReportWorkspaceProps {
  profile: AnonymousOnboardingProfile | null;
  simulation: SimulationResult | null;
  persistedReport: PersistedUserReport | null;
  onReportPersisted(report: PersistedUserReport): void;
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

export function ReportWorkspace({ profile, simulation, persistedReport, onReportPersisted }: ReportWorkspaceProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const report = useMemo(() => persistedReport?.report ?? null, [persistedReport]);

  async function handleGenerateReport() {
    if (!profile || !simulation) return;

    setIsSaving(true);
    setStatusMessage(null);

    const nextReport = await buildUserReport({ profile, simulation });
    await persistUserReport(nextReport);
    await saveReportSnapshot(nextReport);

    const auditEvents = createSimulationAuditEvents(simulation);
    await Promise.all(auditEvents.map((event) => localDb.appendAuditEvent(event)));

    onReportPersisted(nextReport);
    setStatusMessage("Relatório mock salvo localmente neste dispositivo.");
    setIsSaving(false);
  }

  return (
    <section className="space-y-6">
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge variant="secondary">Relatório final inicial</Badge>
            <CardTitle>Relatório estruturado em pt-BR com exportação local</CardTitle>
            <CardDescription className="leading-6">
              Gera uma versão inicial do relatório do usuário, salva localmente e exporta como HTML pronto para impressão.
              <strong> PDF segue como placeholder explícito</strong> neste checkpoint.
            </CardDescription>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <div>Persistência</div>
            <div className="mt-1 font-medium text-white">Local-only no navegador</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button disabled={!profile || !simulation || isSaving} onClick={() => void handleGenerateReport()}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Gerando relatório..." : "Gerar e salvar relatório local"}
          </Button>
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
            disabled={!persistedReport}
            onClick={() => {
              if (!persistedReport) return;
              openPrintPreview(persistedReport.renderedHtml);
              setStatusMessage("Prévia de impressão aberta em uma nova janela.");
            }}
          >
            <Printer className="mr-2 h-4 w-4" /> Imprimir / salvar em PDF
          </Button>
        </div>

        {statusMessage ? <p className="text-sm text-emerald-200">{statusMessage}</p> : null}
      </Card>

      {report ? (
        <Card className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge>Prévia do relatório</Badge>
              <CardTitle className="mt-2">{report.title}</CardTitle>
              <CardDescription className="mt-2 leading-6">
                Estrutura local mock/placeholder persistida neste dispositivo com resumo executivo, premissas, confiança,
                alertas, lacunas e disclaimer.
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
              <div className="font-medium text-white">Capability do local explainer</div>
              <div className="mt-3 space-y-2">
                <p>Status: {report.localExplainerCapability?.statusLabel ?? "N/A"}</p>
                <p>Provider: {report.localExplainerCapability?.provider ?? "N/A"}</p>
                <p>Disponibilidade: {report.localExplainerCapability?.availability ?? "N/A"}</p>
                <p>{report.localExplainerCapability?.detail ?? "Capability ainda não registrada."}</p>
              </div>
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3 text-amber-100">
                Tudo acima permanece explícito como mock/placeholder até a integração real com WebLLM local.
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
              <div className="font-medium text-white">Resposta local do explainer (mock)</div>
              <p className="mt-3 leading-6">{report.localExplainerResponse?.answer ?? "Nenhuma resposta local gerada."}</p>
              <p className="mt-3 text-amber-200">{report.localExplainerResponse?.disclaimer}</p>
              <div className="mt-3 space-y-2">
                {(report.localExplainerResponse?.evidence ?? []).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border bg-muted/20 p-3">
                    <div className="font-medium text-white">{item.title}</div>
                    <div className="mt-1">{item.summary}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
              <div className="font-medium text-white">Chat placeholder do explainer</div>
              <p className="mt-3 leading-6">
                Sessão preparada para futura UX conversacional local, sem modelo real carregado neste checkpoint.
              </p>
              <div className="mt-3 space-y-2">
                {(report.localExplainerChat?.turns ?? []).map((turn) => (
                  <div key={turn.id} className="rounded-2xl border border-border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{turn.role}</div>
                    <div className="mt-1">{turn.content}</div>
                  </div>
                ))}
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
            Gere primeiro uma simulação local e depois salve o relatório inicial para liberar a exportação HTML e a impressão.
          </CardDescription>
        </Card>
      )}
    </section>
  );
}
