import type {
  ConfidenceBand,
  DataGap,
  SimulationAlert,
  SimulationResult,
  SimulationScenario,
  SimulationSummary,
  TaxpayerProfile,
} from "@/models/domain";
import type { TaxRuleEngine } from "@/engine/types";
import { formatCurrency } from "@/engine/types";
import { realRuleBundle } from "@/engine/real-rule-bundle";

// ── Referências 2026 ──────────────────────────────────────────────────────────

const REF = {
  salarioMinimo: 1518.0,       // R$ 1.518,00 — 2026
  meiLimiteAnual: 81_000,      // R$ 81.000/ano
  simplesLimiteAnual: 4_800_000,
  irpjAdicionalBase: 20_000,   // por mês
} as const;

// ── MEI ───────────────────────────────────────────────────────────────────────

const MEI_INSS = REF.salarioMinimo * 0.05; // R$ 75,90

function meiDasMensal(activity: "servicos" | "comercio" | "industria"): number {
  if (activity === "comercio" || activity === "industria") return MEI_INSS + 1.0;
  return MEI_INSS + 5.0; // serviços
}

// ── Simples Nacional ──────────────────────────────────────────────────────────

type SimplesAnexo = "I" | "II" | "III" | "IV" | "V";

type SimplesBracket = { ate: number; aliquota: number; deducao: number };

const SIMPLES: Record<SimplesAnexo, SimplesBracket[]> = {
  I: [
    { ate: 180_000,   aliquota: 0.0400, deducao: 0 },
    { ate: 360_000,   aliquota: 0.0730, deducao: 5_940 },
    { ate: 720_000,   aliquota: 0.0950, deducao: 13_860 },
    { ate: 1_800_000, aliquota: 0.1070, deducao: 22_500 },
    { ate: 3_600_000, aliquota: 0.1430, deducao: 87_300 },
    { ate: 4_800_000, aliquota: 0.1900, deducao: 378_000 },
  ],
  II: [
    { ate: 180_000,   aliquota: 0.0450, deducao: 0 },
    { ate: 360_000,   aliquota: 0.0780, deducao: 5_940 },
    { ate: 720_000,   aliquota: 0.1000, deducao: 13_860 },
    { ate: 1_800_000, aliquota: 0.1120, deducao: 22_500 },
    { ate: 3_600_000, aliquota: 0.1470, deducao: 85_500 },
    { ate: 4_800_000, aliquota: 0.3000, deducao: 720_000 },
  ],
  III: [
    { ate: 180_000,   aliquota: 0.0600, deducao: 0 },
    { ate: 360_000,   aliquota: 0.1120, deducao: 9_360 },
    { ate: 720_000,   aliquota: 0.1320, deducao: 17_640 },
    { ate: 1_800_000, aliquota: 0.1600, deducao: 35_640 },
    { ate: 3_600_000, aliquota: 0.2100, deducao: 125_640 },
    { ate: 4_800_000, aliquota: 0.3300, deducao: 648_000 },
  ],
  IV: [
    { ate: 180_000,   aliquota: 0.0450, deducao: 0 },
    { ate: 360_000,   aliquota: 0.0900, deducao: 8_100 },
    { ate: 720_000,   aliquota: 0.1020, deducao: 12_420 },
    { ate: 1_800_000, aliquota: 0.1400, deducao: 39_780 },
    { ate: 3_600_000, aliquota: 0.2200, deducao: 183_780 },
    { ate: 4_800_000, aliquota: 0.3300, deducao: 828_000 },
  ],
  V: [
    { ate: 180_000,   aliquota: 0.1550, deducao: 0 },
    { ate: 360_000,   aliquota: 0.1800, deducao: 4_500 },
    { ate: 720_000,   aliquota: 0.1950, deducao: 9_900 },
    { ate: 1_800_000, aliquota: 0.2050, deducao: 17_100 },
    { ate: 3_600_000, aliquota: 0.2300, deducao: 62_100 },
    { ate: 4_800_000, aliquota: 0.3050, deducao: 540_000 },
  ],
};

