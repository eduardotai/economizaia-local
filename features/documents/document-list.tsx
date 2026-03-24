import { FileText, ImageIcon, FileCode2, AlertCircle, CheckCircle2, ScanSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { formatBytes } from "@/lib/document-utils";
import type { IngestedDocument } from "@/models/documents";

interface DocumentListProps {
  documents: IngestedDocument[];
}

const kindIconMap = {
  pdf: FileText,
  image: ImageIcon,
  xml: FileCode2,
  unknown: AlertCircle,
} as const;

const statusLabelMap: Record<IngestedDocument["status"], string> = {
  uploaded: "Upload recebido",
  registered: "Registrado",
  classifying: "Classificando",
  extracting_text: "Extraindo texto",
  ocr_queued: "OCR enfileirado",
  extracting_entities: "Extraindo entidades",
  completed: "Concluído",
  review_required: "Revisão necessária",
  failed: "Falhou",
};

export function DocumentList({ documents }: DocumentListProps) {
  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <CardTitle>Arquivos processados localmente</CardTitle>
        <CardDescription>
          Visualização do pipeline documental com status, entidades mockadas e trilha de auditoria preparada para inspeção local.
        </CardDescription>
      </div>

      <div className="space-y-4">
        {documents.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-background/40 p-5 text-sm text-muted-foreground">
            Nenhum documento enviado ainda. Faça um upload para iniciar o fluxo esqueleto.
          </div>
        ) : (
          documents.map((document) => {
            const Icon = kindIconMap[document.kind];
            return (
              <div key={document.id} className="rounded-3xl border border-border/70 bg-background/40 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="rounded-xl bg-emerald-400/10 p-2 text-emerald-300">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{document.originalFileName}</div>
                        <div className="text-xs text-muted-foreground">
                          {document.detectedMimeType} • {formatBytes(document.file.sizeInBytes)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge>{statusLabelMap[document.status]}</Badge>
                      <Badge className="border-slate-400/20 bg-slate-400/10 text-slate-200">{document.kind.toUpperCase()}</Badge>
                      <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-100">placeholder</Badge>
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3 lg:min-w-[360px]">
                    <StatusMetric label="Páginas" value={String(document.pages.length)} icon={<FileText className="h-4 w-4" />} />
                    <StatusMetric label="OCR jobs" value={String(document.ocrJobs.length)} icon={<ScanSearch className="h-4 w-4" />} />
                    <StatusMetric label="Entidades" value={String(document.entities.length)} icon={<CheckCircle2 className="h-4 w-4" />} />
                  </div>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <section className="space-y-2">
                    <h4 className="text-sm font-medium text-foreground">Entidades extraídas (mock)</h4>
                    <div className="space-y-2">
                      {document.entities.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma entidade disponível.</p>
                      ) : (
                        document.entities.map((entity) => (
                          <div key={entity.id} className="rounded-2xl border border-border/70 px-3 py-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-foreground">{entity.label}</span>
                              <span className="text-xs text-muted-foreground">conf. {Math.round(entity.confidence * 100)}%</span>
                            </div>
                            <div className="mt-1 text-muted-foreground">{entity.value}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{entity.note}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="space-y-2">
                    <h4 className="text-sm font-medium text-foreground">Auditoria local dos passos</h4>
                    <div className="space-y-2">
                      {document.auditTrail.map((entry) => (
                        <div key={entry.id} className="rounded-2xl border border-border/70 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-foreground">{entry.step}</span>
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">{entry.status}</span>
                          </div>
                          <div className="mt-1 text-muted-foreground">{entry.message}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function StatusMetric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 px-3 py-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
