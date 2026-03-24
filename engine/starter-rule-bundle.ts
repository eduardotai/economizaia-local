import type { RuleBundle } from "@/models/domain";

export const starterRuleBundle: RuleBundle = {
  id: "starter-bundle-local",
  version: "0.3.0-mock",
  hash: "mock-sha256-manual-review-required-2026-03-24",
  updatedAt: new Date("2026-03-24T10:45:00-03:00").toISOString(),
  schemaVersion: "2026-03-rule-bundle-v1",
  generatedAt: new Date("2026-03-24T10:45:00-03:00").toISOString(),
  bundleStatus: "mock",
  jurisdiction: {
    country: "BR",
    state: "SP",
    city: "São Paulo",
    scope: "municipal",
  },
  disclaimer:
    "Bundle inicial apenas para validação técnica do fluxo. Não contém regra fiscal oficial consolidada e não deve ser usado como interpretação normativa.",
  assumptionsPolicy:
    "Toda premissa não confirmada deve permanecer explícita como placeholder ou exigir revisão humana.",
  refusalPolicy:
    "Se faltarem dados centrais para enquadramento ou vigência, o motor deve retornar insufficient_data/refused em vez de fechar cálculo com aparência oficial.",
  maintainer: "economizaia-local/mock-engine",
  updateAvailableNotice:
    "Bundle local mock versionado. Futuramente este app deve avisar e permitir atualização controlada quando houver pacote revisado mais recente.",
  sources: [
    {
      id: "architecture-doc",
      type: "internal_doc",
      title: "ARCHITECTURE.md",
      version: "local-workspace",
      note: "Documento interno de arquitetura. Não é fonte normativa.",
    },
    {
      id: "mock-normative-placeholder",
      type: "mock_reference",
      title: "Placeholder normativo para testes",
      note: "Referência de exemplo para estruturar citações, sem valor legal.",
      validity: {
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        status: "planned",
      },
    },
  ],
  rules: [
    {
      id: "placeholder-regime-comparison",
      slug: "placeholder-regime-comparison",
      title: "Comparação inicial de cenários",
      description:
        "Regra simulada para demonstrar a estrutura do motor local, vigência, jurisdição e trilha de auditoria. Placeholder sem valor normativo.",
      status: "mock",
      kind: "comparison",
      requires: ["monthlyRevenue", "regime", "activityDescription"],
      tags: ["starter", "comparison", "mock"],
      jurisdiction: {
        country: "BR",
        scope: "federal",
      },
      validity: {
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        status: "planned",
      },
      citations: [
        {
          sourceId: "architecture-doc",
          title: "ARCHITECTURE.md",
          note: "Referência interna de arquitetura, não normativa.",
        },
        {
          sourceId: "mock-normative-placeholder",
          title: "Placeholder normativo para testes",
          article: "art. mock-1",
          excerpt: "Exemplo ilustrativo de citação estrutural, sem valor legal.",
          note: "Citação fake apenas para testar o contrato.",
        },
      ],
      fallbackPolicy: "insufficient_data",
      notes: ["Não traduz lei real.", "Serve apenas para evolução de contrato e testes locais."],
    },
    {
      id: "guardrail-insufficient-data",
      slug: "guardrail-insufficient-data",
      title: "Recusa mock por insuficiência de dados",
      description:
        "Guardrail técnico que impede encerrar cenários quando campos mínimos ainda estão ausentes. Sem qualquer conteúdo tributário oficial.",
      status: "mock",
      kind: "guardrail",
      requires: ["monthlyRevenue", "regime", "activityDescription", "state"],
      tags: ["guardrail", "refusal", "mock"],
      jurisdiction: {
        country: "BR",
        scope: "unknown",
      },
      validity: {
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        status: "planned",
      },
      citations: [
        {
          sourceId: "architecture-doc",
          title: "ARCHITECTURE.md",
          note: "Relaciona-se ao princípio de não fechar cálculo quando faltam dados relevantes.",
        },
      ],
      fallbackPolicy: "refuse",
      notes: ["Mock de proteção contra falsa precisão."],
    },
  ],
};
