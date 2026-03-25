import localforage from "localforage";
import type { IngestedDocument } from "@/models/documents";
import type { FiscalDocument, RuleBundle, SimulationResult, TaxpayerProfile } from "@/models/domain";
import type { AnonymousOnboardingProfile } from "@/models/onboarding";
import type { PersistedUserReport } from "@/models/report";
import type {
  AuditEventRecord,
  DocumentRecord,
  IngestionDocumentRecord,
  LocalAuditEvent,
  LocalPersistenceContract,
  LocalSnapshot,
  PersistedEntityKind,
  PersistedRecord,
  ProfileRecord,
  RepositoryListOptions,
  RuleBundleRecord,
  SimulationRecord,
  SimulationResultRecord,
  UserReportRecord,
} from "@/db/persistence-types";

const DATABASE_NAME = "economizaia-local";
const SCHEMA_VERSION = "local-persistence-v1";

const profileStore = localforage.createInstance({ name: DATABASE_NAME, storeName: "taxpayer_profiles" });
const documentStore = localforage.createInstance({ name: DATABASE_NAME, storeName: "documents" });
const ingestionDocumentStore = localforage.createInstance({ name: DATABASE_NAME, storeName: "ingestion_documents" });
const simulationStore = localforage.createInstance({ name: DATABASE_NAME, storeName: "simulations" });
const resultStore = localforage.createInstance({ name: DATABASE_NAME, storeName: "simulation_results" });
const bundleStore = localforage.createInstance({ name: DATABASE_NAME, storeName: "rule_bundles" });
const reportStore = localforage.createInstance({ name: DATABASE_NAME, storeName: "user_reports" });
const auditStore = localforage.createInstance({ name: DATABASE_NAME, storeName: "audit_events" });
const snapshotStore = localforage.createInstance({ name: DATABASE_NAME, storeName: "snapshots" });
const onboardingStore = localforage.createInstance({ name: DATABASE_NAME, storeName: "anonymous_onboarding" });

function isPersistedRecord<T>(value: unknown): value is PersistedRecord<T> {
  return Boolean(value) && typeof value === "object" && "data" in (value as Record<string, unknown>) && "metadata" in (value as Record<string, unknown>);
}

function wrapRecord<T>(kind: PersistedEntityKind, id: string, data: T, previous?: PersistedRecord<T> | null): PersistedRecord<T> {
  const now = new Date().toISOString();

  return {
    id,
    kind,
    data,
    metadata: {
      savedAt: previous?.metadata.savedAt ?? now,
      updatedAt: now,
      version: (previous?.metadata.version ?? 0) + 1,
      localOnly: true,
      schemaVersion: SCHEMA_VERSION,
    },
  };
}

async function getRecord<T>(store: LocalForage, id: string): Promise<PersistedRecord<T> | null> {
  const raw = await store.getItem<PersistedRecord<T> | T>(id);

  if (!raw) {
    return null;
  }

  if (isPersistedRecord<T>(raw)) {
    return raw;
  }

  return wrapRecord("system", id, raw as T);
}

async function saveRecord<T>(store: LocalForage, kind: PersistedEntityKind, id: string, data: T): Promise<PersistedRecord<T>> {
  const previous = await getRecord<T>(store, id);
  const wrapped = wrapRecord(kind, id, data, previous);
  await store.setItem(id, wrapped);
  return wrapped;
}

async function listRecords<T>(store: LocalForage, options?: RepositoryListOptions<PersistedRecord<T>>): Promise<PersistedRecord<T>[]> {
  const items: PersistedRecord<T>[] = [];

  await store.iterate<PersistedRecord<T> | T, void>((value, key) => {
    if (isPersistedRecord<T>(value)) {
      items.push(value);
      return;
    }

    items.push(wrapRecord("system", String(key), value as T));
  });

  const sortBy = options?.sortBy ?? ((item: PersistedRecord<T>) => item.metadata.updatedAt);
  const direction = options?.direction ?? "desc";

  return items.sort((left, right) => {
    const leftValue = sortBy(left);
    const rightValue = sortBy(right);

    if (leftValue === rightValue) {
      return 0;
    }

    if (direction === "asc") {
      return leftValue > rightValue ? 1 : -1;
    }

    return leftValue < rightValue ? 1 : -1;
  });
}

