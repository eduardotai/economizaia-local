# EconomizaIA Local

**PWA 100% local-first e offline-first** para identificar oportunidades legais e conservadoras de economia tributaria no contexto da Reforma Tributaria brasileira (IBS/CBS 2026-2033).

> **Aviso:** os resultados sao estimativas preliminares baseadas em dados declarados e no bundle de regras em revisao. Nao substitui analise de contador habilitado. **Revisao humana e obrigatoria** antes de qualquer uso pratico.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| App shell | Next.js 15 (App Router) + React 19 + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Persistencia | IndexedDB + localForage (100% local, zero backend) |
| PDF / OCR | pdfjs-dist + Tesseract.js v6 via Web Workers + Comlink |
| Rule engine | TypeScript puro — MEI, Simples Nacional (Anexos I-V), Lucro Presumido |
| RAG local | Transformers.js (embeddings + retrieval no dispositivo) |
| LLM local | WebLLM (Phi-3.5-mini via WebGPU) — apenas explica, nunca calcula |
| PDF export | pdfmake |
| PWA | next-pwa (offline-first em builds de producao) |

## Principios

- **Zero backend de dados** — nenhum dado fiscal ou documento sai do dispositivo
- **Rule engine acima do LLM** — o motor de regras calcula; o LLM apenas explica
- **Arquitetura auditavel** — premissas, regras aplicadas e trilha reproduzivel em toda sugestao
- **Conservadorismo regulatorio** — na duvida, hipotese conservadora + recomendacao de validacao com contador
- **UX de confianca** — sem promessas magicas; com clareza, limites e disclaimers

## Inicio rapido

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. Para build de producao com PWA:

```bash
npm run build && npm start
```

## Fluxo de uso

1. **Onboarding** — preencha perfil, faturamento, regime, atividade e periodo
2. **Consentimentos** — aceite local-only e mock awareness
3. **Simulacao** — valide prontidao e gere a leitura local (cenarios MEI / Simples / Lucro Presumido)
4. **Documentos** — envie PDFs, imagens ou XMLs; revise campos extraidos e confirme manualmente
5. **Relatorio** — gere o relatorio auditavel com gate de prontidao, exporte HTML ou PDF
6. **Exportacao para contador** — baixe JSON ou CSV estruturado para revisao profissional
7. **Chat local** — faca perguntas sobre a simulacao (WebLLM ou modo leve)

## Comandos

```bash
npm run dev              # Dev server com Turbopack
npm run build            # Build de producao
npm run lint             # ESLint
npm run typecheck        # TypeScript (sem emit)
npm run test:manual-first    # Testes de readiness + reporting + HTML snapshot
npm run test:readiness       # Readiness gate + operational readiness
npm run test:update-snapshots  # Regenerar snapshot HTML
```

## Rule Engine

O motor tributario real (`engine/real-tax-rule-engine.ts`) calcula cenarios deterministicos:

- **MEI**: DAS = 5% salario minimo + ICMS/ISS. Limite R$ 81.000/ano
- **Simples Nacional**: Anexos I-V com aliquotas efetivas por faixa. Fator R (28%) determina Anexo III vs V
- **Lucro Presumido**: IRPJ 15% + adicional, CSLL 9%, PIS 0,65%, COFINS 3%, ISS ~3%

Bundle 2026 com citacoes legais (LC 123/2006, CGSN 140/2018, RIR/2018). Status: `review_required` — todas as regras `draft`.

## IA local (WebGPU)

A camada de IA e **explicativa e opcional**:

- Requer **Chrome 113+** ou **Edge 113+** (WebGPU)
- Modelo Phi-3.5-mini (~2GB) baixado e executado no dispositivo
- Prompt com politica anti-alucinacao: nunca inventa aliquotas ou orientacao fiscal
- Fallback claro quando WebGPU nao esta disponivel — app funciona normalmente em modo leve

## Seguranca e gates

- **Readiness gate** bloqueia simulacao quando consents, campos criticos ou revisao documental estao pendentes
- **Operational readiness** avalia confiabilidade (fragil / demonstravel / confiavel) por snapshots, auditoria e coerencia
- **Recusa controlada** do LLM quando faltam evidencias locais
- **Export auditavel** com disclaimer, premissas, regras e snapshot do gate

## Exportacao para contador

Dois formatos disponiveis no workspace do relatorio:

- **JSON** (`economizaia-contador-YYYY-MM-DD.json`) — pacote estruturado com perfil, simulacao, documentos e metadados
- **CSV** (`economizaia-contador-YYYY-MM-DD.csv`) — planilha com secoes de perfil, resultado, premissas, lacunas, alertas e documentos

Nenhum dado sai do dispositivo — o arquivo e criado e baixado localmente.

## Arquitetura

Detalhes completos em [ARCHITECTURE.md](ARCHITECTURE.md). Backlog tecnico em [BACKLOG.md](BACKLOG.md).

## Licenca

MIT