function simplesEfetivoMensal(monthlyRevenue: number, anexo: SimplesAnexo): number | null {
  const annual = monthlyRevenue * 12;
  if (annual > REF.simplesLimiteAnual) return null;
  const bracket = SIMPLES[anexo].find((b) => annual <= b.ate);
  if (!bracket) return null;
  const effectiveRate = Math.max(0, (annual * bracket.aliquota - bracket.deducao) / annual);
  return monthlyRevenue * effectiveRate;
}

// ── Classificação de atividade ────────────────────────────────────────────────

type ActivityClass = "servicos" | "comercio" | "industria";

function classifyActivity(description: string, cnae?: string): ActivityClass {
  const text = (description + " " + (cnae ?? ""))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const serviceTerms = [
    "servico", "servicos", "consultoria", "assessoria", "advocacia", "medico",
    "medicina", "saude", "engenharia", "desenvolvimento", "software", "programacao",
    "design", "marketing", "publicidade", "contabilidade", "financeiro", "juridico",
    "educacao", "treinamento", "coaching", "ti", "tecnologia", "informatica",
    "manutencao", "reparacao", "instalacao", "transporte", "logistica", "corretagem",
    "administracao", "gestao", "auditoria", "psicologia", "odontologia", "fisioterapia",
    "nutricionista", "arquitetura", "fotografia", "comunicacao", "agencia", "estudio",
    "digital", "freelance", "autonomo", "profissional", "liberal", "creative",
  ];

  const commerceTerms = [
    "comercio", "loja", "venda", "vendas", "revenda", "produto", "produtos",
    "varejo", "atacado", "distribuicao", "importacao", "exportacao", "mercadoria",
    "mercado", "supermercado", "farmacia", "livraria",
  ];

  const industryTerms = [
    "industria", "fabricacao", "producao", "manufactura", "manufatura",
    "transformacao", "confeccao", "beneficiamento", "montagem",
  ];

  const s = serviceTerms.filter((t) => text.includes(t)).length;
  const c = commerceTerms.filter((t) => text.includes(t)).length;
  const i = industryTerms.filter((t) => text.includes(t)).length;

  if (i > c && i > s) return "industria";
  if (c > s) return "comercio";
  return "servicos"; // padrão conservador (cobre mais MEI/autônomos)
}

// ── Fator R ───────────────────────────────────────────────────────────────────

function determineServicosAnexo(monthlyRevenue: number, monthlyExpenses?: number): {
  anexo: "III" | "V";
  fatorR: number | null;
  hasEstimate: boolean;
} {
  if (!monthlyExpenses || monthlyExpenses <= 0) {
    return { anexo: "V", fatorR: null, hasEstimate: false }; // conservador: Anexo V (maior carga)
  }
  const fatorR = monthlyExpenses / monthlyRevenue;
  return { anexo: fatorR >= 0.28 ? "III" : "V", fatorR, hasEstimate: true };
}

// ── Lucro Presumido ───────────────────────────────────────────────────────────

interface LucroPresumidoCalc {
  irpj: number;
  csll: number;
  pis: number;
  cofins: number;
  iss: number;
  total: number;
  effectiveRate: number;
}

function calcLucroPresumido(monthlyRevenue: number, activity: ActivityClass): LucroPresumidoCalc {
  const isService = activity === "servicos";
  const irpjPresuncao = isService ? 0.32 : 0.08;
  const csllPresuncao = isService ? 0.32 : 0.12;

  const irpjBase = monthlyRevenue * irpjPresuncao;
  const csllBase = monthlyRevenue * csllPresuncao;

  const irpj = irpjBase * 0.15 + Math.max(0, irpjBase - REF.irpjAdicionalBase) * 0.10;
  const csll = csllBase * 0.09;
  const pis = monthlyRevenue * 0.0065;
  const cofins = monthlyRevenue * 0.03;
  const iss = isService ? monthlyRevenue * 0.03 : 0;

  const total = irpj + csll + pis + cofins + iss;
  return { irpj, csll, pis, cofins, iss, total, effectiveRate: total / monthlyRevenue };
}

