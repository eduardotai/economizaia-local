export type OnboardingUserType = "mei" | "empresa" | "autonomo" | "contador";

export type RevenueRange =
  | "ate_5k"
  | "de_5k_a_15k"
  | "de_15k_a_50k"
  | "de_50k_a_150k"
  | "acima_150k";

export type ActivityType =
  | "servicos_digitais"
  | "comercio"
  | "industria_leve"
  | "profissional_liberal"
  | "agencia_estudio"
  | "outro";

export type SimulationPeriod = "mensal" | "trimestral" | "anual";

export type LocalAppMode = "leve" | "ia";
export type InputFlowMode = "documentos" | "manual_rapido";

export interface AnonymousOnboardingProfile {
  id: string;
  createdAt: string;
  updatedAt: string;
  userType: OnboardingUserType;
  revenueRange: RevenueRange;
  activityType: ActivityType;
  currentRegime?: "mei" | "simples" | "lucro_presumido" | "geral" | "indefinido";
  simulationPeriod: SimulationPeriod;
  consentLocalOnly: boolean;
  consentMockAwareness: boolean;
  appMode: LocalAppMode;
  flowMode: InputFlowMode;
  quickManualInput: {
    monthlyRevenue: string;
    monthlyExpenses: string;
    currentRegime: "mei" | "simples" | "lucro_presumido" | "geral" | "indefinido";
    activityDescription: string;
    cnaeOrActivityCode: string;
    periodLabel: string;
  };
}
