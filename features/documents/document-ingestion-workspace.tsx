"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { DocumentList } from "@/features/documents/document-list";
import { DocumentUploadPanel } from "@/features/documents/document-upload-panel";
import { localDb } from "@/db/local-db";
import { createDocumentStoredAuditEvents } from "@/lib/local-audit";
import { saveDocumentSnapshot } from "@/lib/local-snapshots";
import { processDocumentWithDedicatedWorker } from "@/lib/document-worker-client";
import {
  confirmManualReview,
  confirmManualReviewField,
  registerDocumentLocally,
  updateManualReviewField,
} from "@/lib/document-pipeline";
import type { IngestedDocument } from "@/models/documents";

export function DocumentIngestionWorkspace() {
  const [documents, setDocuments] = useState<IngestedDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const documentListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void localDb
      .listIngestionDocuments()
      .then(setDocuments)
      .catch(() => {
        setError("Não foi possível carregar documentos persistidos localmente.");
      });
  }, []);

  async function syncDocument(documentId: string, updater: (document: IngestedDocument) => IngestedDocument) {
    const stored = await localDb.getIngestionDocument(documentId);
    if (!stored) return;

    const nextDocument = updater(stored);
    await persistDocument(nextDocument);

    setDocuments((current) =>
      current.map((document) => {
        if (document.id !== documentId) return document;
        return nextDocument;
      }),
    );
  }

  const summary = useMemo(
    () => ({
      total: documents.length,
      manualReviewPending: documents.filter((document) => !document.manualReview.confirmed).length,
      manualReviewDone: documents.filter((document) => document.manualReview.confirmed).length,
      failed: documents.filter((document) => document.status === "failed").length,
      warnings: documents.reduce((accumulator, document) => accumulator + document.processingWarnings.length, 0),
      extractedFields: documents.reduce((accumulator, document) => accumulator + document.extractedFields.length, 0),
      confirmedFields: documents.reduce((accumulator, document) => accumulator + document.manualReview.confirmedFieldCount, 0),
    }),
    [documents],
  );

  async function persistDocument(nextDocument: IngestedDocument) {
    await localDb.saveIngestionDocument(nextDocument);
    await saveDocumentSnapshot(nextDocument);
    await Promise.all(createDocumentStoredAuditEvents(nextDocument).map((event) => localDb.appendAuditEvent(event)));
  }

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList?.length) return;

    setIsProcessing(true);
    setError(null);

    try {
      const processedDocuments = await Promise.all(
        Array.from(fileList).map(async (file) => {
          const registered = await registerDocumentLocally({ file });
          const processed = await processDocumentWithDedicatedWorker(registered, file);
          await persistDocument(processed);
          return processed;
        }),
      );

      setDocuments((current) => [...processedDocuments, ...current].sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
      setTimeout(() => documentListRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
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

  function handleManualReviewChange(documentId: string, fieldId: string, value: string) {
    void syncDocument(documentId, (document) => updateManualReviewField(document, fieldId, value));
  }

  function handleConfirmManualReviewField(documentId: string, fieldId: string) {
    void syncDocument(documentId, (document) => confirmManualReviewField(document, fieldId));
  }

  function handleConfirmManualReview(documentId: string) {
    void syncDocument(documentId, (document) => confirmManualReview(document));
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <DocumentUploadPanel onFilesSelected={handleFilesSelected} isProcessing={isProcessing} />

        <div className="rounded-[1.75rem] border border-amber-400/20 bg-amber-400/10 p-5 text-sm text-amber-50">
          <div className="mb-2 flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Guardrails do fluxo documental
          </div>
          <ul className="space-y-1 text-amber-100/90">
            <li>• PDF digital usa pdf.js como caminho prioritário.</li>
            <li>• OCR/Tesseract não é base confiável para cálculo fiscal e fica apenas como fallback técnico.</li>
            <li>• Revisão e edição manual são obrigatórias antes de qualquer uso do documento no rule engine.</li>
            <li>• Sem confirmação humana, o fluxo continua explicitamente bloqueado.</li>
          </ul>
          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-background/30 p-4 text-amber-50">
            <div className="font-medium">Como demonstrar esta etapa</div>
            <ol className="mt-2 space-y-1 text-amber-100/90">
              <li>1. Envie um PDF, imagem ou XML local.</li>
              <li>2. Revise os campos críticos antes de seguir.</li>
              <li>3. Confirme a revisão manual para registrar a evidência.</li>
              <li>4. Volte ao relatório para mostrar o impacto no gate final.</li>
            </ol>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-7">
          <SummaryCard label="Documentos" value={String(summary.total)} />
          <SummaryCard label="Rev. pendente" value={String(summary.manualReviewPending)} />
          <SummaryCard label="Rev. ok" value={String(summary.manualReviewDone)} />
          <SummaryCard label="Falhas" value={String(summary.failed)} />
          <SummaryCard label="Alertas" value={String(summary.warnings)} />
          <SummaryCard label="Campos" value={String(summary.extractedFields)} />
          <SummaryCard label="Confirmados" value={String(summary.confirmedFields)} />
        </div>

        {error ? <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
      </div>

      <div ref={documentListRef} />
      <DocumentList
        documents={documents}
        onManualReviewChange={handleManualReviewChange}
        onConfirmManualReviewField={handleConfirmManualReviewField}
        onConfirmManualReview={handleConfirmManualReview}
      />
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
