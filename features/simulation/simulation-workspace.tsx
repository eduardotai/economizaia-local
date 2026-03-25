"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  DatabaseZap,
  FilePenLine,
  FileText,
  Lock,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { localDb } from "@/db/local-db";
import { realTaxRuleEngine } from "@/engine/real-tax-rule-engine";
import { ReportWorkspace } from "@/features/simulation/report-workspace";
import { OperationalReadinessPanel } from "@/features/inspection/operational-readiness-panel";
import { createProfileSavedAuditEvent, createSimulationAuditEvents } from "@/lib/local-audit";
import { saveProfileSnapshot, saveSimulationSnapshot } from "@/lib/local-snapshots";
import { evaluateWorkspaceReadiness } from "@/lib/readiness-gate";
import {
  activityTypeLabels,
  appModeLabels,
  createEmptyOnboardingProfile,
  flowModeLabels,
  onboardingProfileToTaxpayerProfile,
  revenueRangeLabels,
  simulationPeriodLabels,
  userTypeLabels,
} from "@/lib/onboarding";
import type { IngestedDocument } from "@/models/documents";
import type { SimulationResult } from "@/models/domain";
import type { AnonymousOnboardingProfile, RevenueRange } from "@/models/onboarding";
import type { PersistedUserReport } from "@/models/report";

const revenueImpactMap: Record<RevenueRange, number> = {
  ate_5k: -0.4,
  de_5k_a_15k: 0,
  de_15k_a_50k: 0.45,
  de_50k_a_150k: 0.9,
  acima_150k: 1.3,
};

function formatMockCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}

function buildScenarioCards(profile: AnonymousOnboardingProfile, simulation: SimulationResult) {
  const base = simulation.summary.estimatedSavings;
  const revenueImpact = revenueImpactMap[profile.revenueRange] ?? 0;
  const userTypeWeight = profile.userType === "contador" ? 0.55 : profile.userType === "empresa" ? 0.35 : 0.15;

  return [
    {
      id: "cenario-base",
      title: "Cenário base local (mock)",
      badge: "mock",
      delta: base,
      description: "Usa o mock rule engine atual com os dados mínimos do onboarding anônimo.",
      confidence: simulation.summary.confidence.label,
    },
    {
      id: "cenario-conservador",
      title: "Cenário conservador (placeholder)",
      badge: "placeholder",
      delta: Math.max(base * 0.55, 0),
      description: "Reduz o ganho estimado para refletir lacunas de classificação e ausência de base oficial.",
      confidence: "Muito baixa",
    },
    {
      id: "cenario-exploratorio",
      title: "Cenário exploratório (mock)",
      badge: "mock",
      delta: Math.max(base + base * (revenueImpact + userTypeWeight), 0),
      description: "Amplia o ganho apenas para demonstrar comparação visual entre cenários locais.",
      confidence: "Baixa",
    },
  ];
}

function getQuickManualProgress(profile: AnonymousOnboardingProfile) {
  const checks = [
    profile.quickManualInput.monthlyRevenue.trim().length > 0,
    profile.quickManualInput.monthlyExpenses.trim().length > 0,
    profile.quickManualInput.currentRegime !== "indefinido",
    profile.quickManualInput.activityDescription.trim().length > 0,
    profile.quickManualInput.periodLabel.trim().length > 0,
  ];

  const completed = checks.filter(Boolean).length;
  return {
    completed,
    total: checks.length,
    percentage: Math.round((completed / checks.length) * 100),
  };
}

function getQuickManualChecklist(profile: AnonymousOnboardingProfile) {
  return [
    {
      id: "faturamento",
      label: "Informar faturamento mensal",
      done: profile.quickManualInput.monthlyRevenue.trim().length > 0,
    },
    {
      id: "despesas",
      label: "Informar despesas dedutíveis",
      done: profile.quickManualInput.monthlyExpenses.trim().length > 0,
    },
    {
      id: "regime",
      label: "Escolher regime atual",
      done: profile.quickManualInput.currentRegime !== "indefinido",
    },
    {
      id: "atividade",
      label: "Descrever atividade principal",
      done: profile.quickManualInput.activityDescription.trim().length > 0,
    },
    {
      id: "periodo",
      label: "Confirmar período da leitura",
      done: profile.quickManualInput.periodLabel.trim().length > 0,
    },
  ];
}

