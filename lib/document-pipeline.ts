import type {
  DocumentProcessingStatus,
  IngestedDocument,
  ManualReviewField,
  ManualReviewHistoryEntry,
} from "@/models/documents";
import { createId, detectDocumentKind, nowIso } from "@/lib/document-utils";
import {
  buildMockEntities,
  createDocumentAuditEntry,
  deriveEntitiesAndFieldsFromPages,
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

function createManualReviewHistoryEntry(
  action: ManualReviewHistoryEntry["action"],
  previousValue: string,
  nextValue: string,
  actor: ManualReviewHistoryEntry["actor"],
  note?: string,
): ManualReviewHistoryEntry {
  return {
    id: createId("review_history"),
    createdAt: nowIso(),
    actor,
    action,
    previousValue,
    nextValue,
    note,
  };
}

function computeManualReviewSummary(fields: ManualReviewField[]) {
  const confirmedFieldCount = fields.filter((field) => field.state === "confirmed").length;
  return {
    confirmedFieldCount,
    totalFieldCount: fields.length,
  };
}

function normalizeManualReviewFields(document: IngestedDocument, extractedFields: IngestedDocument["extractedFields"]): ManualReviewField[] {
  return extractedFields.map((field) => ({
    id: field.id,
    label: field.label,
    value: field.value,
    originalValue: field.value,
    sourcePath: field.sourcePath,
    reviewed: false,
    required: true,
    state: "needs_review",
    updatedAt: nowIso(),
    note: field.note,
    history: [
      createManualReviewHistoryEntry(
        "extracted",
        "",
        field.value,
        "pipeline_worker",
        "Campo extraído localmente no pipeline documental e enviado para revisão manual.",
      ),
    ],
  }));
}

function finalizeManualReviewDocument(document: IngestedDocument, fields: ManualReviewField[]): IngestedDocument {
  const summary = computeManualReviewSummary(fields);
  const allRequiredFieldsConfirmed = fields.every((field) => !field.required || field.state === "confirmed");

  return {
    ...document,
    status: allRequiredFieldsConfirmed ? "manual_review_confirmed" : "ready_for_manual_review",
    updatedAt: nowIso(),
    extractedFields: document.extractedFields.map((field) => {
      const manualField = fields.find((item) => item.id === field.id);
      return manualField
        ? {
            ...field,
            value: manualField.value,
            reviewRequired: manualField.state !== "confirmed",
            note: manualField.note ?? field.note,
          }
        : field;
    }),
    manualReview: {
      ...document.manualReview,
      confirmed: allRequiredFieldsConfirmed,
      reviewedBy: allRequiredFieldsConfirmed ? "usuario_local" : "pendente",
      reviewedAt: allRequiredFieldsConfirmed ? nowIso() : undefined,
      fields,
      confirmedFieldCount: summary.confirmedFieldCount,
      totalFieldCount: summary.totalFieldCount,
    },
  };
}

export async function registerDocumentLocally({ file, source = "upload" }: { file: File; source?: IngestedDocument["source"] }): Promise<IngestedDocument> {
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
        "Nenhum dado extraído de documento deve seguir para cálculo sem confirmação humana campo a campo.",
      ],
      confirmedFieldCount: 0,
      totalFieldCount: 0,
    },
    processingWarnings: [
      "Pipeline documental local-first ativa no navegador.",
      "Nenhuma regra fiscal oficial é inferida automaticamente nesta etapa.",
    ],
    auditTrail: [
      createDocumentAuditEntry(documentId, "document_registered", "completed", "Documento registrado no storage local do navegador.", {
        source,
        mimeType: file.type || "application/octet-stream",
        sizeInBytes: file.size,
      }),
    ],
    placeholder: false,
  };
}

