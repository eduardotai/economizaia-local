import { expose } from "comlink";
import { processDocumentLocally } from "@/lib/document-pipeline";
import type { DocumentProcessorApi, DocumentProcessorRequest } from "@/workers/types";

function buildFile(request: DocumentProcessorRequest) {
  const { file } = request;
  return new File([file.buffer], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

const api: DocumentProcessorApi = {
  async processDocument(request) {
    return processDocumentLocally(request.document, buildFile(request));
  },
};

expose(api);
