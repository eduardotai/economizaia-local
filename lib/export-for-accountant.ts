/**
 * Exportação de dados estruturados para revisão por contador.
 * Gera JSON auditável e CSV simples a partir da simulação + perfil + documentos.
 * Nenhum dado sai do dispositivo — o arquivo é criado e baixado localmente.
 */
import type { SimulationResult } from "@/models/domain";
import type { AnonymousOnboardingProfile } from "@/models/onboarding";
import type { IngestedDocument } from "@/models/documents";
import type { PersistedUserReport } from "@/models/report";

// ── Estrutura do pacote JSON para o contador ──────────────────────────────────

export interface AccountantExportPackage {
  meta: {
    exportedAt: string;
    exportVersion: "accountant-export-v1";
    disclaimer: string;
    localOnly: true;
  };
  perfil: {
    tipoUsuario: string;
    faixaFaturamento: string;
    tipoAtividade: string;
    cnae?: string;
    regimeAtual: string;
    periodoReferencia: string;
    faturamentoMensal?: string;
    despesasMensais?: string;
    descricaoAtividade?: string;
  };
  simulacao: {
    id: string;
    geradaEm: string;
    status: string;
    bundleId: string;
    bundleVersao: string;
    bundleStatus: string;
    confianca: {
      nivel: string;
      score: number;
      racional: string;
      fatores: string[];
      bloqueadores: string[];
    };
    economiaEstimada: {
      valorMensal: number;
      label: string;
      statusDecisao: string;
    };
    cenarioAtual: {
      label: string;
      impostomensal: number;
      confianca: string;
      notas: string[];
    };
    cenarioSugerido?: {
      label: string;
      impostoMensal: number;
      confianca: string;
      notas: string[];
    };
    alertas: Array<{
      severidade: string;
      titulo: string;
      mensagem: string;
      requerRevisaoHumana: boolean;
    }>;
    lacunasDeDados: Array<{
      campo: string;
      label: string;
      descricao: string;
      severidade: string;
      bloqueante: boolean;
      impacto: string;
      acaoSugerida: string;
    }>;
    premissas: Array<{
      label: string;
      descricao: string;
      tipo: string;
      valorDeclarado?: string | number | boolean | null;
      placeholder: boolean;
    }>;
    regrasAplicadas: Array<{
      regraNome: string;
      status: string;
      motivo: string;
    }>;
  };
  documentos: Array<{
    nome: string;
    tipo: string;
    status: string;
    revisaoConfirmada: boolean;
    camposExtraidos: Array<{
      label: string;
      valor: string;
      estadoRevisao: string;
      requerRevisao: boolean;
    }>;
    alertasProcessamento: string[];
  }>;
  relatorio?: {
    id: string;
    titulo: string;
    geradoEm: string;
    versaoBundle: string;
  };
}

// ── Builder do JSON ───────────────────────────────────────────────────────────

