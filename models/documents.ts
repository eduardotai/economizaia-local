export type SupportedDocumentKind = "pdf" | "image" | "xml" | "unknown";

export type IngestionSource = "upload" | "demo";

export type DocumentProcessingStatus =
  | "uploaded"
  | "registered"
  | "classifying"
  | "extracting_text"
  | "ocr_queued"
  | "extracting_entities"
  | "completed"
  | "review_required"
  | "failed";

export type AuditStepStatus = "pending" | "running" | "completed" | "warning" | "failed";

export interface StoredFileReference {
  objectUrl?: string;
  mimeType: string;
  sizeInBytes: number;
  lastModified: number;
}

export interface DocumentPage {
  id: string;
  documentId: string;
  pageNumber: number;
  source: "pdf_text" | "ocr_stub" | "image_stub";
  extractedText: string;
  confidence?: number;
  warnings: string[];
}

export interface OCRJob {
  id: string;
  documentId: string;
  pageIds: string[];
  status: "queued" | "running" | "completed" | "failed";
  engine: "tesseract_stub";
  createdAt: string;
  updatedAt: string;
  warnings: string[];
}

export interface ExtractedEntity {
  id: string;
  documentId: string;
  pageId?: string;
  label: "supplier_name" | "document_number" | "issue_date" | "total_amount" | "note";
  value: string;
  confidence: number;
  source: "mock_pipeline";
  note: string;
}

export interface DocumentAuditEntry {
  id: string;
  documentId: string;
  step:
    | "document_registered"
    | "type_detected"
    | "pdf_text_extracted_stub"
    | "ocr_enqueued_stub"
    | "entities_generated_mock"
    | "processing_completed"
    | "processing_failed";
  status: AuditStepStatus;
  message: string;
  createdAt: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface IngestedDocument {
  id: string;
  name: string;
  originalFileName: string;
  kind: SupportedDocumentKind;
  detectedMimeType: string;
  source: IngestionSource;
  status: DocumentProcessingStatus;
  createdAt: string;
  updatedAt: string;
  file: StoredFileReference;
  pages: DocumentPage[];
  ocrJobs: OCRJob[];
  entities: ExtractedEntity[];
  auditTrail: DocumentAuditEntry[];
  processingWarnings: string[];
  placeholder: true;
}

export interface DocumentRegistrationInput {
  file: File;
  source?: IngestionSource;
}
