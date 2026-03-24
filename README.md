# EconomizaIA Local

Starter funcional para um app **Next.js 15 + TypeScript + Tailwind + estilo shadcn/ui + PWA**, desenhado como base **local-first** para evoluir o produto EconomizaIA Local.

> **Importante:** este repositório inicial **não implementa regra fiscal oficial**. Os cálculos exibidos e a nova pipeline documental são **mocks/placeholders técnicos** para validar arquitetura, UX e integração local.

## Checkpoint atual

### Document ingestion pipeline skeleton

Este checkpoint adiciona uma trilha inicial de ingestão documental totalmente local no navegador:

- Upload de arquivos na UI com drag and drop
- Tipos dedicados para documentos, páginas, jobs de OCR, entidades e auditoria
- Registro do documento no storage local via `localForage`
- Pipeline fake/placeholder para:
  - detectar tipo do arquivo
  - extrair texto de PDF (stub)
  - enfileirar OCR (stub)
  - gerar entidades extraídas mockadas
- Lista visual de arquivos com status, warnings e contagem de páginas/jobs/entidades
- Preparação explícita para auditoria local dos passos executados

> **Limite intencional deste checkpoint:** OCR real, parsing real de PDF e extração estruturada confiável ainda não estão implementados. Tudo continua local-first e marcado como placeholder onde apropriado.

## O que já vem pronto

- App Router com `app/layout.tsx` e `app/page.tsx`
- Tailwind configurado
- Componentes base de UI no estilo shadcn/ui (`Button`, `Card`, `Badge`)
- Manifest PWA inicial
- Estrutura de pastas para domínio, engine, storage, workers, RAG e modelos locais
- Camada inicial de storage com `localForage`
- Rule engine fake/local com trilha de auditoria
- Pipeline documental local inicial com upload, persistência e auditoria
- Placeholders explícitos para `pdf.js`, `Tesseract.js`, `Web Workers`, `RAG local` e `WebLLM`

## Estrutura

```txt
app/
components/
features/
engine/
db/
workers/
rag/
models/
lib/
public/
```

## Como rodar localmente

### 1. Instalar dependências

```bash
npm install
```

### 2. Rodar em desenvolvimento

```bash
npm run dev
```

A aplicação deverá abrir em:

```txt
http://localhost:3000
```

### 3. Validar tipos

```bash
npm run typecheck
```

### 4. Gerar build local

```bash
npm run build
npm start
```

## Fluxo documental atual

1. Usuário envia PDF, imagem ou XML pela interface.
2. O app registra metadados do arquivo no storage local do navegador.
3. A pipeline detecta o tipo do documento.
4. Se for PDF, cria uma etapa stub de extração textual.
5. Se for imagem/PDF, cria um job stub de OCR.
6. O sistema gera entidades mockadas para validar revisão humana e UX.
7. Cada passo entra na trilha de auditoria local do documento.

## Contrato do rule engine

Documentação curta deste checkpoint:

- `docs/rule-engine-contract.md`
- `docs/snapshots/simulation-input-success.mock.json`
- `docs/snapshots/simulation-output-success.mock.json`
- `docs/snapshots/simulation-input-insufficient.mock.json`
- `docs/snapshots/simulation-output-insufficient.mock.json`

Esses artefatos documentam o contrato expandido do motor, incluindo confidence bands, premissas, lacunas de dados, alertas, trilha de auditoria e recusa mock por insuficiência de dados.

## Observações importantes

- O PWA está configurado para produção via `next-pwa`.
- Em desenvolvimento, o service worker fica desabilitado para evitar ruído durante implementação.
- Os ícones atuais são placeholders mínimos e podem ser substituídos depois.
- `engine/mock-tax-rule-engine.ts` existe apenas para demonstrar a forma do cálculo auditável.
- `db/local-db.ts` já fornece a base para persistência local de perfis, documentos, bundles, simulações e ingestão documental.
- Os `object URLs` dos arquivos existem só no navegador atual; persistência binária real pode evoluir depois com IndexedDB/Blob mais robusto.

## Próximos passos sugeridos

1. Substituir o bundle mock por um pacote normativo versionado revisado por especialista.
2. Implementar workers reais para `pdf.js` e `Tesseract.js`.
3. Criar revisão manual de entidades/documentos antes de qualquer uso em cálculo.
4. Adicionar parser XML local mais estruturado.
5. Criar indexação local de fontes normativas para RAG.
6. Acoplar WebLLM somente como explicador do resultado estruturado.

## Stack planejada

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- localForage / IndexedDB
- pdf.js
- Tesseract.js
- Web Workers
- Transformers.js
- WebLLM

## Estado atual

O que já funciona neste starter:

- Renderização da home em português brasileiro
- Layout base com identidade visual inicial
- Cards de posicionamento do produto
- Leitura de uma simulação fake/local no front
- Upload inicial de documentos com processamento placeholder
- Persistência local de documentos ingeridos e auditoria básica
- Estrutura de código pronta para expansão local-first

O que ainda está como placeholder:

- OCR real
- Leitura real de PDF
- Parser XML completo
- RAG real
- WebLLM real
- Regras tributárias oficiais
- Extração documental confiável para uso produtivo
