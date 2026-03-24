import type { ConfidenceLevel, DataGap, SimulationAlert, SimulationPremise, SimulationResult } from "@/models/domain";
import type { LocalExplainerCapability, LocalExplainerChatSession, LocalExplainerResponse } from "@/models/local-explainer";
import type { ExplanationContext } from "@/rag";

export interface ReportPremiseItem {
  id: string;
  label: string;
  description: string;
  valueLabel?: string;
  sourceRefs: string[];
  explicitPlaceholder: boolean;
}

export interface ReportConfidenceSection {
  level: ConfidenceLevel;
  label: string;
  score: number;
  rationale: string;
  drivers: string[];
  blockers: string[];
  reviewRecommendation?: string;
}

export interface ReportFooter {
  disclaimer: string;
  mockVersion: string;
  generatedAtLabel: string;
  localOnly: boolean;
}

export interface ReportExplanationSection {
  summary: string;
  explicitPlaceholder: boolean;
  evidenceCount: number;
  blocks: Array<{
    id: string;
    title: string;
    summary: string;
    explicitPlaceholder: boolean;
  }>;
  nextEvolutionNotes: string[];
}

export interface UserReport {
  id: string;
  simulationId: string;
  profileId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  localExplainerCapability?: LocalExplainerCapability;
  localExplainerResponse?: LocalExplainerResponse;
  localExplainerChat?: LocalExplainerChatSession;
  summary: {
    executive: string;
    estimatedSavingsLabel: string;
    decisionStatus: string;
    scenarioLabel: string;
  };
  premises: ReportPremiseItem[];
  confidence: ReportConfidenceSection;
  alerts: SimulationAlert[];
  gaps: DataGap[];
  explanationContext?: ExplanationContext;
  explanation?: ReportExplanationSection;
  footer: ReportFooter;
  export: {
    htmlFileName: string;
    printReady: boolean;
    placeholderPdf: boolean;
  };
  sourceSimulation: Pick<SimulationResult, "bundleId" | "bundleVersion" | "status">;
}

export interface PersistedUserReport {
  report: UserReport;
  renderedHtml: string;
}

export type ReportSourcePremise = Pick<SimulationPremise, "id" | "label" | "description" | "value" | "sourceRefs" | "explicitPlaceholder">;
