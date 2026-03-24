import type { SimulationResult, TaxpayerProfile } from "@/models/domain";
import type { TaxRuleEngine } from "@/engine/types";
import { formatCurrency } from "@/engine/types";
import { starterRuleBundle } from "@/engine/starter-rule-bundle";

class MockTaxRuleEngine implements TaxRuleEngine {
  bundle = starterRuleBundle;

  simulate(profile: TaxpayerProfile): SimulationResult {
    const currentMonthlyTax = profile.monthlyRevenue * 0.12;
    const suggestedMonthlyTax = profile.monthlyRevenue * 0.105;
    const estimatedSavings = Number((currentMonthlyTax - suggestedMonthlyTax).toFixed(2));

    return {
      id: `sim-${profile.id}`,
      createdAt: new Date().toISOString(),
      profileId: profile.id,
      currentScenario: {
        id: "cenario-atual-mock",
        label: "Cenário atual (mock)",
        monthlyTaxEstimate: currentMonthlyTax,
        notes: ["Estimativa fake para validar o fluxo do starter."],
      },
      suggestedScenario: {
        id: "cenario-sugerido-mock",
        label: "Cenário alternativo (mock)",
        monthlyTaxEstimate: suggestedMonthlyTax,
        notes: ["Comparação simulada local, sem caráter oficial."],
      },
      summary: {
        estimatedSavings,
        estimatedSavingsLabel: `${formatCurrency(estimatedSavings)}/mês`,
        narrative:
          "Resultado gerado por simulação local fake para comprovar a integração entre domínio, engine e UI. Antes de uso real, substitua por regras validadas por especialista fiscal.",
      },
      audit: {
        assumptions: [
          `Receita mensal informada: ${formatCurrency(profile.monthlyRevenue)}`,
          `Regime atual declarado: ${profile.regime}`,
          "Percentuais de comparação são placeholders técnicos.",
        ],
        appliedRules: this.bundle.rules.map((rule) => `${rule.title} [${rule.status}]`),
        missingData: [
          "Classificação tributária detalhada da atividade",
          "Dados oficiais de enquadramento e vigência normativa",
        ],
        warnings: [
          "Não use este cálculo como orientação fiscal oficial.",
          "Validação contábil é obrigatória antes de qualquer decisão real.",
        ],
      },
    };
  }
}

export const mockTaxRuleEngine = new MockTaxRuleEngine();