/**
 * PDF export using pdfmake — generates real PDF bytes in the browser.
 * Loaded lazily so it doesn't bloat the initial bundle.
 */
import type { UserReport } from "@/models/report";
import type { ReadinessSnapshotArtifact } from "@/models/report";

type PdfMakeContent = unknown;

interface DocDefinition {
  content: PdfMakeContent[];
  styles?: Record<string, unknown>;
  defaultStyle?: Record<string, unknown>;
  pageSize?: string;
  pageMargins?: number[];
  info?: Record<string, string>;
}

function heading(text: string): PdfMakeContent {
  return { text, style: "heading", margin: [0, 12, 0, 4] };
}

function subheading(text: string): PdfMakeContent {
  return { text, style: "subheading", margin: [0, 8, 0, 2] };
}

function body(text: string): PdfMakeContent {
  return { text, style: "body", margin: [0, 2, 0, 2] };
}

function hr(): PdfMakeContent {
  return { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: "#334155" }], margin: [0, 6, 0, 6] };
}

function kv(label: string, value: string): PdfMakeContent {
  return { text: [{ text: `${label}: `, bold: true }, value], style: "body", margin: [0, 1, 0, 1] };
}

function disclaimer(text: string): PdfMakeContent {
  return { text, style: "disclaimer", margin: [0, 4, 0, 4] };
}