export function SimulationWorkspace() {
  const [profile, setProfile] = useState<AnonymousOnboardingProfile | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [persistedReport, setPersistedReport] = useState<PersistedUserReport | null>(null);
  const [documents, setDocuments] = useState<IngestedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [storedProfile, latestReport, storedDocuments] = await Promise.all([
        localDb.getAnonymousOnboardingProfile(),
        localDb.getLatestUserReport(),
        localDb.listIngestionDocuments(),
      ]);
      const nextProfile = storedProfile ?? createEmptyOnboardingProfile();

      if (!mounted) return;

      setProfile(nextProfile);
      setPersistedReport(latestReport);
      setDocuments(storedDocuments);
      if (storedProfile) {
        setSimulation(realTaxRuleEngine.simulate(onboardingProfileToTaxpayerProfile(storedProfile)));
      }
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const scenarioCards = useMemo(() => {
    if (!profile || !simulation) return [];
    return buildScenarioCards(profile, simulation);
  }, [profile, simulation]);

  const quickManualProgress = useMemo(() => {
    if (!profile) return { completed: 0, total: 5, percentage: 0 };
    return getQuickManualProgress(profile);
  }, [profile]);

  const quickManualChecklist = useMemo(() => {
    if (!profile) return [];
    return getQuickManualChecklist(profile);
  }, [profile]);

  const readinessGate = useMemo(() => {
    if (!profile) return null;
    return evaluateWorkspaceReadiness({
      profile,
      simulation,
      documents,
      persistedReport,
    });
  }, [profile, simulation, documents, persistedReport]);

  const canSimulate = Boolean(readinessGate?.canGenerateSimulation);

  async function persistAndSimulate(nextProfile: AnonymousOnboardingProfile) {
    const currentGate = evaluateWorkspaceReadiness({
      profile: nextProfile,
      simulation,
      documents,
      persistedReport,
    });

    if (!currentGate.canGenerateSimulation) {
      setStatusMessage(currentGate.refusalMessage ?? "Simulação bloqueada até concluir revisão manual e prontidão mínima.");
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    try {
      await localDb.saveAnonymousOnboardingProfile(nextProfile);

      const persistedProfile = onboardingProfileToTaxpayerProfile(nextProfile);
      const simulationResult = realTaxRuleEngine.simulate(persistedProfile);

      await localDb.saveProfile(persistedProfile);
      await localDb.saveSimulation(simulationResult);
      await Promise.all([
        saveProfileSnapshot(persistedProfile),
        saveSimulationSnapshot(simulationResult),
        localDb.appendAuditEvent(createProfileSavedAuditEvent(persistedProfile)),
        ...createSimulationAuditEvents(simulationResult).map((event) => localDb.appendAuditEvent(event)),
      ]);

      setProfile(nextProfile);
      setSimulation(simulationResult);
      setStatusMessage("Leitura local gerada com gate explícito de revisão e prontidão aplicado.");
    } finally {
      setSaving(false);
    }
  }

  function updateProfile<K extends keyof AnonymousOnboardingProfile>(field: K, value: AnonymousOnboardingProfile[K]) {
    setProfile((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value, updatedAt: new Date().toISOString() };
    });
  }

  function updateQuickManualField<K extends keyof AnonymousOnboardingProfile["quickManualInput"]>(field: K, value: AnonymousOnboardingProfile["quickManualInput"][K]) {
    setProfile((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        updatedAt: new Date().toISOString(),
        quickManualInput: {
          ...prev.quickManualInput,
          [field]: value,
        },
      };
    });
  }

  if (loading || !profile) {
    return (
      <Card className="space-y-3">
        <CardTitle>Carregando workspace de simulação...</CardTitle>
        <CardDescription>Preparando o fluxo anônimo local-first no seu navegador.</CardDescription>
      </Card>
    );
  }

  return (
    <section id="simulacao" className="space-y-6 scroll-mt-8">
      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <Card className="space-y-6">
          <div className="space-y-2">
            <Badge variant="secondary">Entrada principal da análise</Badge>
            <CardTitle>Comece pelo caminho mais simples e avance com guardrails claros</CardTitle>
            <CardDescription className="leading-6">
              A entrada principal privilegia o modo manual para montar uma leitura inicial com rapidez. O fluxo documental continua disponível, sempre com revisão humana obrigatória antes de qualquer uso prático.
            </CardDescription>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <button
              type="button"
              onClick={() => updateProfile("flowMode", "manual_rapido")}
              className={`rounded-3xl border p-5 text-left transition ${
                profile.flowMode === "manual_rapido"
                  ? "border-emerald-400/40 bg-emerald-500/10 shadow-lg shadow-emerald-950/20"
                  : "border-border bg-background hover:border-emerald-400/30"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-base font-medium text-foreground">
                    <Sparkles className="h-4 w-4 text-emerald-300" />
                    Modo rápido manual
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Melhor para começar agora: você informa os campos críticos manualmente e avança para uma leitura local rastreável, com menos atrito e mais clareza.
                  </p>
                </div>
                <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">Recomendado</Badge>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>• Mais rápido para testar a proposta do produto</li>
                <li>• Menos dependência de extração documental</li>
                <li>• Ainda exige revisão humana antes de uso real</li>
              </ul>
            </button>

            <button
              type="button"
              onClick={() => updateProfile("flowMode", "documentos")}
              className={`rounded-3xl border p-5 text-left transition ${
                profile.flowMode === "documentos"
                  ? "border-sky-400/40 bg-sky-500/10 shadow-lg shadow-sky-950/20"
                  : "border-border bg-background hover:border-sky-400/30"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-base font-medium text-foreground">
                    <FileText className="h-4 w-4 text-sky-300" />
                    Revisão com documentos
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Use quando já tiver PDF, imagem ou XML e quiser preparar uma revisão guiada dos campos extraídos localmente, com mais apoio à conferência.
                  </p>
                </div>
                <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-100">Mais cautela</Badge>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>• pdf.js priorizado para PDF digital</li>
                <li>• OCR só como fallback técnico</li>
                <li>• Cálculo permanece bloqueado sem revisão confirmada</li>
              </ul>
            </button>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-100">
              <div className="flex items-center gap-2 font-medium">
                <Lock className="h-4 w-4" />
                Local-first e sem envio remoto
              </div>
              <p className="mt-2 leading-6">
                Seus dados deste onboarding ficam no navegador durante este checkpoint. O produto continua prudente: sem backend remoto, com persistência local e sem promessa de cálculo fiscal oficial.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
              <div className="flex items-center gap-2 font-medium">
                <FilePenLine className="h-4 w-4" />
                Regra de prudência
              </div>
              <p className="mt-2 leading-6 text-amber-100/90">
                Todo dado rápido ou documental precisa de revisão humana antes de qualquer uso prático. Este MVP organiza a UX; não entrega cálculo fiscal oficial.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={`rounded-2xl border p-4 ${profile.appMode === "leve" ? "border-sky-400/30 bg-sky-500/10" : "border-border bg-muted/20"}`}>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <DatabaseZap className="h-4 w-4 text-sky-300" />
                Modo leve
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Prioriza clareza, velocidade e menos camadas explicativas. Melhor para triagem inicial e validação rápida do cenário local.
              </p>
              <button
                type="button"
                onClick={() => updateProfile("appMode", "leve")}
                className={`mt-4 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  profile.appMode === "leve"
                    ? "bg-sky-400/15 text-sky-100"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {profile.appMode === "leve" ? "Selecionado" : "Usar modo leve"}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className={`rounded-2xl border p-4 ${profile.appMode === "ia" ? "border-violet-400/30 bg-violet-500/10" : "border-border bg-muted/20"}`}>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <BrainCircuit className="h-4 w-4 text-violet-300" />
                Modo IA
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Destaca a camada explicativa local e a preparação para fluxos com inferência futura. Útil para explorar justificativas e apoiar a análise, não para aumentar confiança regulatória.
              </p>
              <button
                type="button"
                onClick={() => updateProfile("appMode", "ia")}
                className={`mt-4 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  profile.appMode === "ia"
                    ? "bg-violet-400/15 text-violet-100"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {profile.appMode === "ia" ? "Selecionado" : "Usar modo IA"}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Tipo de usuário</span>
              <select
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={profile.userType}
                onChange={(event) => updateProfile("userType", event.target.value as AnonymousOnboardingProfile["userType"])}
              >
                {Object.entries(userTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Faixa de faturamento</span>
              <select
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={profile.revenueRange}
                onChange={(event) => updateProfile("revenueRange", event.target.value as AnonymousOnboardingProfile["revenueRange"])}
              >
                {Object.entries(revenueRangeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Tipo de atividade</span>
              <select
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={profile.activityType}
                onChange={(event) => updateProfile("activityType", event.target.value as AnonymousOnboardingProfile["activityType"])}
              >
                {Object.entries(activityTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Regime atual (opcional)</span>
              <select
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={profile.currentRegime ?? "indefinido"}
                onChange={(event) => {
                  const value = event.target.value;
                  updateProfile("currentRegime", value === "indefinido" ? undefined : (value as NonNullable<AnonymousOnboardingProfile["currentRegime"]>));
                }}
              >
                <option value="indefinido">Prefiro não informar agora</option>
                <option value="mei">MEI</option>
                <option value="simples">Simples Nacional</option>
                <option value="lucro_presumido">Lucro Presumido</option>
                <option value="geral">Outro / geral</option>
              </select>
            </label>

            <label className="space-y-2 text-sm sm:col-span-2">
              <span className="font-medium text-foreground">Período da simulação</span>
              <div className="grid gap-2 sm:grid-cols-3">
                {Object.entries(simulationPeriodLabels).map(([value, label]) => {
                  const active = profile.simulationPeriod === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        updateProfile("simulationPeriod", value as AnonymousOnboardingProfile["simulationPeriod"]);
                        updateQuickManualField("periodLabel", label);
                      }}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        active
                          ? "border-emerald-400/50 bg-emerald-400/10 text-white"
                          : "border-border bg-background text-muted-foreground hover:border-emerald-400/30"
                      }`}
                    >
                      <div className="font-medium">{label}</div>
                      <div className="mt-1 text-xs">Usado para orientar a leitura do cenário neste MVP mock/local.</div>
                    </button>
                  );
                })}
              </div>
            </label>
          </div>

          {profile.flowMode === "manual_rapido" ? (
            <div className="space-y-4 rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">Modo rápido manual</div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Preencha os campos críticos para montar uma primeira leitura local. A ideia é chegar rápido a um cenário analisável, sem pular a revisão humana.
                  </p>
                </div>
                <div className="min-w-[220px] rounded-2xl border border-sky-400/20 bg-background/70 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3 text-muted-foreground">
                    <span>Progresso do preenchimento</span>
                    <span>{quickManualProgress.completed}/{quickManualProgress.total}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-800">
                    <div className="h-2 rounded-full bg-sky-300 transition-all" style={{ width: `${quickManualProgress.percentage}%` }} />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">Quanto mais completo, melhor a qualidade da leitura local e da revisão posterior.</div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {quickManualChecklist.map((item, index) => (
                  <div key={item.id} className="rounded-2xl border border-border bg-background/70 px-3 py-3 text-sm">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                      <span>Passo {index + 1}</span>
                    </div>
                    <div className="mt-2 flex items-start gap-2">
                      <CheckCircle2 className={`mt-0.5 h-4 w-4 ${item.done ? "text-emerald-300" : "text-slate-500"}`} />
                      <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">1. Faturamento mensal</span>
                  <input
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    value={profile.quickManualInput.monthlyRevenue}
                    onChange={(event) => updateQuickManualField("monthlyRevenue", event.target.value)}
                    placeholder="Ex.: 25000"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">2. Despesas dedutíveis</span>
                  <input
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    value={profile.quickManualInput.monthlyExpenses}
                    onChange={(event) => updateQuickManualField("monthlyExpenses", event.target.value)}
                    placeholder="Ex.: 3500"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">3. Regime atual</span>
                  <select
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    value={profile.quickManualInput.currentRegime}
                    onChange={(event) => updateQuickManualField("currentRegime", event.target.value as AnonymousOnboardingProfile["quickManualInput"]["currentRegime"])}
                  >
                    <option value="indefinido">Não informado</option>
                    <option value="mei">MEI</option>
                    <option value="simples">Simples Nacional</option>
                    <option value="lucro_presumido">Lucro Presumido</option>
                    <option value="geral">Outro / geral</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">4. Período</span>
                  <input
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    value={profile.quickManualInput.periodLabel}
                    onChange={(event) => updateQuickManualField("periodLabel", event.target.value)}
                    placeholder="Ex.: Recorte mensal"
                  />
                </label>

                <label className="space-y-2 text-sm sm:col-span-2">
                  <span className="font-medium text-foreground">5. Atividade / descrição operacional</span>
                  <input
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    value={profile.quickManualInput.activityDescription}
                    onChange={(event) => updateQuickManualField("activityDescription", event.target.value)}
                    placeholder="Ex.: Serviços de marketing digital"
                  />
                </label>

                <label className="space-y-2 text-sm sm:col-span-2">
                  <span className="font-medium text-foreground">CNAE ou código de atividade (se aplicável)</span>
                  <input
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    value={profile.quickManualInput.cnaeOrActivityCode}
                    onChange={(event) => updateQuickManualField("cnaeOrActivityCode", event.target.value)}
                    placeholder="Ex.: 6201-5/01"
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <ArrowRight className="h-4 w-4 text-sky-300" />
                  Próximo passo do fluxo rápido
                </div>
                <p className="mt-2 leading-6">
                  Salve o perfil local e gere a leitura do workspace. Depois, use o relatório e a revisão humana para decidir se vale aprofundar ou trazer documentos.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4 text-sm text-sky-50">
              <div className="font-medium">Fluxo com documentos selecionado</div>
              <p className="mt-2 leading-6 text-sky-100/90">
                O próximo passo recomendado é seguir para a seção documental abaixo, enviar os arquivos e revisar manualmente os campos críticos antes de qualquer uso futuro no rule engine.
              </p>
            </div>
          )}

          <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
            <div className="space-y-1">
              <div className="font-medium text-foreground">Antes de continuar</div>
              <p className="text-muted-foreground">Só mantemos dois avisos essenciais para evitar excesso de ruído no fluxo principal.</p>
            </div>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={profile.consentLocalOnly}
                onChange={(event) => updateProfile("consentLocalOnly", event.target.checked)}
              />
              <span>
                Entendo que este fluxo é <strong>local no dispositivo</strong>, com persistência básica no navegador.
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={profile.consentMockAwareness}
                onChange={(event) => updateProfile("consentMockAwareness", event.target.checked)}
              />
              <span>
                Entendo que o resultado atual é <strong>mock</strong> e não substitui revisão humana nem regra fiscal oficial.
              </span>
            </label>
          </div>

          {readinessGate ? (
            <div className={`rounded-2xl border p-4 text-sm ${readinessGate.status === "pronto" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : readinessGate.status === "bloqueado" ? "border-red-400/20 bg-red-400/10 text-red-100" : "border-amber-400/20 bg-amber-400/10 text-amber-100"}`}>
              <div className="flex items-start gap-3">
                {readinessGate.status === "bloqueado" ? <AlertTriangle className="mt-0.5 h-4 w-4" /> : <ShieldCheck className="mt-0.5 h-4 w-4" />}
                <div className="space-y-3">
                  <div>
                    <div className="font-medium">Gate único de prontidão: {readinessGate.statusLabel}</div>
                    <p className="mt-1">{readinessGate.summary}</p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {readinessGate.checklist.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-current/10 bg-background/40 p-3">
                        <div className="font-medium">{item.done ? "OK" : "Pendente"} · {item.label}</div>
                        <p className="mt-1 text-xs opacity-90">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                  {readinessGate.blockers.length ? (
                    <div className="rounded-2xl border border-current/10 bg-background/40 p-3">
                      <div className="font-medium">Recusa operacional</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs opacity-95">
                        {readinessGate.blockers.map((blocker) => (
                          <li key={blocker.code}>
                            <strong>{blocker.title}:</strong> {blocker.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="text-xs opacity-90">
                    Fluxo: {readinessGate.evidence.flowModeLabel} · Confiança: {readinessGate.evidence.confidenceLabel} · Docs revisados: {readinessGate.evidence.documentReviewConfirmedCount} · Docs pendentes: {readinessGate.evidence.documentReviewPendingCount}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {statusMessage ? <p className="text-sm text-emerald-200">{statusMessage}</p> : null}

          <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-50">
            <div className="font-medium">Como conduzir esta parte da demo</div>
            <ol className="mt-2 space-y-1 text-sky-100/90">
              <li>1. Preencha apenas o mínimo necessário para chegar rápido a um cenário navegável.</li>
              <li>2. Mostre o gate único de prontidão antes de clicar no CTA principal.</li>
              <li>3. Gere a leitura local e destaque lacunas, confiança e recusa prudente quando aplicável.</li>
            </ol>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button disabled={!canSimulate || saving} onClick={() => void persistAndSimulate(profile)}>
              {saving ? "Salvando..." : profile.flowMode === "manual_rapido" ? "Validar prontidão e gerar leitura local" : "Validar prontidão e preparar revisão documental"}
            </Button>
            {profile.flowMode === "documentos" ? (
              <a href="#documentos" className="inline-flex">
                <Button variant="outline">Ir para revisão documental</Button>
              </a>
            ) : simulation ? (
              <a href="#relatorio" className="inline-flex">
                <Button variant="outline">Seguir para relatório</Button>
              </a>
            ) : null}
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => {
                void (async () => {
                  setSaving(true);
                  setStatusMessage("Reiniciando...");
                  try {
                    await localDb.clearAll();
                    const fresh = createEmptyOnboardingProfile();
                    setProfile(fresh);
                    setSimulation(null);
                    setPersistedReport(null);
                    setDocuments([]);
                    setStatusMessage("Onboarding reiniciado. Todos os dados locais foram apagados.");
                  } finally {
                    setSaving(false);
                    setTimeout(() => setStatusMessage(null), 4000);
                  }
                })();
              }}
            >
              <RefreshCcw className="mr-2 h-4 w-4" /> Reiniciar onboarding
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge>Workspace de simulação</Badge>
                <CardTitle className="mt-2">Resumo de premissas e sinais de confiança</CardTitle>
                <CardDescription className="mt-2 leading-6">
                  Ambiente local para entender hipóteses, lacunas, estado das regras e próximos passos antes de qualquer aprofundamento sério.
                </CardDescription>
              </div>
              <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm">
                <div className="text-muted-foreground">Status da confiança</div>
                <div className="mt-1 font-medium text-white">{simulation?.summary.confidence.label ?? "Aguardando dados"}</div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background p-4 text-sm">
                <div className="flex items-center gap-2 font-medium text-white">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" /> Premissas do perfil
                </div>
                <ul className="mt-3 space-y-2 text-muted-foreground">
                  <li>Modo: {appModeLabels[profile.appMode]}</li>
                  <li>Fluxo: {flowModeLabels[profile.flowMode]}</li>
                  <li>Tipo: {userTypeLabels[profile.userType]}</li>
                  <li>Faturamento: {profile.flowMode === "manual_rapido" ? profile.quickManualInput.monthlyRevenue : revenueRangeLabels[profile.revenueRange]}</li>
                  <li>Atividade: {profile.flowMode === "manual_rapido" ? profile.quickManualInput.activityDescription : activityTypeLabels[profile.activityType]}</li>
                  <li>Regime atual: {profile.flowMode === "manual_rapido" ? (profile.quickManualInput.currentRegime || "não informado") : profile.currentRegime ? profile.currentRegime : "não informado"}</li>
                  <li>CNAE: {profile.quickManualInput.cnaeOrActivityCode || "não informado"}</li>
                  <li>Despesas: {profile.quickManualInput.monthlyExpenses || "não informado"}</li>
                  <li>Período: {profile.flowMode === "manual_rapido" ? profile.quickManualInput.periodLabel : simulationPeriodLabels[profile.simulationPeriod]}</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4 text-sm">
                <div className="flex items-center gap-2 font-medium text-white">
                  <DatabaseZap className="h-4 w-4 text-sky-300" /> Status do pacote de regras
                </div>
                <ul className="mt-3 space-y-2 text-muted-foreground">
                  <li>Bundle: {simulation?.bundleId ?? "mvp-bundle-local-prototype"}</li>
                  <li>Versão: {simulation?.bundleVersion ?? "n/d"}</li>
                  <li>Status: protótipo local / mock / review_required</li>
                  <li>Aprovação: reviewed_internal neste checkpoint</li>
                  <li>Decisão: {simulation?.summary.decisionStatus ?? "pendente"}</li>
                  <li>Racional: {simulation?.summary.confidence.rationale ?? "Preencha o onboarding para gerar um cenário."}</li>
                </ul>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-3">
            {scenarioCards.length > 0 ? (
              scenarioCards.map((scenario) => (
                <Card key={scenario.id} className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{scenario.title}</CardTitle>
                      <CardDescription className="mt-2 leading-6">{scenario.description}</CardDescription>
                    </div>
                    <Badge variant="outline">{scenario.badge}</Badge>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Economia estimada</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{formatMockCurrency(scenario.delta)}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">Confiança visual: {scenario.confidence}</div>
                </Card>
              ))
            ) : (
              <Card className="xl:col-span-3">
                <CardTitle>Sem cenários ainda</CardTitle>
                <CardDescription className="mt-2 leading-6">
                  Complete o onboarding anônimo e aceite os avisos para gerar os cards mock do workspace.
                </CardDescription>
              </Card>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-300" />
                <CardTitle className="text-lg">Alertas e lacunas</CardTitle>
              </div>
              {simulation ? (
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {simulation.audit.warnings.map((warning) => (
                    <li key={warning.id} className="rounded-2xl border border-border bg-background p-3">
                      <div className="font-medium text-white">{warning.title}</div>
                      <div className="mt-1">{warning.message}</div>
                    </li>
                  ))}
                  {simulation.audit.missingData.map((gap) => (
                    <li key={gap.id} className="rounded-2xl border border-border bg-background p-3">
                      <div className="font-medium text-white">{gap.label}</div>
                      <div className="mt-1">{gap.description}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <CardDescription>Ainda não há alertas porque nenhuma simulação local foi gerada.</CardDescription>
              )}
            </Card>

            <Card className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                <CardTitle className="text-lg">Guardrails essenciais</CardTitle>
              </div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="rounded-2xl border border-border bg-background p-3">
                  <strong>Resultado atual:</strong> cenários mock usados para validar UX, arquitetura local-first e tomada de decisão prudente.
                </li>
                <li className="rounded-2xl border border-border bg-background p-3">
                  <strong>O que não é:</strong> cálculo fiscal oficial, parecer contábil ou interpretação normativa automatizada.
                </li>
                <li className="rounded-2xl border border-border bg-background p-3">
                  <strong>Condição para seguir:</strong> dados rápidos ou documentais precisam passar por revisão humana antes de qualquer uso prático.
                </li>
              </ul>
            </Card>
          </div>

          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FilePenLine className="h-4 w-4 text-violet-300" />
                <CardTitle className="text-lg">Trilha técnica de auditoria</CardTitle>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditTrail((prev) => !prev)}
                className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
                  showAuditTrail
                    ? "border-violet-400/50 bg-violet-400/10 text-violet-200"
                    : "border-border text-muted-foreground hover:border-violet-400/30"
                }`}
              >
                {showAuditTrail ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            {showAuditTrail && simulation ? (
              <div className="max-h-96 space-y-2 overflow-y-auto text-sm">
                {simulation.audit.timeline.length > 0 ? (
                  simulation.audit.timeline.map((event, index) => (
                    <div key={index} className="rounded-xl border border-border bg-background p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-white">{event.kind}</span>
                        <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                      </div>
                      <div className="mt-1 text-muted-foreground">{event.message}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground">Nenhum evento na timeline da simulação atual.</div>
                )}
                {simulation.audit.premises.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Premissas aplicadas</div>
                    {simulation.audit.premises.map((premise, index) => (
                      <div key={index} className="rounded-xl border border-border bg-background p-3">
                        <div className="font-medium text-white">{premise.label}</div>
                        <div className="mt-1 text-muted-foreground">{premise.description}</div>
                      </div>
                    ))}
                  </div>
                )}
                {simulation.audit.appliedRules.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Regras aplicadas</div>
                    {simulation.audit.appliedRules.map((rule, index) => (
                      <div key={index} className="rounded-xl border border-border bg-background p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-white">{rule.title}</span>
                          <span className="text-xs text-muted-foreground">{rule.status}</span>
                        </div>
                        <div className="mt-1 text-muted-foreground">{rule.reason}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : showAuditTrail ? (
              <CardDescription>Gere uma simulação para visualizar a trilha de auditoria.</CardDescription>
            ) : (
              <CardDescription>Ative para inspecionar premissas, regras aplicadas e timeline da simulação.</CardDescription>
            )}
          </Card>
        </div>
      </div>

      <ReportWorkspace
        profile={profile}
        simulation={simulation}
        persistedReport={persistedReport}
        documents={documents}
        onReportPersisted={(report) => setPersistedReport(report)}
      />

      <OperationalReadinessPanel
        profile={profile}
        simulation={simulation}
        persistedReport={persistedReport}
        documents={documents}
      />
    </section>
  );
}
