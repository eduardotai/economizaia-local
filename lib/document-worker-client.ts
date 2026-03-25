"use client";

import { transfer, wrap } from "comlink";
import type { IngestedDocument } from "@/models/documents";
import { processDocumentLocally } from "@/lib/document-pipeline";
import type { DocumentProcessorApi, DocumentProcessorRequest } from "@/workers/types";

let workerApiPromise: Promise<DocumentProcessorApi> | null = null;

function getWorkerApi() {
  if (!workerApiPromise) {
    const worker = new Worker(new URL("../workers/document-processor.worker.ts", import.meta.url), { type: "module" });
    workerApiPromise = Promise.resolve(wrap<DocumentProcessorApi>(worker));
  }

  return workerApiPromise;
}

function buildRequest(document: IngestedDocument, file: File): Promise<DocumentProcessorRequest> {
  return file.arrayBuffer().then((buffer) => ({
    document,
    file: {
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      buffer,
    },
  }));
}

export async function processDocumentWithDedicatedWorker(document: IngestedDocument, file: File): Promise<IngestedDocument> {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return processDocumentLocally(document, file);
  }

  try {
    const request = await buildRequest(document, file);
    const api = await getWorkerApi();
    return await api.processDocument(transfer(request, [request.file.buffer]));
  } catch {
    return processDocumentLocally(document, file);
  }
}
