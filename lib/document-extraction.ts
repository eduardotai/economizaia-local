import { getDocument } from "pdfjs-dist";
import type {
  DocumentAuditEntry,
  DocumentPage,
  DocumentProcessingStatus,
  ExtractedEntity,
  IngestedDocument,
  OCRJob,
  SupportedDocumentKind,
} from "@/models/documents";
import { createId, nowIso, readTextSnippet } from "@/lib/document-utils";

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
          extractedText: text || "",
          confidence: text ? 0.88 : 0,
          warnings: text
            ? []
            : ["pdf.js carregou a página, mas não encontrou texto selecionável. OCR local ainda segue parcial/stub."],
        });

        if (!text) {
          warnings.push({
            code: "PDF_TEXT_EMPTY",
            message: `Página ${pageNumber} sem texto selecionável. Próximo passo: renderizar a página em canvas e passar por OCR local.`,
            recoverable: true,
          });
        }
      }

      return {
        pages,
        warnings,
        capability: {
          engine: "pdfjs-dist",
          status: warnings.length > 0 ? "degraded" : "available",
          mode: warnings.length > 0 ? "hybrid" : "real",
          message:
            warnings.length > 0
              ? "pdf.js extraiu texto de forma parcial; páginas sem texto continuam dependendo de OCR local futuro."
              : "pdf.js extraiu texto localmente no navegador.",
        },
        suggestedStatus: warnings.length > 0 ? "review_required" : "extracting_entities",
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
            extractedText: snippet ? `Fallback stub derivado do binário/trecho legível: ${snippet}` : "",
            confidence: snippet ? 0.24 : 0,
            warnings: [
              "Falha ao interpretar o PDF com pdf.js neste checkpoint.",
              "Fallback local mantido apenas para plumbing; não tratar como extração documental confiável.",
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
          message: "pdf.js está conectado, mas ainda existe fallback stub para PDFs incompatíveis ou parsing incompleto.",
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

    return {
      pages: [
        {
          id: createId("page"),
          documentId: document.id,
          pageNumber: 1,
          source: "image_stub",
          extractedText: text,
          confidence: text ? 0.92 : 0,
          warnings: ["Leitura textual do XML disponível, mas parser fiscal estruturado ainda é stub neste checkpoint."],
        },
      ],
      warnings: [
        {
          code: "XML_PARSER_STUB",
          message: "XML é lido como texto bruto localmente. Parser semântico/tributário ainda não foi implementado.",
          recoverable: true,
        },
      ],
      capability: {
        engine: "browser-file-text",
        status: "degraded",
        mode: "hybrid",
        message: "XML já pode ser lido localmente como texto, mas sem estrutura fiscal confiável.",
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
          warnings: ["Imagens dependem de OCR local; extração textual direta ainda não se aplica aqui."],
        },
      ],
      warnings: [
        {
          code: "OCR_IMAGE_RENDER_MISSING",
          message: "Imagem registrada, mas ainda falta o passo de OCR real com Tesseract.js para produzir texto utilizável.",
          recoverable: true,
        },
      ],
      capability: {
        engine: "image-direct-text",
        status: "stub",
        mode: "stub",
        message: "Imagens ainda não possuem extração textual direta; pipeline prepara a transição para OCR local.",
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
  async run({ document, pages }) {
    const createdAt = nowIso();

    return {
      jobs: [
        {
          id: createId("ocr"),
          documentId: document.id,
          pageIds: pages.map((page) => page.id),
          status: "queued",
          engine: "tesseract_stub",
          createdAt,
          updatedAt: createdAt,
          warnings: [
            "Adapter do Tesseract.js já está isolado, mas a execução OCR real ainda não foi habilitada neste checkpoint.",
            "Próximo passo: mover reconhecimento para worker local com idioma/treinamento configuráveis.",
          ],
        },
      ],
      pages,
      warnings: [
        {
          code: "OCR_NOT_IMPLEMENTED",
          message: "OCR local segue explícito como stub: sem reconhecimento real ainda, apenas job/plumbing preparado.",
          recoverable: true,
        },
      ],
      capability: {
        engine: "tesseract.js",
        status: "stub",
        mode: "stub",
        message: "Tesseract.js está previsto e isolado via adapter, mas o reconhecimento real ainda não roda neste checkpoint.",
      },
      suggestedStatus: "review_required",
    };
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
      confidence: 0.54,
      source: "mock_pipeline",
      note: "Valor sintético criado para validar a etapa de extração estruturada. Ainda não vem de parser fiscal real.",
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
      note: "Não representa interpretação fiscal oficial nem extração documental confiável.",
    },
  ];
}
