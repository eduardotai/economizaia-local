import type { IngestedDocument } from "@/models/documents";
import type { AuditTrailEntry, FiscalDocument, RuleBundle, SimulationResult, TaxpayerProfile } from "@/models/domain";

export type LocalStoreName =
  | "taxpayer_profiles"
  | "documents"
  | "ingestion_documents"
  | "simulations"
  | "simulation_results"
  | "rule_bundles"
  | "audit_events"
  | "snapshots";

export type PersistedEntityKind = "profile" | "document" | "ingestion_document" | "simulation" | "result" | "bundle" | "audit_event" | "system";

export interface PersistedRecordMetadata {
  savedAt: string;
  updatedAt: string;
  version: number;
  localOnly: true;
  schemaVersion: string;
}

export interface PersistedRecord<T> {
  id: string;
  kind: PersistedEntityKind;
  metadata: PersistedRecordMetadata;
  data: T;
}

export interface RepositoryListOptions<T> {
  sortBy?: (item: T) => string | number;
  direction?: "asc" | "desc";
}

export interface LocalSnapshot<TPayload = unknown> {
  id: string;
  scope: string;
  entityId?: string;
  createdAt: string;
  payload: TPayload;
  localOnly: true;
}

export interface LocalAuditEvent extends AuditTrailEntry {
  aggregateId: string;
  aggregateType: "profile" | "document" | "simulation" | "result" | "system";
  status: "info" | "warning" | "error";
}

export type ProfileRecord = PersistedRecord<TaxpayerProfile>;
export type DocumentRecord = PersistedRecord<FiscalDocument>;
export type IngestionDocumentRecord = PersistedRecord<IngestedDocument>;
export type SimulationRecord = PersistedRecord<SimulationResult>;
export type SimulationResultRecord = PersistedRecord<SimulationResult>;
export type RuleBundleRecord = PersistedRecord<RuleBundle>;
export type AuditEventRecord = PersistedRecord<LocalAuditEvent>;

export interface LocalPersistenceContract {
  profiles: {
    save(profile: TaxpayerProfile): Promise<ProfileRecord>;
    get(id: string): Promise<ProfileRecord | null>;
    list(): Promise<ProfileRecord[]>;
  };
  documents: {
    save(document: FiscalDocument): Promise<DocumentRecord>;
    get(id: string): Promise<DocumentRecord | null>;
    list(): Promise<DocumentRecord[]>;
  };
  ingestionDocuments: {
    save(document: IngestedDocument): Promise<IngestionDocumentRecord>;
    get(id: string): Promise<IngestionDocumentRecord | null>;
    list(): Promise<IngestionDocumentRecord[]>;
  };
  simulations: {
    save(simulation: SimulationResult): Promise<SimulationRecord>;
    get(id: string): Promise<SimulationRecord | null>;
    list(): Promise<SimulationRecord[]>;
  };
  results: {
    save(result: SimulationResult): Promise<SimulationResultRecord>;
    get(id: string): Promise<SimulationResultRecord | null>;
    list(): Promise<SimulationResultRecord[]>;
  };
  bundles: {
    save(bundle: RuleBundle): Promise<RuleBundleRecord>;
    get(id: string): Promise<RuleBundleRecord | null>;
    list(): Promise<RuleBundleRecord[]>;
  };
  audit: {
    append(event: LocalAuditEvent): Promise<AuditEventRecord>;
    list(): Promise<AuditEventRecord[]>;
    listByAggregate(aggregateId: string): Promise<AuditEventRecord[]>;
  };
  snapshots: {
    save<TPayload>(snapshot: LocalSnapshot<TPayload>): Promise<LocalSnapshot<TPayload>>;
    get<TPayload>(id: string): Promise<LocalSnapshot<TPayload> | null>;
    list<TPayload = unknown>(scope?: string): Promise<LocalSnapshot<TPayload>[]>;
  };
}
