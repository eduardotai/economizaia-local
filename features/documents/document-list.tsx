import { FileText, ImageIcon, FileCode2, AlertCircle, CheckCircle2, ScanSearch, TriangleAlert, Sparkles, ShieldAlert, Files } from "lucide-react";
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
  ocr_queued: "OCR preparado",
  extracting_entities: "Extraindo entidades",
  completed: "Concluido",
  review_required: "Revisao obrigatoria",
  failed: "Falhou",
};

const statusToneMap: Record<IngestedDocument["status"], string> = {
  uploaded: "border-slate-400/20 bg-slate-400/10 text-slate-100",
  registered: "border-slate-400/20 bg-slate-400/10 text-slate-100",
  classifying: "border-sky-400/20 bg-sky-400/10 text-sky-100",
  extracting_text: "border-sky-400/20 bg-sky-400/10 text-sky-100",
  ocr_queued: "border-amber-400/20 bg-amber-400/10 text-amber-100",
  extracting_entities: "border-sky-400/20 bg-sky-400/10 text-sky-100",
  completed: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
  review_required: "border-amber-400/20 bg-amber-500/20 text-amber-50",
  failed: "border-red-400/20 bg-red-400/10 text-red-100",
};

export function DocumentList({ documents }: DocumentListProps) {
  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <CardTitle>Arquivos processados localmente</CardTitle>
        <CardDescription>
          Pipeline documental local-first com estados visiveis, parser XML placeholder inicial, adapters isolados e revisão humana destacada.
        </CardDescription>
      </div>

      <div className="space-y-4">
        {documents.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-background/40 p-5 text-sm text-muted-foreground">
            Nenhum documento enviado ainda. Faca um upload para iniciar o fluxo local.
          </div>
        ) : (
          documents.map((document) => {
            const Icon = kindIconMap[document.kind];
            const hasReviewRequired = document.status === "review_required";

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
                      <Badge className={statusToneMap[document.status]}>{statusLabelMap[document.status]}</Badge>
                      <Badge className="border-slate-400/20 bg-slate-400/10 text-slate-200">{document.kind.toUpperCase()}</Badge>
                      <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-100">local-first</Badge>
                      <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-100">placeholder auditavel</Badge>
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-4 lg:min-w-[460px]">
                    <StatusMetric label="Paginas" value={String(document.pages.length)} icon={<FileText className="h-4 w-4" />} />
                    <StatusMetric label="Campos" value={String(document.extractedFields.length)} icon={<Files className="h-4 w-4" />} />
                    <StatusMetric label="OCR jobs" value={String(document.ocrJobs.length)} icon={<ScanSearch className="h-4 w-4" />} />
                    <StatusMetric label="Entidades" value={String(document.entities.length)} icon={<CheckCircle2 className="h-4 w-4" />} />
                  </div>
                </div>

                {hasReviewRequired ? (
                  <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-50">
                    <div className="mb-2 flex items-center gap-2 font-medium">
                      <ShieldAlert className="h-4 w-4" />
                      Revisao manual obrigatoria
                    </div>
                    <p className="text-amber-100/90">
                      Este documento terminou com status <strong>review_required</strong>. Os campos abaixo sao apenas sugestoes locais/heuristicas e nao devem ser tratados como interpretacao fiscal oficial.
                    </p>
                  </div>
                ) : null}

                {document.extractedFields.length > 0 ? (
                  <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                      <Sparkles className="h-4 w-4 text-emerald-300" />
                      Campos extraidos para revisao
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {document.extractedFields.map((field) => (
                        <div key={field.id} className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-foreground">{field.label}</div>
                              {field.sourcePath ? <div className="text-[11px] text-muted-foreground">origem: {field.sourcePath}</div> : null}
                            </div>
                            <Badge className={field.reviewRequired ? "border-amber-400/20 bg-amber-400/10 text-amber-100" : ""}>
                              {field.reviewRequired ? "revisar" : "ok"}
                            </Badge>
                          </div>
                          <div className="mt-2 break-words text-foreground">{field.value}</div>
                          <div className="mt-2 text-xs text-muted-foreground">conf. {Math.round(field.confidence * 100)}% • {field.note}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {document.processingWarnings.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                    <div className="mb-2 flex items-center gap-2 font-medium">
                      <TriangleAlert className="h-4 w-4" />
                      Warnings e limites conhecidos
                    </div>
                    <ul className="space-y-1 text-amber-100/90">
                      {document.processingWarnings.map((warning, index) => (
                        <li key={`${document.id}-warning-${index}`}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <section className="space-y-2">
                    <h4 className="text-sm font-medium text-foreground">Entidades extraidas</h4>
                    <div className="space-y-2">
                      {document.entities.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma entidade disponivel.</p>
                      ) : (
                        document.entities.map((entity) => (
                          <div key={entity.id} className="rounded-2xl border border-border/70 px-3 py-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-foreground">{entity.label}</span>
                              <span className="text-xs text-muted-foreground">conf. {Math.round(entity.confidence * 100)}%</span>
                            </div>
                            <div className="mt-1 break-words text-muted-foreground">{entity.value}</div>
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
