import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

const stages = [
  {
    title: "Registro local",
    description: "Arquivo é catalogado no navegador com metadados e referência local para futuras revisões.",
  },
  {
    title: "Classificação e leitura",
    description: "Pipeline detecta o tipo do arquivo e prepara extração textual com stubs explícitos.",
  },
  {
    title: "Auditoria pronta",
    description: "Cada passo gera eventos auditáveis, facilitando inspeção humana e evolução incremental.",
  },
];

export function DocumentIngestionOverview() {
  return (
    <Card className="space-y-6">
      <div className="space-y-2">
        <Badge>Checkpoint: document ingestion pipeline skeleton</Badge>
        <CardTitle>Nova trilha local para ingestão documental</CardTitle>
        <CardDescription>
          Este checkpoint adiciona upload inicial, persistência local e uma pipeline fake para preparar OCR, leitura de PDF, entidades extraídas e auditoria de execução.
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