// ── Helpers de tipos ──────────────────────────────────────────────────────────

function confidence(level: ConfidenceBand["level"], score: number, label: string, rationale: string, drivers: string[], blockers?: string[]): ConfidenceBand {
  return { level, score, label, rationale, drivers, blockers };
}

function gap(field: string, label: string, description: string, whyItMatters: string, blocking: boolean): DataGap {
  return {
    id: `gap-${field}`,
    field,
    label,
    description,
    severity: blocking ? "blocking" : "medium",
    blocking,
    whyItMatters,
    suggestedAction: "Confirmar com contador antes de qualquer decisão de regime.",
  };
}

function buildScenario(
  id: string,
  label: string,
  monthlyTaxEstimate: number,
  notes: string[],
  conf: ConfidenceBand,
  placeholdersUsed: string[] = [],
): SimulationScenario {
  return {
    id,
    label,
    monthlyTaxEstimate: Math.round(monthlyTaxEstimate * 100) / 100,
    annualTaxEstimate: Math.round(monthlyTaxEstimate * 12 * 100) / 100,
    notes,
    confidence: conf,
    placeholdersUsed,
  };
}

// ── Engine principal ──────────────────────────────────────────────────────────

class RealTaxRuleEngine implements TaxRuleEngine {
  bundle = realRuleBundle;

