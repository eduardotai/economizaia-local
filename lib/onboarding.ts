import type { TaxpayerProfile } from "@/models/domain";
import type {
  ActivityType,
  AnonymousOnboardingProfile,
  InputFlowMode,
  LocalAppMode,
  OnboardingUserType,
  RevenueRange,
  SimulationPeriod,
} from "@/models/onboarding";

export const revenueRangeLabels: Record<RevenueRange, string> = {
  ate_5k: "Até R$ 5 mil/mês",
  de_5k_a_15k: "De R$ 5 mil a R$ 15 mil/mês",
  de_15k_a_50k: "De R$ 15 mil a R$ 50 mil/mês",
  de_50k_a_150k: "De R$ 50 mil a R$ 150 mil/mês",
  acima_150k: "Acima de R$ 150 mil/mês",
};

export const userTypeLabels: Record<OnboardingUserType, string> = {
  mei: "MEI ou micro operação",
  empresa: "Empresa pequena ou média",
  autonomo: "Autônomo / profissional independente",
  contador: "Contador(a) ou consultoria",
};

export const activityTypeLabels: Record<ActivityType, string> = {
  servicos_digitais: "Serviços digitais",
  comercio: "Comércio",
  industria_leve: "Indústria leve / produção simples",
  profissional_liberal: "Profissional liberal",
  agencia_estudio: "Agência / estúdio / operação criativa",
  outro: "Outro tipo de atividade",
};

export const simulationPeriodLabels: Record<SimulationPeriod, string> = {
  mensal: "Recorte mensal",
  trimestral: "Recorte trimestral",
  anual: "Recorte anual",
};

export const appModeLabels: Record<LocalAppMode, string> = {
  leve: "Modo leve",
  ia: "Modo IA",
};

export const flowModeLabels: Record<InputFlowMode, string> = {
  manual_rapido: "Modo rápido manual",
  documentos: "Fluxo com documentos",
};

const revenueRangeToMonthlyValue: Record<RevenueRange, number> = {
  ate_5k: 4000,
  de_5k_a_15k: 10000,
  de_15k_a_50k: 28000,
  de_50k_a_150k: 80000,
  acima_150k: 180000,
};

const activityTypeDescription: Record<ActivityType, string> = {
  servicos_digitais: "Operação de serviços digitais declarada no onboarding anônimo",
  comercio: "Atividade de comércio declarada no onboarding anônimo",
  industria_leve: "Operação de indústria leve declarada no onboarding anônimo",
  profissional_liberal: "Atividade profissional liberal declarada no onboarding anônimo",
  agencia_estudio: "Agência ou estúdio declarados no onboarding anônimo",
  outro: "Atividade genérica declarada no onboarding anônimo",
};

function toNumber(value: string, fallback: number) {
  const normalized = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback;
}

export function createEmptyOnboardingProfile(): AnonymousOnboardingProfile {
  const now = new Date().toISOString();

  return {
    id: `anonymous-${now}`,
    createdAt: now,
    updatedAt: now,
    userType: "mei",
    revenueRange: "ate_5k",
    activityType: "servicos_digitais",
    currentRegime: undefined,
    simulationPeriod: "mensal",
    consentLocalOnly: false,
    consentMockAwareness: false,
    appMode: "leve",
    flowMode: "manual_rapido",
    quickManualInput: {
      monthlyRevenue: "4000",
      monthlyExpenses: "500",
      currentRegime: "indefinido",
      activityDescription: activityTypeDescription.servicos_digitais,
      cnaeOrActivityCode: "",
      periodLabel: simulationPeriodLabels.mensal,
    },
  };
}

export function onboardingProfileToTaxpayerProfile(profile: AnonymousOnboardingProfile): TaxpayerProfile {
  const isQuickManual = profile.flowMode === "manual_rapido";
  const monthlyRevenue = isQuickManual
    ? toNumber(profile.quickManualInput.monthlyRevenue, revenueRangeToMonthlyValue[profile.revenueRange])
    : revenueRangeToMonthlyValue[profile.revenueRange];

  return {
    id: profile.id,
    businessName: `Perfil anônimo - ${userTypeLabels[profile.userType]}`,
    regime: isQuickManual ? profile.quickManualInput.currentRegime ?? profile.currentRegime ?? "indefinido" : profile.currentRegime ?? "indefinido",
    monthlyRevenue,
    monthlyExpenses: isQuickManual ? toNumber(profile.quickManualInput.monthlyExpenses, 0) : 0,
    activityDescription: isQuickManual
      ? profile.quickManualInput.activityDescription || activityTypeDescription[profile.activityType]
      : activityTypeDescription[profile.activityType],
    cnaeOrActivityCode: isQuickManual ? profile.quickManualInput.cnaeOrActivityCode || undefined : undefined,
    simulationPeriodLabel: isQuickManual ? profile.quickManualInput.periodLabel : simulationPeriodLabels[profile.simulationPeriod],
    city: "Não informado",
    state: "BR",
    notes: [
      `Modo da aplicação: ${appModeLabels[profile.appMode]}.`,
      `Fluxo selecionado: ${flowModeLabels[profile.flowMode]}.`,
      "Perfil gerado via onboarding anônimo local-first.",
      `Período solicitado: ${simulationPeriodLabels[profile.simulationPeriod]}.`,
      "Todos os cenários deste fluxo são mock/placeholder.",
    ],
  };
}
