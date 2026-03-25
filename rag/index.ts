import { createId, nowIso } from "@/lib/document-utils";

export type NormativeDocumentKind = "official_text" | "technical_note" | "internal_note" | "placeholder_reference";
export type NormativeDocumentStatus = "mock" | "placeholder" | "review_required" | "draft";
export type RetrievalStrategy = "keyword_overlap" | "embedding_cosine" | "manual_seed" | "embedding_placeholder";
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
    placeholder: boolean;
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

import { REAL_NORMATIVE_DOCUMENTS, REAL_NORMATIVE_CHUNKS } from "@/rag/normative-chunks";

// ── Embedding cache ───────────────────────────────────────────────────────────
// Cached after first successful load so subsequent calls are instant.
let _embeddingPipeline: ((texts: string[], opts?: Record<string, unknown>) => Promise<{ data: Float32Array }[]>) | null = null;
let _chunkEmbeddings: Float32Array[] | null = null;

async function getEmbeddingPipeline() {
  if (_embeddingPipeline) return _embeddingPipeline;
  if (typeof window === "undefined") return null; // SSR/Node.js — skip

  try {
    const { pipeline, env } = await import("@xenova/transformers");
    env.allowLocalModels = false;
    // @ts-expect-error — @xenova/transformers v2 types are loose
    _embeddingPipeline = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    return _embeddingPipeline;
  } catch {
    return null;
  }
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

async function embedText(pipe: NonNullable<typeof _embeddingPipeline>, text: string): Promise<Float32Array> {
  const output = await pipe([text], { pooling: "mean", normalize: true });
  return output[0].data as Float32Array;
}

async function getChunkEmbeddings(pipe: NonNullable<typeof _embeddingPipeline>): Promise<Float32Array[]> {
  if (_chunkEmbeddings) return _chunkEmbeddings;
  _chunkEmbeddings = await Promise.all(REAL_NORMATIVE_CHUNKS.map((chunk) => embedText(pipe, chunk.text)));
  return _chunkEmbeddings;
}

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

export function getLocalKnowledgeBase(): LocalKnowledgeBase {
  return { documents: REAL_NORMATIVE_DOCUMENTS, chunks: REAL_NORMATIVE_CHUNKS };
}

/** @deprecated Use getLocalKnowledgeBase() */
export function getMockLocalKnowledgeBase(): LocalKnowledgeBase {
  return getLocalKnowledgeBase();
}

function keywordRetrieve(queryContext: RetrievalQueryContext, chunks: NormativeChunk[], topK = 5): RetrievalEvidence[] {
  const queryTerms = Array.from(new Set([...(queryContext.tags ?? []), ...normalizeTerms(queryContext.query)]));

  return chunks
    .map<RetrievalEvidence | null>((chunk) => {
      const haystackTerms = Array.from(new Set([...chunk.keywords.flatMap(normalizeTerms), ...normalizeTerms(chunk.text)]));
      const matchedTerms = queryTerms.filter((term) => haystackTerms.includes(term));
      if (matchedTerms.length === 0) return null;
      const score = Number((matchedTerms.length / Math.max(queryTerms.length, 1)).toFixed(2));
      return {
        chunkId: chunk.id,
        documentId: chunk.documentId,
        score,
        strategy: "keyword_overlap",
        matchedTerms,
        excerpt: buildExcerpt(chunk.text),
        role: (matchedTerms.includes("revisao") || matchedTerms.includes("humana") || matchedTerms.includes("limite")) ? "constraint" : "primary",
        explicitPlaceholder: chunk.explicitPlaceholder,
      };
    })
    .filter((v): v is RetrievalEvidence => v !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export async function retrieveLocalNormativeContext(queryContext: RetrievalQueryContext): Promise<RetrievalResult> {
  const kb = getLocalKnowledgeBase();
  const pipe = await getEmbeddingPipeline();
  let evidences: RetrievalEvidence[];
  let strategy: RetrievalStrategy;
  let notes: string[];

  if (pipe) {
    try {
      const [queryEmbedding, chunkEmbeddings] = await Promise.all([
        embedText(pipe, queryContext.query),
        getChunkEmbeddings(pipe),
      ]);

      const scored = kb.chunks.map((chunk, i) => ({
        chunk,
        score: cosine(queryEmbedding, chunkEmbeddings[i]),
      }));

      evidences = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .filter((item) => item.score > 0.2)
        .map((item) => ({
          chunkId: item.chunk.id,
          documentId: item.chunk.documentId,
          score: Number(item.score.toFixed(3)),
          strategy: "embedding_cosine",
          matchedTerms: [],
          excerpt: buildExcerpt(item.chunk.text),
          role: (item.chunk.documentId === "doc-guardrails-revisao" ? "constraint" : item.score > 0.5 ? "primary" : "supporting"),
          explicitPlaceholder: item.chunk.explicitPlaceholder,
        }));

      strategy = "embedding_cosine";
      notes = ["Retrieval por embeddings locais (Xenova/all-MiniLM-L6-v2).", "Conteúdo baseado em LC 123/2006, RIR/2018 e EC 132/2023."];
    } catch {
      evidences = keywordRetrieve(queryContext, kb.chunks);
      strategy = "keyword_overlap";
      notes = ["Falha no embedding — fallback para retrieval por palavras-chave.", "Conteúdo normativo real disponível."];
    }
  } else {
    evidences = keywordRetrieve(queryContext, kb.chunks);
    strategy = "keyword_overlap";
    notes = ["Retrieval por palavras-chave (embedding não disponível neste ambiente).", "Conteúdo normativo real — LC 123/2006, RIR/2018, EC 132/2023."];
  }

  return {
    id: createId("retrieval"),
    createdAt: nowIso(),
    query: queryContext,
    evidences,
    diagnostics: {
      indexedDocuments: kb.documents.length,
      indexedChunks: kb.chunks.length,
      retrievalStrategy: strategy,
      placeholder: false,
      notes,
    },
  };
}

export async function buildExplanationContext(params: {
  simulationId: string;
  reportId?: string;
  query: string;
  tags?: string[];
}): Promise<ExplanationContext> {
  const retrieval = await retrieveLocalNormativeContext({
    query: params.query,
    simulationId: params.simulationId,
    reportId: params.reportId,
    tags: params.tags,
  });

  const kb = getLocalKnowledgeBase();
  const documentsById = new Map(kb.documents.map((doc) => [doc.id, doc]));

  const blocks: ExplanationContextBlock[] = retrieval.evidences.map((evidence, index) => {
    const doc = documentsById.get(evidence.documentId);
    const matchInfo = evidence.matchedTerms.length > 0 ? ` Termos: ${evidence.matchedTerms.slice(0, 5).join(", ")}.` : "";
    return {
      id: `explanation-block-${index + 1}`,
      title: doc?.title ?? "Referência normativa local",
      summary: `${evidence.excerpt}${matchInfo}`,
      evidenceChunkIds: [evidence.chunkId],
      evidenceDocumentIds: [evidence.documentId],
      explicitPlaceholder: evidence.explicitPlaceholder,
    };
  });

  const hasRealContent = retrieval.evidences.some((e) => !e.explicitPlaceholder);
  const userFacingSummary = retrieval.evidences.length > 0
    ? hasRealContent
      ? `Contexto recuperado de ${new Set(retrieval.evidences.map((e) => e.documentId)).size} documento(s) normativo(s) via ${retrieval.diagnostics.retrievalStrategy}.`
      : "Contexto explicativo local montado com referências internas."
    : "Nenhuma evidência normativa correspondente foi encontrada para esta consulta.";

  return {
    id: createId("explanation_context"),
    createdAt: nowIso(),
    simulationId: params.simulationId,
    reportId: params.reportId,
    userFacingSummary,
    retrieval,
    blocks,
    nextEvolutionNotes: [
      "Persistir índice de embeddings no IndexedDB para evitar recomputação a cada sessão.",
      "Usar modelo multilingual (paraphrase-multilingual-MiniLM) para melhor cobertura do português jurídico.",
      "Reranking com WebLLM após embedding retrieval para selecionar trechos mais relevantes.",
    ],
    explicitPlaceholder: true,
  };
}