  simulate(profile: TaxpayerProfile): SimulationResult {
    const now = new Date().toISOString();
    const missingData: DataGap[] = [];
    const alerts: SimulationAlert[] = [];

    // ── Validação de campos mínimos ──
    if (!Number.isFinite(profile.monthlyRevenue) || profile.monthlyRevenue <= 0) {
      missingData.push(gap("monthlyRevenue", "Receita mensal", "Receita mensal ausente ou inválida.", "Sem receita não é possível determinar faixa tributária.", true));
    }
    if (!profile.activityDescription?.trim()) {
      missingData.push(gap("activityDescription", "Descrição da atividade", "Atividade não informada.", "A atividade determina o Anexo do Simples e a presunção do Lucro Presumido.", true));
    }
    if (!profile.regime || profile.regime === "indefinido") {
      missingData.push(gap("regime", "Regime atual", "Regime tributário atual não informado.", "Necessário para calcular carga atual e identificar oportunidade de troca.", true));
    }

    if (missingData.some((g) => g.blocking)) {
      return this.buildRefusal(profile, missingData, now);
    }

    // ── Classificação da atividade ──
    const activity = classifyActivity(profile.activityDescription, profile.cnaeOrActivityCode);
    const annualRevenue = profile.monthlyRevenue * 12;

    const hasCnae = Boolean(profile.cnaeOrActivityCode?.trim());
    if (!hasCnae) {
      missingData.push(gap(
        "cnaeOrActivityCode",
        "CNAE ou código de atividade",
        "Sem CNAE, a classificação é feita por palavras-chave da descrição.",
        "CNAE define exatamente qual Anexo do Simples se aplica e quais atividades são elegíveis ao MEI.",
        false,
      ));
    }

    // ── Carga atual ──
    const { currentTax, currentLabel, currentNotes, currentPlaceholders, currentConf } =
      this.calcCurrentRegime(profile, activity, annualRevenue, hasCnae);

    // ── Alternativas ──
    const alternatives = this.calcAlternatives(profile, activity, annualRevenue, hasCnae);

    // ── Melhor alternativa ──
    const best = alternatives.sort((a, b) => a.monthly - b.monthly)[0];
    const savings = best ? Math.max(0, currentTax - best.monthly) : 0;
    const hasAlternative = best !== undefined && savings > 0;

    // ── Alertas ──
    alerts.push({
      id: "alert-revisao-humana",
      severity: "warning",
      title: "Validação com contador obrigatória",
      message: "Esta estimativa é orientativa. Mudança de regime requer análise profissional, verificação de débitos e cumprimento de prazos legais.",
      code: "HUMAN_REVIEW_REQUIRED",
      sourceRuleId: "guardrail-revisao-humana",
      requiresHumanReview: true,
    });

    if (!hasCnae) {
      alerts.push({
        id: "alert-sem-cnae",
        severity: "info",
        title: "Classificação de atividade por palavras-chave",
        message: `Atividade classificada como "${activity}" por heurística. Confirme com o CNAE oficial para resultado mais preciso.`,
        code: "ACTIVITY_HEURISTIC",
        requiresHumanReview: false,
      });
    }

    if (annualRevenue > REF.simplesLimiteAnual) {
      alerts.push({
        id: "alert-fora-simples",
        severity: "info",
        title: "Acima do limite do Simples Nacional",
        message: `Receita anual estimada (${formatCurrency(annualRevenue)}) supera R$ 4.800.000 — Simples Nacional não elegível.`,
        code: "ABOVE_SIMPLES_LIMIT",
        requiresHumanReview: false,
      });
    }

    const overallConf = hasCnae
      ? confidence("moderate", 0.62, "Moderada", "Cálculos baseados em tabelas oficiais; CNAE confirma atividade.", ["CNAE informado", "Tabelas LC 123/2006 aplicadas"])
      : confidence("low", 0.42, "Baixa", "Classificação de atividade por heurística de palavras-chave — confirmar CNAE.", ["Tabelas LC 123/2006 aplicadas"], ["CNAE não informado — atividade classificada por palavras-chave"]);

    const currentScenario = buildScenario("cenario-atual", currentLabel, currentTax, currentNotes, currentConf, currentPlaceholders);
    const suggestedScenario = hasAlternative
      ? buildScenario("cenario-alternativo", best.label, best.monthly, best.notes, best.conf, best.placeholders)
      : undefined;

    const summary: SimulationSummary = {
      estimatedSavings: Math.round(savings * 100) / 100,
      estimatedSavingsLabel: savings > 0 ? `${formatCurrency(savings)}/mês · ${formatCurrency(savings * 12)}/ano` : "Sem economia estimada com as informações fornecidas",
      narrative: this.buildNarrative(profile, activity, savings, best?.label),
      decisionStatus: missingData.some((g) => !g.blocking) ? "completed_with_gaps" : "completed",
      confidence: overallConf,
    };

    return {
      id: `sim-real-${profile.id}`,
      createdAt: now,
      profileId: profile.id,
      bundleId: this.bundle.id,
      bundleVersion: this.bundle.version,
      status: "partial",
      currentScenario,
      suggestedScenario,
      summary,
      audit: {
        premises: this.buildPremises(profile, activity, hasCnae),
        appliedRules: [
          { ruleId: "simples-nacional-anexos-2026", title: "Simples Nacional — Anexos I-V", status: "applied", reason: "Cálculo de alíquota efetiva por faixa de RBA.", citations: [] },
          { ruleId: "lucro-presumido-2026", title: "Lucro Presumido", status: "applied", reason: "Estimativa IRPJ + CSLL + PIS + COFINS + ISS.", citations: [] },
          ...(annualRevenue <= REF.meiLimiteAnual
            ? [{ ruleId: "mei-das-2026", title: "MEI DAS 2026", status: "applied" as const, reason: "Receita dentro do limite MEI — DAS calculado.", citations: [] }]
            : [{ ruleId: "mei-das-2026", title: "MEI DAS 2026", status: "not_applicable" as const, reason: "Receita anual acima de R$ 81.000 — MEI não elegível.", citations: [] }]),
        ],
        missingData,
        warnings: alerts,
        timeline: [
          { id: "evt-start", timestamp: now, kind: "simulation_started", message: "Simulação fiscal real iniciada." },
          { id: "evt-bundle", timestamp: now, kind: "bundle_selected", message: `Bundle ${this.bundle.id}@${this.bundle.version} aplicado.`, refs: [this.bundle.id], metadata: { approvalStatus: this.bundle.approvalStatus } },
          { id: "evt-activity", timestamp: now, kind: "premise_registered", message: `Atividade classificada como "${activity}" (CNAE ${hasCnae ? "informado" : "não informado"}).` },
          { id: "evt-rules", timestamp: now, kind: "rule_evaluated", message: "Regras de MEI, Simples Nacional e Lucro Presumido avaliadas." },
          { id: "evt-finish", timestamp: now, kind: "simulation_finished", message: "Simulação concluída com resultado parcial auditável.", refs: [currentScenario.id] },
        ],
      },
    };
  }

