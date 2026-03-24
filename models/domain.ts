export type TaxRegime = "mei" | "simples" | "lucro_presumido" | "geral" | "indefinido";

export type ConfidenceLevel = "very_low" | "low" | "moderate" | "high" | "very_high";

export type RuleLifecycleStatus = "mock" | "placeholder" | "draft" | "review_required";

export type RuleOutcomeStatus = "applied" | "skipped" | "not_applicable" | "insufficient_data" | "refused";

export type RuleDecisionStatus = "completed" | "completed_with_gaps" | "insufficient_data" | "refused";

export type DataGapSeverity = "low" | "medium" | "high" | "blocking";

export type SimulationAlertSeverity = "info" | "warning" | "critical";

export type PremiseKind = "declared_by_user" | "derived_locally" | "placeholder" | "document_extracted" | "manual_review";

export type AuditEventKind =
  | "simulation_started"
  | "bundle_selected"
  | "profile_validated"
  | "premise_registered"
  | "rule_evaluated"
  | "alert_emitted"
  | "insufficient_data"
  | "simulation_finished";

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

export interface ConfidenceBand {
  level: ConfidenceLevel;
  score: number;
  label: string;
  rationale: string;
  drivers: string[];
  blockers?: string[];
  reviewRecommendation?: string;
}

export interface SimulationPremise {
  id: string;
  label: string;
  description: string;
  kind: PremiseKind;
  value?: string | number | boolean | null;
  sourceRefs: string[];
  confidence: ConfidenceBand;
  explicitPlaceholder: boolean;
}

export interface DataGap {
  id: string;
  field: string;
  label: string;
  description: string;
  severity: DataGapSeverity;
  blocking: boolean;
  whyItMatters: string;
  suggestedAction: string;
}

export interface SimulationAlert {
  id: string;
  severity: SimulationAlertSeverity;
  title: string;
  message: string;
  code: string;
  sourceRuleId?: string;
  requiresHumanReview: boolean;
}

export interface RuleCitation {
  sourceId: string;
  title: string;
  article?: string;
  excerpt?: string;
  note?: string;
  url?: string;
}

export interface RuleTemporalValidity {
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: "planned" | "active" | "expired" | "unknown";
}

export interface RuleJurisdiction {
  country: string;
  state?: string;
  city?: string;
  scope: "federal" | "state" | "municipal" | "cross_border" | "unknown";
}

export interface RuleDefinition {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: RuleLifecycleStatus;
  kind: "comparison" | "eligibility" | "classification" | "guardrail" | "explanation" | "unknown";
  requires: string[];
  tags: string[];
  jurisdiction: RuleJurisdiction;
  validity: RuleTemporalValidity;
  citations: RuleCitation[];
  fallbackPolicy: "refuse" | "insufficient_data" | "manual_review";
  notes?: string[];
}

export interface RuleBundleSource {
  id: string;
  type: "internal_doc" | "legal_text" | "technical_note" | "mock_reference";
  title: string;
  version?: string;
  url?: string;
  hash?: string;
  note?: string;
  validity?: RuleTemporalValidity;
}

export interface RuleBundle {
  id: string;
  version: string;
  schemaVersion: string;
  generatedAt: string;
  bundleStatus: "mock" | "draft" | "review_required";
  jurisdiction: RuleJurisdiction;
  disclaimer: string;
  assumptionsPolicy: string;
  refusalPolicy: string;
  maintainer: string;
  sources: RuleBundleSource[];
  rules: RuleDefinition[];
}

export interface SimulationScenario {
  id: string;
  label: string;
  monthlyTaxEstimate: number;
  annualTaxEstimate?: number;
  notes: string[];
  confidence: ConfidenceBand;
  placeholdersUsed: string[];
}

export interface AuditTrailEntry {
  id: string;
  timestamp: string;
  kind: AuditEventKind;
  message: string;
  refs?: string[];
  metadata?: Record<string, string | number | boolean | null>;
}

export interface RuleEvaluationRecord {
  ruleId: string;
  title: string;
  status: RuleOutcomeStatus;
  reason: string;
  citations: RuleCitation[];
}

export interface SimulationAuditTrail {
  premises: SimulationPremise[];
  appliedRules: RuleEvaluationRecord[];
  missingData: DataGap[];
  warnings: SimulationAlert[];
  timeline: AuditTrailEntry[];
}

export interface SimulationSummary {
  estimatedSavings: number;
  estimatedSavingsLabel: string;
  narrative: string;
  decisionStatus: RuleDecisionStatus;
  confidence: ConfidenceBand;
}

export interface SimulationRefusal {
  reasonCode: "INSUFFICIENT_DATA" | "MANUAL_REVIEW_REQUIRED";
  message: string;
  missingFields: string[];
  nextSteps: string[];
}

export interface SimulationResult {
  id: string;
  createdAt: string;
  profileId: string;
  bundleId: string;
  bundleVersion: string;
  status: "success" | "partial" | "refused";
  currentScenario: SimulationScenario;
  suggestedScenario?: SimulationScenario;
  summary: SimulationSummary;
  audit: SimulationAuditTrail;
  refusal?: SimulationRefusal;
}