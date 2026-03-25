export function getOcrWorkerBootstrap() {
  return {
    status: "delegated_to_document_worker",
    message: "OCR agora é orquestrado pelo worker documental dedicado em workers/document-processor.worker.ts.",
  };
}
