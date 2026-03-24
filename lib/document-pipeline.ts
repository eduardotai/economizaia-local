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
    extractedFields: [],
    manualReview: {
      required: true,
      reviewedBy: "pendente",
      confirmed: false,
      fields: [],
      notes: [
        "Revisão manual obrigatória antes do rule engine quando a origem for documental.",
        "OCR não é confiável o suficiente para cálculo fiscal; pdf.js deve ser priorizado para PDFs digitais.",
      ],
    },
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
  const extractedFields = textResult.extractedFields ?? [];
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
        extractedFields: extractedFields.length,
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
  const entities = textResult.entities?.length ? textResult.entities : buildMockEntities(current, pages);

  auditTrail.push(
    createDocumentAuditEntry(current.id, "entities_generated_mock", "warning", "Entidades estruturadas ainda dependem de heurística/mock e servem para validar UX/auditoria local.", {
      entityCount: entities.length,
      extractedFields: extractedFields.length,
      xmlHeuristic: current.kind === "xml",
    }),
  );

  const manualReviewFields = extractedFields.map((field) => ({
    id: field.id,
    label: field.label,
    value: field.value,
    sourcePath: field.sourcePath,
    reviewed: false,
    updatedAt: nowIso(),
    note: field.note,
  }));

  const finalStatus: DocumentProcessingStatus = current.status === "failed" ? "failed" : "ready_for_manual_review";

  auditTrail.push(
    createDocumentAuditEntry(
      current.id,
      "manual_review_required",
      finalStatus === "failed" ? "failed" : "warning",
      finalStatus === "failed"
        ? "Pipeline local não conseguiu concluir o documento com segurança neste checkpoint."
        : "Documento preparado para revisão manual obrigatória antes de qualquer cálculo no rule engine.",
      {
        warnings: processingWarnings.length,
        entities: entities.length,
        extractedFields: extractedFields.length,
        ocrJobs: ocrJobs.length,
        manualReviewRequired: true,
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
    extractedFields,
    manualReview: {
      required: true,
      reviewedBy: "pendente",
      confirmed: false,
      reviewedAt: undefined,
      fields: manualReviewFields,
      notes: Array.from(
        new Set([
          ...current.manualReview.notes,
          "Sem revisão manual confirmada, o app deve bloquear o cálculo originado de documento.",
          "pdf.js foi priorizado para PDFs digitais; OCR permanece apenas como fallback/placebo técnico neste checkpoint.",
        ]),
      ),
    },
    auditTrail,
    processingWarnings: Array.from(new Set(processingWarnings)),
  };
}

export function confirmManualReview(document: IngestedDocument, fields: IngestedDocument["manualReview"]["fields"]): IngestedDocument {
  const reviewedAt = nowIso();

  return {
    ...document,
    status: "manual_review_confirmed",
    updatedAt: reviewedAt,
    extractedFields: document.extractedFields.map((field) => {
      const reviewedField = fields.find((item) => item.id === field.id);
      return reviewedField
        ? {
            ...field,
            value: reviewedField.value,
            reviewRequired: !reviewedField.reviewed,
            note: reviewedField.note ?? field.note,
          }
        : field;
    }),
    manualReview: {
      ...document.manualReview,
      confirmed: true,
      reviewedBy: "usuario_local",
      reviewedAt,
      fields: fields.map((field) => ({ ...field, reviewed: true, updatedAt: reviewedAt })),
      notes: Array.from(new Set([...document.manualReview.notes, "Revisão manual confirmada localmente pelo usuário."])),
    },
    auditTrail: [
      ...document.auditTrail,
      createDocumentAuditEntry(document.id, "manual_review_confirmed", "completed", "Revisão manual confirmada antes do cálculo.", {
        reviewedFields: fields.length,
      }),
    ],
  };
}

export function documentCanRunRuleEngine(document: IngestedDocument): boolean {
  return Boolean(document.manualReview.required && document.manualReview.confirmed && document.status === "manual_review_confirmed");
}
