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
  | "ready_for_manual_review"
  | "manual_review_confirmed"
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
  source: "pdf_text" | "ocr_tesseract" | "ocr_stub" | "image_stub" | "xml_placeholder" | "xml_parser";
  extractedText: string;
  confidence?: number;
  warnings: string[];
}

export interface OCRJob {
  id: string;
  documentId: string;
  pageIds: string[];
  status: "queued" | "running" | "completed" | "failed";
  engine: "tesseract" | "tesseract_stub";
  createdAt: string;
  updatedAt: string;
  warnings: string[];
}

export interface ExtractedEntity {
  id: string;
  documentId: string;
  pageId?: string;
  label: "supplier_name" | "document_number" | "issue_date" | "total_amount" | "cnpj_emitente" | "note";
  value: string;
  confidence: number;
  source: "mock_pipeline" | "pdf_text_parser" | "ocr_tesseract" | "xml_parser";
  note: string;
}

export interface ExtractedFieldCandidate {
  id: string;
  documentId: string;
  label: string;
  value: string;
  sourcePath?: string;
  confidence: number;
  reviewRequired: boolean;
  note: string;
}

export type ManualReviewFieldState = "needs_review" | "edited" | "confirmed";

export interface ManualReviewHistoryEntry {
  id: string;
  createdAt: string;
  actor: "pipeline_worker" | "usuario_local";
  action: "extracted" | "edited" | "confirmed" | "bulk_confirmed";
  previousValue: string;
  nextValue: string;
  note?: string;
}

export interface ManualReviewField {
  id: string;
  label: string;
  value: string;
  originalValue: string;
  sourcePath?: string;
  reviewed: boolean;
  required: boolean;
  state: ManualReviewFieldState;
  updatedAt: string;
  note?: string;
  history: ManualReviewHistoryEntry[];
}

export interface ManualReviewState {
  required: boolean;
  reviewedAt?: string;
  reviewedBy: "usuario_local" | "pendente";
  confirmed: boolean;
  fields: ManualReviewField[];
  notes: string[];
  confirmedFieldCount: number;
  totalFieldCount: number;
}

export interface DocumentAuditEntry {
  id: string;
  documentId: string;
  step:
    | "document_registered"
    | "worker_processing_started"
    | "type_detected"
    | "pdf_text_extracted_stub"
    | "ocr_enqueued_stub"
    | "ocr_completed"
    | "ocr_failed"
    | "entities_generated_mock"
    | "field_review_updated"
    | "field_review_confirmed"
    | "manual_review_required"
    | "manual_review_confirmed"
    | "manual_review_reset"
    | "worker_processing_completed"
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
  extractedFields: ExtractedFieldCandidate[];
  manualReview: ManualReviewState;
  auditTrail: DocumentAuditEntry[];
  processingWarnings: string[];
  placeholder: boolean;
}

export interface DocumentRegistrationInput {
  file: File;
  source?: IngestionSource;
}
