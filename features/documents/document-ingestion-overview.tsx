import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

const stages = [
  {
    title: "Registro local",
    description: "Arquivo é catalogado no navegador com metadados e referência local para futuras revisões.",
  },
  {
    title: "Extração textual priorizada",
    description: "PDF digital deve priorizar pdf.js; OCR existe apenas como fallback quando não houver texto selecionável suficiente.",
  },
  {
    title: "Revisão manual antes do cálculo",
    description: "Campos extraídos ou digitados precisam ser revisados/editados manualmente antes de qualquer execução futura do rule engine.",
  },
];

export function DocumentIngestionOverview() {
  return (
    <Card className="space-y-6">
      <div className="space-y-2">
        <Badge>Checkpoint: revisão manual obrigatória + parser XML placeholder</Badge>
        <CardTitle>Nova trilha local para ingestão documental</CardTitle>
        <CardDescription>
          Este checkpoint reforça a priorização de leitura textual com pdf.js para PDF digital, mantém OCR apenas como fallback e destaca uma etapa de revisão/edição manual antes de qualquer cálculo.
        </CardDescription>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stages.map((stage) => (
          <div key={stage.title} className="rounded-3xl border border-border/70 bg-background/40 p-4">
            <div className="text-sm font-medium text-foreground">{stage.title}</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{stage.description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
