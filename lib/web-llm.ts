import { createId, nowIso } from "@/lib/document-utils";
import type {
  LocalExplainerCapability,
  LocalExplainerChatSession,
  LocalExplainerRequest,
  LocalExplainerResponse,
} from "@/models/local-explainer";
import { buildExplanationContext } from "@/rag";

export function getLocalExplainerCapability(): LocalExplainerCapability {
  return {
    provider: "mock",
    availability: "ready_placeholder",
    canExplainReport: true,
    canExplainChat: true,
    requiresModelDownload: false,
    requiresUserAction: false,
    explicitPlaceholder: true,
    supportsStreaming: false,
    supportedStrategies: ["keyword_overlap", "manual_seed", "embedding_placeholder"],
    primaryReasonCode: "PLACEHOLDER_MODE",
    statusLabel: "Mock pronto para integração",
    detail:
      "Camada explicativa local disponível apenas em modo mock/placeholder. WebLLM real ainda não foi configurado nem inicializado neste checkpoint.",
    checkedAt: nowIso(),
  };
}

export async function explainWithLocalLlm(request: LocalExplainerRequest): Promise<LocalExplainerResponse> {
  const capability = getLocalExplainerCapability();
  const explanationContext =
    request.explanationContext ??
    buildExplanationContext({
      simulationId: request.simulation.id,
      reportId: request.reportId,
      query: [
        request.simulation.summary.narrative,
        request.simulation.summary.confidence.rationale,
        request.userPrompt ?? "",
        ...request.simulation.audit.warnings.map((warning) => warning.title),
        ...request.simulation.audit.missingData.map((gap) => gap.label),
      ]
        .filter(Boolean)
        .join(" "),
      tags: ["mock", "placeholder", request.channel, "webllm-local-explainer"],
    });

  const evidence = [
    ...explanationContext.blocks.slice(0, 2).map((block) => ({
      id: block.id,
      title: block.title,
      summary: block.summary,
      source: "retrieval_context" as const,
      explicitPlaceholder: true,
    })),
    ...request.simulation.audit.warnings.slice(0, 1).map((warning) => ({
      id: warning.id,
      title: warning.title,
      summary: warning.message,
      source: "simulation_audit" as const,
      explicitPlaceholder: false,
    })),
  ];

  const answerSegments = [
    `Resumo do cenário: ${request.simulation.summary.narrative}`,
    request.userPrompt
      ? `Pergunta recebida no modo ${request.channel}: ${request.userPrompt}`
      : "Nenhuma pergunta livre foi enviada; a resposta foi gerada a partir do resumo estruturado do relatório.",
    "Leitura local atual: este texto é mock/placeholder e apenas reorganiza sinais do motor, alertas e contexto recuperado localmente.",
    "Limite explícito: não há interpretação fiscal oficial, cálculo adicional nem recomendação tributária autônoma nesta resposta.",
  ];

  return {
    id: createId("local_explainer_response"),
    createdAt: nowIso(),
    provider: capability.provider,
    availability: capability.availability,
    status: "completed",
    title: request.channel === "chat" ? "Resposta local do assistente explicativo (mock)" : "Explicação local do relatório (mock)",
    summary: "Resposta gerada por um serviço local mock/placeholder preparado para futura troca por WebLLM real.",
    answer: answerSegments.join(" "),
    disclaimer:
      "Mock/placeholder explícito: a camada explicativa local apenas resume dados estruturados e contexto interno do protótipo. Não substitui revisão humana nem orientação fiscal oficial.",
    evidence,
    followUps: [
      "Conectar capability real de WebLLM e distinguir ready_placeholder de ready com modelo carregado.",
      "Restringir prompts e respostas a JSON estruturado antes da renderização final.",
      "Exibir progresso de download/carregamento quando houver modelo local real.",
    ],
    explicitPlaceholder: true,
  };
}

export async function createLocalExplainerChatSession(params: {
  simulation: LocalExplainerRequest["simulation"];
  reportId?: string;
  openingPrompt?: string;
}): Promise<LocalExplainerChatSession> {
  const capability = getLocalExplainerCapability();
  const openingPrompt =
    params.openingPrompt ??
    "Explique este cenário de forma conservadora, deixando explícito que a resposta é mock/placeholder e depende de revisão humana.";

  const initialResponse = await explainWithLocalLlm({
    simulation: params.simulation,
    reportId: params.reportId,
    channel: "chat",
    userPrompt: openingPrompt,
  });

  const createdAt = nowIso();

  return {
    id: createId("local_explainer_chat"),
    createdAt,
    updatedAt: createdAt,
    capability,
    explicitPlaceholder: true,
    turns: [
      {
        id: createId("chat_turn"),
        role: "system",
        content:
          "Sessão de chat local mock/placeholder criada para preparar a futura integração com WebLLM real sem depender de modelo ativo neste checkpoint.",
        createdAt,
        explicitPlaceholder: true,
      },
      {
        id: createId("chat_turn"),
        role: "user",
        content: openingPrompt,
        createdAt,
        explicitPlaceholder: true,
      },
      {
        id: createId("chat_turn"),
        role: "assistant",
        content: initialResponse.answer,
        createdAt,
        explicitPlaceholder: true,
      },
    ],
  };
}
