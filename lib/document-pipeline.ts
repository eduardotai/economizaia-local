import type {
  DocumentAuditEntry,
  DocumentPage,
  DocumentRegistrationInput,
  ExtractedEntity,
  IngestedDocument,
  OCRJob,
} from "@/models/documents";
import { detectDocumentKind, createId, nowIso, readTextSnippet } from "@/lib/document-utils";

function createAuditEntry(
  documentId: string,
  step: DocumentAuditEntry["step"],
  status: DocumentAuditEntry["status"],
  message: string,
  metadata?: DocumentAuditEntry["metadata"],
): DocumentAuditEntry {
  return {
    id: createId("audit"),
    documentId,
    step,
    status,
    message,
    metadata,
    createdAt: nowIso(),
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
      "Pipeline documental em modo placeholder/local-first.",
      "Nenhuma regra fiscal oficial é inferida automaticamente nesta etapa.",
    ],
    auditTrail: [
      createAuditEntry(documentId, "document_registered", "completed", "Documento registrado no storage local do navegador.", {
        source,
        mimeType: file.type || "application/octet-stream",
        sizeInBytes: file.size,
      }),
    ],
    placeholder: true,
  };
}

export async function extractPdfTextStub(document: IngestedDocument, file: File): Promise<DocumentPage[]> {
  const snippet = await readTextSnippet(file);

  return [
    {
      id: createId("page"),
      documentId: document.id,
      pageNumber: 1,
      source: "pdf_text",
      extractedText: snippet
        ? `STUB pdf.js: texto preliminar derivado do arquivo. Trecho detectado: ${snippet}`
        : "STUB pdf.js: extração real de texto ainda não implementada.",
      confidence: 0.42,
      warnings: [
        "Placeholder: integrar pdf.js em worker local para leitura real do PDF.",
        "Este texto não deve ser tratado como extração oficial do documento.",
      ],
    },
  ];
}

export function enqueueOcrStub(document: IngestedDocument, pages: DocumentPage[]): OCRJob {
  const createdAt = nowIso();

  return {
    id: createId("ocr"),
    documentId: document.id,
    pageIds: pages.map((page) => page.id),
    status: "completed",
    engine: "tesseract_stub",
    createdAt,
    updatedAt: createdAt,
    warnings: [
      "Placeholder: Tesseract.js ainda não foi conectado ao worker local.",
      "Job marcado como concluído apenas para demonstrar o fluxo de status.",
    ],
  };
}

export function generateMockEntities(document: IngestedDocument, pages: DocumentPage[]): ExtractedEntity[] {
  const primaryPage = pages[0];
  const safeName = document.originalFileName.replace(/\.[^.]+$/, "");

  return [
    {
      id: createId("entity"),
      documentId: document.id,
      pageId: primaryPage?.id,
      label: "document_number",
      value: `MOCK-${document.id.slice(-6).toUpperCase()}`,
      confidence: 0.54,
      source: "mock_pipeline",
      note: "Valor sintético criado para validar a etapa de extração estruturada.",
    },
    {
      id: createId("entity"),
      documentId: document.id,
      pageId: primaryPage?.id,
      label: "supplier_name",
      value: safeName,
      confidence: 0.35,
      source: "mock_pipeline",
      note: "Placeholder derivado do nome do arquivo enviado pelo usuário.",
    },
    {
      id: createId("entity"),
      documentId: document.id,
      pageId: primaryPage?.id,
      label: "note",
      value: "Entidades mockadas para exercitar revisão humana e trilha de auditoria local.",
      confidence: 0.2,
      source: "mock_pipeline",
      note: "Não representa interpretação fiscal oficial.",
    },
  ];
}

export async function processDocumentPlaceholder(document: IngestedDocument, file: File): Promise<IngestedDocument> {
  const auditTrail = [...document.auditTrail];
  const processingWarnings = [...document.processingWarnings];

  auditTrail.push(
    createAuditEntry(document.id, "type_detected", "completed", `Tipo do arquivo detectado como ${document.kind}.`, {
      kind: document.kind,
      mimeType: document.detectedMimeType,
    }),
  );

  let pages: DocumentPage[] = [];
  let ocrJobs: OCRJob[] = [];

  if (document.kind === "pdf") {
    pages = await extractPdfTextStub(document, file);
    auditTrail.push(
      createAuditEntry(document.id, "pdf_text_extracted_stub", "warning", "Extração de texto de PDF executada em modo stub.", {
        pageCount: pages.length,
      }),
    );
    processingWarnings.push("Extração de PDF ainda usa stub local e precisa de integração real com pdf.js.");
  }

  if (document.kind === "image" || document.kind === "pdf") {
    const ocrJob = enqueueOcrStub(document, pages);
    ocrJobs = [ocrJob];
    auditTrail.push(
      createAuditEntry(document.id, "ocr_enqueued_stub", "warning", "OCR enfileirado e finalizado em modo stub.", {
        jobId: ocrJob.id,
        pageCount: ocrJob.pageIds.length,
      }),
    );
    processingWarnings.push("OCR ainda usa placeholder com status fictício para demonstrar a pipeline.");
  }

  if (document.kind === "xml" && pages.length === 0) {
    const xmlSnippet = await readTextSnippet(file);
    pages = [
      {
        id: createId("page"),
        documentId: document.id,
        pageNumber: 1,
        source: "image_stub",
        extractedText: xmlSnippet || "STUB XML: leitura estrutural ainda não implementada.",
        warnings: ["Placeholder: parser XML local será adicionado em checkpoint futuro."],
      },
    ];
  }

  const entities = generateMockEntities(document, pages);
  auditTrail.push(
    createAuditEntry(document.id, "entities_generated_mock", "warning", "Entidades extraídas geradas por mock da pipeline.", {
      entityCount: entities.length,
    }),
    createAuditEntry(document.id, "processing_completed", "completed", "Documento finalizado no fluxo esqueleto de ingestão local."),
  );

  return {
    ...document,
    status: "completed",
    updatedAt: nowIso(),
    pages,
    ocrJobs,
    entities,
    auditTrail,
    processingWarnings,
  };
}
