"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, DatabaseZap, FilePenLine, Lock, RefreshCcw, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { localDb } from "@/db/local-db";
import { mockTaxRuleEngine } from "@/engine/mock-tax-rule-engine";
import { createProfileSavedAuditEvent, createSimulationAuditEvents } from "@/lib/local-audit";
import { saveProfileSnapshot, saveSimulationSnapshot } from "@/lib/local-snapshots";
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
import type { SimulationResult } from "@/models/domain";
import type { AnonymousOnboardingProfile, RevenueRange } from "@/models/onboarding";
import type { PersistedUserReport } from "@/models/report";
import { ReportWorkspace } from "@/features/simulation/report-workspace";

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

export function SimulationWorkspace() {
  const [profile, setProfile] = useState<AnonymousOnboardingProfile | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [persistedReport, setPersistedReport] = useState<PersistedUserReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [storedProfile, latestReport] = await Promise.all([localDb.getAnonymousOnboardingProfile(), localDb.getLatestUserReport()]);
      const nextProfile = storedProfile ?? createEmptyOnboardingProfile();

      if (!mounted) return;

      setProfile(nextProfile);
      setPersistedReport(latestReport);
      if (storedProfile) {
        setSimulation(mockTaxRuleEngine.simulate(onboardingProfileToTaxpayerProfile(storedProfile)));
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

  const canSimulate = Boolean(profile?.consentLocalOnly && profile?.consentMockAwareness);

  async function persistAndSimulate(nextProfile: AnonymousOnboardingProfile) {
    setSaving(true);

    try {
      await localDb.saveAnonymousOnboardingProfile(nextProfile);

      const persistedProfile = onboardingProfileToTaxpayerProfile(nextProfile);
      const simulationResult = mockTaxRuleEngine.simulate(persistedProfile);

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
    } finally {
      setSaving(false);
    }
  }

  function updateProfile<K extends keyof AnonymousOnboardingProfile>(field: K, value: AnonymousOnboardingProfile[K]) {
    if (!profile) return;
    setProfile({ ...profile, [field]: value, updatedAt: new Date().toISOString() });
  }

  function updateQuickManualField<K extends keyof AnonymousOnboardingProfile["quickManualInput"]>(field: K, value: AnonymousOnboardingProfile["quickManualInput"][K]) {
    if (!profile) return;
    setProfile({
      ...profile,
      updatedAt: new Date().toISOString(),
      quickManualInput: {
        ...profile.quickManualInput,
        [field]: value,
      },
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
    <section className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <Card className="space-y-6">
          <div className="space-y-2">
            <Badge variant="secondary">Onboarding anônimo</Badge>
            <CardTitle>Comece sem login e sem backend remoto</CardTitle>
            <CardDescription className="leading-6">
              Este fluxo salva apenas um perfil mínimo no seu navegador. Nada é enviado para servidores neste checkpoint.
            </CardDescription>
          </div>

          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-100">
            <div className="flex items-center gap-2 font-medium">
              <Lock className="h-4 w-4" />
              Privacidade local-first
            </div>
            <p className="mt-2 leading-6">
              Seus dados deste onboarding ficam em armazenamento local do navegador. Você pode limpar depois sem depender de conta.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
            <div className="flex items-center gap-2 font-medium">
              <FilePenLine className="h-4 w-4" />
              Revisao manual antes do calculo
            </div>
            <p className="mt-2 leading-6 text-amber-100/90">
              Dados extraidos de documentos ou informados rapidamente precisam ser revisados manualmente antes de qualquer execucao futura do rule engine. Este checkpoint apenas prepara a UX e a captura local, sem regra fiscal oficial.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Modo do app</span>
              <select
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={profile.appMode}
                onChange={(event) => updateProfile("appMode", event.target.value as AnonymousOnboardingProfile["appMode"])}
              >
                {Object.entries(appModeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Fluxo de entrada</span>
              <select
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={profile.flowMode}
                onChange={(event) => updateProfile("flowMode", event.target.value as AnonymousOnboardingProfile["flowMode"])}
              >
                {Object.entries(flowModeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

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
                      <div className="mt-1 text-xs">Mock/placeholder para orientar a visualização do workspace.</div>
                    </button>
                  );
                })}
              </div>
            </label>
          </div>

          {profile.flowMode === "manual_rapido" ? (
            <div className="space-y-4 rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4">
              <div>
                <div className="text-sm font-medium text-foreground">Modo rápido manual</div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Preencha manualmente os campos críticos para preparar uma futura revisão antes do cálculo: faturamento mensal, despesas dedutíveis, regime atual, CNAE/atividade e período.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">Faturamento mensal</span>
                  <input
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    value={profile.quickManualInput.monthlyRevenue}
                    onChange={(event) => updateQuickManualField("monthlyRevenue", event.target.value)}
                    placeholder="Ex.: 25000"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">Despesas dedutíveis</span>
                  <input
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    value={profile.quickManualInput.monthlyExpenses}
                    onChange={(event) => updateQuickManualField("monthlyExpenses", event.target.value)}
                    placeholder="Ex.: 3500"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">Regime atual</span>
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
                  <span className="font-medium text-foreground">Período</span>
                  <input
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    value={profile.quickManualInput.periodLabel}
                    onChange={(event) => updateQuickManualField("periodLabel", event.target.value)}
                    placeholder="Ex.: Recorte mensal"
                  />
                </label>

                <label className="space-y-2 text-sm sm:col-span-2">
                  <span className="font-medium text-foreground">Atividade / descrição operacional</span>
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
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Fluxo com documentos selecionado. Extrações documentais continuam sujeitas a revisão/edição manual antes de qualquer cálculo.
            </div>
          )}

          <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={profile.consentLocalOnly}
                onChange={(event) => updateProfile("consentLocalOnly", event.target.checked)}
              />
              <span>
                Entendo que este onboarding é <strong>anônimo e local</strong>, com persistência básica apenas neste dispositivo.
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
                Entendo que a simulação deste checkpoint é <strong>mock/placeholder</strong>, não representa cálculo fiscal oficial e exige revisão humana antes de qualquer uso prático.
              </span>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button disabled={!canSimulate || saving} onClick={() => void persistAndSimulate(profile)}>
              {saving ? "Salvando..." : "Salvar perfil local e simular"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const fresh = createEmptyOnboardingProfile();
                setProfile(fresh);
                setSimulation(null);
                setPersistedReport(null);
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
                  Ambiente local para entender hipóteses, lacunas e cenários artificiais antes de qualquer modelagem séria.
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
                  <DatabaseZap className="h-4 w-4 text-sky-300" /> Estado do motor mock
                </div>
                <ul className="mt-3 space-y-2 text-muted-foreground">
                  <li>Bundle: {simulation?.bundleId ?? "starter-mock"}</li>
                  <li>Versão: {simulation?.bundleVersion ?? "n/d"}</li>
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
                <CardTitle className="text-lg">Disclaimers deste checkpoint</CardTitle>
              </div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="rounded-2xl border border-border bg-background p-3">
                  Todo cenário exibido aqui é <strong>mock/placeholder</strong> e serve apenas para validação de UX e arquitetura local-first.
                </li>
                <li className="rounded-2xl border border-border bg-background p-3">
                  Não há cálculo fiscal real, interpretação normativa oficial ou recomendação contábil automatizada neste fluxo.
                </li>
                <li className="rounded-2xl border border-border bg-background p-3">
                  Dados extraídos de documentos ou preenchidos no modo rápido manual precisam ser revisados antes do cálculo.
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </div>

      <ReportWorkspace
        profile={profile}
        simulation={simulation}
        persistedReport={persistedReport}
        onReportPersisted={(report) => setPersistedReport(report)}
      />
    </section>
  );
}
