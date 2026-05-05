import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Política de Privacidade</h1>
          <p className="mt-2 text-muted-foreground">EconomizaIA Local — Versão 1.0 • 05 de maio de 2026</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">← Voltar ao app</Link>
        </Button>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Resumo Executivo</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <p>
            O <strong>EconomizaIA Local</strong> é um aplicativo <strong>100% local-first</strong>. 
            Nenhum dado pessoal, fiscal ou documental é enviado para servidores, nuvens ou terceiros.
          </p>
          <p>
            Todo o processamento (OCR, extração de PDF, cálculos tributários, RAG e LLM) acontece 
            exclusivamente no seu navegador.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">1. Quais dados coletamos?</h2>
          <p className="text-muted-foreground">
            <strong>Nenhum dado é coletado por nós.</strong> Todos os dados que você insere (perfil, faturamento, documentos, 
            simulações) ficam armazenados apenas no seu navegador (IndexedDB).
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">2. Base legal (LGPD)</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Consentimento explícito (Art. 7º, I)</li>
            <li>Legítimo interesse (Art. 7º, IX) — apenas para funcionamento do app local</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. Seus direitos</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border p-4">
              <h3 className="font-semibold">Direito de acesso</h3>
              <p className="text-sm text-muted-foreground mt-1">Você pode exportar todos os seus dados a qualquer momento.</p>
            </div>
            <div className="rounded-xl border p-4">
              <h3 className="font-semibold">Direito ao esquecimento</h3>
              <p className="text-sm text-muted-foreground mt-1">Botão "Excluir todos os meus dados" remove permanentemente tudo do seu navegador.</p>
            </div>
            <div className="rounded-xl border p-4">
              <h3 className="font-semibold">Direito de portabilidade</h3>
              <p className="text-sm text-muted-foreground mt-1">Exporte seus dados em JSON estruturado.</p>
            </div>
            <div className="rounded-xl border p-4">
              <h3 className="font-semibold">Direito de revogar consentimento</h3>
              <p className="text-sm text-muted-foreground mt-1">Você pode limpar os dados a qualquer momento.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. Contato</h2>
          <p className="text-muted-foreground">
            Dúvidas sobre privacidade? Entre em contato pelo GitHub ou email do mantenedor.
          </p>
        </section>
      </div>

      <div className="mt-12 text-center text-xs text-muted-foreground">
        Esta política pode ser atualizada. Última atualização: 05/05/2026
      </div>
    </div>
  );
}