export async function processDocumentLocally(document: IngestedDocument, file: File): Promise<IngestedDocument> {
  let current = updateDocumentStatus(document, "classifying");
  const auditTrail = [...current.auditTrail];
  const processingWarnings = [...current.processingWarnings];

  auditTrail.push(
    createDocumentAuditEntry(current.id, "worker_processing_started", "running", "Worker documental iniciou o processamento local do arquivo.", {
      kind: current.kind,
      mimeType: current.detectedMimeType,
    }),
  );

  auditTrail.push(
    createDocumentAuditEntry(current.id, "type_detected", "completed", `Tipo do arquivo detectado como ${current.kind}.`, {
      kind: current.kind,
      mimeType: current.detectedMimeType,
    }),
  );

  current = updateDocumentStatus(current, "extracting_text");
  const textAdapter = getTextExtractionAdapter(current.kind);
  const textResult = await textAdapter.extract({ document: current, file });

  let pages = textResult.pages;
  let extractedFields = textResult.extractedFields ?? [];
  let entities = textResult.entities ?? [];
  let ocrJobs = current.ocrJobs;

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

  const ocrAdapter = getOcrAdapter(current.kind);
  const shouldRunOcr =
    Boolean(ocrAdapter) &&
    (current.kind === "image" || pages.some((page) => page.extractedText.trim().length === 0));

  if (ocrAdapter && shouldRunOcr) {
    current = updateDocumentStatus(current, "ocr_queued");
    const ocrResult = await ocrAdapter.run({ document: current, file, pages });
    pages = ocrResult.pages;
    ocrJobs = ocrResult.jobs;
    processingWarnings.push(...mapWarningsToMessages(ocrResult.warnings));
    auditTrail.push(
      createDocumentAuditEntry(
        current.id,
        ocrResult.capability.status === "unavailable" ? "ocr_failed" : "ocr_completed",
        ocrResult.capability.status === "available" ? "completed" : ocrResult.capability.status === "unavailable" ? "failed" : "warning",
        ocrResult.capability.message,
        {
          engine: ocrResult.capability.engine,
          mode: ocrResult.capability.mode,
          pageCount: pages.length,
          jobCount: ocrJobs.length,
        },
      ),
    );
    current = updateDocumentStatus(current, ocrResult.suggestedStatus);
  }

  current = updateDocumentStatus(current, current.status === "failed" ? "failed" : "extracting_entities");

  if (extractedFields.length === 0 || entities.length === 0) {
    const derived = deriveEntitiesAndFieldsFromPages(current, pages);
    extractedFields = extractedFields.length > 0 ? extractedFields : derived.extractedFields;
    entities = entities.length > 0 ? entities : derived.entities;
  }

  if (entities.length === 0) {
    entities = buildMockEntities(current, pages);
    auditTrail.push(
      createDocumentAuditEntry(
        current.id,
        "entities_generated_mock",
        "warning",
        "Entidades de fallback foram geradas para sustentar a revisão manual quando o parser local não encontrou campos suficientes.",
        {
          pageCount: pages.length,
          extractedFields: extractedFields.length,
        },
      ),
    );
  }

  const manualReviewFields = normalizeManualReviewFields(current, extractedFields);
  const summary = computeManualReviewSummary(manualReviewFields);
  const finalStatus: DocumentProcessingStatus = current.status === "failed" ? "failed" : "ready_for_manual_review";

  auditTrail.push(
    createDocumentAuditEntry(
      current.id,
      "manual_review_required",
      finalStatus === "failed" ? "failed" : "warning",
      finalStatus === "failed"
        ? "Pipeline local não conseguiu concluir o documento com segurança neste checkpoint."
        : "Documento preparado para revisão manual avançada antes de qualquer cálculo no rule engine.",
      {
        warnings: processingWarnings.length,
        entities: entities.length,
        extractedFields: extractedFields.length,
        ocrJobs: ocrJobs.length,
        manualReviewRequired: true,
      },
    ),
  );

  auditTrail.push(
    createDocumentAuditEntry(current.id, "worker_processing_completed", finalStatus === "failed" ? "failed" : "completed", "Worker documental concluiu o processamento local do arquivo.", {
      finalStatus,
      reviewedFields: summary.confirmedFieldCount,
      totalFields: summary.totalFieldCount,
    }),
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
          "Estados por campo: needs_review, edited e confirmed.",
          "Sem confirmação humana de todos os campos, o app deve bloquear o cálculo originado de documento.",
          "Histórico local de edições é salvo dentro do próprio documento persistido.",
        ]),
      ),
      confirmedFieldCount: summary.confirmedFieldCount,
      totalFieldCount: summary.totalFieldCount,
    },
    auditTrail,
    processingWarnings: Array.from(new Set(processingWarnings)),
    placeholder: entities.some((entity) => entity.source === "mock_pipeline"),
  };
}

export async function processDocumentPlaceholder(document: IngestedDocument, file: File): Promise<IngestedDocument> {
  return processDocumentLocally(document, file);
}

