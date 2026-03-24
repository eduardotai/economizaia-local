import type { DocumentRegistrationInput, DocumentProcessingStatus, IngestedDocument } from "@/models/documents";
import { createId, detectDocumentKind, nowIso } from "@/lib/document-utils";
import {
  buildMockEntities,
  createDocumentAuditEntry,
  getOcrAdapter,
  getTextExtractionAdapter,
  mapWarningsToMessages,
} from "@/lib/document-extraction";

function updateDocumentStatus(document: IngestedDocument, status: DocumentProcessingStatus): IngestedDocument {
  return {
    ...document,
    status,
    updatedAt: nowIso(),
  };
}

export async function registerDocumentLocally({ file, source = "upload" }: DocumentRegistrationInput): Promise<IngestedDocument> {
  const documentId = createId("doc");
  const kind = detectDocumentKind(file);
  const objectUrl = URL.createObjectURL(file);
  const createdAt = nowIso();

  return {
    id: documentId,
    name: file.name.replace(/\.[^.]+$/, "") || file.name,
    originalFileName: file.name,
    kind,
    detectedMimeType: file.type || "application/octet-stream",
    source,
    status: "registered",
    createdAt,
    updatedAt: createdAt,
    file: {
      objectUrl,
      mimeType: file.type || "application/octet-stream",
      sizeInBytes: file.size,
      lastModified: file.lastModified,
    },
    pages: [],
    ocrJobs: [],
    entities: [],
    processingWarnings: [
      "Pipeline documental local-first ativa no navegador.",
      "Nenhuma regra fiscal oficial é inferida automaticamente nesta etapa.",
      "Extração estrutural ainda exige revisão humana; partes do fluxo seguem stub por design neste checkpoint.",
    ],
    auditTrail: [
      createDocumentAuditEntry(documentId, "document_registered", "completed", "Documento registrado no storage local do navegador.", {
        source,
        mimeType: file.type || "application/octet-stream",
        sizeInBytes: file.size,
      }),
    ],
    placeholder: true,
  };
}

export async function processDocumentPlaceholder(document: IngestedDocument, file: File): Promise<IngestedDocument> {
  let current = updateDocumentStatus(document, "classifying");
  const auditTrail = [...current.auditTrail];
  const processingWarnings = [...current.processingWarnings];

  auditTrail.push(
    createDocumentAuditEntry(current.id, "type_detected", "completed", `Tipo do arquivo detectado como ${current.kind}.`, {
      kind: current.kind,
      mimeType: current.detectedMimeType,
    }),
  );

  current = updateDocumentStatus(current, "extracting_text");
  const textAdapter = getTextExtractionAdapter(current.kind);
  const textResult = await textAdapter.extract({ document: current, file });
  const pages = textResult.pages;
  processingWarnings.push(...mapWarningsToMessages(textResult.warnings));

  auditTrail.push(
    createDocumentAuditEntry(
      current.id,
      "pdf_text_extracted_stub",
      textResult.capability.status === "available" ? "completed" : textResult.capability.status === "unavailable" ? "failed" : "warning",
      textResult.capability.message,
      {
        engine: textResult.capability.engine,
        mode: textResult.capability.mode,
        pageCount: pages.length,
      },
    ),
  );

  current = updateDocumentStatus(current, textResult.suggestedStatus === "failed" ? "failed" : current.kind === "image" ? "ocr_queued" : "extracting_entities");

  let ocrJobs = current.ocrJobs;
  if (current.kind === "pdf" || current.kind === "image") {
    const ocrAdapter = getOcrAdapter(current.kind);

    if (ocrAdapter) {
      current = updateDocumentStatus(current, "ocr_queued");
      const ocrResult = await ocrAdapter.run({ document: current, file, pages });
      ocrJobs = ocrResult.jobs;
      processingWarnings.push(...mapWarningsToMessages(ocrResult.warnings));
      auditTrail.push(
        createDocumentAuditEntry(current.id, "ocr_enqueued_stub", "warning", ocrResult.capability.message, {
          engine: ocrResult.capability.engine,
          mode: ocrResult.capability.mode,
          jobCount: ocrResult.jobs.length,
          pageCount: pages.length,
        }),
      );
      current = updateDocumentStatus(current, ocrResult.suggestedStatus);
    }
  }

  current = updateDocumentStatus(current, current.status === "failed" ? "failed" : "extracting_entities");
  const entities = buildMockEntities(current, pages);

  auditTrail.push(
    createDocumentAuditEntry(current.id, "entities_generated_mock", "warning", "Entidades estruturadas continuam mockadas; servem só para validar UX/auditoria local.", {
      entityCount: entities.length,
    }),
  );

  const finalStatus: DocumentProcessingStatus = current.status === "failed" ? "failed" : processingWarnings.length > 3 ? "review_required" : "completed";

  auditTrail.push(
    createDocumentAuditEntry(
      current.id,
      finalStatus === "failed" ? "processing_failed" : "processing_completed",
      finalStatus === "failed" ? "failed" : finalStatus === "review_required" ? "warning" : "completed",
      finalStatus === "failed"
        ? "Pipeline local não conseguiu concluir o documento com segurança neste checkpoint."
        : finalStatus === "review_required"
          ? "Pipeline concluída com limitações explícitas; revisão humana recomendada antes de qualquer uso fiscal."
          : "Documento concluído localmente com extração inicial e trilha auditável.",
      {
        warnings: processingWarnings.length,
        entities: entities.length,
        ocrJobs: ocrJobs.length,
      },
    ),
  );

  return {
    ...current,
    status: finalStatus,
    updatedAt: nowIso(),
    pages,
    ocrJobs,
    entities,
    auditTrail,
    processingWarnings: Array.from(new Set(processingWarnings)),
  };
}
