import type { OcrRequest, OcrResult } from "@/lib/document-extraction";
import { getOcrAdapter } from "@/lib/document-extraction";

export async function runLocalOcr(request: OcrRequest): Promise<OcrResult> {
  const adapter = getOcrAdapter(request.document.kind);

  if (!adapter) {
    return {
      jobs: [],
      pages: request.pages,
      warnings: [
        {
          code: "UNSUPPORTED_DOCUMENT_KIND",
          message: `Nao existe adapter OCR local para o tipo ${request.document.kind}.`,
          recoverable: false,
        },
      ],
      capability: {
        engine: "unsupported",
        status: "unavailable",
        mode: "stub",
        message: "OCR indisponivel para este formato neste checkpoint.",
      },
      suggestedStatus: "failed",
    };
  }

  return adapter.run(request);
}
