import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { runFakeSimulation } from "@/engine/fake-simulation";

export function FakeSimulationPreview() {
  const result = runFakeSimulation();

  return (
    <Card className="space-y-5">
      <div>
        <CardTitle>Prévia de simulação local (mock)</CardTitle>
        <CardDescription className="mt-2 leading-6">
          Exemplo determinístico e local para validar o fluxo do starter. Não representa orientação fiscal oficial.
        </CardDescription>
      </div>

      <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-5">
        <div className="text-sm text-emerald-200">Cenário comparado</div>
        <div className="mt-2 text-3xl font-semibold text-white">{result.summary.estimatedSavingsLabel}</div>
        <p className="mt-2 text-sm leading-6 text-slate-300">{result.summary.narrative}</p>
      </div>

      <div className="space-y-3 text-sm text-muted-foreground">
        <div>
          <strong className="text-foreground">Premissas:</strong> {result.audit.assumptions.join(" • ")}
        </div>
        <div>
          <strong className="text-foreground">Regras avaliadas:</strong> {result.audit.appliedRules.join(" • ")}
        </div>
        <div>
          <strong className="text-foreground">Pendências:</strong> {result.audit.missingData.join(" • ")}
        </div>
      </div>
    </Card>
  );
}