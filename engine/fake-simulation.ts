import { mockTaxRuleEngine } from "@/engine/mock-tax-rule-engine";
import type { SimulationResult, TaxpayerProfile } from "@/models/domain";

const demoProfile: TaxpayerProfile = {
  id: "demo-profile",
  businessName: "Estúdio Local de Serviços",
  regime: "simples",
  monthlyRevenue: 18000,
  activityDescription: "Prestação de serviços recorrentes",
  city: "São Paulo",
  state: "SP",
};

export function runFakeSimulation(): SimulationResult {
  return mockTaxRuleEngine.simulate(demoProfile);
}