function buildDocDefinition(report: UserReport, readinessSnapshot?: ReadinessSnapshotArtifact): DocDefinition {
  const content: PdfMakeContent[] = [];

  // ── Header ──────────────────────────────────────────────────────────────────
  content.push({ text: "EconomizaIA Local", style: "title" });
  content.push({ text: report.title, style: "subtitle", margin: [0, 2, 0, 0] });
  content.push({ text: `Gerado em: ${report.footer.generatedAtLabel} | Versão: ${report.footer.mockVersion}`, style: "caption", margin: [0, 4, 0, 8] });
  content.push(hr());

  // ── Disclaimer principal ─────────────────────────────────────────────────────
  content.push(disclaimer(report.footer.disclaimer));
  content.push(hr());

  // ── Resumo executivo ─────────────────────────────────────────────────────────
  content.push(heading("Resumo Executivo"));
  content.push(body(report.summary.executive));
  content.push(kv("Economia estimada", report.summary.estimatedSavingsLabel));
  content.push(kv("Status da decisão", report.summary.decisionStatus));
  content.push(kv("Cenário atual", report.summary.scenarioLabel));

  // ── Confiança ────────────────────────────────────────────────────────────────
  content.push(heading("Confiança"));
  content.push(kv("Nível", `${report.confidence.label} (${report.confidence.score})`));
  content.push(body(report.confidence.rationale));
  if (report.confidence.drivers.length > 0) {
    content.push(subheading("Fatores"));
    content.push({ ul: report.confidence.drivers, style: "body", margin: [12, 2, 0, 2] } as PdfMakeContent);
  }

  // ── Premissas ────────────────────────────────────────────────────────────────
  content.push(heading("Premissas"));
  for (const premise of report.premises) {
    content.push(subheading(premise.label));
    content.push(body(premise.description));
    if (premise.valueLabel) content.push(kv("Valor", premise.valueLabel));
    if (premise.explicitPlaceholder) content.push(disclaimer("Marcado como mock/placeholder — requer validação."));
  }

  // ── Alertas ──────────────────────────────────────────────────────────────────
  if (report.alerts.length > 0) {
    content.push(heading("Alertas"));
    for (const alert of report.alerts) {
      content.push(subheading(alert.title));
      content.push(body(alert.message));
    }
  }

  // ── Lacunas de dados ─────────────────────────────────────────────────────────
  if (report.gaps.length > 0) {
    content.push(heading("Lacunas de Dados"));
    for (const gap of report.gaps) {
      content.push(subheading(gap.label));
      content.push(body(gap.description));
      content.push(kv("Ação sugerida", gap.suggestedAction));
    }
  }

  // ── Contexto normativo (RAG) ──────────────────────────────────────────────
  if (report.explanation && report.explanation.blocks.length > 0) {
    content.push(heading("Contexto Normativo Recuperado"));
    content.push(body(report.explanation.summary));
    for (const block of report.explanation.blocks) {
      content.push(subheading(block.title));
      content.push(body(block.summary));
      if (block.explicitPlaceholder) content.push(disclaimer("Bloco marcado como placeholder."));
    }
  }

  // ── Gate de prontidão ────────────────────────────────────────────────────────
  if (readinessSnapshot) {
    content.push(heading("Gate de Prontidão (Snapshot)"));
    content.push(kv("Status", readinessSnapshot.statusLabel));
    content.push(body(readinessSnapshot.summary));
    content.push(kv("Confiança", readinessSnapshot.evidence.confidenceLabel));
    content.push(kv("Docs revisados", String(readinessSnapshot.evidence.documentReviewConfirmedCount)));
    content.push(kv("Docs pendentes", String(readinessSnapshot.evidence.documentReviewPendingCount)));
    content.push(kv("Lacunas críticas", String(readinessSnapshot.evidence.criticalMissingCount)));
    if (readinessSnapshot.nextSteps.length > 0) {
      content.push(subheading("Próximos passos"));
      content.push({ ul: readinessSnapshot.nextSteps, style: "body", margin: [12, 2, 0, 2] } as PdfMakeContent);
    }
  }

  // ── Fonte das regras ─────────────────────────────────────────────────────────
  content.push(heading("Fonte das Regras"));
  content.push(kv("Bundle", report.sourceSimulation.bundleId));
  content.push(kv("Versão", report.sourceSimulation.bundleVersion));
  content.push(kv("Status", report.sourceSimulation.status));
  content.push(disclaimer("As regras neste bundle têm status 'review_required'. Não constituem parecer fiscal oficial."));

  // ── Footer disclaimer ─────────────────────────────────────────────────────────
  content.push(hr());
  content.push(disclaimer(
    "Este documento foi gerado localmente pelo EconomizaIA Local e não saiu do seu dispositivo. " +
    "Nenhum dado foi enviado a servidores externos. " +
    "Revisão humana por contador ou advogado tributarista é obrigatória antes de qualquer decisão fiscal."
  ));

  return {
    content,
    pageSize: "A4",
    pageMargins: [40, 50, 40, 50],
    info: {
      title: report.title,
      author: "EconomizaIA Local",
      subject: "Relatório fiscal estimativo",
      keywords: "simples nacional, mei, lucro presumido, brasil",
    },
    defaultStyle: { font: "Roboto", fontSize: 10, color: "#e2e8f0" },
    styles: {
      title: { fontSize: 20, bold: true, color: "#f8fafc" },
      subtitle: { fontSize: 13, color: "#94a3b8" },
      caption: { fontSize: 8, color: "#64748b" },
      heading: { fontSize: 13, bold: true, color: "#f1f5f9", fillColor: "#1e293b" },
      subheading: { fontSize: 10, bold: true, color: "#cbd5e1" },
      body: { fontSize: 10, color: "#94a3b8", lineHeight: 1.5 },
      disclaimer: { fontSize: 8, color: "#f59e0b", italics: true, lineHeight: 1.4 },
    },
  };
}

/**
 * Generate PDF bytes from a report.
 * Loads pdfmake lazily. Returns null if generation fails.
 */
export async function generateReportPdf(
  report: UserReport,
  readinessSnapshot?: ReadinessSnapshotArtifact,
): Promise<Blob | null> {
  try {
    const pdfMake = (await import("pdfmake/build/pdfmake")).default;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfFonts = (await import("pdfmake/build/vfs_fonts")) as any;
    // pdfmake v0.3 attaches vfs via the fonts object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pdfMake as any).vfs = pdfFonts.default?.pdfMake?.vfs ?? pdfFonts.pdfMake?.vfs ?? pdfFonts.default ?? pdfFonts;

    const docDefinition = buildDocDefinition(report, readinessSnapshot);

    return await new Promise<Blob>((resolve, reject) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfDoc = (pdfMake as any).createPdf(docDefinition);
        pdfDoc.getBlob((blob: Blob) => resolve(blob));
      } catch (e) {
        reject(e);
      }
    });
  } catch {
    return null;
  }
}

/**
 * Download a PDF file directly in the browser.
 */
export function downloadPdfBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
