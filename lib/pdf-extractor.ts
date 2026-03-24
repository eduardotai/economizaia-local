import type { TextExtractionRequest, TextExtractionResult } from "@/lib/document-extraction";
import { getTextExtractionAdapter } from "@/lib/document-extraction";

export async function extractPdfLocally(request: TextExtractionRequest): Promise<TextExtractionResult> {
  return getTextExtractionAdapter("pdf").extract(request);
}
