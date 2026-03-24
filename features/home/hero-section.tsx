import { ShieldCheck, DatabaseZap, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function HeroSection() {
  return (
    <section className="grid gap-8 rounded-[2rem] border border-border/70 bg-card/70 p-8 shadow-2xl shadow-emerald-950/20 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
      <div className="space-y-6">
        <Badge>Local-first • PWA • sem backend remoto</Badge>
        <div className="space-y-4">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
            EconomizaIA Local: base pronta para simular cenários tributários com IA explicativa no próprio dispositivo.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            Este starter organiza a fundação do produto com Next.js 15, TypeScript, Tailwind, componentes de UI e camadas iniciais para armazenamento local, rule engine auditável, OCR, RAG local e WebLLM.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg">Explorar arquitetura inicial</Button>
          <Button variant="outline" size="lg">Validar fluxo local-first</Button>
        </div>
        <ul className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Seus dados ficam no dispositivo</li>
          <li className="flex items-center gap-2"><DatabaseZap className="h-4 w-4 text-emerald-400" /> Persistência local preparada</li>
          <li className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-emerald-400" /> IA local como camada explicativa</li>
        </ul>
      </div>

      <div className="rounded-[1.75rem] border border-emerald-400/15 bg-slate-950/60 p-6">
        <div className="mb-4 text-sm font-medium text-emerald-300">Posicionamento do produto</div>
        <div className="space-y-4 text-sm leading-6 text-slate-300">
          <p>
            O foco aqui é entregar um app auditável e conservador: o motor de regras calcula, a IA explica, e todos os pontos ainda são marcados como <strong>mock</strong> ou <strong>placeholder</strong> onde não há regra oficial consolidada no código.
          </p>
          <p>
            A arquitetura já deixa espaço para pdf.js, Tesseract.js, workers, bundles normativos versionados, retrieval local e inferência WebGPU sem exigir nenhum serviço remoto.
          </p>
        </div>
      </div>
    </section>
  );
}