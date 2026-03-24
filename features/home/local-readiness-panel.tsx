import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { localReadinessChecklist } from "@/models/foundation";

export function LocalReadinessPanel() {
  return (
    <Card className="space-y-5">
      <div>
        <CardTitle>Camadas locais já preparadas</CardTitle>
        <CardDescription className="mt-2 leading-6">
          Estrutura inicial para evoluir o produto sem mudar o princípio central: processamento e armazenamento no dispositivo do usuário.
        </CardDescription>
      </div>

      <div className="grid gap-3">
        {localReadinessChecklist.map((item) => (
          <div key={item.title} className="rounded-2xl border border-border/70 bg-background/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{item.title}</p>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">{item.status}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}