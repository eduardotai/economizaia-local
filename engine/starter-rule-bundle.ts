import type { RuleBundle } from "@/models/domain";

export const starterRuleBundle: RuleBundle = {
  id: "starter-bundle-local",
  version: "0.1.0-mock",
  generatedAt: new Date("2026-03-24T10:00:00-03:00").toISOString(),
  disclaimer:
    "Bundle inicial apenas para validação técnica do fluxo. Não contém regra fiscal oficial consolidada.",
  rules: [
    {
      id: "placeholder-regime-comparison",
      title: "Comparação inicial de cenários",
      description:
        "Regra simulada para demonstrar a estrutura do motor local e a trilha de auditoria. Placeholder sem valor normativo.",
      status: "mock",
      requires: ["monthlyRevenue", "regime", "activityDescription"],
      citations: [
        {
          sourceId: "architecture-doc",
          title: "ARCHITECTURE.md",
          note: "Referência interna de arquitetura, não normativa.",
        },
      ],
    },
  ],
};