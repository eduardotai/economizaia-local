import { createId, nowIso } from "@/lib/document-utils";
import type {
  LocalExplainerCapability,
  LocalExplainerChatSession,
  LocalExplainerPromptContract,
  LocalExplainerRequest,
  LocalExplainerResponse,
  LocalExplainerEvidenceItem,
  LocalExplainerRefusal,
  LocalExplainerStructuredSection,
} from "@/models/local-explainer";
import { buildExplanationContext } from "@/rag";

// ── WebLLM engine ─────────────────────────────────────────────────────────────

const WEBLLM_MODEL_ID = "Phi-3.5-mini-instruct-q4f16_1-MLC";

type MLCEngineType = {
  chat: {
    completions: {
      create(params: { messages: Array<{ role: string; content: string }>; temperature?: number; max_tokens?: number }): Promise<{ choices: Array<{ message: { content: string } }> }>;
    };
  };
};

let _webllmEngine: MLCEngineType | null = null;
let _webllmState: "idle" | "loading" | "ready" | "error" = "idle";
let _webllmProgressListeners: Array<(progress: number, text: string) => void> = [];

export function onWebLLMProgress(listener: (progress: number, text: string) => void): () => void {
  _webllmProgressListeners.push(listener);
  return () => {
    _webllmProgressListeners = _webllmProgressListeners.filter((l) => l !== listener);
  };
}

export function getWebLLMState(): typeof _webllmState {
  return _webllmState;
}

export async function initializeLocalLlm(): Promise<boolean> {
  if (_webllmState === "ready") return true;
  if (_webllmState === "loading") return false;
  if (typeof window === "undefined") return false;
  if (!("gpu" in navigator)) return false;

  _webllmState = "loading";
  try {
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
    _webllmEngine = await CreateMLCEngine(WEBLLM_MODEL_ID, {
      initProgressCallback: (progress: { progress: number; text: string }) => {
        _webllmProgressListeners.forEach((l) => l(progress.progress, progress.text));
      },
    }) as MLCEngineType;
    _webllmState = "ready";
    return true;
  } catch {
    _webllmState = "error";
    return false;
  }
}

