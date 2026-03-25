import type { IngestedDocument } from "@/models/documents";

export interface SerializedDocumentFile {
  name: string;
  type: string;
  lastModified: number;
  buffer: ArrayBuffer;
}

export interface DocumentProcessorRequest {
  document: IngestedDocument;
  file: SerializedDocumentFile;
}

export interface DocumentProcessorApi {
  processDocument(request: DocumentProcessorRequest): Promise<IngestedDocument>;
}
