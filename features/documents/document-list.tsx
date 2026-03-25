import {
  AlertCircle,
  CheckCircle2,
  FileCode2,
  FileText,
  Files,
  History,
  ImageIcon,
  Lock,
  PencilLine,
  ScanSearch,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  Unlock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { formatBytes } from "@/lib/document-utils";
import { documentCanRunRuleEngine } from "@/lib/document-pipeline";
import type { IngestedDocument, ManualReviewField } from "@/models/documents";

interface DocumentListProps {
  documents: IngestedDocument[];
  onManualReviewChange: (documentId: string, fieldId: string, value: string) => void;
  onConfirmManualReviewField: (documentId: string, fieldId: string) => void;
  onConfirmManualReview: (documentId: string) => void;
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
  ocr_queued: "OCR em andamento",
  extracting_entities: "Extraindo entidades",
  completed: "Concluído",
  review_required: "Revisão obrigatória",
  ready_for_manual_review: "Pronto para revisão manual",
  manual_review_confirmed: "Revisão confirmada",
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
  ready_for_manual_review: "border-amber-400/20 bg-amber-500/20 text-amber-50",
  manual_review_confirmed: "border-emerald-400/20 bg-emerald-500/20 text-emerald-50",
  failed: "border-red-400/20 bg-red-400/10 text-red-100",
};

const reviewStateToneMap: Record<ManualReviewField["state"], string> = {
  needs_review: "border-amber-400/20 bg-amber-400/10 text-amber-100",
  edited: "border-sky-400/20 bg-sky-400/10 text-sky-100",
  confirmed: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
};

const reviewStateLabelMap: Record<ManualReviewField["state"], string> = {
  needs_review: "needs-review",
  edited: "edited",
  confirmed: "confirmed",
};

const criticalFieldTerms = ["fatur", "receita", "despesa", "regime", "cnae", "atividade", "period", "compet", "municip", "uf", "anexo", "aliquota", "cnpj", "valor", "total"];

function isCriticalField(field: ManualReviewField) {
  const text = `${field.label} ${field.sourcePath ?? ""} ${field.note ?? ""}`.toLowerCase();
  return criticalFieldTerms.some((term) => text.includes(term));
}

function getFieldDiffLabel(field: ManualReviewField) {
  if (field.value.trim() === field.originalValue.trim()) {
    return "Sem alteração";
  }

  if (!field.originalValue.trim() && field.value.trim()) {
    return "Valor preenchido manualmente";
  }

  if (field.originalValue.trim() && !field.value.trim()) {
    return "Valor removido manualmente";
  }

  return "Valor alterado";
}

function getFieldProgress(document: IngestedDocument) {
  const requiredFields = document.manualReview.fields.filter((field) => field.required);
  const confirmedRequiredFields = requiredFields.filter((field) => field.state === "confirmed").length;

  return {
    total: requiredFields.length,
    confirmed: confirmedRequiredFields,
    percentage: requiredFields.length > 0 ? Math.round((confirmedRequiredFields / requiredFields.length) * 100) : 0,
  };
}

export function DocumentList({
  documents,
  onManualReviewChange,
  onConfirmManualReviewField,
  onConfirmManualReview,
}: DocumentListProps) {
  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <CardTitle>Arquivos processados localmente</CardTitle>
        <CardDescription>
          Pipeline documental local-first com worker dedicado, pdf.js priorizado para PDF digital, OCR apenas como fallback e revisão humana obrigatória.
        </CardDescription>
      </div>

      <div className="space-y-4">
        {documents.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-background/40 p-5 text-sm text-muted-foreground">
            Nenhum documento enviado ainda. Faça um upload para iniciar o fluxo local.
          </div>
        ) : (
          documents.map((document) => {
            const Icon = kindIconMap[document.kind];
            const canRun = documentCanRunRuleEngine(document);
            const hasReviewRequired =
              document.status === "review_required" || document.status === "ready_for_manual_review" || !document.manualReview.confirmed;
            const requiredFields = document.manualReview.fields.filter((field) => field.required);
            const criticalFields = requiredFields.filter(isCriticalField);
            const complementaryFields = document.manualReview.fields.filter((field) => !criticalFields.some((item) => item.id === field.id));
            const reviewProgress = getFieldProgress(document);
            const canConfirmAll = requiredFields.every((field) => field.value.trim().length > 0);

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
                      <Badge className="border-sky-400/20 bg-sky-400/10 text-sky-100">Worker dedicado</Badge>
                      <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">pdf.js prioritário</Badge>
                      <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-100">OCR fallback</Badge>
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-4 lg:min-w-[520px]">
                    <StatusMetric label="Páginas" value={String(document.pages.length)} icon={<FileText className="h-4 w-4" />} />
                    <StatusMetric label="Campos" value={String(document.extractedFields.length)} icon={<Files className="h-4 w-4" />} />
                    <StatusMetric label="OCR jobs" value={String(document.ocrJobs.length)} icon={<ScanSearch className="h-4 w-4" />} />
                    <StatusMetric label="Confirmados" value={`${reviewProgress.confirmed}/${reviewProgress.total}`} icon={<CheckCircle2 className="h-4 w-4" />} />
                  </div>
                </div>

                <div className={`mt-4 rounded-2xl border p-4 text-sm ${canRun ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-50" : "border-amber-400/30 bg-amber-500/10 text-amber-50"}`}>
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    {canRun ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    Gate do rule engine
                  </div>
                  <p>
                    {canRun
                      ? "Revisão manual confirmada. Este documento já está apto para alimentar o rule engine."
                      : "Bloqueado: todos os campos obrigatórios precisam estar confirmados manualmente antes de qualquer cálculo."}
                  </p>
                </div>

                {hasReviewRequired ? (
                  <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-50">
                    <div className="mb-2 flex items-center gap-2 font-medium">
                      <ShieldAlert className="h-4 w-4" />
                      Revisão manual obrigatória
                    </div>
                    <p className="text-amber-100/90">
                      Cada campo fica em um de três estados: <strong>needs-review</strong>, <strong>edited</strong> ou <strong>confirmed</strong>. A confirmação total só libera o documento quando todos os campos obrigatórios estiverem completos.
                    </p>
                  </div>
                ) : null}

                {document.manualReview.fields.length > 0 ? (
                  <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <PencilLine className="h-4 w-4 text-emerald-300" />
                          Revisão guiada e histórico local por campo
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Edite quando necessário, confirme campo a campo e finalize com a ação de confirmação total para liberar o documento.
                        </p>
                      </div>
                      <div className="min-w-[260px] rounded-2xl border border-border/70 bg-background/70 p-3 text-sm">
                        <div className="flex items-center justify-between gap-3 text-muted-foreground">
                          <span>Campos obrigatórios confirmados</span>
                          <span>
                            {reviewProgress.confirmed}/{reviewProgress.total}
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-slate-800">
                          <div className="h-2 rounded-full bg-emerald-300 transition-all" style={{ width: `${reviewProgress.percentage}%` }} />
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Histórico de revisão salvo localmente dentro do documento persistido.
                        </div>
                      </div>
                    </div>

                    {criticalFields.length > 0 ? (
                      <FieldSection
                        document={document}
                        title="Prioridade 1 — conferir campos críticos"
                        fields={criticalFields}
                        onManualReviewChange={onManualReviewChange}
                        onConfirmManualReviewField={onConfirmManualReviewField}
                      />
                    ) : null}

                    {complementaryFields.length > 0 ? (
                      <FieldSection
                        document={document}
                        title="Prioridade 2 — revisar campos complementares"
                        fields={complementaryFields}
                        onManualReviewChange={onManualReviewChange}
                        onConfirmManualReviewField={onConfirmManualReviewField}
                      />
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Button disabled={!canConfirmAll} onClick={() => onConfirmManualReview(document.id)}>
                        Confirmar todos os campos
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {canConfirmAll
                          ? "A confirmação total libera o documento para o próximo passo do fluxo."
                          : "Preencha todos os campos obrigatórios antes de confirmar tudo."}
                      </span>
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
                    <h4 className="text-sm font-medium text-foreground">Entidades extraídas</h4>
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

function FieldSection({
  document,
  title,
  fields,
  onManualReviewChange,
  onConfirmManualReviewField,
}: {
  document: IngestedDocument;
  title: string;
  fields: ManualReviewField[];
  onManualReviewChange: (documentId: string, fieldId: string, value: string) => void;
  onConfirmManualReviewField: (documentId: string, fieldId: string) => void;
}) {
  return (
    <div className="mb-4 rounded-2xl border border-border/70 bg-background/40 p-4 last:mb-0">
      <div className="mb-3 text-sm font-medium text-foreground">{title}</div>
      <div className="grid gap-3 xl:grid-cols-2">
        {fields.map((field) => {
          const hasDiff = field.value.trim() !== field.originalValue.trim();

          return (
            <div key={field.id} className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-foreground">{field.label}</div>
                  {field.sourcePath ? <div className="text-[11px] text-muted-foreground">origem: {field.sourcePath}</div> : null}
                </div>
                <Badge className={reviewStateToneMap[field.state]}>{reviewStateLabelMap[field.state]}</Badge>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Antes</div>
                  <div className="mt-1 min-h-10 break-words text-muted-foreground">{field.originalValue || "—"}</div>
                </div>
                <div className={`rounded-2xl border p-3 ${hasDiff ? "border-sky-400/20 bg-sky-400/10" : "border-border/70 bg-muted/20"}`}>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Agora</div>
                  <div className="mt-1 min-h-10 break-words text-foreground">{field.value || "—"}</div>
                </div>
              </div>

              <div className="mt-2 text-xs text-muted-foreground">{getFieldDiffLabel(field)}</div>

              <textarea
                className="mt-3 min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                value={field.value}
                onChange={(event) => onManualReviewChange(document.id, field.id, event.target.value)}
              />

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  variant={field.state === "confirmed" ? "outline" : "default"}
                  disabled={field.value.trim().length === 0}
                  onClick={() => onConfirmManualReviewField(document.id, field.id)}
                >
                  Confirmar campo
                </Button>
                <span className="text-xs text-muted-foreground">{field.note ?? "Campo revisável salvo localmente."}</span>
              </div>

              {field.history.length > 0 ? (
                <div className="mt-3 rounded-2xl border border-border/70 bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <History className="h-3.5 w-3.5" />
                    Histórico local
                  </div>
                  <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                    {field.history.slice(-3).reverse().map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                        <div className="font-medium text-foreground">{entry.action}</div>
                        <div className="mt-1">
                          {entry.previousValue || "—"} → {entry.nextValue || "—"}
                        </div>
                        {entry.note ? <div className="mt-1">{entry.note}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
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
