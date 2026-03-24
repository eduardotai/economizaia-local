import type { SupportedDocumentKind } from "@/models/documents";

export function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function detectDocumentKind(file: File): SupportedDocumentKind {
  const mimeType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();

  if (mimeType.includes("pdf") || fileName.endsWith(".pdf")) {
    return "pdf";
  }

  if (mimeType.includes("image/") || /\.(png|jpg|jpeg|webp)$/i.test(fileName)) {
    return "image";
  }

  if (mimeType.includes("xml") || fileName.endsWith(".xml")) {
    return "xml";
  }

  return "unknown";
}

export function formatBytes(sizeInBytes: number) {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = sizeInBytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export async function readTextSnippet(file: File, maxLength = 220) {
  try {
    const text = await file.text();
    return text.replace(/\s+/g, " ").trim().slice(0, maxLength);
  } catch {
    return "";
  }
}
