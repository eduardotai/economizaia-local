"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { DocumentList } from "@/features/documents/document-list";
import { DocumentUploadPanel } from "@/features/documents/document-upload-panel";
import { localDb } from "@/db/local-db";
import { createDocumentStoredAuditEvents } from "@/lib/local-audit";
import { saveDocumentSnapshot } from "@/lib/local-snapshots";
import { processDocumentPlaceholder, registerDocumentLocally } from "@/lib/document-pipeline";
import type { IngestedDocument } from "@/models/documents";

export function DocumentIngestionWorkspace() {
  const [documents, setDocuments] = useState<IngestedDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void localDb
      .listIngestionDocuments()
      .then(setDocuments)
      .catch(() => {
        setError("Nao foi possivel carregar documentos persistidos localmente.");
      });
  }, []);

  const summary = useMemo(() => {
    return {
      total: documents.length,
      completed: documents.filter((document) => document.status === "completed").length,
      reviewRequired: documents.filter((document) => document.status === "review_required").length,
      failed: documents.filter((document) => document.status === "failed").length,
      warnings: documents.reduce((accumulator, document) => accumulator + document.processingWarnings.length, 0),
      extractedFields: documents.reduce((accumulator, document) => accumulator + document.extractedFields.length, 0),
    };
  }, [documents]);

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const processedDocuments = await Promise.all(
        Array.from(fileList).map(async (file) => {
          const registered = await registerDocumentLocally({ file });
          const processed = await processDocumentPlaceholder(registered, file);
          await localDb.saveIngestionDocument(processed);
          await saveDocumentSnapshot(processed);
          await Promise.all(createDocumentStoredAuditEvents(processed).map((event) => localDb.appendAuditEvent(event)));
          return processed;
        }),
      );

      setDocuments((current) => [...processedDocuments, ...current].sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
    } catch (processingError) {
      const message =
        processingError instanceof Error
          ? `Falha ao processar os arquivos localmente: ${processingError.message}`
          : "Falha inesperada ao processar os arquivos localmente.";
      setError(`${message} Nenhum backend remoto foi usado; revise o formato do arquivo e os limites atuais do checkpoint.`);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <DocumentUploadPanel onFilesSelected={handleFilesSelected} isProcessing={isProcessing} />

        <div className="rounded-[1.75rem] border border-amber-400/20 bg-amber-400/10 p-5 text-sm text-amber-50">
          <div className="mb-2 flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Checkpoint documental: parser XML placeholder inicial + revisao manual reforcada
          </div>
          <ul className="space-y-1 text-amber-100/90">
            <li>• PDF tenta leitura local inicial com pdf.js antes de cair em fallback stub.</li>
            <li>• XML agora passa por parser estrutural generico local, com campos sugeridos e status review_required.</li>
            <li>• OCR foi isolado em adapter proprio, mas o reconhecimento real com Tesseract.js ainda nao esta habilitado.</li>
            <li>• Sempre revise campos extraidos, warnings e auditoria antes de qualquer uso fiscal/manual.</li>
          </ul>
        </div>

        <div className="grid gap-3 sm:grid-cols-6">
          <SummaryCard label="Documentos" value={String(summary.total)} />
          <SummaryCard label="Concluidos" value={String(summary.completed)} />
          <SummaryCard label="Revisao" value={String(summary.reviewRequired)} />
          <SummaryCard label="Falhas" value={String(summary.failed)} />
          <SummaryCard label="Warnings" value={String(summary.warnings)} />
          <SummaryCard label="Campos" value={String(summary.extractedFields)} />
        </div>

        {error ? <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
      </div>

      <DocumentList documents={documents} />
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card/70 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}