  private calcCurrentRegime(
    profile: TaxpayerProfile,
    activity: ActivityClass,
    annualRevenue: number,
    hasCnae: boolean,
  ): { currentTax: number; currentLabel: string; currentNotes: string[]; currentPlaceholders: string[]; currentConf: ConfidenceBand } {
    const { regime, monthlyRevenue, monthlyExpenses } = profile;

    switch (regime) {
      case "mei": {
        const das = meiDasMensal(activity);
        const eligible = annualRevenue <= REF.meiLimiteAnual;
        return {
          currentTax: das,
          currentLabel: `MEI — DAS mensal ${formatCurrency(das)}`,
          currentNotes: [
            `INSS: ${formatCurrency(MEI_INSS)} + tributo ${activity === "servicos" ? "ISS R$ 5,00" : "ICMS R$ 1,00"}`,
            ...(eligible ? [] : ["⚠️ Receita anual acima de R$ 81.000 — avaliar saída do MEI."]),
          ],
          currentPlaceholders: [],
          currentConf: confidence("moderate", 0.70, "Moderada", "DAS MEI é fixo — cálculo exato.", ["Salário mínimo 2026: R$ 1.518,00"]),
        };
      }

      case "simples": {
        const annexInfo = activity === "servicos"
          ? determineServicosAnexo(monthlyRevenue, monthlyExpenses)
          : { anexo: activity === "comercio" ? "I" : "II", fatorR: null, hasEstimate: false } as { anexo: SimplesAnexo; fatorR: number | null; hasEstimate: boolean };

        const monthlyTax = simplesEfetivoMensal(monthlyRevenue, annexInfo.anexo as SimplesAnexo);
        if (monthlyTax === null) {
          return {
            currentTax: calcLucroPresumido(monthlyRevenue, activity).total,
            currentLabel: "Simples Nacional — fora do limite (fallback Lucro Presumido)",
            currentNotes: ["Receita acima de R$ 4.800.000/ano. Estimativa pelo Lucro Presumido usada como referência."],
            currentPlaceholders: ["simples-acima-limite-fallback-lp"],
            currentConf: confidence("low", 0.35, "Baixa", "Acima do limite do Simples — fallback.", []),
          };
        }
        const annual = monthlyRevenue * 12;
        const bracket = SIMPLES[annexInfo.anexo as SimplesAnexo].find((b) => annual <= b.ate);
        return {
          currentTax: monthlyTax,
          currentLabel: `Simples Nacional — Anexo ${annexInfo.anexo} — efetivo ${((monthlyTax / monthlyRevenue) * 100).toFixed(2)}%`,
          currentNotes: [
            `Faixa: alíquota ${((bracket?.aliquota ?? 0) * 100).toFixed(1)}% − dedução ${formatCurrency((bracket?.deducao ?? 0) / 12)}/mês`,
            activity === "servicos" && !annexInfo.hasEstimate ? "Fator R não calculado — Anexo V aplicado (conservador). Informe despesas para refinar." : "",
            activity === "servicos" && annexInfo.hasEstimate ? `Fator R estimado: ${((annexInfo.fatorR ?? 0) * 100).toFixed(1)}% → Anexo ${annexInfo.anexo}` : "",
          ].filter(Boolean),
          currentPlaceholders: hasCnae ? [] : ["activity-classification-heuristic"],
          currentConf: confidence(
            annexInfo.hasEstimate ? "moderate" : "low",
            annexInfo.hasEstimate ? 0.60 : 0.45,
            annexInfo.hasEstimate ? "Moderada" : "Baixa",
            annexInfo.hasEstimate ? "Fator R estimado pelas despesas declaradas." : "Anexo V aplicado como conservador — Fator R não calculado.",
            ["Tabela LC 123/2006 aplicada", `Anexo ${annexInfo.anexo}`],
            annexInfo.hasEstimate ? [] : ["Folha de salários não informada — Fator R estimado"],
          ),
        };
      }

      case "lucro_presumido": {
        const lp = calcLucroPresumido(monthlyRevenue, activity);
        return {
          currentTax: lp.total,
          currentLabel: `Lucro Presumido — efetivo ${(lp.effectiveRate * 100).toFixed(2)}%`,
          currentNotes: [
            `IRPJ: ${formatCurrency(lp.irpj)} | CSLL: ${formatCurrency(lp.csll)}`,
            `PIS: ${formatCurrency(lp.pis)} | COFINS: ${formatCurrency(lp.cofins)}${activity === "servicos" ? ` | ISS: ${formatCurrency(lp.iss)}` : ""}`,
            "INSS patronal não incluído (depende da folha de salários).",
          ],
          currentPlaceholders: activity === "servicos" ? [] : ["iss-not-applicable-commerce"],
          currentConf: confidence("moderate", 0.58, "Moderada", "Cálculo baseado nas presunções do RIR/2018.", ["RIR/2018 art. 591-597"], ["INSS patronal não incluído"]),
        };
      }

      default: {
        const lp = calcLucroPresumido(monthlyRevenue, activity);
        return {
          currentTax: lp.total,
          currentLabel: "Regime não identificado — estimativa pelo Lucro Presumido",
          currentNotes: ["Regime atual não informado ou não reconhecido. Lucro Presumido usado como referência."],
          currentPlaceholders: ["regime-indefinido-fallback-lp"],
          currentConf: confidence("very_low", 0.20, "Muito baixa", "Regime não informado — estimativa por fallback.", [], ["Regime não informado"]),
        };
      }
    }
  }

