import { createId, nowIso } from "@/lib/document-utils";
import type {
  LocalExplainerCapability,
  LocalExplainerChatSession,
  LocalExplainerPromptContract,
  LocalExplainerRequest,
  LocalExplainerResponse,
} from "@/models/local-explainer";
import { buildExplanationContext } from "@/rag";

const LOCAL_EXPLAINER_PROMPT_TEMPLATE_VERSION = "mock-anti-hallucination-v0.2";

function buildPromptContract(bundleVersion: string): LocalExplainerPromptContract {
  const scaffoldPrompt = [
    "Você é o assistente fiscal do EconomizaIA Local.",
    `Use APENAS os dados extraídos/revisados pelo usuário e as regras oficiais do JSON carregado (versão ${bundleVersion}).`,
    "Nunca invente números, alíquotas ou regimes.",
    "Se faltar informação, diga: 'Preciso de mais dados: X, Y, Z'.",
    "Responda em português simples, como se falasse com um MEI.",
    "Sempre termine com: 'Este é um cálculo baseado nas regras oficiais de {data}. Consulte seu contador.'",
  ].join(" ");

  return {
    templateVersion: LOCAL_EXPLAINER_PROMPT_TEMPLATE_VERSION,
    antiHallucinationPolicy: [
      "Usar apenas dados estruturados do motor e contexto local permitido.",
      "Não inventar números, alíquotas, regimes ou base normativa ausente.",
      "Se faltarem dados, responder explicitamente com a fórmula 'Preciso de mais dados: X, Y, Z'.",
      "Chain-of-thought permanece interno/privado e não deve ser exposto na UI.",
      "Contexto explicativo futuro deve vir de RAG local, nunca de memória remota do modelo.",
    ],
    scaffoldPrompt,
    closingRule: "Este é um cálculo baseado nas regras oficiais de {data}. Consulte seu contador.",
    chainOfThoughtPolicy: "private_internal",
    ragContextPolicy: "future_local_rag_only",
    explicitPlaceholder: true,
  };
}

export function getLocalExplainerCapability(mode: "light" | "ai" = "light"): LocalExplainerCapability {
  if (mode === "light") {
    return {
      provider: "disabled",
      mode,
      availability: "ready_light",
      canExplainReport: true,
      canExplainChat: false,
      canGenerateOnDemand: false,
      lazyLoadOnly: false,
      requiresModelDownload: false,
      requiresUserAction: false,
      explicitPlaceholder: true,
      supportsStreaming: false,
      supportedModes: ["light", "ai"],
      supportedStrategies: ["keyword_overlap", "manual_seed", "embedding_placeholder"],
      primaryReasonCode: "LIGHT_MODE_ONLY",
      activationLabel: "Modo leve ativo",
      statusLabel: "Modo leve sem IA",
      detail:
        "Relatório em modo leve: usa apenas números e texto estático/controlado. Nenhum LLM é carregado neste modo.",
      checkedAt: nowIso(),
    };
  }

  return {
    provider: "mock",
    mode,
    availability: "ready_placeholder",
    canExplainReport: true,
    canExplainChat: true,
    canGenerateOnDemand: true,
    lazyLoadOnly: true,
    requiresModelDownload: false,
    requiresUserAction: true,
    explicitPlaceholder: true,
    supportsStreaming: false,
    supportedModes: ["light", "ai"],
    supportedStrategies: ["keyword_overlap", "manual_seed", "embedding_placeholder"],
    primaryReasonCode: "PLACEHOLDER_MODE",
    activationLabel: "Gerar relatório com explicação IA",
    statusLabel: "IA local sob demanda (mock)",
    detail:
      "Camada explicativa preparada para lazy-load por ação explícita do usuário. WebLLM real ainda não foi configurado nem inicializado neste checkpoint.",
    checkedAt: nowIso(),
  };
}

