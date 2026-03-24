import localforage from "localforage";
import type { FiscalDocument, RuleBundle, SimulationResult, TaxpayerProfile } from "@/models/domain";

const profileStore = localforage.createInstance({ name: "economizaia-local", storeName: "taxpayer_profiles" });
const documentStore = localforage.createInstance({ name: "economizaia-local", storeName: "documents" });
const simulationStore = localforage.createInstance({ name: "economizaia-local", storeName: "simulations" });
const bundleStore = localforage.createInstance({ name: "economizaia-local", storeName: "rule_bundles" });

export const localDb = {
  saveProfile: (profile: TaxpayerProfile) => profileStore.setItem(profile.id, profile),
  getProfile: (id: string) => profileStore.getItem<TaxpayerProfile>(id),
  saveDocument: (document: FiscalDocument) => documentStore.setItem(document.id, document),
  getDocument: (id: string) => documentStore.getItem<FiscalDocument>(id),
  saveSimulation: (simulation: SimulationResult) => simulationStore.setItem(simulation.id, simulation),
  listSimulations: async () => {
    const items: SimulationResult[] = [];
    await simulationStore.iterate<SimulationResult, void>((value) => {
      items.push(value);
    });
    return items;
  },
  saveRuleBundle: (bundle: RuleBundle) => bundleStore.setItem(bundle.id, bundle),
  getRuleBundle: (id: string) => bundleStore.getItem<RuleBundle>(id),
};