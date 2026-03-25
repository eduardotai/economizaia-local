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
    suggestedAction: "Coletar, revisar manualmente e confirmar a informação antes de concluir a análise.",
  };
}

function buildRefusalScenario(profileId: string): SimulationScenario {
  return {
    id: `scenario-refused-${profileId}`,
    label: "Simulação não concluída (protótipo local)",
    monthlyTaxEstimate: 0,
    annualTaxEstimate: 0,
    notes: ["Placeholder técnico para representar recusa conservadora do MVP por dados insuficientes ou revisão pendente."],
    confidence: buildConfidenceBand({
      level: "very_low",
      score: 0.08,
      label: "Muito baixa",
      rationale: "Dados essenciais ausentes ou revisão pendente impedem qualquer simulação confiável neste protótipo local.",
      drivers: ["Guardrail conservador do MVP acionado"],
      blockers: ["Campos obrigatórios ausentes ou não revisados"],
      reviewRecommendation: "Solicitar revisão humana/local antes de seguir.",
    }),
    placeholdersUsed: ["mvp-refusal-placeholder"],
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
      rationale: "Simulação propositalmente artificial e local, útil para validar fluxo e auditoria, mas não para decisão fiscal real.",
      drivers: ["Receita mensal declarada", "Regime informado", "Comparação determinística local e prototípica"],
      blockers: ["Ausência de regra normativa oficial", "Dependência de placeholders de demo"],
      reviewRecommendation: "Usar somente para testes internos, demonstração controlada e validação de UX.",
    }),
    placeholdersUsed: ["prototype-comparison-rate-placeholder", "prototype-regime-evaluation-placeholder"],
  };
}

class MockTaxRuleEngine implements TaxRuleEngine {
  bundle = starterRuleBundle;

