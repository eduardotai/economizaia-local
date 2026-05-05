"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { deleteAllUserData, exportAllUserData } from "@/lib/privacy-utils";
import Link from "next/link";

export function PrivacySettings() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleDeleteAll = async () => {
    if (!confirm("Tem certeza? Isso vai apagar TODOS os seus dados permanentemente (perfil, documentos, simulações e relatórios). Esta ação não pode ser desfeita.")) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAllUserData();
      alert("Todos os seus dados foram excluídos com sucesso. O app será recarregado.");
      window.location.reload();
    } catch (error) {
      alert("Erro ao excluir dados. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const jsonData = await exportAllUserData();
      const blob = new Blob([jsonData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `economizaia-dados-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert("Erro ao exportar dados.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">Configurações de Privacidade (LGPD)</CardTitle>
        <CardDescription>
          Controle total sobre seus dados. Tudo fica no seu dispositivo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Processamento local-only</p>
              <p className="text-sm text-muted-foreground">Aceito que todos os dados sejam processados exclusivamente no meu navegador</p>
            </div>
            <Switch defaultChecked disabled />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Uso de LLM local (WebLLM)</p>
              <p className="text-sm text-muted-foreground">Aceito usar IA local para explicações (opcional)</p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Armazenamento local</p>
              <p className="text-sm text-muted-foreground">Aceito que dados fiquem salvos no navegador (IndexedDB)</p>
            </div>
            <Switch defaultChecked disabled />
          </div>
        </div>

        <div className="pt-4 border-t flex flex-col gap-3">
          <Button asChild variant="outline" className="w-full">
            <Link href="/privacy">Ver Política de Privacidade completa</Link>
          </Button>

          <Button 
            onClick={handleExport} 
            disabled={isExporting}
            variant="outline" 
            className="w-full"
          >
            {isExporting ? "Exportando..." : "Exportar todos os meus dados (JSON)"}
          </Button>

          <Button 
            onClick={handleDeleteAll} 
            disabled={isDeleting}
            variant="destructive" 
            className="w-full"
          >
            {isDeleting ? "Excluindo..." : "Excluir TODOS os meus dados permanentemente"}
          </Button>
        </div>

        <p className="text-[10px] text-center text-muted-foreground">
          Seus direitos LGPD estão garantidos. Esta ação só afeta os dados neste navegador.
        </p>
      </div>
    </Card>
  );
}