export function buildAccountantExportPackage(params: {
  profile: AnonymousOnboardingProfile;
  simulation: SimulationResult;
  documents: IngestedDocument[];
  persistedReport: PersistedUserReport | null;
}): AccountantExportPackage {
  const { profile, simulation, documents, persistedReport } = params;
  const quick = profile.quickManualInput;

  return {
    meta: {
      exportedAt: new Date().toISOString(),
      exportVersion: "accountant-export-v1",
      disclaimer:
        "Exportação local-first gerada pelo EconomizaIA Local. " +
        "Todas as estimativas são preliminares, baseadas em dados declarados pelo usuário e no bundle de regras em revisão. " +
        "Não substitui análise de contador habilitado. " +
        "Nenhum dado foi enviado a servidores externos.",
      localOnly: true,
    },
    perfil: {
      tipoUsuario: profile.userType,
      faixaFaturamento: profile.revenueRange,
      tipoAtividade: profile.activityType,
      cnae: quick.cnaeOrActivityCode || undefined,
      regimeAtual: quick.currentRegime || profile.currentRegime,
      periodoReferencia: quick.periodLabel || profile.simulationPeriod,
      faturamentoMensal: quick.monthlyRevenue || undefined,
      despesasMensais: quick.monthlyExpenses || undefined,
      descricaoAtividade: quick.activityDescription || undefined,
    },
    simulacao: {
      id: simulation.id,
      geradaEm: simulation.createdAt,
      status: simulation.status,
      bundleId: simulation.bundleId,
      bundleVersao: simulation.bundleVersion,
      bundleStatus: "review_required",
      confianca: {
        nivel: simulation.summary.confidence.level,
        score: simulation.summary.confidence.score,
        racional: simulation.summary.confidence.rationale,
        fatores: [...simulation.summary.confidence.drivers],
        bloqueadores: [...(simulation.summary.confidence.blockers ?? [])],
      },
      economiaEstimada: {
        valorMensal: simulation.summary.estimatedSavings,
        label: simulation.summary.estimatedSavingsLabel,
        statusDecisao: simulation.summary.decisionStatus,
      },
      cenarioAtual: {
        label: simulation.currentScenario.label,
        impostomensal: simulation.currentScenario.monthlyTaxEstimate,
        confianca: simulation.currentScenario.confidence.label,
        notas: [...simulation.currentScenario.notes],
      },
      cenarioSugerido: simulation.suggestedScenario
        ? {
            label: simulation.suggestedScenario.label,
            impostoMensal: simulation.suggestedScenario.monthlyTaxEstimate,
            confianca: simulation.suggestedScenario.confidence.label,
            notas: [...simulation.suggestedScenario.notes],
          }
        : undefined,
      alertas: simulation.audit.warnings.map((w) => ({
        severidade: w.severity,
        titulo: w.title,
        mensagem: w.message,
        requerRevisaoHumana: w.requiresHumanReview,
      })),
      lacunasDeDados: simulation.audit.missingData.map((g) => ({
        campo: g.field,
        label: g.label,
        descricao: g.description,
        severidade: g.severity,
        bloqueante: g.blocking,
        impacto: g.whyItMatters,
        acaoSugerida: g.suggestedAction,
      })),
      premissas: simulation.audit.premises.map((p) => ({
        label: p.label,
        descricao: p.description,
        tipo: p.kind,
        valorDeclarado: p.value,
        placeholder: p.explicitPlaceholder,
      })),
      regrasAplicadas: simulation.audit.appliedRules.map((r) => ({
        regraNome: r.title,
        status: r.status,
        motivo: r.reason,
      })),
    },
    documentos: documents.map((doc) => ({
      nome: doc.originalFileName,
      tipo: doc.kind,
      status: doc.status,
      revisaoConfirmada: doc.manualReview.confirmed,
      camposExtraidos: doc.manualReview.fields.map((f) => ({
        label: f.label,
        valor: f.value,
        estadoRevisao: f.state,
        requerRevisao: f.state !== "confirmed",
      })),
      alertasProcessamento: [...doc.processingWarnings],
    })),
    relatorio: persistedReport
      ? {
          id: persistedReport.report.id,
          titulo: persistedReport.report.title,
          geradoEm: persistedReport.report.createdAt,
          versaoBundle: persistedReport.report.sourceSimulation.bundleVersion,
        }
      : undefined,
  };
}

// ── CSV ───────────────────────────────────────────────────────────────────────

function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(...cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(escapeCsv).join(",");
}