  private calcAlternatives(
    profile: TaxpayerProfile,
    activity: ActivityClass,
    annualRevenue: number,
    hasCnae: boolean,
  ): Array<{ regime: string; monthly: number; label: string; notes: string[]; conf: ConfidenceBand; placeholders: string[] }> {
    const { regime, monthlyRevenue, monthlyExpenses } = profile;
    const alternatives: Array<{ regime: string; monthly: number; label: string; notes: string[]; conf: ConfidenceBand; placeholders: string[] }> = [];

    // MEI
    if (regime !== "mei" && annualRevenue <= REF.meiLimiteAnual) {
      const das = meiDasMensal(activity);
      alternatives.push({
        regime: "mei",
        monthly: das,
        label: `MEI — DAS fixo ${formatCurrency(das)}/mês`,
        notes: [`INSS ${formatCurrency(MEI_INSS)} + ${activity === "servicos" ? "ISS R$ 5,00" : "ICMS R$ 1,00"}. Limite: R$ 81.000/ano.`, "Verificar elegibilidade da atividade e histórico fiscal antes de migrar."],
        conf: confidence("moderate", 0.68, "Moderada", "DAS MEI é fixo e exato para revenue dentro do limite.", ["Limite R$ 81.000/ano respeitado"]),
        placeholders: [],
      });
    }

    // Simples Nacional
    if (annualRevenue <= REF.simplesLimiteAnual && regime !== "simples") {
      const annexInfo = activity === "servicos"
        ? determineServicosAnexo(monthlyRevenue, monthlyExpenses)
        : { anexo: activity === "comercio" ? "I" : "II" as SimplesAnexo, fatorR: null, hasEstimate: false };

      const monthlyTax = simplesEfetivoMensal(monthlyRevenue, annexInfo.anexo as SimplesAnexo);
      if (monthlyTax !== null) {
        const annual = monthlyRevenue * 12;
        const bracket = SIMPLES[annexInfo.anexo as SimplesAnexo].find((b) => annual <= b.ate);
        alternatives.push({
          regime: "simples",
          monthly: monthlyTax,
          label: `Simples Nacional — Anexo ${annexInfo.anexo} — efetivo ${((monthlyTax / monthlyRevenue) * 100).toFixed(2)}%`,
          notes: [
            `Alíquota ${((bracket?.aliquota ?? 0) * 100).toFixed(1)}% sobre RBA anual − dedução ${formatCurrency((bracket?.deducao ?? 0) / 12)}/mês`,
            activity === "servicos" && !annexInfo.hasEstimate ? "Fator R não calculado — Anexo V (conservador). Informe despesas para refinar." : "",
          ].filter(Boolean),
          conf: confidence(
            annexInfo.hasEstimate ? "moderate" : "low",
            annexInfo.hasEstimate ? 0.60 : 0.42,
            annexInfo.hasEstimate ? "Moderada" : "Baixa",
            "Simples Nacional calculado por tabelas da LC 123/2006.",
            ["Tabela oficial LC 123/2006"],
            hasCnae ? [] : ["CNAE não informado"],
          ),
          placeholders: hasCnae ? [] : ["activity-classification-heuristic"],
        });
      }
    }

    // Lucro Presumido
    if (regime !== "lucro_presumido") {
      const lp = calcLucroPresumido(monthlyRevenue, activity);
      alternatives.push({
        regime: "lucro_presumido",
        monthly: lp.total,
        label: `Lucro Presumido — efetivo ${(lp.effectiveRate * 100).toFixed(2)}%`,
        notes: [
          `IRPJ ${formatCurrency(lp.irpj)} + CSLL ${formatCurrency(lp.csll)} + PIS ${formatCurrency(lp.pis)} + COFINS ${formatCurrency(lp.cofins)}${activity === "servicos" ? ` + ISS ${formatCurrency(lp.iss)}` : ""}`,
          "INSS patronal (20% sobre folha) não incluído.",
        ],
        conf: confidence("moderate", 0.55, "Moderada", "Estimativa pelo RIR/2018 sem folha de salários.", ["RIR/2018"], ["INSS patronal não incluído"]),
        placeholders: [],
      });
    }

    return alternatives;
  }

