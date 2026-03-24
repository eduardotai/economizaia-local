export type TaxRegime = "mei" | "simples" | "lucro_presumido" | "geral" | "indefinido";

export interface TaxpayerProfile {
  id: string;
  businessName: string;
  documentId?: string;
  regime: TaxRegime;
  monthlyRevenue: number;
  activityDescription: string;
  city?: string;
  state?: string;
  notes?: string[];
}

export interface FiscalDocument {
  id: string;
  name: string;
  kind: "pdf" | "image" | "xml" | "manual";
  status: "pending" | "processed" | "review_required";
  extractedText?: string;
  confidence?: number;
  createdAt: string;
}

export interface RuleCitation {
  sourceId: string;
  title: string;
  article?: string;
  note?: string;
}

export interface RuleDefinition {
  id: string;
  title: string;
  description: string;
  status: "mock" | "placeholder" | "draft";
  requires: string[];
  citations: RuleCitation[];
}

export interface RuleBundle {
  id: string;
  version: string;
  generatedAt: string;
  disclaimer: string;
  rules: RuleDefinition[];
}

export interface SimulationScenario {
  id: string;
  label: string;
  monthlyTaxEstimate: number;
  notes: string[];
}

export interface SimulationAuditTrail {
  assumptions: string[];
  appliedRules: string[];
  missingData: string[];
  warnings: string[];
}

export interface SimulationResult {
  id: string;
  createdAt: string;
  profileId: string;
  currentScenario: SimulationScenario;
  suggestedScenario: SimulationScenario;
  summary: {
    estimatedSavings: number;
    estimatedSavingsLabel: string;
    narrative: string;
  };
  audit: SimulationAuditTrail;
}