export function buildAccountantCsv(pkg: AccountantExportPackage): string {
  const lines: string[] = [];

  lines.push("# EconomizaIA Local — Exportacao para Contador");
  lines.push(csvRow("Exportado em", pkg.meta.exportedAt));
  lines.push(csvRow("Disclaimer", pkg.meta.disclaimer));
  lines.push("");

  lines.push("## PERFIL DO USUARIO");
  lines.push(csvRow("Campo", "Valor"));
  lines.push(csvRow("Tipo de usuario", pkg.perfil.tipoUsuario));
  lines.push(csvRow("Faixa de faturamento", pkg.perfil.faixaFaturamento));
  lines.push(csvRow("Tipo de atividade", pkg.perfil.tipoAtividade));
  lines.push(csvRow("CNAE", pkg.perfil.cnae ?? "nao informado"));
  lines.push(csvRow("Regime atual", pkg.perfil.regimeAtual));
  lines.push(csvRow("Periodo de referencia", pkg.perfil.periodoReferencia));
  lines.push(csvRow("Faturamento mensal declarado", pkg.perfil.faturamentoMensal ?? "nao informado"));
  lines.push(csvRow("Despesas mensais declaradas", pkg.perfil.despesasMensais ?? "nao informado"));
  lines.push(csvRow("Descricao da atividade", pkg.perfil.descricaoAtividade ?? "nao informado"));
  lines.push("");

  lines.push("## RESULTADO DA SIMULACAO");
  lines.push(csvRow("Campo", "Valor"));
  lines.push(csvRow("Status", pkg.simulacao.status));
  lines.push(csvRow("Bundle / versao", `${pkg.simulacao.bundleId} @ ${pkg.simulacao.bundleVersao}`));
  lines.push(csvRow("Bundle status", pkg.simulacao.bundleStatus));
  lines.push(csvRow("Confianca", `${pkg.simulacao.confianca.nivel} (score: ${pkg.simulacao.confianca.score})`));
  lines.push(csvRow("Racional da confianca", pkg.simulacao.confianca.racional));
  lines.push(csvRow("Economia estimada mensal", pkg.simulacao.economiaEstimada.label));
  lines.push(csvRow("Cenario atual", pkg.simulacao.cenarioAtual.label));
  lines.push(csvRow("Imposto mensal atual estimado", pkg.simulacao.cenarioAtual.impostomensal));
  if (pkg.simulacao.cenarioSugerido) {
    lines.push(csvRow("Cenario sugerido", pkg.simulacao.cenarioSugerido.label));
    lines.push(csvRow("Imposto mensal sugerido estimado", pkg.simulacao.cenarioSugerido.impostoMensal));
  }
  lines.push("");

  if (pkg.simulacao.premissas.length > 0) {
    lines.push("## PREMISSAS APLICADAS");
    lines.push(csvRow("Label", "Descricao", "Tipo", "Valor declarado", "Placeholder"));
    for (const p of pkg.simulacao.premissas) {
      lines.push(csvRow(p.label, p.descricao, p.tipo, p.valorDeclarado, p.placeholder));
    }
    lines.push("");
  }

  if (pkg.simulacao.lacunasDeDados.length > 0) {
    lines.push("## LACUNAS DE DADOS");
    lines.push(csvRow("Campo", "Label", "Descricao", "Severidade", "Bloqueante", "Impacto", "Acao sugerida"));
    for (const g of pkg.simulacao.lacunasDeDados) {
      lines.push(csvRow(g.campo, g.label, g.descricao, g.severidade, g.bloqueante, g.impacto, g.acaoSugerida));
    }
    lines.push("");
  }

  if (pkg.simulacao.alertas.length > 0) {
    lines.push("## ALERTAS");
    lines.push(csvRow("Severidade", "Titulo", "Mensagem", "Requer revisao humana"));
    for (const a of pkg.simulacao.alertas) {
      lines.push(csvRow(a.severidade, a.titulo, a.mensagem, a.requerRevisaoHumana));
    }
    lines.push("");
  }

  if (pkg.documentos.length > 0) {
    lines.push("## DOCUMENTOS REVISADOS");
    lines.push(csvRow("Arquivo", "Tipo", "Status", "Revisao confirmada", "Campos extraidos", "Campos confirmados"));
    for (const doc of pkg.documentos) {
      const totalCampos = doc.camposExtraidos.length;
      const confirmados = doc.camposExtraidos.filter((f) => f.estadoRevisao === "confirmed").length;
      lines.push(csvRow(doc.nome, doc.tipo, doc.status, doc.revisaoConfirmada, totalCampos, confirmados));
    }
    lines.push("");

    for (const doc of pkg.documentos) {
      if (doc.camposExtraidos.length === 0) continue;
      lines.push(csvRow(`# Campos extraidos: ${doc.nome}`));
      lines.push(csvRow("Label", "Valor", "Estado de revisao"));
      for (const f of doc.camposExtraidos) {
        lines.push(csvRow(f.label, f.valor, f.estadoRevisao));
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ── Download helpers ──────────────────────────────────────────────────────────

export function downloadJsonExport(pkg: AccountantExportPackage): void {
  const json = JSON.stringify(pkg, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `economizaia-contador-${date}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadCsvExport(csv: string): void {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `economizaia-contador-${date}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
