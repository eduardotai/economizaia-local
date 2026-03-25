import type { SimulationResult } from "@/models/domain";
import type { ExplanationContext, RetrievalStrategy } from "@/rag";

export type LocalExplainerProvider = "mock" | "webllm" | "disabled";
export type LocalExplainerMode = "light" | "ai";

export type LocalExplainerAvailability =
  | "unavailable"
  | "checking"
  | "ready_light"
  | "ready_placeholder"
  | "ready"
  | "degraded"
  | "error";

export type LocalExplainerReasonCode =
  | "WEBGPU_UNAVAILABLE"
  | "WEBLLM_NOT_CONFIGURED"
  | "MODEL_NOT_DOWNLOADED"
  | "MODEL_LOADING"
  | "PLACEHOLDER_MODE"
  | "LIGHT_MODE_ONLY"
  | "USER_ACTION_REQUIRED"
  | "LOCAL_ONLY_DISABLED"
  | "INSUFFICIENT_EVIDENCE"
  | "MISSING_LOCAL_CONTEXT"
  | "MISSING_HUMAN_REVIEW"
  | "UNKNOWN";

export interface LocalExplainerPromptContract {
  templateVersion: string;
  antiHallucinationPolicy: string[];
  scaffoldPrompt: string;
  closingRule: string;
  chainOfThoughtPolicy: "private_internal";
  ragContextPolicy: "future_local_rag_only";
  explicitPlaceholder: true;
}

export interface LocalExplainerCapability {
  provider: LocalExplainerProvider;
  mode: LocalExplainerMode;
  availability: LocalExplainerAvailability;
  canExplainReport: boolean;
  canExplainChat: boolean;
  canGenerateOnDemand: boolean;
  lazyLoadOnly: boolean;
  requiresModelDownload: boolean;
  requiresUserAction: boolean;
  explicitPlaceholder: boolean;
  supportsStreaming: boolean;
  supportedModes: LocalExplainerMode[];
  supportedStrategies: RetrievalStrategy[];
  primaryReasonCode: LocalExplainerReasonCode;
  activationLabel: string;
  statusLabel: string;
  detail: string;
  checkedAt: string;
}

export interface LocalExplainerRequest {
  simulation: Pick<SimulationResult, "id" | "summary" | "audit" | "currentScenario" | "status" | "bundleVersion">;
  reportId?: string;
  channel: "report" | "chat";
  mode: LocalExplainerMode;
  userPrompt?: string;
  explanationContext?: ExplanationContext;
}

export interface LocalExplainerEvidenceItem {
  id: string;
  title: string;
  summary: string;
  source: "retrieval_context" | "simulation_audit" | "placeholder_note";
  explicitPlaceholder: boolean;
}

export interface LocalExplainerEvidenceAnchor {
  bundleVersion: string;
  simulationStatus: string;
  retrievalEvidenceCount: number;
  retrievalBlockCount: number;
  warningCount: number;
  gapCount: number;
  evidenceIds: string[];
  explicitPlaceholder: boolean;
}

export interface LocalExplainerStructuredSection {
  heading: string;
  body: string[];
}

export interface LocalExplainerRefusal {
  code: "INSUFFICIENT_EVIDENCE" | "MISSING_LOCAL_CONTEXT" | "MISSING_HUMAN_REVIEW";
  title: string;
  message: string;
  missingItems: string[];
  requiredActions: string[];
  requiresHumanReview: boolean;
  explicitPlaceholder: true;
}

export interface LocalExplainerStatusSummary {
  modeLabel: string;
  providerLabel: string;
  readinessLabel: string;
  behaviorLabel: string;
  explicitPlaceholder: true;
}

export interface LocalExplainerResponse {
  id: string;
  createdAt: string;
  provider: LocalExplainerProvider;
  mode: LocalExplainerMode;
  availability: LocalExplainerAvailability;
  status: "idle" | "completed" | "partial" | "refused";
  title: string;
  summary: string;
  answer: string;
  sections: LocalExplainerStructuredSection[];
  disclaimer: string;
  promptContract: LocalExplainerPromptContract;
  evidence: LocalExplainerEvidenceItem[];
  evidenceAnchor: LocalExplainerEvidenceAnchor;
  capabilityStatus: LocalExplainerStatusSummary;
  refusal?: LocalExplainerRefusal;
  followUps: string[];
  explicitPlaceholder: boolean;
}

export interface LocalExplainerChatTurn {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  explicitPlaceholder: boolean;
}

export interface LocalExplainerChatSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  mode: LocalExplainerMode;
  capability: LocalExplainerCapability;
  turns: LocalExplainerChatTurn[];
  explicitPlaceholder: true;
}