  private buildNarrative(profile: TaxpayerProfile, activity: ActivityClass, savings: number, bestLabel?: string): string {
    const monthly = formatCurrency(profile.monthlyRevenue);
    const activityLabel = { servicos: "serviços", comercio: "comércio", industria: "indústria" }[activity];

    if (savings <= 0 || !bestLabel) {
      return `Para receita mensal de ${monthly} em ${activityLabel} no regime ${profile.regime}, a estimativa sugere que o regime atual pode ser o mais adequado com as informações disponíveis. Validar com contador.`;
    }

    return (
      `Para receita mensal de ${monthly} em ${activityLabel}, a simulação estima economia potencial de ` +
      `${formatCurrency(savings)}/mês (${formatCurrency(savings * 12)}/ano) migrando para: ${bestLabel}. ` +
      `Resultado orientativo — requer validação contábil antes de qualquer decisão.`
    );
  }

  private buildPremises(profile: TaxpayerProfile, activity: ActivityClass, hasCnae: boolean) {
    return [
      {
        id: "premise-revenue",
        label: "Receita mensal declarada",
        description: "Receita bruta mensal informada pelo usuário. Base de cálculo de todos os regimes.",
        kind: "declared_by_user" as const,
        value: profile.monthlyRevenue,
        sourceRefs: ["profile.monthlyRevenue"],
        confidence: confidence("moderate", 0.65, "Moderada", "Declaração direta do usuário sem comprovante nesta etapa.", ["Entrada manual revisada pelo usuário"]),
        explicitPlaceholder: false,
      },
      {
        id: "premise-regime",
        label: "Regime atual declarado",
        description: `Regime atual: ${profile.regime}. Usado para calcular carga atual e identificar alternativas.`,
        kind: "declared_by_user" as const,
        value: profile.regime,
        sourceRefs: ["profile.regime"],
        confidence: confidence("moderate", 0.60, "Moderada", "Regime declarado pelo usuário sem verificação na Receita Federal.", ["Entrada do onboarding"]),
        explicitPlaceholder: false,
      },
      {
        id: "premise-activity",
        label: "Classificação da atividade",
        description: `Atividade classificada como "${activity}"${hasCnae ? " via CNAE" : " por palavras-chave da descrição"}.`,
        kind: hasCnae ? ("declared_by_user" as const) : ("derived_locally" as const),
        value: activity,
        sourceRefs: ["profile.activityDescription", "profile.cnaeOrActivityCode"],
        confidence: confidence(
          hasCnae ? "moderate" : "low",
          hasCnae ? 0.70 : 0.40,
          hasCnae ? "Moderada" : "Baixa",
          hasCnae ? "CNAE confirma atividade diretamente." : "Classificação heurística — confirmar com CNAE oficial.",
          [hasCnae ? "CNAE informado" : "Heurística de palavras-chave aplicada"],
        ),
        explicitPlaceholder: !hasCnae,
      },
      ...(profile.monthlyExpenses && profile.monthlyExpenses > 0
        ? [{
            id: "premise-expenses",
            label: "Despesas mensais declaradas (proxy para Fator R)",
            description: `Despesas de ${formatCurrency(profile.monthlyExpenses)}/mês usadas como estimativa de folha para cálculo do Fator R.`,
            kind: "declared_by_user" as const,
            value: profile.monthlyExpenses,
            sourceRefs: ["profile.monthlyExpenses"],
            confidence: confidence("low", 0.38, "Baixa", "Despesas totais ≠ folha de salários. Fator R deve ser calculado com folha oficial.", ["Valor declarado pelo usuário"], ["Despesas ≠ folha de salários — Fator R aproximado"]),
            explicitPlaceholder: true,
          }]
        : []),
    ];
  }

