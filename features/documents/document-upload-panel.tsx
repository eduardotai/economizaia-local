"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

interface DocumentUploadPanelProps {
  onFilesSelected: (files: FileList | null) => Promise<void>;
  isProcessing: boolean;
}

export function DocumentUploadPanel({ onFilesSelected, isProcessing }: DocumentUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const uploadDoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevProcessing = useRef(isProcessing);

  useEffect(() => {
    if (prevProcessing.current && !isProcessing) {
      setUploadDone(true);
      if (uploadDoneTimer.current) clearTimeout(uploadDoneTimer.current);
      uploadDoneTimer.current = setTimeout(() => setUploadDone(false), 3000);
    }
    prevProcessing.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    return () => {
      if (uploadDoneTimer.current) clearTimeout(uploadDoneTimer.current);
    };
  }, []);

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <CardTitle>Upload inicial de documentos</CardTitle>
        <CardDescription>
          Envie PDFs, imagens ou XMLs para registrar no storage local e acionar a pipeline local com revisão manual obrigatória.
        </CardDescription>
      </div>

      <div
        className={`rounded-3xl border border-dashed p-6 transition ${
          uploadDone
            ? "border-emerald-400 bg-emerald-400/10"
            : isDragging
              ? "border-emerald-400 bg-emerald-400/10"
              : "border-border/80 bg-background/40"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void onFilesSelected(event.dataTransfer.files);
        }}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-emerald-400/10 p-4 text-emerald-300">
            {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : uploadDone ? <CheckCircle2 className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {uploadDone ? "Arquivo processado — veja a lista abaixo" : "Arraste arquivos aqui ou selecione manualmente"}
            </p>
            <p className="max-w-xl text-sm text-muted-foreground">
              Tudo permanece local no navegador. PDFs digitais usam pdf.js como prioridade, XMLs usam parser estrutural genérico/placeholder e OCR segue apenas como fallback técnico.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => inputRef.current?.click()} disabled={isProcessing}>
              Selecionar arquivos
            </Button>
            <span className="text-xs text-muted-foreground">Formatos visados: PDF, PNG/JPG/WebP, XML</span>
          </div>
          <div className="max-w-2xl rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-left text-xs text-amber-100">
            <div className="font-medium text-amber-50">Limites deste checkpoint</div>
            <ul className="mt-2 space-y-1">
              <li>• Tesseract/OCR não é confiável o suficiente para cálculo fiscal nesta versão.</li>
              <li>• XML não recebe interpretação fiscal oficial; apenas leitura genérica de tags e valores.</li>
              <li>• Campos sugeridos podem representar outro trecho do arquivo e exigem revisão/edição humana.</li>
              <li>• Sem confirmação manual, o fluxo deve permanecer bloqueado para cálculo a partir do documento.</li>
            </ul>
          </div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.xml,image/png,image/jpeg,image/jpg,image/webp"
            multiple
            onChange={(event) => {
              void onFilesSelected(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </div>
    </Card>
  );
}