function hasWebGpu(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

function buildWebLLMPrompt(request: LocalExplainerRequest, ragContext: string): { system: string; user: string } {
  const sim = request.simulation;
  const warnings = sim.audit.warnings.map((w) => `- ${w.title}: ${w.message}`).join("\n");
  const gaps = sim.audit.missingData.map((g) => `- ${g.label}: ${g.description}`).join("\n");

  const system = [
    "Você é o assistente fiscal local do EconomizaIA Local.",
    `Use APENAS os dados da simulação e as evidências normativas fornecidas.`,
    "Nunca invente alíquotas, regras, jurisprudência ou orientação fiscal oficial.",
    "Se uma informação não estiver nas evidências ou na simulação, diga explicitamente que não tem base para responder.",
    "Responda em português simples e conservador. Sempre mencione que o resultado requer validação com contador.",
    "Não tome decisões fiscais — apenas explique os dados apresentados.",
  ].join(" ");

  const user = [
    `## Dados da simulação`,
    `Status: ${sim.status} | Confiança: ${sim.summary.confidence.label}`,
    `Regime atual: ${sim.currentScenario.label}`,
    `Economia estimada: ${sim.summary.estimatedSavingsLabel}`,
    `Narrativa: ${sim.summary.narrative}`,
    warnings ? `\n## Alertas\n${warnings}` : "",
    gaps ? `\n## Lacunas de dados\n${gaps}` : "",
    ragContext ? `\n## Evidências normativas recuperadas\n${ragContext}` : "",
    `\n## Pergunta`,
    request.userPrompt ?? "Explique os resultados desta simulação de forma conservadora e estruturada.",
  ].filter(Boolean).join("\n");

  return { system, user };
}

const LOCAL_EXPLAINER_PROMPT_TEMPLATE_VERSION = "real-webllm-anti-hallucination-v1.0";

function buildPromptContract(bundleVersion: string): LocalExplainerPromptContract {
  const scaffoldPrompt = [
    "Você é o assistente explicativo local do EconomizaIA Local.",
    `Use APENAS dados estruturados da simulação, evidências recuperadas do contexto local e o bundle carregado (versão ${bundleVersion}).`,
    "Nunca invente números, alíquotas, regimes, jurisprudência ou aconselhamento fiscal oficial.",
    "Se a resposta não estiver ancorada em evidência local suficiente, recuse de forma controlada.",
    "Se faltar informação, descreva explicitamente quais dados ou revisões humanas ainda faltam.",
    "Responda em português simples, com seções previsíveis e linguagem conservadora.",
    "Sempre deixe explícito quando o conteúdo for mock/placeholder.",
  ].join(" ");

  return {
    templateVersion: LOCAL_EXPLAINER_PROMPT_TEMPLATE_VERSION,
    antiHallucinationPolicy: [
      "Usar apenas dados estruturados do motor, bundle local e contexto local permitido.",
      "Não inventar números, alíquotas, regimes, conclusões normativas ou aconselhamento fiscal oficial.",
      "Se faltarem dados, revisão humana ou evidência local, responder com recusa controlada.",
      "Chain-of-thought permanece interno/privado e não deve ser exposto na UI.",
      "Contexto explicativo futuro deve vir de RAG local, nunca de memória remota do modelo.",
      "Toda saída pública deve ser estruturada e rastreável para evidências locais disponíveis.",
    ],
    scaffoldPrompt,
    closingRule: "Conteúdo local mock/placeholder, sem valor fiscal oficial. Revisão humana continua obrigatória.",
    chainOfThoughtPolicy: "private_internal",
    ragContextPolicy: "future_local_rag_only",
    explicitPlaceholder: true,
  };
}

function buildCapabilityStatus(capability: LocalExplainerCapability): LocalExplainerResponse["capabilityStatus"] {
  const modeLabel = capability.mode === "light" ? "Modo leve" : "Modo IA local sob demanda";
  const providerLabel =
    capability.provider === "disabled"
      ? "Sem LLM"
      : capability.provider === "webllm"
        ? `WebLLM (${WEBLLM_MODEL_ID})`
        : "Modo estruturado (sem modelo)";

  const readinessLabel =
    capability.availability === "ready_light"
      ? "Pronto em modo leve"
      : capability.availability === "ready_placeholder"
        ? "Preparado, mas ainda placeholder"
        : capability.availability === "ready"
          ? "Pronto"
          : capability.availability;

  const behaviorLabel =
    capability.mode === "light"
      ? "Explicação controlada sem IA gerativa."
      : capability.provider === "mock"
        ? "Resposta mock estruturada, preparada para futura troca por WebLLM real."
        : "Resposta por IA local.";

  return {
    modeLabel,
    providerLabel,
    readinessLabel,
    behaviorLabel,
    explicitPlaceholder: true,
  };
}

function buildEvidenceAnchor(request: LocalExplainerRequest, evidence: LocalExplainerEvidenceItem[]): LocalExplainerResponse["evidenceAnchor"] {
  return {
    bundleVersion: request.simulation.bundleVersion,
    simulationStatus: request.simulation.status,
    retrievalEvidenceCount: request.explanationContext?.retrieval.evidences.length ?? 0,
    retrievalBlockCount: request.explanationContext?.blocks.length ?? 0,
    warningCount: request.simulation.audit.warnings.length,
    gapCount: request.simulation.audit.missingData.length,
    evidenceIds: evidence.map((item) => item.id),
    explicitPlaceholder: true,
  };
}

function buildLightModeResponse(request: LocalExplainerRequest): LocalExplainerResponse {
  const capability = getLocalExplainerCapability("light");
  const promptContract = buildPromptContract(request.simulation.bundleVersion);
  const evidence: LocalExplainerEvidenceItem[] = [
    {
      id: "light-mode-placeholder",
      title: "Modo leve sem inferência",
      summary: "Nenhum modelo local foi carregado. Apenas dados estruturados e texto controlado do produto foram exibidos.",
      source: "placeholder_note",
      explicitPlaceholder: true,
    },
  ];

  const sections: LocalExplainerStructuredSection[] = [
    {
      heading: "status_capability",
      body: [
        "Modo leve ativo.",
        "Sem IA gerativa carregada neste checkpoint.",
        "Fluxo atual prioriza previsibilidade, rastreabilidade e baixo risco de alucinação.",
      ],
    },
    {
      heading: "resumo_controlado",
      body: [
        `A decisão atual do motor está em \"${request.simulation.summary.decisionStatus}\".`,
        `O cenário exibido é \"${request.simulation.currentScenario.label}\".`,
        "A explicação neste modo usa apenas texto controlado e dados estruturados já presentes na simulação.",
      ],
    },
    {
      heading: "limites",
      body: [
        "Este conteúdo é mock/placeholder explícito.",
        "Não há aconselhamento fiscal oficial.",
        "Revisão humana continua obrigatória antes de qualquer uso prático.",
      ],
    },
  ];

  return {
    id: createId("local_explainer_response"),
    createdAt: nowIso(),
    provider: capability.provider,
    mode: capability.mode,
    availability: capability.availability,
    status: "idle",
    title: "Relatório em modo leve (sem IA)",
    summary: "Modo leve ativo: somente dados estruturados e texto controlado, sem inferência local.",
    answer:
      "Modo leve ativo. A camada explicativa permanece controlada e sem IA gerativa neste checkpoint. O conteúdo mostrado é derivado apenas da simulação local e continua explicitamente mock/placeholder.",
    sections,
    disclaimer:
      "Mock/placeholder explícito: o modo leve não usa LLM. Chain-of-thought é interno/privado. Não há aconselhamento fiscal oficial.",
    promptContract,
    evidence,
    evidenceAnchor: buildEvidenceAnchor(request, evidence),
    capabilityStatus: buildCapabilityStatus(capability),
    followUps: [
      "Adicionar botão explícito para ativar IA local sob demanda.",
      "Preservar o modo leve como caminho padrão conservador.",
      "Quando WebLLM existir, manter o mesmo contrato estruturado de resposta.",
    ],
    explicitPlaceholder: true,
  };
}

function buildRefusal(params: {
  code: LocalExplainerRefusal["code"];
  title: string;
  message: string;
  missingItems: string[];
  requiredActions: string[];
}): LocalExplainerRefusal {
  return {
    ...params,
    requiresHumanReview: true,
    explicitPlaceholder: true,
  };
}

function buildAnchoredEvidence(request: LocalExplainerRequest): LocalExplainerEvidenceItem[] {
  const context = request.explanationContext;

  return [
    ...(context?.blocks.slice(0, 2).map((block) => ({
      id: block.id,
      title: block.title,
      summary: block.summary,
      source: "retrieval_context" as const,
      explicitPlaceholder: true,
    })) ?? []),
    ...request.simulation.audit.warnings.slice(0, 2).map((warning) => ({
      id: warning.id,
      title: warning.title,
      summary: warning.message,
      source: "simulation_audit" as const,
      explicitPlaceholder: false,
    })),
  ];
}

function evaluateRefusal(request: LocalExplainerRequest, evidence: LocalExplainerEvidenceItem[]): LocalExplainerRefusal | null {
  const missingItems = request.simulation.audit.missingData.map((gap) => gap.label);
  const hasMissingData = missingItems.length > 0;
  const retrievalEvidenceCount = request.explanationContext?.retrieval.evidences.length ?? 0;
  const hasLocalEvidence = retrievalEvidenceCount > 0 || evidence.some((item) => item.source === "simulation_audit");
  const requiresHumanReview = request.simulation.audit.warnings.some((warning) => warning.requiresHumanReview);

  if (!hasLocalEvidence) {
    return buildRefusal({
      code: "MISSING_LOCAL_CONTEXT",
      title: "Recusa por falta de contexto local ancorado",
      message:
        "O explainer mock não encontrou evidências locais suficientes para sustentar uma resposta explicativa rastreável.",
      missingItems: ["evidências locais recuperadas", "blocos de contexto ancorados"],
      requiredActions: [
        "Regerar o contexto explicativo local com retrieval válido.",
        "Confirmar que o bundle/contexto relevante está carregado no dispositivo.",
        "Solicitar revisão humana antes de seguir.",
      ],
    });
  }

  if (hasMissingData) {
    return buildRefusal({
      code: "INSUFFICIENT_EVIDENCE",
      title: "Recusa por dados insuficientes",
      message:
        "O explainer mock recusou a resposta final porque faltam dados mínimos para uma explicação conservadora e auditável.",
      missingItems,
      requiredActions: [
        "Completar os dados pendentes no fluxo local.",
        "Reprocessar a simulação após preencher as lacunas.",
        "Manter revisão humana obrigatória.",
      ],
    });
  }

  if (requiresHumanReview) {
    return buildRefusal({
      code: "MISSING_HUMAN_REVIEW",
      title: "Recusa por revisão humana pendente",
      message:
        "O explainer mock não deve transformar um resultado que ainda exige revisão humana em orientação aparentemente conclusiva.",
      missingItems: ["revisão humana confirmada"],
      requiredActions: [
        "Submeter o cenário à revisão humana.",
        "Manter o uso apenas para teste/demonstração interna.",
        "Não tratar a resposta como aconselhamento fiscal oficial.",
      ],
    });
  }

  return null;
}

function buildStructuredSections(params: {
  request: LocalExplainerRequest;
  evidence: LocalExplainerEvidenceItem[];
  refusal: LocalExplainerRefusal | null;
}): LocalExplainerStructuredSection[] {
  const { request, evidence, refusal } = params;

  if (refusal) {
    return [
      {
        heading: "status_capability",
        body: [
          `Modo solicitado: ${request.mode}.`,
          "Camada explicativa local ainda está em estado mock/WebLLM-ready.",
          "A resposta abaixo foi intencionalmente convertida em recusa controlada.",
        ],
      },
      {
        heading: "recusa_controlada",
        body: [refusal.message, `Itens faltantes: ${refusal.missingItems.join(", ") || "nenhum item listado"}.`],
      },
      {
        heading: "proximos_passos",
        body: refusal.requiredActions,
      },
    ];
  }

  return [
    {
      heading: "status_capability",
      body: [
        "Modo IA local sob demanda solicitado.",
        "Provider atual: mock/placeholder, pronto para futura troca por WebLLM real.",
        "A resposta permanece conservadora e limitada ao contexto local disponível.",
      ],
    },
    {
      heading: "resumo_ancorado",
      body: [
        `Narrativa do motor: ${request.simulation.summary.narrative}`,
        `Status da decisão: ${request.simulation.summary.decisionStatus}.`,
        `Bundle carregado: ${request.simulation.bundleVersion}.`,
      ],
    },
    {
      heading: "evidencias_utilizadas",
      body:
        evidence.length > 0
          ? evidence.map((item) => `${item.title}: ${item.summary}`)
          : ["Nenhuma evidência local utilizável foi encontrada."],
    },
    {
      heading: "limites_e_cautelas",
      body: [
        "Conteúdo explicitamente mock/placeholder.",
        "Sem valor fiscal oficial ou parecer tributário.",
        "Revisão humana continua obrigatória antes de qualquer decisão prática.",
      ],
    },
  ];
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
        "Fluxo conservador sem LLM: usa apenas dados estruturados, texto controlado e trilha local auditável.",
      checkedAt: nowIso(),
    };
  }

  // Real WebLLM: engine is loaded and ready
  if (_webllmState === "ready" && _webllmEngine !== null) {
    return {
      provider: "webllm",
      mode,
      availability: "ready",
      canExplainReport: true,
      canExplainChat: true,
      canGenerateOnDemand: true,
      lazyLoadOnly: false,
      requiresModelDownload: false,
      requiresUserAction: false,
      explicitPlaceholder: false,
      supportsStreaming: false,
      supportedModes: ["light", "ai"],
      supportedStrategies: ["keyword_overlap", "embedding_cosine"],
      primaryReasonCode: "LIGHT_MODE_ONLY",
      activationLabel: "Modelo local carregado — gerar explicação",
      statusLabel: `IA local ativa (${WEBLLM_MODEL_ID})`,
      detail: `Modelo ${WEBLLM_MODEL_ID} carregado localmente via WebLLM. Inferência ocorre no dispositivo, sem envio de dados.`,
      checkedAt: nowIso(),
    };
  }

  // WebLLM loading in progress
  if (_webllmState === "loading") {
    return {
      provider: "webllm",
      mode,
      availability: "checking",
      canExplainReport: false,
      canExplainChat: false,
      canGenerateOnDemand: false,
      lazyLoadOnly: true,
      requiresModelDownload: true,
      requiresUserAction: false,
      explicitPlaceholder: true,
      supportsStreaming: false,
      supportedModes: ["light", "ai"],
      supportedStrategies: ["keyword_overlap"],
      primaryReasonCode: "MODEL_LOADING",
      activationLabel: "Carregando modelo local…",
      statusLabel: "IA local carregando",
      detail: "Download e inicialização do modelo em andamento. Aguarde para gerar explicações.",
      checkedAt: nowIso(),
    };
  }

  // WebLLM errored
  if (_webllmState === "error") {
    return {
      provider: "disabled",
      mode,
      availability: "error",
      canExplainReport: false,
      canExplainChat: false,
      canGenerateOnDemand: false,
      lazyLoadOnly: false,
      requiresModelDownload: false,
      requiresUserAction: true,
      explicitPlaceholder: true,
      supportsStreaming: false,
      supportedModes: ["light"],
      supportedStrategies: ["keyword_overlap"],
      primaryReasonCode: "WEBLLM_NOT_CONFIGURED",
      activationLabel: "Tentar novamente",
      statusLabel: "Erro ao carregar modelo local",
      detail: "Ocorreu um erro ao inicializar o modelo WebLLM. Use o modo leve ou tente novamente.",
      checkedAt: nowIso(),
    };
  }

  // No WebGPU support
  if (!hasWebGpu()) {
    return {
      provider: "disabled",
      mode,
      availability: "unavailable",
      canExplainReport: false,
      canExplainChat: false,
      canGenerateOnDemand: false,
      lazyLoadOnly: false,
      requiresModelDownload: false,
      requiresUserAction: false,
      explicitPlaceholder: true,
      supportsStreaming: false,
      supportedModes: ["light"],
      supportedStrategies: ["keyword_overlap"],
      primaryReasonCode: "WEBGPU_UNAVAILABLE",
      activationLabel: "WebGPU não disponível",
      statusLabel: "IA local indisponível neste dispositivo",
      detail: "Este dispositivo não suporta WebGPU. Use o modo leve ou acesse por um navegador compatível (Chrome/Edge).",
      checkedAt: nowIso(),
    };
  }

  // WebGPU available but model not yet loaded (idle)
  return {
    provider: "mock",
    mode,
    availability: "ready_placeholder",
    canExplainReport: true,
    canExplainChat: true,
    canGenerateOnDemand: true,
    lazyLoadOnly: true,
    requiresModelDownload: true,
    requiresUserAction: true,
    explicitPlaceholder: true,
    supportsStreaming: false,
    supportedModes: ["light", "ai"],
    supportedStrategies: ["keyword_overlap", "manual_seed"],
    primaryReasonCode: "MODEL_NOT_DOWNLOADED",
    activationLabel: "Baixar e ativar modelo local (~2GB)",
    statusLabel: "IA local disponível — clique para carregar",
    detail: `WebGPU disponível. Clique para baixar e inicializar o modelo ${WEBLLM_MODEL_ID} (~2GB). O download ocorre uma vez e fica em cache no navegador.`,
    checkedAt: nowIso(),
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
    await buildExplanationContext({
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

  const anchoredRequest = { ...request, explanationContext };
  const evidence = buildAnchoredEvidence(anchoredRequest);
  const refusal = evaluateRefusal(anchoredRequest, evidence);
  const sections = buildStructuredSections({ request: anchoredRequest, evidence, refusal });

  // ── Real WebLLM inference ──────────────────────────────────────────────────
  if (!refusal && _webllmEngine !== null && _webllmState === "ready") {
    const ragContext = anchoredRequest.explanationContext?.blocks
      .map((block, i) => `[${i + 1}] ${block.title}: ${block.summary}`)
      .join("\n") ?? "";

    const { system, user } = buildWebLLMPrompt(anchoredRequest, ragContext);

    try {
      const completion = await _webllmEngine.chat.completions.create({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.1,
        max_tokens: 800,
      });
      const llmAnswer = completion.choices[0]?.message?.content ?? "";

      return {
        id: createId("local_explainer_response"),
        createdAt: nowIso(),
        provider: "webllm",
        mode: capability.mode,
        availability: "ready",
        status: "completed",
        title: request.channel === "chat" ? "Resposta do modelo local (WebLLM)" : "Explicação local gerada por IA (WebLLM)",
        summary: "Explicação gerada pelo modelo local com base nos dados da simulação e contexto normativo recuperado.",
        answer: llmAnswer,
        sections,
        disclaimer:
          "Gerado por modelo de IA local (WebLLM). Não constitui aconselhamento fiscal oficial. Revisão humana obrigatória antes de qualquer decisão prática.",
        promptContract,
        evidence,
        evidenceAnchor: buildEvidenceAnchor(anchoredRequest, evidence),
        capabilityStatus: buildCapabilityStatus(capability),
        followUps: [],
        explicitPlaceholder: false,
      };
    } catch {
      // Fall through to mock response on LLM error
    }
  }

  // ── Mock / fallback response ───────────────────────────────────────────────
  const answer = refusal
    ? `${refusal.title}. ${refusal.message} Próximos passos: ${refusal.requiredActions.join(" ")}`
    : [
        `Resumo ancorado: ${anchoredRequest.simulation.summary.narrative}`,
        request.userPrompt ? `Pergunta do usuário: ${request.userPrompt}` : "Sem pergunta livre adicional registrada.",
        `Evidências locais consideradas: ${evidence.map((item) => item.title).join(", ") || "nenhuma"}.`,
        "Conclusão conservadora: esta resposta apenas reorganiza evidências locais e não constitui aconselhamento fiscal oficial.",
      ].join(" ");

  return {
    id: createId("local_explainer_response"),
    createdAt: nowIso(),
    provider: capability.provider,
    mode: capability.mode,
    availability: capability.availability,
    status: refusal ? "refused" : "completed",
    title: request.channel === "chat" ? "Resposta local estruturada do explainer" : "Explicação local estruturada do relatório",
    summary: refusal
      ? "Resposta convertida em recusa controlada por ausência de base local suficiente ou necessidade de revisão."
      : "Resposta estruturada e ancorada em contexto normativo local disponível.",
    answer,
    sections,
    disclaimer:
      "Modo estruturado sem IA gerativa. Chain-of-thought é interno/privado. Não constitui aconselhamento fiscal oficial.",
    promptContract,
    evidence,
    evidenceAnchor: buildEvidenceAnchor(anchoredRequest, evidence),
    capabilityStatus: buildCapabilityStatus(capability),
    refusal: refusal ?? undefined,
    followUps: _webllmState === "idle" && hasWebGpu()
      ? ["Clique em 'Ativar IA local' para baixar o modelo e gerar explicações mais detalhadas."]
      : [],
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
    "Explique este cenário de forma conservadora, estruturada e ancorada em evidências locais, recusando quando faltar base suficiente.";

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
            : "Sessão de chat local mock/WebLLM-ready criada com contrato estruturado, ancoragem obrigatória e recusa controlada.",
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
