import type { SimulationResult } from "@/models/domain";
import type { ExplanationContext, RetrievalStrategy } from "@/rag";

export type LocalExplainerProvider = "mock" | "webllm" | "disabled";

export type LocalExplainerAvailability =
  | "unavailable"
  | "checking"
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
  | "LOCAL_ONLY_DISABLED"
  | "UNKNOWN";

export interface LocalExplainerCapability {
  provider: LocalExplainerProvider;
  availability: LocalExplainerAvailability;
  canExplainReport: boolean;
  canExplainChat: boolean;
  requiresModelDownload: boolean;
  requiresUserAction: boolean;
  explicitPlaceholder: boolean;
  supportsStreaming: boolean;
  supportedStrategies: RetrievalStrategy[];
  primaryReasonCode: LocalExplainerReasonCode;
  statusLabel: string;
  detail: string;
  checkedAt: string;
}

export interface LocalExplainerRequest {
  simulation: Pick<SimulationResult, "id" | "summary" | "audit" | "currentScenario" | "status">;
  reportId?: string;
  channel: "report" | "chat";
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

export interface LocalExplainerResponse {
  id: string;
  createdAt: string;
  provider: LocalExplainerProvider;
  availability: LocalExplainerAvailability;
  status: "completed" | "partial" | "refused";
  title: string;
  summary: string;
  answer: string;
  disclaimer: string;
  evidence: LocalExplainerEvidenceItem[];
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
  capability: LocalExplainerCapability;
  turns: LocalExplainerChatTurn[];
  explicitPlaceholder: true;
}
