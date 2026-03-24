import type { FiscalDocument } from "@/models/domain";

export interface OcrResult {
  text: string;
  confidence: number;
  warnings: string[];
}

export async function runLocalOcr(_document: FiscalDocument): Promise<OcrResult> {
  return {
    text: "",
    confidence: 0,
    warnings: [
      "Placeholder: conectar Tesseract.js via worker para OCR local.",
      "Nenhuma inferência real é executada neste starter base.",
    ],
  };
}