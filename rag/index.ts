export interface RagSource {
  id: string;
  title: string;
  kind: "lei" | "guia" | "faq" | "interno";
  content: string;
}

export interface RagChunk {
  id: string;
  sourceId: string;
  text: string;
  tags?: string[];
}

export interface RagSearchResult {
  chunkId: string;
  score: number;
  excerpt: string;
}

export async function searchLocalKnowledgeBase(_query: string): Promise<RagSearchResult[]> {
  return [
    {
      chunkId: "placeholder-chunk",
      score: 0.1,
      excerpt: "Placeholder de RAG local: substitua por indexação real com embeddings no dispositivo.",
    },
  ];
}