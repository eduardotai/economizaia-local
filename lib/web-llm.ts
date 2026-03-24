export interface LocalLlmExplainInput {
  summary: string;
  assumptions: string[];
  warnings: string[];
}

export async function explainWithLocalLlm(input: LocalLlmExplainInput) {
  return {
    status: "placeholder",
    model: "webllm-not-configured",
    text: `Explicação local placeholder: ${input.summary}. A implementação real deve usar apenas saída estruturada do motor de regras, sem inventar interpretação fiscal.`,
  };
}