export function updateManualReviewField(document: IngestedDocument, fieldId: string, value: string): IngestedDocument {
  const reviewedAt = nowIso();

  const nextFields = document.manualReview.fields.map((field) => {
    if (field.id !== fieldId) {
      return field;
    }

    return {
      ...field,
      value,
      reviewed: false,
      state: (value.trim().length === 0 ? "needs_review" : value.trim() === field.originalValue.trim() ? "needs_review" : "edited") as ManualReviewField["state"],
      updatedAt: reviewedAt,
      history: [
        ...field.history,
        createManualReviewHistoryEntry("edited", field.value, value, "usuario_local", "Campo editado localmente durante a revisão manual."),
      ],
    };
  });

  const nextDocument = finalizeManualReviewDocument(document, nextFields);

  return {
    ...nextDocument,
    manualReview: {
      ...nextDocument.manualReview,
      notes: Array.from(new Set([...nextDocument.manualReview.notes, "Uma edição local reabriu a revisão manual do documento."])),
    },
    auditTrail: [
      ...nextDocument.auditTrail,
      createDocumentAuditEntry(document.id, "field_review_updated", "warning", "Campo alterado localmente; revisão manual foi reaberta até nova confirmação.", {
        fieldId,
      }),
      createDocumentAuditEntry(document.id, "manual_review_reset", "warning", "Alteração em campo revisável reabriu o gate documental.", {
        fieldId,
      }),
    ],
  };
}

export function confirmManualReviewField(document: IngestedDocument, fieldId: string): IngestedDocument {
  const reviewedAt = nowIso();

  const nextFields = document.manualReview.fields.map((field) => {
    if (field.id !== fieldId || field.value.trim().length === 0) {
      return field;
    }

    return {
      ...field,
      reviewed: true,
      state: "confirmed" as const,
      updatedAt: reviewedAt,
      history: [
        ...field.history,
        createManualReviewHistoryEntry("confirmed", field.value, field.value, "usuario_local", "Campo confirmado manualmente pelo usuário."),
      ],
    };
  });

  const nextDocument = finalizeManualReviewDocument(document, nextFields);

  return {
    ...nextDocument,
    auditTrail: [
      ...nextDocument.auditTrail,
      createDocumentAuditEntry(document.id, "field_review_confirmed", "completed", "Campo confirmado manualmente pelo usuário.", {
        fieldId,
      }),
    ],
  };
}

export function confirmManualReview(document: IngestedDocument): IngestedDocument {
  const reviewedAt = nowIso();
  const hasPendingRequiredField = document.manualReview.fields.some((field) => field.required && field.value.trim().length === 0);

  if (hasPendingRequiredField) {
    return {
      ...document,
      manualReview: {
        ...document.manualReview,
        confirmed: false,
        reviewedBy: "pendente",
        reviewedAt: undefined,
        notes: Array.from(
          new Set([...document.manualReview.notes, "A confirmação total foi bloqueada porque ainda existem campos obrigatórios vazios."]),
        ),
      },
      auditTrail: [
        ...document.auditTrail,
        createDocumentAuditEntry(document.id, "manual_review_reset", "warning", "Tentativa de confirmação total bloqueada por campos obrigatórios vazios.", {
          totalFields: document.manualReview.fields.length,
        }),
      ],
    };
  }

  const nextFields = document.manualReview.fields.map((field) => {
    if (field.state === "confirmed") {
      return field;
    }

    return {
      ...field,
      reviewed: true,
      state: "confirmed" as const,
      updatedAt: reviewedAt,
      history: [
        ...field.history,
        createManualReviewHistoryEntry("bulk_confirmed", field.value, field.value, "usuario_local", "Campo confirmado pela ação de revisão total."),
      ],
    };
  });

  const nextDocument = finalizeManualReviewDocument(document, nextFields);

  return {
    ...nextDocument,
    manualReview: {
      ...nextDocument.manualReview,
      confirmed: true,
      reviewedBy: "usuario_local",
      reviewedAt,
      notes: Array.from(new Set([...nextDocument.manualReview.notes, "Revisão manual confirmada localmente pelo usuário."])),
    },
    auditTrail: [
      ...nextDocument.auditTrail,
      createDocumentAuditEntry(document.id, "manual_review_confirmed", "completed", "Todos os campos foram confirmados manualmente antes do cálculo.", {
        reviewedFields: nextFields.length,
      }),
    ],
  };
}

export function documentCanRunRuleEngine(document: IngestedDocument): boolean {
  const requiredFields = document.manualReview.fields.filter((field) => field.required);
  const allRequiredFieldsConfirmed = requiredFields.every((field) => field.state === "confirmed" && field.value.trim().length > 0);

  return Boolean(document.manualReview.required && document.manualReview.confirmed && allRequiredFieldsConfirmed && document.status === "manual_review_confirmed");
}
