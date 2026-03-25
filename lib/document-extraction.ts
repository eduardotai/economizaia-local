import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import type {
  DocumentAuditEntry,
  DocumentPage,
  DocumentProcessingStatus,
  ExtractedEntity,
  ExtractedFieldCandidate,
  IngestedDocument,
  OCRJob,
  SupportedDocumentKind,
} from "@/models/documents";
import { createId, nowIso, readTextSnippet } from "@/lib/document-utils";
import { parseXmlPlaceholder } from "@/lib/xml-placeholder-parser";

if (typeof window !== "undefined" && !GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

export type ExtractionCapabilityStatus = "available" | "degraded" | "stub" | "unavailable";

export interface ExtractionCapability {
  engine: string;
  status: ExtractionCapabilityStatus;
  mode: "real" | "hybrid" | "stub";
  message: string;
}

export interface ExtractionWarning {
  code:
    | "PDFJS_IMPORT_FAILED"
    | "PDF_PARSE_FAILED"
    | "PDF_TEXT_EMPTY"
    | "OCR_NOT_IMPLEMENTED"
    | "OCR_IMAGE_RENDER_MISSING"
    | "XML_PARSER_STUB"
    | "UNSUPPORTED_DOCUMENT_KIND";
  message: string;
  recoverable: boolean;
}

export interface TextExtractionRequest {
  document: IngestedDocument;
  file: File;
}

export interface TextExtractionResult {
  pages: DocumentPage[];
  warnings: ExtractionWarning[];
  capability: ExtractionCapability;
  suggestedStatus: DocumentProcessingStatus;
  entities?: ExtractedEntity[];
  extractedFields?: ExtractedFieldCandidate[];
}

export interface OcrRequest {
  document: IngestedDocument;
  file: File;
  pages: DocumentPage[];
}

export interface OcrResult {
  jobs: OCRJob[];
  pages: DocumentPage[];
  warnings: ExtractionWarning[];
  capability: ExtractionCapability;
  suggestedStatus: DocumentProcessingStatus;
}

export interface TextExtractionAdapter {
  supportedKinds: SupportedDocumentKind[];
  extract(request: TextExtractionRequest): Promise<TextExtractionResult>;
}

export interface OcrAdapter {
  supportedKinds: SupportedDocumentKind[];
  run(request: OcrRequest): Promise<OcrResult>;
}

export function createDocumentAuditEntry(
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

function normalizeSearchableText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeFields(fields: ExtractedFieldCandidate[]) {
  const seen = new Set<string>();
  return fields.filter((field) => {
    const key = `${field.label}:${field.value}:${field.sourcePath ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractStructuredFieldCandidates(document: IngestedDocument, pages: DocumentPage[]): ExtractedFieldCandidate[] {
  const text = pages
    .map((page) => page.extractedText)
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return [];
  }

  const normalized = normalizeSearchableText(text);
  const candidates: ExtractedFieldCandidate[] = [];

  const cnpjMatch = text.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/);
  if (cnpjMatch) {
    const rawCnpj = cnpjMatch[0].replace(/\D/g, "");
    const formattedCnpj =
      rawCnpj.length === 14
        ? `${rawCnpj.slice(0, 2)}.${rawCnpj.slice(2, 5)}.${rawCnpj.slice(5, 8)}/${rawCnpj.slice(8, 12)}-${rawCnpj.slice(12)}`
        : cnpjMatch[0];
    candidates.push({
      id: createId("field"),
      documentId: document.id,
      label: "CNPJ emitente",
      value: formattedCnpj,
      sourcePath: "document.text.cnpj_emitente",
      confidence: 0.8,
      reviewRequired: true,
      note: "Campo extraído por parser local baseado em padrão de CNPJ. Formato: XX.XXX.XXX/XXXX-XX.",
    });
  }

  const dateMatch = text.match(/\b\d{2}[\/.-]\d{2}[\/.-]\d{4}\b/);
  if (dateMatch) {
    candidates.push({
      id: createId("field"),
      documentId: document.id,
      label: "Data de emissão",
      value: dateMatch[0],
      sourcePath: "document.text.issue_date",
      confidence: 0.72,
      reviewRequired: true,
      note: "Data detectada por padrão textual. Confirmar manualmente o contexto do campo.",
    });
  }

  const currencyMatch = text.match(/R\$\s?\d{1,3}(?:\.\d{3})*,\d{2}/);
  if (currencyMatch) {
    candidates.push({
      id: createId("field"),
      documentId: document.id,
      label: "Valor total",
      value: currencyMatch[0],
      sourcePath: "document.text.total_amount",
      confidence: 0.74,
      reviewRequired: true,
      note: "Valor monetário detectado pelo parser local. Revisão humana continua obrigatória.",
    });
  }

  const numberMatch =
    text.match(/(?:nfs-e|nf-e|nota fiscal|numero|nº|n\.)\s*[:#-]?\s*([a-z0-9-]{4,})/i) ??
    text.match(/\b\d{5,}\b/);
  if (numberMatch) {
    candidates.push({
      id: createId("field"),
      documentId: document.id,
      label: "Número do documento",
      value: numberMatch[1] ?? numberMatch[0],
      sourcePath: "document.text.document_number",
      confidence: 0.6,
      reviewRequired: true,
      note: "Número inferido por heurística textual. Confirmar o identificador correto antes de seguir.",
    });
  }

  if (normalized.includes("servico") || normalized.includes("prestacao")) {
    candidates.push({
      id: createId("field"),
      documentId: document.id,
      label: "Indicativo de serviço",
      value: "Prestação de serviços",
      sourcePath: "document.text.activity_hint",
      confidence: 0.42,
      reviewRequired: true,
      note: "Sinal heurístico útil para conferência humana, não para classificação tributária automática.",
    });
  }

  return dedupeFields(candidates);
}

function buildEntitiesFromFields(document: IngestedDocument, fields: ExtractedFieldCandidate[]): ExtractedEntity[] {
  const fieldsByLabel = new Map(fields.map((field) => [field.label, field]));
  const entities: ExtractedEntity[] = [];

  const cnpjField = fieldsByLabel.get("CNPJ emitente");
  if (cnpjField) {
    entities.push({
      id: createId("entity"),
      documentId: document.id,
      label: "cnpj_emitente",
      value: cnpjField.value,
      confidence: cnpjField.confidence,
      source: "pdf_text_parser",
      note: cnpjField.note,
    });
  }

  const documentNumberField = fieldsByLabel.get("Número do documento");
  if (documentNumberField) {
    entities.push({
      id: createId("entity"),
      documentId: document.id,
      label: "document_number",
      value: documentNumberField.value,
      confidence: documentNumberField.confidence,
      source: "pdf_text_parser",
      note: documentNumberField.note,
    });
  }

  const issueDateField = fieldsByLabel.get("Data de emissão");
  if (issueDateField) {
    entities.push({
      id: createId("entity"),
      documentId: document.id,
      label: "issue_date",
      value: issueDateField.value,
      confidence: issueDateField.confidence,
      source: "pdf_text_parser",
      note: issueDateField.note,
    });
  }

  const totalField = fieldsByLabel.get("Valor total");
  if (totalField) {
    entities.push({
      id: createId("entity"),
      documentId: document.id,
      label: "total_amount",
      value: totalField.value,
      confidence: totalField.confidence,
      source: "pdf_text_parser",
      note: totalField.note,
    });
  }

  return entities;
}

async function renderPdfPageToBlob(page: {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: any) => { promise: Promise<unknown> };
}) {
  const viewport = page.getViewport({ scale: 2 });

  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    await page.render({
      // pdf.js accepts OffscreenCanvasRenderingContext2D in worker-like environments
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvasContext: context as any,
      viewport,
    }).promise;

    return canvas.convertToBlob({ type: "image/png" });
  }

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    await page.render({ canvasContext: context, viewport }).promise;

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  return null;
}

const pdfTextAdapter: TextExtractionAdapter = {
  supportedKinds: ["pdf"],
  async extract({ document, file }) {
    const fileBuffer = await file.arrayBuffer();

    try {
      const pdf = await getDocument({ data: fileBuffer }).promise;
      const pages: DocumentPage[] = [];
      const warnings: ExtractionWarning[] = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        pages.push({
          id: createId("page"),
          documentId: document.id,
          pageNumber,
          source: "pdf_text",
          extractedText: text,
          confidence: text ? 0.9 : 0,
          warnings: text
            ? []
            : ["pdf.js abriu a página, mas não encontrou texto selecionável. OCR local será usado como fallback."],
        });

        if (!text) {
          warnings.push({
            code: "PDF_TEXT_EMPTY",
            message: `Página ${pageNumber} sem texto selecionável. OCR local será usado como fallback explícito.`,
            recoverable: true,
          });
        }
      }

      const extractedFields = extractStructuredFieldCandidates(document, pages);
      const entities = buildEntitiesFromFields(document, extractedFields);

      return {
        pages,
        extractedFields,
        entities,
        warnings,
        capability: {
          engine: "pdfjs-dist",
          status: warnings.length > 0 ? "degraded" : "available",
          mode: warnings.length > 0 ? "hybrid" : "real",
          message:
            warnings.length > 0
              ? "pdf.js extraiu texto parcialmente; páginas sem texto seguem para OCR local."
              : "pdf.js extraiu texto localmente no worker dedicado.",
        },
        suggestedStatus: warnings.length > 0 ? "ocr_queued" : "extracting_entities",
      };
    } catch (error) {
      const snippet = await readTextSnippet(file);
      return {
        pages: [
          {
            id: createId("page"),
            documentId: document.id,
            pageNumber: 1,
            source: "pdf_text",
            extractedText: snippet ? `Fallback local derivado de trecho legível: ${snippet}` : "",
            confidence: snippet ? 0.24 : 0,
            warnings: [
              "Falha ao interpretar o PDF com pdf.js.",
              "Fallback mantido apenas para preservar rastreabilidade da leitura local.",
            ],
          },
        ],
        warnings: [
          {
            code: "PDF_PARSE_FAILED",
            message: error instanceof Error ? `pdf.js não conseguiu abrir/processar o PDF: ${error.message}` : "pdf.js não conseguiu abrir/processar o PDF.",
            recoverable: true,
          },
        ],
        capability: {
          engine: "pdfjs-dist",
          status: "stub",
          mode: "stub",
          message: "pdf.js está conectado, mas este arquivo exigiu fallback local parcial.",
        },
        suggestedStatus: "review_required",
      };
    }
  },
};

const xmlTextAdapter: TextExtractionAdapter = {
  supportedKinds: ["xml"],
  async extract({ document, file }) {
    const text = (await file.text()).trim();
    const parsed = parseXmlPlaceholder(document, text);

    return {
      pages: parsed.pages.map((page) => ({
        ...page,
        source: "xml_parser",
      })),
      entities: parsed.entities.map((entity) => ({
        ...entity,
        source: "xml_parser",
      })),
      extractedFields: parsed.discoveredFields.map((field) => ({
        id: createId("field"),
        documentId: document.id,
        label: field.tagName,
        value: field.value,
        sourcePath: field.path,
        confidence: 0.6,
        reviewRequired: true,
        note: "Campo lido do XML por parser estrutural local. Revisão humana obrigatória.",
      })),
      warnings: [
        {
          code: "XML_PARSER_STUB",
          message: "XML passou por parser local estrutural. Campos seguem exigindo revisão humana antes de qualquer uso fiscal.",
          recoverable: true,
        },
      ],
      capability: {
        engine: "local-xml-parser",
        status: "degraded",
        mode: "hybrid",
        message: "XML agora recebe parsing estrutural local no worker, com revisão manual obrigatória.",
      },
      suggestedStatus: "extracting_entities",
    };
  },
};

const imageTextAdapter: TextExtractionAdapter = {
  supportedKinds: ["image"],
  async extract({ document }) {
    return {
      pages: [
        {
          id: createId("page"),
          documentId: document.id,
          pageNumber: 1,
          source: "image_stub",
          extractedText: "",
          confidence: 0,
          warnings: ["Imagens dependem de OCR local; não há extração textual direta antes desse passo."],
        },
      ],
      warnings: [
        {
          code: "OCR_IMAGE_RENDER_MISSING",
          message: "Imagem registrada. OCR local será executado como caminho principal para produzir texto.",
          recoverable: true,
        },
      ],
      capability: {
        engine: "image-direct-text",
        status: "stub",
        mode: "stub",
        message: "Imagens entram direto no caminho de OCR dentro do worker documental.",
      },
      suggestedStatus: "ocr_queued",
    };
  },
};

const unsupportedTextAdapter: TextExtractionAdapter = {
  supportedKinds: ["unknown"],
  async extract({ document }) {
    return {
      pages: [],
      warnings: [
        {
          code: "UNSUPPORTED_DOCUMENT_KIND",
          message: `Tipo ${document.kind} ainda não possui adapter local de extração textual.`,
          recoverable: false,
        },
      ],
      capability: {
        engine: "unsupported",
        status: "unavailable",
        mode: "stub",
        message: "Formato ainda não suportado pela pipeline local.",
      },
      suggestedStatus: "failed",
    };
  },
};

const tesseractOcrAdapter: OcrAdapter = {
  supportedKinds: ["pdf", "image"],
  async run({ document: ingestedDocument, file, pages }) {
    const createdAt = nowIso();
    const jobId = createId("ocr");

    try {
      const { default: Tesseract } = await import("tesseract.js");
      const updatedPages: DocumentPage[] = [];
      const warnings: ExtractionWarning[] = [];

      if (ingestedDocument.kind === "image") {
        const { data } = await Tesseract.recognize(file, "por+eng");
        const trimmedText = data.text.trim();
        const imagePage = pages[0] ?? {
          id: createId("page"),
          documentId: ingestedDocument.id,
          pageNumber: 1,
          source: "ocr_tesseract",
          extractedText: "",
          confidence: 0,
          warnings: [],
        };

        updatedPages.push({
          ...imagePage,
          source: "ocr_tesseract",
          extractedText: trimmedText,
          confidence: data.confidence / 100,
          warnings: trimmedText ? [] : ["OCR não encontrou texto reconhecível nesta imagem."],
        });
      } else {
        const pdf = await getDocument({ data: await file.arrayBuffer() }).promise;

        for (const page of pages) {
          if (page.extractedText.trim().length >= 24) {
            updatedPages.push(page);
            continue;
          }

          try {
            const pdfPage = await pdf.getPage(page.pageNumber);
            const renderedBlob = await renderPdfPageToBlob(pdfPage);

            if (!renderedBlob) {
              updatedPages.push({
                ...page,
                warnings: [...page.warnings, `Página ${page.pageNumber}: ambiente sem suporte para renderização de OCR.`],
              });
              warnings.push({
                code: "OCR_IMAGE_RENDER_MISSING",
                message: `Página ${page.pageNumber}: não foi possível renderizar a página para OCR no worker.`,
                recoverable: true,
              });
              continue;
            }

            const { data } = await Tesseract.recognize(renderedBlob, "por+eng");
            const trimmedText = data.text.trim();

            updatedPages.push({
              ...page,
              source: trimmedText ? "ocr_tesseract" : page.source,
              extractedText: trimmedText || page.extractedText,
              confidence: trimmedText ? data.confidence / 100 : page.confidence ?? 0,
              warnings: trimmedText ? page.warnings : [...page.warnings, `Página ${page.pageNumber}: OCR não encontrou texto legível.`],
            });
          } catch (error) {
            updatedPages.push({
              ...page,
              warnings: [...page.warnings, `Página ${page.pageNumber}: OCR falhou e o texto original foi preservado.`],
            });
            warnings.push({
              code: "OCR_NOT_IMPLEMENTED",
              message: error instanceof Error ? error.message : `Página ${page.pageNumber}: falha ao executar OCR.`,
              recoverable: true,
            });
          }
        }
      }

      const hasTextAfterOcr = updatedPages.some((page) => page.extractedText.trim().length > 0);

      return {
        jobs: [
          {
            id: jobId,
            documentId: ingestedDocument.id,
            pageIds: updatedPages.map((page) => page.id),
            status: hasTextAfterOcr ? "completed" : "failed",
            engine: hasTextAfterOcr ? "tesseract" : "tesseract_stub",
            createdAt,
            updatedAt: nowIso(),
            warnings: warnings.map((warning) => warning.message),
          },
        ],
        pages: updatedPages,
        warnings,
        capability: {
          engine: "tesseract.js",
          status: hasTextAfterOcr ? (warnings.length > 0 ? "degraded" : "available") : "degraded",
          mode: "real",
          message: "Tesseract.js executou OCR local no worker dedicado com suporte a português e inglês.",
        },
        suggestedStatus: hasTextAfterOcr ? "extracting_entities" : "review_required",
      };
    } catch (error) {
      return {
        jobs: [
          {
            id: jobId,
            documentId: ingestedDocument.id,
            pageIds: pages.map((page) => page.id),
            status: "failed",
            engine: "tesseract_stub",
            createdAt,
            updatedAt: nowIso(),
            warnings: [error instanceof Error ? error.message : "Erro ao inicializar o Tesseract.js"],
          },
        ],
        pages,
        warnings: [
          {
            code: "OCR_NOT_IMPLEMENTED",
            message: `Tesseract.js não pôde executar OCR nesta sessão: ${error instanceof Error ? error.message : "erro desconhecido"}`,
            recoverable: true,
          },
        ],
        capability: {
          engine: "tesseract.js",
          status: "unavailable",
          mode: "stub",
          message: "Tesseract.js encontrou um erro e não pôde executar OCR nesta sessão.",
        },
        suggestedStatus: "review_required",
      };
    }
  },
};

export function getTextExtractionAdapter(kind: SupportedDocumentKind): TextExtractionAdapter {
  if (kind === "pdf") return pdfTextAdapter;
  if (kind === "xml") return xmlTextAdapter;
  if (kind === "image") return imageTextAdapter;
  return unsupportedTextAdapter;
}

export function getOcrAdapter(kind: SupportedDocumentKind): OcrAdapter | null {
  if (kind === "pdf" || kind === "image") return tesseractOcrAdapter;
  return null;
}

export function mapWarningsToMessages(warnings: ExtractionWarning[]): string[] {
  return warnings.map((warning) => warning.message);
}

export function buildMockEntities(document: IngestedDocument, pages: DocumentPage[]): ExtractedEntity[] {
  const primaryPage = pages[0];
  const safeName = document.originalFileName.replace(/\.[^.]+$/, "");

  return [
    {
      id: createId("entity"),
      documentId: document.id,
      pageId: primaryPage?.id,
      label: "document_number",
      value: `MOCK-${document.id.slice(-6).toUpperCase()}`,
      confidence: 0.3,
      source: "mock_pipeline",
      note: "Valor sintético criado para manter a revisão manual auditável quando o parser local não encontrou campos suficientes.",
    },
    {
      id: createId("entity"),
      documentId: document.id,
      pageId: primaryPage?.id,
      label: "supplier_name",
      value: safeName,
      confidence: 0.25,
      source: "mock_pipeline",
      note: "Placeholder derivado do nome do arquivo enviado pelo usuário.",
    },
    {
      id: createId("entity"),
      documentId: document.id,
      pageId: primaryPage?.id,
      label: "note",
      value: "Entidades de fallback criadas apenas para sustentar a revisão manual e a trilha local de auditoria.",
      confidence: 0.2,
      source: "mock_pipeline",
      note: "Não representa interpretação fiscal oficial.",
    },
  ];
}

export function deriveEntitiesAndFieldsFromPages(document: IngestedDocument, pages: DocumentPage[]) {
  const extractedFields = extractStructuredFieldCandidates(document, pages);
  const entities = buildEntitiesFromFields(document, extractedFields);

  return {
    extractedFields,
    entities,
  };
}


