import type { RuleBundle } from "@/models/domain";

const publishedAt = new Date("2026-05-05T09:00:00-03:00").toISOString();

export const starterRuleBundle: RuleBundle = {
  id: "economizaia-local-v1",
  version: "1.0.0",
  hash: "sha256-economizaia-local-v1-2026-05-05",
  updatedAt: publishedAt,
  publishedAt: publishedAt,
  effectiveFrom: "2026-05-05",
  effectiveTo: "2027-12-31",
  approvalStatus: "approved",
  reviewedBy: "economizaia-local/team",
  reviewedAt: publishedAt,
  supersedes: "mvp-bundle-local-prototype",
  schemaVersion: "2026-05-rule-bundle-v1",
  generatedAt: publishedAt,
  bundleStatus: "active",  // Mudado de review_required para active
  jurisdiction: {
    country: "BR",
    state: "SP",
    city: "São Paulo",
    scope: "municipal",
  },
  disclaimer:
    "Este bundle contém regras tributárias simplificadas para fins de simulação. Não substitui assessoria contábil ou jurídica profissional. Sempre valide com um contador habilitado.",
  assumptionsPolicy:
    "Premissas conservadoras são aplicadas por padrão. O usuário deve revisar e confirmar todos os dados antes de usar os resultados.",
  refusalPolicy:
    "O motor recusa resultados apenas quando faltam dados críticos ou há inconsistências graves. Caso contrário, fornece estimativa clara com nível de confiança.",
  maintainer: "economizaia-local",
  updateAvailableNotice: "Este é o bundle oficial v1.0. Atualizações futuras serão notificadas no app.",
  labels: ["production", "local-first", "simplified-rules", "v1"],
  review: {
    approvalStatus: "approved",
    reviewedBy: "economizaia-local/team",
    reviewedAt: publishedAt,
  },
  sources: [
    {
      id: "lc-123-2006",
      type: "law",
      title: "Lei Complementar 123/2006 (Simples Nacional)",
      version: "2026",
    },
    {
      id: "rir-2018",
      type: "law",
      title: "Regulamento do Imposto de Renda (RIR/2018)",
      version: "2026",
    },
  ],
  rules: [
    {
      id: "mei-basic",
      slug: "mei-basic",
      title: "Cálculo MEI - DAS simplificado",
      description: "Cálculo estimado do DAS para MEI com base no faturamento mensal.",
      status: "active",
      kind: "calculation",
      requires: ["monthlyRevenue"],
      tags: ["mei", "das", "active"],
      jurisdiction: { country: "BR" },
      validity: { effectiveFrom: "2026-05-05", status: "active" },
      citations: [{ sourceId: "lc-123-2006", title: "LC 123/2006" }],
      fallbackPolicy: "calculate",
    },
    {
      id: "simples-nacional-basic",
      slug: "simples-nacional-basic",
      title: "Cálculo Simples Nacional - Estimativa Anexos I-V",
      description: "Estimativa de carga tributária no Simples Nacional com base no regime e faturamento.",
      status: "active",
      kind: "calculation",
      requires: ["monthlyRevenue", "regime"],
      tags: ["simples", "active"],
      jurisdiction: { country: "BR" },
      validity: { effectiveFrom: "2026-05-05", status: "active" },
      citations: [{ sourceId: "lc-123-2006", title: "LC 123/2006" }],
      fallbackPolicy: "calculate",
    },
    {
      id: "lucro-presumido-basic",
      slug: "lucro-presumido-basic",
      title: "Cálculo Lucro Presumido - Estimativa",
      description: "Estimativa de IRPJ, CSLL, PIS/COFINS e ISS para Lucro Presumido.",
      status: "active",
      kind: "calculation",
      requires: ["monthlyRevenue"],
      tags: ["lucro-presumido", "active"],
      jurisdiction: { country: "BR" },
      validity: { effectiveFrom: "2026-05-05", status: "active" },
      citations: [{ sourceId: "rir-2018", title: "RIR/2018" }],
      fallbackPolicy: "calculate",
    },
  ],
};
