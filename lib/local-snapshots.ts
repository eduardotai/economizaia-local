import type { IngestedDocument } from "@/models/documents";
import type { SimulationResult, TaxpayerProfile } from "@/models/domain";
import type { LocalSnapshot } from "@/db/persistence-types";
import { localDb } from "@/db/local-db";
import { createId, nowIso } from "@/lib/document-utils";

function createSnapshot<TPayload>(scope: string, payload: TPayload, entityId?: string): LocalSnapshot<TPayload> {
  return {
    id: createId("snapshot"),
    scope,
    entityId,
    createdAt: nowIso(),
    payload,
    localOnly: true,
  };
}

export async function saveProfileSnapshot(profile: TaxpayerProfile) {
  return localDb.saveSnapshot(createSnapshot("profile", profile, profile.id));
}

export async function saveDocumentSnapshot(document: IngestedDocument) {
  return localDb.saveSnapshot(createSnapshot("document", document, document.id));
}

export async function saveSimulationSnapshot(result: SimulationResult) {
  return localDb.saveSnapshot(createSnapshot("simulation", result, result.id));
}

export async function getLatestProfileSnapshot(profileId: string) {
  const snapshots = await localDb.listSnapshots<TaxpayerProfile>("profile");
  return snapshots.find((snapshot) => snapshot.entityId === profileId) ?? null;
}

export async function getLatestDocumentSnapshot(documentId: string) {
  const snapshots = await localDb.listSnapshots<IngestedDocument>("document");
  return snapshots.find((snapshot) => snapshot.entityId === documentId) ?? null;
}

export async function getLatestSimulationSnapshot(simulationId: string) {
  const snapshots = await localDb.listSnapshots<SimulationResult>("simulation");
  return snapshots.find((snapshot) => snapshot.entityId === simulationId) ?? null;
}
