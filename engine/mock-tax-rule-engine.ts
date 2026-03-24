import type {
  ConfidenceBand,
  DataGap,
  RuleDefinition,
  SimulationAlert,
  SimulationResult,
  SimulationScenario,
  SimulationSummary,
  TaxpayerProfile,
} from "@/models/domain";
import type { TaxRuleEngine } from "@/engine/types";
import { formatCurrency } from "@/engine/types";
import { starterRuleBundle } from "@/engine/starter-rule-bundle";

function buildConfidenceBand(input: {
  level: ConfidenceBand["level"];
  score: number;
  label: string;
  rationale: string;
  drivers: string[];
  blockers?: string[];
  reviewRecommendation?: string;
}): ConfidenceBand {
  return input;
}

function buildGap(field: string, label: string, description: string, blocking = true): DataGap {
  return {
    id: `gap-${field}`,
    field,
    label,
    description,
    severity: blocking ? "blocking" : "medium",
    blocking,
    whyItMatters: "Sem esse dado, o motor não consegue sustentar um cenário auditável com segurança.",
    suggestedAction: "Coletar ou revisar manualmente a informação antes de concluir a análise.",
  };
}

function buildRefusalScenario(profileId: string): SimulationScenario {
  return {
    id: `scenario-refused-${profileId}`,
    label: "Simulação não concluída (mock)",
    monthlyTaxEstimate: 0,
    annualTaxEstimate: 0,
    notes: ["Placeholder técnico para representar recusa por dados insuficientes."],
    confidence: buildConfidenceBand({
      level: "very_low",
      score: 0.08,
      label: "Muito baixa",
      rationale: "Dados essenciais ausentes impedem qualquer simulação confiável.",
      drivers: ["Guardrail de insuficiência de dados acionado"],
      blockers: ["Campos obrigatórios ausentes"],
      reviewRecommendation: "Solicitar revisão humana antes de seguir.",
    }),
    placeholdersUsed: ["refusal-scenario-placeholder"],
  };
}

function buildSuccessfulScenario(
  id: string,
  label: string,
  monthlyTaxEstimate: number,
  narrative: string,
): SimulationScenario {
  return {
    id,
    label,
    monthlyTaxEstimate,
    annualTaxEstimate: Number((monthlyTaxEstimate * 12).toFixed(2)),
    notes: [narrative],
    confidence: buildConfidenceBand({
      level: "low",
      score: 0.34,
      label: "Baixa",
      rationale: "Simulação propositalmente mock, útil para testar fluxo mas não para decisão fiscal real.",
      drivers: ["Receita mensal declarada", "Regime informado", "Comparação determinística local"],
      blockers: ["Ausência de regra normativa oficial", "Dependência de placeholders"],
      reviewRecommendation: "Usar somente para testes e demonstrações internas.",
    }),
    placeholdersUsed: ["comparison-rate-placeholder", "regime-evaluation-placeholder"],
  };
}

class MockTaxRuleEngine implements TaxRuleEngine {
  bundle = starterRuleBundle;

