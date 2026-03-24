import { createId, nowIso } from "@/lib/document-utils";

export type NormativeDocumentKind = "official_text" | "technical_note" | "internal_note" | "placeholder_reference";
export type NormativeDocumentStatus = "mock" | "placeholder" | "review_required";
export type RetrievalStrategy = "keyword_overlap" | "manual_seed" | "embedding_placeholder";
export type ExplanationEvidenceRole = "primary" | "supporting" | "constraint";

export interface NormativeDocumentRef {
  id: string;
  slug: string;
  title: string;
  kind: NormativeDocumentKind;
  status: NormativeDocumentStatus;
  jurisdiction: "federal" | "state" | "municipal" | "unknown";
  sourceLabel: string;
  sourceUrl?: string;
  publishedAt?: string;
  updatedAt?: string;
  disclaimer: string;
  explicitPlaceholder: boolean;
}

export interface NormativeChunk {
  id: string;
  documentId: string;
  ordinal: number;
  text: string;
  keywords: string[];
  sectionLabel?: string;
  pageLabel?: string;
  tokenEstimate: number;
  explicitPlaceholder: boolean;
}

export interface RetrievalQueryContext {
  query: string;
  simulationId?: string;
  reportId?: string;
  tags?: string[];
}

export interface RetrievalEvidence {
  chunkId: string;
  documentId: string;
  score: number;
  strategy: RetrievalStrategy;
  matchedTerms: string[];
  excerpt: string;
  role: ExplanationEvidenceRole;
  explicitPlaceholder: boolean;
}

export interface RetrievalResult {
  id: string;
  createdAt: string;
  query: RetrievalQueryContext;
  evidences: RetrievalEvidence[];
  diagnostics: {
    indexedDocuments: number;
    indexedChunks: number;
    retrievalStrategy: RetrievalStrategy;
    placeholder: true;
    notes: string[];
  };
}

export interface ExplanationContextBlock {
  id: string;
  title: string;
  summary: string;
  evidenceChunkIds: string[];
  evidenceDocumentIds: string[];
  explicitPlaceholder: boolean;
}

export interface ExplanationContext {
  id: string;
  createdAt: string;
  simulationId: string;
  reportId?: string;
  userFacingSummary: string;
  retrieval: RetrievalResult;
  blocks: ExplanationContextBlock[];
  nextEvolutionNotes: string[];
  explicitPlaceholder: true;
}

const MOCK_NORMATIVE_DOCUMENTS: NormativeDocumentRef[] = [
  {
    id: "normative-placeholder-architecture",
    slug: "local-rag-architecture-placeholder",
    title: "Arquitetura local de contexto explicativo (placeholder)",
    kind: "placeholder_reference",
    status: "placeholder",
    jurisdiction: "unknown",
    sourceLabel: "Documento interno de arquitetura do protótipo",
    disclaimer:
      "Este item não representa texto normativo oficial. Existe apenas para demonstrar contratos e fluxo de RAG local no protótipo.",
    explicitPlaceholder: true,
  },
  {
    id: "normative-placeholder-review",
    slug: "human-review-boundary-placeholder",
    title: "Limites de revisão humana e não-oficialidade (placeholder)",
    kind: "placeholder_reference",
    status: "placeholder",
    jurisdiction: "unknown",
    sourceLabel: "Nota interna de segurança do protótipo",
    disclaimer:
      "Este item não representa texto normativo oficial. Existe apenas para explicitar limites do mock local-first.",
    explicitPlaceholder: true,
  },
];

const MOCK_NORMATIVE_CHUNKS: NormativeChunk[] = [
  {
    id: "chunk-architecture-001",
    documentId: "normative-placeholder-architecture",
    ordinal: 1,
    text:
      "O scaffold inicial de RAG local usa indexação simples por palavras-chave para preparar o fluxo explicativo, sem inferir interpretação normativa oficial.",
    keywords: ["rag", "local", "indexação", "palavras-chave", "explicativo"],
    sectionLabel: "Arquitetura base",
    tokenEstimate: 26,
    explicitPlaceholder: true,
  },
  {
    id: "chunk-architecture-002",
    documentId: "normative-placeholder-architecture",
    ordinal: 2,
    text:
      "A evolução planejada substitui a busca mock por embeddings locais e reranking no dispositivo, preservando contratos de retrieval e contexto explicativo.",
    keywords: ["embeddings", "reranking", "dispositivo", "retrieval", "contratos"],
    sectionLabel: "Evolução planejada",
    tokenEstimate: 24,
    explicitPlaceholder: true,
  },
  {
    id: "chunk-review-001",
    documentId: "normative-placeholder-review",
    ordinal: 1,
    text:
      "Toda resposta explicativa deste checkpoint deve deixar explícito que o conteúdo é mock ou placeholder e que revisão humana continua obrigatória.",
    keywords: ["mock", "placeholder", "revisão", "humana", "obrigatória"],
    sectionLabel: "Restrições do checkpoint",
    tokenEstimate: 24,
    explicitPlaceholder: true,
  },
];

