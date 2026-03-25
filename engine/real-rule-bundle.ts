import type { RuleBundle } from "@/models/domain";

const publishedAt = new Date("2026-03-24T18:00:00-03:00").toISOString();

export const realRuleBundle: RuleBundle = {
  id: "real-bundle-br-2026-draft",
  version: "1.0.0-draft",
  hash: "sha256-real-bundle-br-simples-mei-lp-2026-draft",
  updatedAt: publishedAt,
  publishedAt,
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  approvalStatus: "reviewed_internal",
  reviewedBy: "economizaia-local/tax-review",
  reviewedAt: publishedAt,
  supersedes: "mvp-bundle-local-prototype@0.4.0-prototype-local",
  schemaVersion: "2026-03-rule-bundle-v1",
  generatedAt: publishedAt,
  bundleStatus: "review_required",
  jurisdiction: {
    country: "BR",
    scope: "federal",
  },
  disclaimer:
    "Bundle com cálculos baseados em legislação vigente (LC 123/2006, Resolução CGSN 140/2018, RIR/2018). " +
    "Estimativas conservadoras. Não substitui análise de contador habilitado. " +
    "Fator R calculado com base em despesas declaradas como proxy de folha — confirmar com contador.",
  assumptionsPolicy:
    "Toda premissa derivada de declaração do usuário é marcada explicitamente. " +
    "Quando faltar CNAE oficial, a classificação de atividade é heurística por palavras-chave. " +
    "Fator R estimado pela razão despesas/receita quando folha de salários não informada.",
  refusalPolicy:
    "Recusar quando faltarem receita, regime ou descrição de atividade. " +
    "Emitir alerta crítico quando a classificação de atividade for ambígua. " +
    "Nunca apresentar estimativa como cálculo fiscal oficial.",
  maintainer: "economizaia-local/real-engine",
  labels: ["draft", "federal", "simples-nacional", "mei", "lucro-presumido", "2026"],
  review: {
    approvalStatus: "reviewed_internal",
    reviewedBy: "economizaia-local/tax-review",
    reviewedAt: publishedAt,
  },
  sources: [
    {
      id: "lc-123-2006",
      type: "legal_text",
      title: "Lei Complementar nº 123/2006 — Estatuto Nacional da Microempresa e Empresa de Pequeno Porte",
      url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm",
      validity: { effectiveFrom: "2006-12-14", effectiveTo: null, status: "active" },
    },
    {
      id: "cgsn-140-2018",
      type: "legal_text",
      title: "Resolução CGSN nº 140/2018 — Regulamento do Simples Nacional",
      url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm",
      validity: { effectiveFrom: "2018-05-22", effectiveTo: null, status: "active" },
    },
    {
      id: "rir-2018",
      type: "legal_text",
      title: "Decreto nº 9.580/2018 — Regulamento do Imposto de Renda (RIR/2018)",
      url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/D9580.htm",
      validity: { effectiveFrom: "2018-11-22", effectiveTo: null, status: "active" },
    },
    {
      id: "mei-resolucao-2024",
      type: "legal_text",
      title: "Resolução CGSN nº 162/2024 — DAS MEI e limites 2026",
      validity: { effectiveFrom: "2024-01-01", effectiveTo: null, status: "active" },
      note: "DAS MEI calculado sobre salário mínimo vigente de R$ 1.518,00 (2026).",
    },
  ],
  rules: [
    {
      id: "guardrail-dados-minimos",
      slug: "guardrail-dados-minimos",
      title: "Recusa por dados mínimos ausentes",
      description: "Bloqueia a simulação quando receita, regime ou atividade não estão informados.",
      status: "draft",
      kind: "guardrail",
      requires: ["monthlyRevenue", "regime", "activityDescription"],
      tags: ["guardrail", "refusal", "validation"],
      jurisdiction: { country: "BR", scope: "federal" },
      validity: { effectiveFrom: "2026-01-01", effectiveTo: null, status: "active" },
      citations: [{ sourceId: "lc-123-2006", title: "LC 123/2006", note: "Art. 18 — alíquotas do Simples requerem receita bruta acumulada definida." }],
      fallbackPolicy: "refuse",
    },
    {
      id: "mei-das-2026",
      slug: "mei-das-2026",
      title: "DAS MEI 2026 — Cálculo do documento de arrecadação",
      description:
        "MEI recolhe INSS (5% do salário mínimo), ICMS (R$ 1,00) para comércio/indústria e ISS (R$ 5,00) para serviços. " +
        "Salário mínimo 2026: R$ 1.518,00. Limite anual: R$ 81.000,00.",
      status: "draft",
      kind: "comparison",
      requires: ["monthlyRevenue", "activityDescription"],
      tags: ["mei", "das", "inss", "2026"],
      jurisdiction: { country: "BR", scope: "federal" },
      validity: { effectiveFrom: "2026-01-01", effectiveTo: null, status: "active" },
      citations: [
        { sourceId: "lc-123-2006", title: "LC 123/2006", article: "Art. 18-A", excerpt: "O MEI recolherá, na forma estabelecida, valor fixo mensal correspondente ao INSS e tributos municipais/estaduais." },
        { sourceId: "mei-resolucao-2024", title: "Resolução CGSN 162/2024", note: "DAS MEI 2026 calculado sobre salário mínimo de R$ 1.518,00." },
      ],
      fallbackPolicy: "manual_review",
      notes: [
        "Atividades vedadas ao MEI não são verificadas automaticamente — confirmar elegibilidade.",
        "Limite de faturamento anual: R$ 81.000,00.",
        "Máximo de 1 empregado contratado.",
      ],
    },
    {
      id: "simples-nacional-anexos-2026",
      slug: "simples-nacional-anexos-2026",
      title: "Simples Nacional — Anexos I a V (LC 123/2006, Anexos atualizados CGSN 140)",
      description:
        "Alíquotas efetivas do Simples Nacional por faixa de receita bruta anual acumulada nos 12 meses anteriores. " +
        "Serviços: Anexo III (Fator R ≥ 28%) ou Anexo V (Fator R < 28%). " +
        "Comércio: Anexo I. Indústria: Anexo II.",
      status: "draft",
      kind: "comparison",
      requires: ["monthlyRevenue", "activityDescription"],
      tags: ["simples-nacional", "anexo-iii", "anexo-v", "fator-r", "2026"],
      jurisdiction: { country: "BR", scope: "federal" },
      validity: { effectiveFrom: "2018-01-01", effectiveTo: null, status: "active" },
      citations: [
        { sourceId: "lc-123-2006", title: "LC 123/2006", article: "Art. 18 e Anexos I-V", excerpt: "As alíquotas e partilha do Simples Nacional constam dos Anexos I a V desta Lei Complementar." },
        { sourceId: "cgsn-140-2018", title: "Resolução CGSN 140/2018", article: "Art. 25-A", note: "Fator R determina aplicação do Anexo III ou V para serviços." },
      ],
      fallbackPolicy: "manual_review",
      notes: [
        "Fator R = folha de salários (12 meses) / receita bruta (12 meses). Estimado via despesas declaradas quando folha não informada.",
        "Limite do Simples: R$ 4.800.000/ano.",
        "Empresa com dívida ativa ou débito fiscal não pode optar pelo Simples.",
      ],
    },
    {
      id: "lucro-presumido-2026",
      slug: "lucro-presumido-2026",
      title: "Lucro Presumido — IRPJ, CSLL, PIS, COFINS e ISS (RIR/2018)",
      description:
        "Presunção de lucro: 32% para serviços, 8% para comércio. " +
        "IRPJ: 15% + adicional de 10% sobre lucro presumido excedente a R$ 20.000/mês. " +
        "CSLL: 9%. PIS: 0,65%. COFINS: 3%. ISS: ~3% para serviços (varia por município).",
      status: "draft",
      kind: "comparison",
      requires: ["monthlyRevenue", "activityDescription"],
      tags: ["lucro-presumido", "irpj", "csll", "pis", "cofins", "iss", "2026"],
      jurisdiction: { country: "BR", scope: "federal" },
      validity: { effectiveFrom: "2018-01-01", effectiveTo: null, status: "active" },
      citations: [
        { sourceId: "rir-2018", title: "RIR/2018", article: "Art. 591-597", excerpt: "A base de cálculo do imposto sobre a renda das pessoas jurídicas optantes pelo lucro presumido é o somatório das receitas presumidas." },
        { sourceId: "lc-123-2006", title: "LC 123/2006", note: "Comparação com Simples para identificar regime mais favorável." },
      ],
      fallbackPolicy: "manual_review",
      notes: [
        "ISS varia por município (2% a 5%). Estimativa de 3% usada como valor modal.",
        "INSS patronal (20% sobre folha) não incluído — depende de folha não informada.",
        "IBS/CBS 2026 (Reforma Tributária) em período de teste: alíquota teste de 0,1% CBS + 0,05% IBS sobre as mesmas bases. Impacto marginal em 2026.",
      ],
    },
    {
      id: "guardrail-revisao-humana",
      slug: "guardrail-revisao-humana",
      title: "Revisão humana obrigatória antes de decisão fiscal",
      description: "Todo resultado do motor deve ser validado por contador habilitado antes de qualquer decisão de enquadramento ou mudança de regime.",
      status: "draft",
      kind: "guardrail",
      requires: [],
      tags: ["guardrail", "human-review", "disclaimer"],
      jurisdiction: { country: "BR", scope: "federal" },
      validity: { effectiveFrom: "2026-01-01", effectiveTo: null, status: "active" },
      citations: [{ sourceId: "lc-123-2006", title: "LC 123/2006", note: "Mudança de regime tem prazos e condições legais específicos que requerem análise profissional." }],
      fallbackPolicy: "manual_review",
    },
  ],
};