function buildLightModeResponse(request: LocalExplainerRequest): LocalExplainerResponse {
  const capability = getLocalExplainerCapability("light");
  const promptContract = buildPromptContract(request.simulation.bundleVersion);

  return {
    id: createId("local_explainer_response"),
    createdAt: nowIso(),
    provider: capability.provider,
    mode: capability.mode,
    availability: capability.availability,
    status: "idle",
    title: "Relatório em modo leve (sem IA)",
    summary: "Modo leve ativo: somente números e texto estático/controlado, sem carregar LLM.",
    answer:
      "Modo leve ativo. Este relatório mostra apenas os números calculados pelo motor local e textos controlados do produto. Para uma explicação IA sob demanda, o usuário deverá clicar explicitamente em 'Gerar relatório com explicação IA' em um checkpoint futuro.",
    disclaimer:
      "Mock/placeholder explícito: o modo leve não usa LLM. Chain-of-thought é interno/privado e o contexto explicativo futuro virá de RAG local.",
    promptContract,
    evidence: [
      {
        id: "light-mode-placeholder",
        title: "Modo leve sem inferência",
        summary: "Nenhum modelo local foi carregado. Apenas números e texto estático/controlado foram exibidos.",
        source: "placeholder_note",
        explicitPlaceholder: true,
      },
    ],
    followUps: [
      "Adicionar botão explícito para ativar IA local sob demanda.",
      "Manter modo leve como caminho padrão sem custo de inicialização.",
      "Quando WebLLM existir, preservar os mesmos contratos públicos de resposta.",
    ],
    explicitPlaceholder: true,
  };
}

export async function explainWithLocalLlm(request: LocalExplainerRequest): Promise<LocalExplainerResponse> {
  if (request.mode === "light") {
    return buildLightModeResponse(request);
  }

  const capability = getLocalExplainerCapability("ai");
  const promptContract = buildPromptContract(request.simulation.bundleVersion);
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
      tags: ["mock", "placeholder", request.channel, "webllm-local-explainer", "lazy-load"],
    });

  const missingDataLabels = request.simulation.audit.missingData.map((gap) => gap.label).slice(0, 3);

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
      ? `Pedido explícito do usuário no modo ${request.channel}: ${request.userPrompt}`
      : "Explicação IA sob demanda solicitada sem pergunta livre adicional.",
    missingDataLabels.length > 0
      ? `Preciso de mais dados: ${missingDataLabels.join(", ")}.`
      : "Não identifiquei lacunas bloqueantes adicionais na estrutura atual, mas este conteúdo continua sendo mock/placeholder.",
    "Use apenas dados estruturados do motor e contexto local autorizado; não invente números, alíquotas ou regimes.",
    "Este é um cálculo baseado nas regras oficiais de {data}. Consulte seu contador.",
  ];

  return {
    id: createId("local_explainer_response"),
    createdAt: nowIso(),
    provider: capability.provider,
    mode: capability.mode,
    availability: capability.availability,
    status: "completed",
    title: request.channel === "chat" ? "Resposta local do assistente explicativo (mock)" : "Explicação IA local do relatório (mock)",
    summary: "Resposta gerada por um serviço local mock/placeholder preparado para futura troca por WebLLM real lazy-loaded.",
    answer: answerSegments.join(" "),
    disclaimer:
      "Mock/placeholder explícito: a camada IA local só deve ser ativada por ação explícita do usuário. Chain-of-thought é interno/privado e o contexto explicativo futuro vem de RAG local.",
    promptContract,
    evidence,
    followUps: [
      "Conectar capability real de WebLLM e distinguir ready_placeholder de ready com modelo carregado.",
      "Acionar download/carga do modelo somente após clique em 'Gerar relatório com explicação IA'.",
      "Restringir prompts e respostas a JSON estruturado antes da renderização final.",
      "Exibir progresso de download/carregamento quando houver modelo local real.",
    ],
    explicitPlaceholder: true,
  };
}

export async function createLocalExplainerChatSession(params: {
  simulation: LocalExplainerRequest["simulation"];
  reportId?: string;
  mode?: "light" | "ai";
  openingPrompt?: string;
}): Promise<LocalExplainerChatSession> {
  const mode = params.mode ?? "ai";
  const capability = getLocalExplainerCapability(mode);
  const openingPrompt =
    params.openingPrompt ??
    "Explique este cenário de forma conservadora, deixando explícito que a resposta é mock/placeholder, que chain-of-thought é privado e que a base futura virá de RAG local.";

  const initialResponse = await explainWithLocalLlm({
    simulation: params.simulation,
    reportId: params.reportId,
    channel: "chat",
    mode,
    userPrompt: openingPrompt,
  });

  const createdAt = nowIso();

  return {
    id: createId("local_explainer_chat"),
    createdAt,
    updatedAt: createdAt,
    capability,
    mode,
    explicitPlaceholder: true,
    turns: [
      {
        id: createId("chat_turn"),
        role: "system",
        content:
          mode === "light"
            ? "Sessão placeholder em modo leve: sem IA, sem modelo carregado e sem chain-of-thought exposto."
            : "Sessão de chat local mock/placeholder criada para futura integração com WebLLM real lazy-loaded, mantendo chain-of-thought privado.",
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