function normalizeTerms(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 3);
}

function buildExcerpt(text: string, limit = 160) {
  return text.length <= limit ? text : `${text.slice(0, limit).trim()}...`;
}

export interface LocalKnowledgeBase {
  documents: NormativeDocumentRef[];
  chunks: NormativeChunk[];
}

export function getMockLocalKnowledgeBase(): LocalKnowledgeBase {
  return {
    documents: MOCK_NORMATIVE_DOCUMENTS,
    chunks: MOCK_NORMATIVE_CHUNKS,
  };
}

export function retrieveLocalNormativeContext(queryContext: RetrievalQueryContext): RetrievalResult {
  const knowledgeBase = getMockLocalKnowledgeBase();
  const queryTerms = Array.from(new Set([...(queryContext.tags ?? []), ...normalizeTerms(queryContext.query)]));

  const evidences = knowledgeBase.chunks
    .map<RetrievalEvidence | null>((chunk) => {
      const haystackTerms = Array.from(new Set([...chunk.keywords.flatMap(normalizeTerms), ...normalizeTerms(chunk.text)]));
      const matchedTerms = queryTerms.filter((term) => haystackTerms.includes(term));

      if (matchedTerms.length === 0) {
        return null;
      }

      const score = Number((matchedTerms.length / Math.max(queryTerms.length, 1)).toFixed(2));

      return {
        chunkId: chunk.id,
        documentId: chunk.documentId,
        score,
        strategy: "keyword_overlap",
        matchedTerms,
        excerpt: buildExcerpt(chunk.text),
        role: matchedTerms.includes("revisao") || matchedTerms.includes("humana") ? "constraint" : "supporting",
        explicitPlaceholder: true,
      };
    })
    .filter((value): value is RetrievalEvidence => value !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  return {
    id: createId("retrieval"),
    createdAt: nowIso(),
    query: queryContext,
    evidences,
    diagnostics: {
      indexedDocuments: knowledgeBase.documents.length,
      indexedChunks: knowledgeBase.chunks.length,
      retrievalStrategy: "keyword_overlap",
      placeholder: true,
      notes: [
        "Índice local mock em memória com palavras-chave.",
        "Sem embeddings, sem reranking neural e sem interpretação normativa oficial.",
      ],
    },
  };
}

export function buildExplanationContext(params: {
  simulationId: string;
  reportId?: string;
  query: string;
  tags?: string[];
}): ExplanationContext {
  const retrieval = retrieveLocalNormativeContext({
    query: params.query,
    simulationId: params.simulationId,
    reportId: params.reportId,
    tags: params.tags,
  });

  const documentsById = new Map(MOCK_NORMATIVE_DOCUMENTS.map((document) => [document.id, document]));

  const blocks: ExplanationContextBlock[] = retrieval.evidences.map((evidence, index) => {
    const document = documentsById.get(evidence.documentId);

    return {
      id: `explanation-block-${index + 1}`,
      title: document?.title ?? "Referência local mock",
      summary: `${evidence.excerpt} Correspondência por termos: ${evidence.matchedTerms.join(", ") || "nenhuma"}.`,
      evidenceChunkIds: [evidence.chunkId],
      evidenceDocumentIds: [evidence.documentId],
      explicitPlaceholder: true,
    };
  });

  return {
    id: createId("explanation_context"),
    createdAt: nowIso(),
    simulationId: params.simulationId,
    reportId: params.reportId,
    userFacingSummary:
      retrieval.evidences.length > 0
        ? "Contexto explicativo local montado com referências mock/placeholder para demonstrar retrieval e rastreabilidade."
        : "Nenhuma evidência mock correspondente foi encontrada no índice local placeholder.",
    retrieval,
    blocks,
    nextEvolutionNotes: [
      "Substituir busca por palavras-chave por embeddings locais em Transformers.js.",
      "Adicionar reranking/geração explicativa com WebLLM consumindo somente evidências recuperadas.",
      "Persistir índice local versionado no navegador sem backend remoto.",
    ],
    explicitPlaceholder: true,
  };
}
