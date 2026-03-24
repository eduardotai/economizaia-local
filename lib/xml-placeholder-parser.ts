import { createId } from "@/lib/document-utils";
import type { DocumentPage, ExtractedEntity, IngestedDocument } from "@/models/documents";

const GENERIC_FIELD_CANDIDATES = [
  {
    label: "document_number" as const,
    aliases: ["nNF", "numero", "numeroNota", "invoiceNumber", "documentNumber", "id"],
    note: "Campo inferido por nome de tag genérica. Não representa mapeamento fiscal oficial.",
  },
  {
    label: "issue_date" as const,
    aliases: ["dhEmi", "dEmi", "issueDate", "date", "dataEmissao", "emissao"],
    note: "Data capturada por heurística de tag. Validar manualmente antes de qualquer uso.",
  },
  {
    label: "total_amount" as const,
    aliases: ["vNF", "total", "amount", "totalAmount", "valorTotal"],
    note: "Valor total sugerido por alias textual genérico, sem semântica tributária oficial.",
  },
  {
    label: "supplier_name" as const,
    aliases: ["xNome", "emitente", "supplier", "supplierName", "razaoSocial", "nome"],
    note: "Nome capturado por heurística textual; pode se referir a outra entidade no XML.",
  },
] as const;

export interface XmlPlaceholderField {
  path: string;
  tagName: string;
  value: string;
}

export interface XmlPlaceholderParseResult {
  pages: DocumentPage[];
  entities: ExtractedEntity[];
  warnings: string[];
  discoveredFields: XmlPlaceholderField[];
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractLeafFields(xmlText: string): XmlPlaceholderField[] {
  const tagRegex = /<([A-Za-z_:][\w:.-]*)\b[^>]*>([^<]+)<\/\1>/g;
  const fields: XmlPlaceholderField[] = [];
  const occurrenceCount = new Map<string, number>();
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(xmlText)) !== null) {
    const [, rawTagName, rawValue] = match;
    const value = normalizeWhitespace(rawValue);

    if (!value) {
      continue;
    }

    const tagName = rawTagName.includes(":") ? rawTagName.split(":").pop() ?? rawTagName : rawTagName;
    const currentCount = (occurrenceCount.get(tagName) ?? 0) + 1;
    occurrenceCount.set(tagName, currentCount);

    fields.push({
      path: `${tagName}[${currentCount}]`,
      tagName,
      value: value.slice(0, 240),
    });
  }

  return fields;
}

function inferXmlEntities(document: IngestedDocument, pageId: string | undefined, fields: XmlPlaceholderField[]): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const usedPaths = new Set<string>();

  for (const candidate of GENERIC_FIELD_CANDIDATES) {
    const matchedField = fields.find((field) => {
      const fieldName = field.tagName.toLowerCase();
      return candidate.aliases.some((alias) => alias.toLowerCase() === fieldName || fieldName.includes(alias.toLowerCase()));
    });

    if (!matchedField) {
      continue;
    }

    usedPaths.add(matchedField.path);
    entities.push({
      id: createId("entity"),
      documentId: document.id,
      pageId,
      label: candidate.label,
      value: matchedField.value,
      confidence: 0.58,
      source: "mock_pipeline",
      note: `${candidate.note} Origem heurística: ${matchedField.path}.`,
    });
  }

  const previewFields = fields
    .filter((field) => !usedPaths.has(field.path))
    .slice(0, 4)
    .map((field) => `${field.tagName}=${field.value}`)
    .join(" | ");

  entities.push({
    id: createId("entity"),
    documentId: document.id,
    pageId,
    label: "note",
    value: previewFields || "XML lido localmente, mas sem campos genéricos suficientes para sugerir entidades.",
    confidence: 0.3,
    source: "mock_pipeline",
    note: "Resumo placeholder de campos encontrados no XML para apoiar revisão humana. Não é interpretação fiscal oficial.",
  });

  return entities;
}

export function parseXmlPlaceholder(document: IngestedDocument, xmlText: string): XmlPlaceholderParseResult {
  const normalizedXml = normalizeWhitespace(xmlText);
  const discoveredFields = extractLeafFields(xmlText).slice(0, 18);
  const warnings = [
    "Parser XML local em modo placeholder: apenas leitura estrutural genérica por tags/texto.",
    "Nenhuma semântica fiscal oficial de NFe, NFC-e ou NFS-e é assumida automaticamente.",
  ];

  if (discoveredFields.length === 0) {
    warnings.push("Nenhum campo textual simples foi encontrado via parser placeholder; revisar o XML manualmente.");
  } else {
    warnings.push(`Campos textuais genéricos identificados: ${discoveredFields.length}. Necessária revisão humana dos valores sugeridos.`);
  }

  const pageId = createId("page");
  const page: DocumentPage = {
    id: pageId,
    documentId: document.id,
    pageNumber: 1,
    source: "pdf_text",
    extractedText: normalizedXml,
    confidence: normalizedXml ? 0.9 : 0,
    warnings,
  };

  return {
    pages: [page],
    entities: inferXmlEntities(document, pageId, discoveredFields),
    warnings,
    discoveredFields,
  };
}
