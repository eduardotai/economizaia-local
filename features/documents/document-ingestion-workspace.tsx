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
    void localDb.listIngestionDocuments().then(setDocuments).catch(() => {
      setError("Não foi possível carregar documentos persistidos localmente.");
    });
  }, []);

  const summary = useMemo(() => {
    return {
      total: documents.length,
      completed: documents.filter((document) => document.status === "completed").length,
      warnings: documents.reduce((accumulator, document) => accumulator + document.processingWarnings.length, 0),
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
      const message = processingError instanceof Error ? processingError.message : "Falha inesperada ao processar os arquivos.";
      setError(message);
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
            Checkpoint documental em modo esqueleto
          </div>
          <ul className="space-y-1 text-amber-100/90">
            <li>• Detecção de tipo do arquivo é real, porém simples.</li>
            <li>• Extração de PDF, OCR e entidades estruturadas seguem como stubs/placeholders.</li>
            <li>• A trilha de auditoria já fica pronta para futuras etapas reais no dispositivo.</li>
          </ul>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Documentos" value={String(summary.total)} />
          <SummaryCard label="Concluídos" value={String(summary.completed)} />
          <SummaryCard label="Warnings" value={String(summary.warnings)} />
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</div>
        ) : null}
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