  simulate(profile: TaxpayerProfile): SimulationResult {
    const missingData: DataGap[] = [];

    if (!profile.activityDescription?.trim()) {
      missingData.push(buildGap("activityDescription", "Descrição da atividade", "A atividade declarada está vazia."));
    }

    if (!profile.state?.trim()) {
      missingData.push(buildGap("state", "UF", "A jurisdição estadual não foi informada."));
    }

    if (!Number.isFinite(profile.monthlyRevenue) || profile.monthlyRevenue <= 0) {
      missingData.push(buildGap("monthlyRevenue", "Receita mensal", "Receita mensal ausente, inválida ou não positiva."));
    }

    const refusalRule = this.bundle.rules.find((rule) => rule.id === "guardrail-insufficient-data");

    if (missingData.some((gap) => gap.blocking)) {
      const refusalScenario = buildRefusalScenario(profile.id);
      const alert: SimulationAlert = {
        id: "alert-insufficient-data",
        severity: "critical",
        title: "Dados insuficientes para concluir a análise",
        message: "O motor mock recusou a conclusão para evitar um resultado com falsa aparência oficial.",
        code: "INSUFFICIENT_DATA",
        sourceRuleId: refusalRule?.id,
        requiresHumanReview: true,
      };

      const summary: SimulationSummary = {
        estimatedSavings: 0,
        estimatedSavingsLabel: formatCurrency(0),
        narrative:
          "Simulação recusada pelo guardrail mock. O objetivo é demonstrar um comportamento conservador quando faltam dados essenciais.",
        decisionStatus: "refused",
        confidence: refusalScenario.confidence,
      };

      return {
        id: `sim-${profile.id}`,
        createdAt: new Date().toISOString(),
        profileId: profile.id,
        bundleId: this.bundle.id,
        bundleVersion: this.bundle.version,
        status: "refused",
        currentScenario: refusalScenario,
        summary,
        audit: {
          premises: [
            {
              id: "premise-profile-id",
              label: "Identificador do perfil",
              description: "Perfil recebido pelo motor local.",
              kind: "derived_locally",
              value: profile.id,
              sourceRefs: ["profile.id"],
              confidence: buildConfidenceBand({
                level: "high",
                score: 0.9,
                label: "Alta",
                rationale: "Campo técnico gerado e rastreável localmente.",
                drivers: ["Identificador recebido na entrada"],
              }),
              explicitPlaceholder: false,
            },
          ],
          appliedRules: [
            {
              ruleId: refusalRule?.id ?? "guardrail-insufficient-data",
              title: refusalRule?.title ?? "Recusa mock por insuficiência de dados",
              status: "refused",
              reason: "Campos mínimos ausentes bloquearam a simulação.",
              citations: refusalRule?.citations ?? [],
            },
          ],
          missingData,
          warnings: [alert],
          timeline: [
            {
              id: "evt-start",
              timestamp: new Date().toISOString(),
              kind: "simulation_started",
              message: "Simulação mock iniciada.",
            },
            {
              id: "evt-bundle",
              timestamp: new Date().toISOString(),
              kind: "bundle_selected",
              message: `Bundle ${this.bundle.id}@${this.bundle.version} selecionado.`,
              refs: [this.bundle.id],
            },
            {
              id: "evt-insufficient-data",
              timestamp: new Date().toISOString(),
              kind: "insufficient_data",
              message: "Guardrail mock acionado por insuficiência de dados.",
              refs: missingData.map((gap) => gap.field),
            },
            {
              id: "evt-finished",
              timestamp: new Date().toISOString(),
              kind: "simulation_finished",
              message: "Simulação encerrada com recusa mock.",
            },
          ],
        },
        refusal: {
          reasonCode: "INSUFFICIENT_DATA",
          message: "A simulação foi recusada pelo motor mock porque faltam dados mínimos para um resultado auditável.",
          missingFields: missingData.map((gap) => gap.field),
          nextSteps: [
            "Preencher os campos obrigatórios ausentes.",
            "Revisar manualmente a jurisdição e a descrição da atividade.",
            "Executar nova simulação somente após complementar os dados.",
          ],
        },
      };
    }

    const currentMonthlyTax = profile.monthlyRevenue * 0.12;
    const suggestedMonthlyTax = profile.monthlyRevenue * 0.105;
    const estimatedSavings = Number((currentMonthlyTax - suggestedMonthlyTax).toFixed(2));
    const comparisonRule = this.bundle.rules.find((rule) => rule.id === "placeholder-regime-comparison") as
      | RuleDefinition
      | undefined;

    return {
      id: `sim-${profile.id}`,
      createdAt: new Date().toISOString(),
      profileId: profile.id,
      bundleId: this.bundle.id,
      bundleVersion: this.bundle.version,
      status: "partial",
      currentScenario: buildSuccessfulScenario(
        "cenario-atual-mock",
        "Cenário atual (mock)",
        currentMonthlyTax,
        "Estimativa fake para validar o fluxo do starter.",
      ),
      suggestedScenario: buildSuccessfulScenario(
        "cenario-sugerido-mock",
        "Cenário alternativo (mock)",
        suggestedMonthlyTax,
        "Comparação simulada local, sem caráter oficial.",
      ),
      summary: {
        estimatedSavings,
        estimatedSavingsLabel: `${formatCurrency(estimatedSavings)}/mês`,
        narrative:
          "Resultado gerado por simulação local fake para comprovar a integração entre domínio, engine e UI. Antes de uso real, substitua por regras validadas por especialista fiscal.",
        decisionStatus: "completed_with_gaps",
        confidence: buildConfidenceBand({
          level: "low",
          score: 0.36,
          label: "Baixa",
          rationale: "A saída é útil para testes de contrato, mas depende de premissas placeholder e não expressa regra oficial.",
          drivers: ["Bundle versionado", "Premissas explícitas", "Trilha auditável"],
          blockers: ["Sem base normativa oficial consolidada"],
          reviewRecommendation: "Não usar em produção regulatória sem revisão especializada.",
        }),
      },
      audit: {
        premises: [
          {
            id: "premise-monthly-revenue",
            label: "Receita mensal declarada",
            description: "Receita mensal informada pelo usuário ao iniciar a simulação.",
            kind: "declared_by_user",
            value: profile.monthlyRevenue,
            sourceRefs: ["profile.monthlyRevenue"],
            confidence: buildConfidenceBand({
              level: "moderate",
              score: 0.6,
              label: "Moderada",
              rationale: "Depende de declaração manual do usuário, sem documento comprobatório neste starter.",
              drivers: [`Valor informado: ${formatCurrency(profile.monthlyRevenue)}`],
            }),
            explicitPlaceholder: false,
          },
          {
            id: "premise-current-regime",
            label: "Regime atual declarado",
            description: "Regime informado pelo usuário; não há conferência normativa automática nesta versão.",
            kind: "declared_by_user",
            value: profile.regime,
            sourceRefs: ["profile.regime"],
            confidence: buildConfidenceBand({
              level: "moderate",
              score: 0.55,
              label: "Moderada",
              rationale: "Informação declarada, ainda sem verificação documental.",
              drivers: [`Regime declarado: ${profile.regime}`],
            }),
            explicitPlaceholder: false,
          },
          {
            id: "premise-comparison-rate",
            label: "Percentuais comparativos placeholder",
            description: "Percentuais fixos usados apenas para demonstrar o contrato do motor.",
            kind: "placeholder",
            value: "12% vs 10,5%",
            sourceRefs: ["engine/mock-tax-rule-engine.ts"],
            confidence: buildConfidenceBand({
              level: "very_low",
              score: 0.1,
              label: "Muito baixa",
              rationale: "Placeholder técnico explícito, sem respaldo tributário oficial.",
              drivers: ["Exemplo determinístico para testes locais"],
              blockers: ["Não representa regra fiscal real"],
            }),
            explicitPlaceholder: true,
          },
        ],
        appliedRules: [
          {
            ruleId: comparisonRule?.id ?? "placeholder-regime-comparison",
            title: comparisonRule?.title ?? "Comparação inicial de cenários",
            status: "applied",
            reason: "Regra mock aplicada para comparar dois cenários artificiais e exercitar a auditoria.",
            citations: comparisonRule?.citations ?? [],
          },
        ],
        missingData: [
          buildGap(
            "officialNormativeBasis",
            "Base normativa oficial consolidada",
            "Este starter ainda não possui pacote normativo revisado por especialista.",
            false,
          ),
          buildGap(
            "activityTaxClassification",
            "Classificação tributária detalhada da atividade",
            "A atividade ainda não foi mapeada em taxonomia fiscal estruturada.",
            false,
          ),
        ],
        warnings: [
          {
            id: "alert-non-official",
            severity: "critical",
            title: "Sem valor oficial",
            message: "Não use este cálculo como orientação fiscal oficial.",
            code: "NON_OFFICIAL_RESULT",
            requiresHumanReview: true,
          },
          {
            id: "alert-review-required",
            severity: "warning",
            title: "Validação humana obrigatória",
            message: "Validação contábil é obrigatória antes de qualquer decisão real.",
            code: "HUMAN_REVIEW_REQUIRED",
            requiresHumanReview: true,
          },
        ],
        timeline: [
          {
            id: "evt-start",
            timestamp: new Date().toISOString(),
            kind: "simulation_started",
            message: "Simulação mock iniciada.",
          },
          {
            id: "evt-bundle",
            timestamp: new Date().toISOString(),
            kind: "bundle_selected",
            message: `Bundle ${this.bundle.id}@${this.bundle.version} selecionado.`,
            refs: [this.bundle.id],
          },
          {
            id: "evt-premise-1",
            timestamp: new Date().toISOString(),
            kind: "premise_registered",
            message: "Premissas declaradas e placeholders registrados para auditoria.",
          },
          {
            id: "evt-rule",
            timestamp: new Date().toISOString(),
            kind: "rule_evaluated",
            message: "Regra mock de comparação executada.",
            refs: [comparisonRule?.id ?? "placeholder-regime-comparison"],
          },
          {
            id: "evt-warning",
            timestamp: new Date().toISOString(),
            kind: "alert_emitted",
            message: "Alertas de não-oficialidade e revisão humana emitidos.",
          },
          {
            id: "evt-finished",
            timestamp: new Date().toISOString(),
            kind: "simulation_finished",
            message: "Simulação encerrada com resultado parcial auditável.",
          },
        ],
      },
    };
  }
}

export const mockTaxRuleEngine = new MockTaxRuleEngine();
