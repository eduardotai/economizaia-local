import type { RuleBundle } from "@/models/domain";

const mvpBundlePublishedAt = new Date("2026-03-24T15:00:00-03:00").toISOString();
const mvpBundleReviewedAt = new Date("2026-03-24T15:05:00-03:00").toISOString();

export const starterRuleBundle: RuleBundle = {
  id: "mvp-bundle-local-prototype",
  version: "0.4.0-prototype-local",
  hash: "sha256-mvp-local-prototype-bundle-2026-03-24-audit-v1",
  updatedAt: mvpBundleReviewedAt,
  publishedAt: mvpBundlePublishedAt,
  effectiveFrom: "2026-03-24",
  effectiveTo: "2026-06-30",
  approvalStatus: "reviewed_internal",
  reviewedBy: "economizaia-local/product-review",
  reviewedAt: mvpBundleReviewedAt,
  supersedes: "starter-bundle-local@0.3.0-mock",
  schemaVersion: "2026-03-rule-bundle-v1",
  generatedAt: mvpBundlePublishedAt,
  bundleStatus: "review_required",
  jurisdiction: {
    country: "BR",
    state: "SP",
    city: "São Paulo",
    scope: "municipal",
  },
  disclaimer:
    "Bundle MVP local e protótipo. Não contém cobertura tributária completa, não substitui interpretação legal e não deve ser usado como orientação fiscal oficial.",
  assumptionsPolicy:
    "Toda premissa não confirmada documentalmente ou revisada manualmente deve permanecer explícita, com rótulo de protótipo/local/placeholder.",
  refusalPolicy:
    "Se faltarem dados essenciais, se houver revisão pendente ou se a atividade/jurisdição sair do recorte estreito do MVP, o motor deve recusar a conclusão em vez de aparentar oficialidade.",
  maintainer: "economizaia-local/mock-engine",
  updateAvailableNotice:
    "Bundle MVP local publicado apenas para demonstração controlada. Qualquer pacote futuro deve indicar supersedes, revisão e vigência antes do uso.",
  labels: ["prototype", "local", "reviewed-internal", "mock-engine-compatible", "mvp-narrow-scope"],
  review: {
    approvalStatus: "reviewed_internal",
    reviewedBy: "economizaia-local/product-review",
    reviewedAt: mvpBundleReviewedAt,
  },
  sources: [
    {
      id: "architecture-doc",
      type: "internal_doc",
      title: "ARCHITECTURE.md",
      version: "local-workspace",
      note: "Documento interno de arquitetura e produto. Não é fonte normativa.",
    },
    {
      id: "rule-engine-contract",
      type: "internal_doc",
      title: "docs/rule-engine-contract.md",
      version: "mvp-2026-03-24",
      note: "Contrato técnico do motor local. Não contém interpretação jurídica oficial.",
    },
    {
      id: "demo-prototype-note",
      type: "technical_note",
      title: "Nota de recorte MVP local",
      version: "2026-03-24",
      note: "Recorte conservador para demo: comparação artificial local e recusa obrigatória quando faltam dados ou revisão humana.",
      validity: {
        effectiveFrom: "2026-03-24",
        effectiveTo: "2026-06-30",
        status: "active",
      },
    },
  ],
  rules: [
    {
      id: "guardrail-manual-review-required",
      slug: "guardrail-manual-review-required",
      title: "Recusa por revisão humana pendente",
      description:
        "Guardrail de protótipo que exige revisão humana/local antes de aceitar qualquer insumo documental ou premissa crítica como base de comparação.",
      status: "review_required",
      kind: "guardrail",
      requires: ["monthlyRevenue", "regime", "activityDescription", "state"],
      tags: ["guardrail", "manual-review", "prototype", "local"],
      jurisdiction: {
        country: "BR",
        state: "SP",
        city: "São Paulo",
        scope: "municipal",
      },
      validity: {
        effectiveFrom: "2026-03-24",
        effectiveTo: "2026-06-30",
        status: "active",
      },
      citations: [
        {
          sourceId: "rule-engine-contract",
          title: "docs/rule-engine-contract.md",
          note: "Contrato local exige recusa quando faltarem dados ou revisão pendente.",
        },
      ],
      fallbackPolicy: "manual_review",
      notes: [
        "Regra de proteção de UX e governança.",
        "Não representa exigência legal específica; é política conservadora do protótipo local.",
      ],
    },
    {
      id: "guardrail-insufficient-data",
      slug: "guardrail-insufficient-data",
      title: "Recusa por insuficiência de dados mínimos",
      description:
        "Guardrail técnico do MVP que bloqueia conclusões quando faltam campos mínimos para um resultado auditável no recorte demonstrável.",
      status: "review_required",
      kind: "guardrail",
      requires: ["monthlyRevenue", "regime", "activityDescription", "state"],
      tags: ["guardrail", "refusal", "prototype", "local", "auditability"],
      jurisdiction: {
        country: "BR",
        state: "SP",
        city: "São Paulo",
        scope: "municipal",
      },
      validity: {
        effectiveFrom: "2026-03-24",
        effectiveTo: "2026-06-30",
        status: "active",
      },
      citations: [
        {
          sourceId: "rule-engine-contract",
          title: "docs/rule-engine-contract.md",
          note: "Regra local de recusa por dados insuficientes.",
        },
      ],
      fallbackPolicy: "refuse",
      notes: [
        "Guardrail de falsa precisão.",
        "Não expressa regra tributária oficial; apenas política local de segurança do MVP.",
      ],
    },
    {
      id: "prototype-local-scenario-comparison",
      slug: "prototype-local-scenario-comparison",
      title: "Comparação artificial de cenários locais",
      description:
        "Regra demonstrativa do MVP para comparar dois cenários artificiais com percentuais placeholder, explicitamente marcados como demo/protótipo/local.",
      status: "mock",
      kind: "comparison",
      requires: ["monthlyRevenue", "regime", "activityDescription", "state"],
      tags: ["comparison", "prototype", "demo", "placeholder", "local"],
      jurisdiction: {
        country: "BR",
        state: "SP",
        city: "São Paulo",
        scope: "municipal",
      },
      validity: {
        effectiveFrom: "2026-03-24",
        effectiveTo: "2026-06-30",
        status: "active",
      },
      citations: [
        {
          sourceId: "demo-prototype-note",
          title: "Nota de recorte MVP local",
          article: "demo-1",
          excerpt: "Percentuais e cenários abaixo são artificiais e existem apenas para demonstrar contrato, auditoria e UX.",
          note: "Exemplo explícito de placeholder sem valor legal.",
        },
        {
          sourceId: "architecture-doc",
          title: "ARCHITECTURE.md",
          note: "Base arquitetural do fluxo local-first auditável.",
        },
      ],
      fallbackPolicy: "manual_review",
      notes: [
        "Usa percentuais fixos artificiais para demo controlada.",
        "Não cobre CNAE, anexos, exceções, benefícios ou legislação real.",
      ],
    },
  ],
};