  simulate(profile: TaxpayerProfile): SimulationResult {
    const now = new Date().toISOString();
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

    const reviewRequiredRule = this.bundle.rules.find((rule) => rule.id === "guardrail-manual-review-required");
    const refusalRule = this.bundle.rules.find((rule) => rule.id === "guardrail-insufficient-data");
    const comparisonRule = this.bundle.rules.find((rule) => rule.id === "prototype-local-scenario-comparison") as
      | RuleDefinition
      | undefined;

    if (missingData.some((gap) => gap.blocking)) {
      const refusalScenario = buildRefusalScenario(profile.id);
      const alert: SimulationAlert = {
        id: "alert-insufficient-data",
        severity: "critical",
        title: "Dados insuficientes para concluir a análise",
        message: "O motor local de protótipo recusou a conclusão para evitar um resultado com falsa aparência oficial.",
        code: "INSUFFICIENT_DATA",
        sourceRuleId: refusalRule?.id,
        requiresHumanReview: true,
      };

      const reviewPendingAlert: SimulationAlert = {
        id: "alert-review-pending",
        severity: "warning",
        title: "Revisão humana/local continua obrigatória",
        message: "Mesmo após preencher os campos, este bundle MVP segue exigindo revisão humana antes de qualquer uso real.",
        code: "MANUAL_REVIEW_REQUIRED",
        sourceRuleId: reviewRequiredRule?.id,
        requiresHumanReview: true,
      };

      const summary: SimulationSummary = {
        estimatedSavings: 0,
        estimatedSavingsLabel: formatCurrency(0),
        narrative:
          "Simulação recusada pelo guardrail conservador do MVP. O objetivo é demonstrar recusa explícita quando faltam dados essenciais ou quando ainda há necessidade de revisão humana.",
        decisionStatus: "refused",
        confidence: refusalScenario.confidence,
      };

      return {
        id: `sim-${profile.id}`,
        createdAt: now,
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
              title: refusalRule?.title ?? "Recusa por insuficiência de dados mínimos",
              status: "refused",
              reason: "Campos mínimos ausentes bloquearam a simulação no recorte conservador do MVP.",
              citations: refusalRule?.citations ?? [],
            },
            {
              ruleId: reviewRequiredRule?.id ?? "guardrail-manual-review-required",
              title: reviewRequiredRule?.title ?? "Recusa por revisão humana pendente",
              status: "insufficient_data",
              reason: "Mesmo no modo local, o bundle mantém revisão humana como exigência explícita de governança.",
              citations: reviewRequiredRule?.citations ?? [],
            },
          ],
          missingData,
          warnings: [alert, reviewPendingAlert],
          timeline: [
            {
              id: "evt-start",
              timestamp: now,
              kind: "simulation_started",
              message: "Simulação do bundle MVP local iniciada.",
            },
            {
              id: "evt-bundle",
              timestamp: now,
              kind: "bundle_selected",
              message: `Bundle ${this.bundle.id}@${this.bundle.version} selecionado.`,
              refs: [this.bundle.id],
              metadata: {
                approvalStatus: this.bundle.approvalStatus,
                reviewedBy: this.bundle.reviewedBy,
                reviewedAt: this.bundle.reviewedAt ?? null,
              },
            },
            {
              id: "evt-insufficient-data",
              timestamp: now,
              kind: "insufficient_data",
              message: "Guardrail conservador acionado por insuficiência de dados no MVP local.",
              refs: missingData.map((gap) => gap.field),
            },
            {
              id: "evt-finished",
              timestamp: now,
              kind: "simulation_finished",
              message: "Simulação encerrada com recusa explícita de protótipo/local.",
            },
          ],
        },
        refusal: {
          reasonCode: "INSUFFICIENT_DATA",
          message:
            "A simulação foi recusada pelo bundle MVP local porque faltam dados mínimos para um resultado auditável e o protótipo não deve fingir cobertura tributária completa.",
          missingFields: missingData.map((gap) => gap.field),
          nextSteps: [
            "Preencher os campos obrigatórios ausentes.",
            "Revisar manualmente a jurisdição, a atividade e o enquadramento informado.",
            "Executar nova simulação apenas como demo local, nunca como orientação fiscal oficial.",
          ],
        },
      };
    }

    const currentMonthlyTax = profile.monthlyRevenue * 0.12;
    const suggestedMonthlyTax = profile.monthlyRevenue * 0.105;
    const estimatedSavings = Number((currentMonthlyTax - suggestedMonthlyTax).toFixed(2));

    return {
      id: `sim-${profile.id}`,
      createdAt: now,
      profileId: profile.id,
      bundleId: this.bundle.id,
      bundleVersion: this.bundle.version,
      status: "partial",
      currentScenario: buildSuccessfulScenario(
        "cenario-atual-prototype-local",
        "Cenário atual (protótipo local)",
        currentMonthlyTax,
        "Estimativa artificial de demo para validar o fluxo do MVP local.",
      ),
      suggestedScenario: buildSuccessfulScenario(
        "cenario-sugerido-prototype-local",
        "Cenário alternativo (protótipo local)",
        suggestedMonthlyTax,
        "Comparação simulada local e auditável, sem caráter oficial.",
      ),
      summary: {
        estimatedSavings,
        estimatedSavingsLabel: `${formatCurrency(estimatedSavings)}/mês`,
        narrative:
          "Resultado gerado por bundle MVP local/protótipo para demonstrar integração entre domínio, engine, auditoria e UI. Não representa regra fiscal oficial e exige revisão humana antes de qualquer decisão real.",
        decisionStatus: "completed_with_gaps",
        confidence: buildConfidenceBand({
          level: "low",
          score: 0.36,
          label: "Baixa",
          rationale: "A saída é útil para testes de contrato e trilha auditável, mas depende de percentuais demo e recorte estreito do MVP.",
          drivers: ["Bundle versionado e auditável", "Metadados explícitos de revisão", "Premissas e guardrails visíveis"],
          blockers: ["Sem base normativa oficial consolidada", "Comparação artificial de demo"],
          reviewRecommendation: "Não usar em produção regulatória; exigir validação especializada.",
        }),
      },
      audit: {
        premises: [
          {
            id: "premise-monthly-revenue",
            label: "Receita mensal declarada",
            description: "Receita mensal informada pelo usuário ao iniciar a simulação demo.",
            kind: "declared_by_user",
            value: profile.monthlyRevenue,
            sourceRefs: ["profile.monthlyRevenue"],
            confidence: buildConfidenceBand({
              level: "moderate",
              score: 0.6,
              label: "Moderada",
              rationale: "Depende de declaração manual do usuário, sem documento comprobatório neste protótipo.",
              drivers: [`Valor informado: ${formatCurrency(profile.monthlyRevenue)}`],
            }),
            explicitPlaceholder: false,
          },
          {
            id: "premise-current-regime",
            label: "Regime atual declarado",
            description: "Regime informado pelo usuário; não há conferência normativa automática nesta versão local.",
            kind: "declared_by_user",
            value: profile.regime,
            sourceRefs: ["profile.regime"],
            confidence: buildConfidenceBand({
              level: "moderate",
              score: 0.55,
              label: "Moderada",
              rationale: "Informação declarada, ainda sem verificação documental ou normativa.",
              drivers: [`Regime declarado: ${profile.regime}`],
            }),
            explicitPlaceholder: false,
          },
          {
            id: "premise-bundle-scope",
            label: "Recorte estreito do bundle MVP",
            description: "Este bundle cobre apenas uma demonstração artificial local com revisão humana obrigatória.",
            kind: "manual_review",
            value: "mvp-local-prototype-scope",
            sourceRefs: ["engine/starter-rule-bundle.ts"],
            confidence: buildConfidenceBand({
              level: "high",
              score: 0.85,
              label: "Alta",
              rationale: "Premissa explicitamente definida no próprio bundle versionado.",
              drivers: ["Metadados e disclaimer do bundle"],
            }),
            explicitPlaceholder: false,
          },
          {
            id: "premise-comparison-rate",
            label: "Percentuais comparativos demo",
            description: "Percentuais fixos artificiais usados apenas para demonstrar o contrato do motor e a auditoria local.",
            kind: "placeholder",
            value: "12% vs 10,5%",
            sourceRefs: ["engine/mock-tax-rule-engine.ts", "engine/starter-rule-bundle.ts"],
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
            ruleId: comparisonRule?.id ?? "prototype-local-scenario-comparison",
            title: comparisonRule?.title ?? "Comparação artificial de cenários locais",
            status: "applied",
            reason: "Regra de demo aplicada para comparar dois cenários artificiais e exercitar a auditoria do MVP local.",
            citations: comparisonRule?.citations ?? [],
          },
          {
            ruleId: reviewRequiredRule?.id ?? "guardrail-manual-review-required",
            title: reviewRequiredRule?.title ?? "Recusa por revisão humana pendente",
            status: "applied",
            reason: "A simulação prossegue apenas como demonstração local e continua marcada como dependente de revisão humana.",
            citations: reviewRequiredRule?.citations ?? [],
          },
        ],
        missingData: [
          buildGap(
            "officialNormativeBasis",
            "Base normativa oficial consolidada",
            "Este bundle MVP não possui pacote normativo oficial revisado por especialista; cobre apenas demo local auditável.",
            false,
          ),
          buildGap(
            "activityTaxClassification",
            "Classificação tributária detalhada da atividade",
            "A atividade ainda não foi mapeada em taxonomia fiscal estruturada dentro do recorte estreito do MVP.",
            false,
          ),
        ],
        warnings: [
          {
            id: "alert-prototype-local",
            severity: "critical",
            title: "Protótipo local sem valor oficial",
            message: "Não use este cálculo como orientação fiscal oficial; trata-se de demo local auditável.",
            code: "NON_OFFICIAL_PROTOTYPE_RESULT",
            requiresHumanReview: true,
          },
          {
            id: "alert-review-required",
            severity: "warning",
            title: "Validação humana obrigatória",
            message: "Validação contábil/humana permanece obrigatória antes de qualquer decisão real.",
            code: "HUMAN_REVIEW_REQUIRED",
            sourceRuleId: reviewRequiredRule?.id,
            requiresHumanReview: true,
          },
        ],
        timeline: [
          {
            id: "evt-start",
            timestamp: now,
            kind: "simulation_started",
            message: "Simulação do bundle MVP local iniciada.",
          },
          {
            id: "evt-bundle",
            timestamp: now,
            kind: "bundle_selected",
            message: `Bundle ${this.bundle.id}@${this.bundle.version} selecionado.`,
            refs: [this.bundle.id],
            metadata: {
              approvalStatus: this.bundle.approvalStatus,
              reviewedBy: this.bundle.reviewedBy,
              reviewedAt: this.bundle.reviewedAt ?? null,
            },
          },
          {
            id: "evt-premise-1",
            timestamp: now,
            kind: "premise_registered",
            message: "Premissas declaradas, guardrails e placeholders de demo registrados para auditoria.",
          },
          {
            id: "evt-rule",
            timestamp: now,
            kind: "rule_evaluated",
            message: "Regra de comparação artificial do MVP local executada.",
            refs: [comparisonRule?.id ?? "prototype-local-scenario-comparison"],
          },
          {
            id: "evt-warning",
            timestamp: now,
            kind: "alert_emitted",
            message: "Alertas de protótipo/local e revisão humana emitidos.",
          },
          {
            id: "evt-finished",
            timestamp: now,
            kind: "simulation_finished",
            message: "Simulação encerrada com resultado parcial auditável de demo local.",
          },
        ],
      },
    };
  }
}

export const mockTaxRuleEngine = new MockTaxRuleEngine();
