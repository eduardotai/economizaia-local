import type { RuleBundle, SimulationResult, TaxpayerProfile } from "@/models/domain";

export interface TaxRuleEngine {
  bundle: RuleBundle;
  simulate(profile: TaxpayerProfile): SimulationResult;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}