  private buildRefusal(profile: TaxpayerProfile, missingData: DataGap[], now: string): SimulationResult {
    const refusalConf = confidence("very_low", 0.05, "Muito baixa", "Dados insuficientes para qualquer estimativa.", ["Guardrail de recusa acionado"], ["Campos obrigatórios ausentes"]);
    const refusalScenario = buildScenario("cenario-recusado", "Simulação não concluída", 0, ["Dados mínimos ausentes."], refusalConf, ["refusal-placeholder"]);

    return {
      id: `sim-refused-${profile.id}`,
      createdAt: now,
      profileId: profile.id,
      bundleId: this.bundle.id,
      bundleVersion: this.bundle.version,
      status: "refused",
      currentScenario: refusalScenario,
      summary: {
        estimatedSavings: 0,
        estimatedSavingsLabel: formatCurrency(0),
        narrative: "Simulação recusada por dados insuficientes. Preencha os campos obrigatórios e execute novamente.",
        decisionStatus: "refused",
        confidence: refusalConf,
      },
      audit: {
        premises: [],
        appliedRules: [{ ruleId: "guardrail-dados-minimos", title: "Recusa por dados insuficientes", status: "applied", reason: "Campos obrigatórios ausentes.", citations: [] }],
        missingData,
        warnings: [{ id: "alert-refusal", severity: "critical", title: "Dados insuficientes", message: "Preencha receita, regime e atividade.", code: "INSUFFICIENT_DATA", requiresHumanReview: true }],
        timeline: [
          { id: "evt-start", timestamp: now, kind: "simulation_started", message: "Simulação iniciada." },
          { id: "evt-refused", timestamp: now, kind: "insufficient_data", message: "Recusa por dados insuficientes.", refs: missingData.map((g) => g.field) },
          { id: "evt-finish", timestamp: now, kind: "simulation_finished", message: "Encerrado com recusa." },
        ],
      },
      refusal: {
        reasonCode: "INSUFFICIENT_DATA",
        message: "Preencha os campos obrigatórios (receita, regime, atividade) para gerar uma estimativa.",
        missingFields: missingData.map((g) => g.field),
        nextSteps: ["Preencher receita mensal.", "Informar regime atual.", "Descrever a atividade principal."],
      },
    };
  }
}

export const realTaxRuleEngine = new RealTaxRuleEngine();
