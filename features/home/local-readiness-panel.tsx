import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { starterRuleBundle } from "@/engine/starter-rule-bundle";

export function LocalReadinessPanel() {
  const isProduction = starterRuleBundle.bundleStatus === "active";

  return (
    <Card className="space-y-5 border-green-500/30 bg-green-950/10">
      <div>
        <div className="flex items-center gap-2">
          <CardTitle>App em Modo Produção</CardTitle>
          {isProduction && (
            <span className="rounded-full bg-green-500 px-2.5 py-0.5 text-xs font-medium text-white">
              v1.0 Ativo
            </span>
          )}
        </div>
        <CardDescription className="mt-2 leading-6">
          {isProduction 
            ? "Cálculos reais ativados. O motor tributário agora gera estimativas funcionais com base nos seus dados."
            : "Estrutura local-first pronta para uso real."
          }
        </CardDescription>
      </div>

      <div className="rounded-xl border border-green-500/30 bg-background/60 p-4 text-sm">
        <p className="font-medium text-green-400">✓ Rule Engine v1.0 ativo</p>
        <p className="mt-1 text-muted-foreground">
          MEI • Simples Nacional • Lucro Presumido com cálculos determinísticos
        </p>
      </div>
    </Card>
  );
}