async function saveSnapshot<TPayload>(snapshot: LocalSnapshot<TPayload>) {
  await snapshotStore.setItem(snapshot.id, snapshot);
  return snapshot;
}

async function getSnapshot<TPayload>(id: string) {
  return (await snapshotStore.getItem<LocalSnapshot<TPayload>>(id)) ?? null;
}

async function listSnapshots<TPayload = unknown>(scope?: string) {
  const items: LocalSnapshot<TPayload>[] = [];

  await snapshotStore.iterate<LocalSnapshot<TPayload>, void>((value) => {
    if (!scope || value.scope === scope) {
      items.push(value);
    }
  });

  return items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

const profilesRepository = {
  save: (profile: TaxpayerProfile) => saveRecord(profileStore, "profile", profile.id, profile) as Promise<ProfileRecord>,
  get: (id: string) => getRecord<TaxpayerProfile>(profileStore, id) as Promise<ProfileRecord | null>,
  list: () => listRecords<TaxpayerProfile>(profileStore) as Promise<ProfileRecord[]>,
};

const documentsRepository = {
  save: (document: FiscalDocument) => saveRecord(documentStore, "document", document.id, document) as Promise<DocumentRecord>,
  get: (id: string) => getRecord<FiscalDocument>(documentStore, id) as Promise<DocumentRecord | null>,
  list: () => listRecords<FiscalDocument>(documentStore) as Promise<DocumentRecord[]>,
};

const ingestionDocumentsRepository = {
  save: (document: IngestedDocument) => saveRecord(ingestionDocumentStore, "ingestion_document", document.id, document) as Promise<IngestionDocumentRecord>,
  get: (id: string) => getRecord<IngestedDocument>(ingestionDocumentStore, id) as Promise<IngestionDocumentRecord | null>,
  list: () =>
    listRecords<IngestedDocument>(ingestionDocumentStore, {
      sortBy: (item) => item.data.createdAt,
      direction: "desc",
    }) as Promise<IngestionDocumentRecord[]>,
};

const simulationsRepository = {
  save: (simulation: SimulationResult) => saveRecord(simulationStore, "simulation", simulation.id, simulation) as Promise<SimulationRecord>,
  get: (id: string) => getRecord<SimulationResult>(simulationStore, id) as Promise<SimulationRecord | null>,
  list: () =>
    listRecords<SimulationResult>(simulationStore, {
      sortBy: (item) => item.data.createdAt,
      direction: "desc",
    }) as Promise<SimulationRecord[]>,
};

const resultsRepository = {
  save: (result: SimulationResult) => saveRecord(resultStore, "result", result.id, result) as Promise<SimulationResultRecord>,
  get: (id: string) => getRecord<SimulationResult>(resultStore, id) as Promise<SimulationResultRecord | null>,
  list: () =>
    listRecords<SimulationResult>(resultStore, {
      sortBy: (item) => item.data.createdAt,
      direction: "desc",
    }) as Promise<SimulationResultRecord[]>,
};

const bundlesRepository = {
  save: (bundle: RuleBundle) => saveRecord(bundleStore, "bundle", bundle.id, bundle) as Promise<RuleBundleRecord>,
  get: (id: string) => getRecord<RuleBundle>(bundleStore, id) as Promise<RuleBundleRecord | null>,
  list: () => listRecords<RuleBundle>(bundleStore) as Promise<RuleBundleRecord[]>,
};

const reportsRepository = {
  save: (report: PersistedUserReport) => saveRecord(reportStore, "user_report", report.report.id, report) as Promise<UserReportRecord>,
  get: (id: string) => getRecord<PersistedUserReport>(reportStore, id) as Promise<UserReportRecord | null>,
  list: () =>
    listRecords<PersistedUserReport>(reportStore, {
      sortBy: (item) => item.data.report.updatedAt,
      direction: "desc",
    }) as Promise<UserReportRecord[]>,
  getLatest: async () => {
    const reports = await listRecords<PersistedUserReport>(reportStore, {
      sortBy: (item) => item.data.report.updatedAt,
      direction: "desc",
    });

    return (reports[0] as UserReportRecord | undefined) ?? null;
  },
};

const auditRepository = {
  append: (event: LocalAuditEvent) => saveRecord(auditStore, "audit_event", event.id, event) as Promise<AuditEventRecord>,
  list: () =>
    listRecords<LocalAuditEvent>(auditStore, {
      sortBy: (item) => item.data.timestamp,
      direction: "desc",
    }) as Promise<AuditEventRecord[]>,
  listByAggregate: async (aggregateId: string) => {
    const items = await listRecords<LocalAuditEvent>(auditStore, {
      sortBy: (item) => item.data.timestamp,
      direction: "desc",
    });

    return items.filter((item) => item.data.aggregateId === aggregateId) as AuditEventRecord[];
  },
};

export const repositories: LocalPersistenceContract = {
  profiles: profilesRepository,
  documents: documentsRepository,
  ingestionDocuments: ingestionDocumentsRepository,
  simulations: simulationsRepository,
  results: resultsRepository,
  bundles: bundlesRepository,
  reports: reportsRepository,
  audit: auditRepository,
  snapshots: {
    save: saveSnapshot,
    get: getSnapshot,
    list: listSnapshots,
  },
};

export const localDb = {
  repositories,
  saveProfile: async (profile: TaxpayerProfile) => (await profilesRepository.save(profile)).data,
  getProfile: async (id: string) => (await profilesRepository.get(id))?.data ?? null,
  listProfiles: async () => (await profilesRepository.list()).map((record) => record.data),
  saveDocument: async (document: FiscalDocument) => (await documentsRepository.save(document)).data,
  getDocument: async (id: string) => (await documentsRepository.get(id))?.data ?? null,
  listDocuments: async () => (await documentsRepository.list()).map((record) => record.data),
  saveIngestionDocument: async (document: IngestedDocument) => (await ingestionDocumentsRepository.save(document)).data,
  getIngestionDocument: async (id: string) => (await ingestionDocumentsRepository.get(id))?.data ?? null,
  listIngestionDocuments: async () => (await ingestionDocumentsRepository.list()).map((record) => record.data),
  saveSimulation: async (simulation: SimulationResult) => (await simulationsRepository.save(simulation)).data,
  getSimulation: async (id: string) => (await simulationsRepository.get(id))?.data ?? null,
  listSimulations: async () => (await simulationsRepository.list()).map((record) => record.data),
  saveSimulationResult: async (result: SimulationResult) => (await resultsRepository.save(result)).data,
  getSimulationResult: async (id: string) => (await resultsRepository.get(id))?.data ?? null,
  listSimulationResults: async () => (await resultsRepository.list()).map((record) => record.data),
  saveRuleBundle: async (bundle: RuleBundle) => (await bundlesRepository.save(bundle)).data,
  getRuleBundle: async (id: string) => (await bundlesRepository.get(id))?.data ?? null,
  listRuleBundles: async () => (await bundlesRepository.list()).map((record) => record.data),
  saveUserReport: async (report: PersistedUserReport) => (await reportsRepository.save(report)).data,
  getUserReport: async (id: string) => (await reportsRepository.get(id))?.data ?? null,
  listUserReports: async () => (await reportsRepository.list()).map((record) => record.data),
  getLatestUserReport: async () => (await reportsRepository.getLatest())?.data ?? null,
  appendAuditEvent: async (event: LocalAuditEvent) => (await auditRepository.append(event)).data,
  listAuditEvents: async () => (await auditRepository.list()).map((record) => record.data),
  listAuditEventsByAggregate: async (aggregateId: string) => (await auditRepository.listByAggregate(aggregateId)).map((record) => record.data),
  saveAnonymousOnboardingProfile: (profile: AnonymousOnboardingProfile) => onboardingStore.setItem(profile.id, profile),
  getAnonymousOnboardingProfile: async () => {
    const items: AnonymousOnboardingProfile[] = [];
    await onboardingStore.iterate<AnonymousOnboardingProfile, void>((value) => {
      items.push(value);
    });
    return items.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
  },
  clearOnboardingProfiles: () => onboardingStore.clear(),
  clearAll: async () => {
    await Promise.all([
      onboardingStore.clear(),
      profileStore.clear(),
      simulationStore.clear(),
      resultStore.clear(),
      ingestionDocumentStore.clear(),
      documentStore.clear(),
      reportStore.clear(),
      auditStore.clear(),
      snapshotStore.clear(),
    ]);
  },
  saveSnapshot,
  getSnapshot,
  listSnapshots,
};
