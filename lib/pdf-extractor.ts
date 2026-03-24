import type { FiscalDocument } from "@/models/domain";

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  warnings: string[];
}

export async function extractPdfLocally(_document: FiscalDocument): Promise<PdfExtractionResult> {
  return {
    text: "",
    pageCount: 0,
    warnings: [
      "Placeholder: integrar pdf.js aqui para extração local de texto.",
      "Nenhum conteúdo real é processado neste starter base.",
    ],
  };
}