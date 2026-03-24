export const foundationPillars = [
  {
    title: "Persistência local",
    description: "Camada inicial com localForage para perfis, documentos, bundles e simulações, sem backend remoto.",
  },
  {
    title: "Rule engine auditável",
    description: "Interfaces determinísticas para entrada, bundle versionado, resultado estruturado e trilha de auditoria.",
  },
  {
    title: "Pipeline documental",
    description: "Pastas e contratos preparados para pdf.js, Tesseract.js e Web Workers com placeholders explícitos.",
  },
  {
    title: "IA local explicativa",
    description: "Estrutura pronta para RAG local e WebLLM, mantendo cálculo e decisão fora do LLM.",
  },
] as const;

export const localReadinessChecklist = [
  {
    title: "IndexedDB / localForage",
    status: "base criada",
    description: "Storage service tipado com namespaces para contribuinte, documento, simulação e configuração local.",
  },
  {
    title: "pdf.js / Tesseract.js",
    status: "placeholder",
    description: "Adapters tipados indicam os pontos de integração local para extração de texto PDF e OCR por worker.",
  },
  {
    title: "RAG local",
    status: "placeholder",
    description: "Interfaces de chunk, source e retrieval já definidas para futura indexação de fontes normativas locais.",
  },
  {
    title: "WebLLM",
    status: "placeholder",
    description: "Gateway inicial descreve como o explicador local deve receber apenas contexto estruturado e auditável.",
  },
] as const;