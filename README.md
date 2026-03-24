# EconomizaIA Local

Starter funcional para um app **Next.js 15 + TypeScript + Tailwind + estilo shadcn/ui + PWA**, desenhado como base **local-first** para evoluir o produto EconomizaIA Local.

> **Importante:** este repositório inicial **não implementa regra fiscal oficial**. Os cálculos exibidos são **mocks/placeholders técnicos** para validar arquitetura, UX e integração local.

## O que já vem pronto

- App Router com `app/layout.tsx` e `app/page.tsx`
- Tailwind configurado
- Componentes base de UI no estilo shadcn/ui (`Button`, `Card`, `Badge`)
- Manifest PWA inicial
- Estrutura de pastas para domínio, engine, storage, workers, RAG e modelos locais
- Camada inicial de storage com `localForage`
- Rule engine fake/local com trilha de auditoria
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

## Observações importantes

- O PWA está configurado para produção via `next-pwa`.
- Em desenvolvimento, o service worker fica desabilitado para evitar ruído durante implementação.
- Os ícones atuais são placeholders mínimos e podem ser substituídos depois.
- `engine/mock-tax-rule-engine.ts` existe apenas para demonstrar a forma do cálculo auditável.
- `db/local-db.ts` já fornece a base para persistência local de perfis, documentos, bundles e simulações.

## Próximos passos sugeridos

1. Substituir o bundle mock por um pacote normativo versionado revisado por especialista.
2. Implementar upload e revisão manual de documentos.
3. Integrar `pdf.js` e `Tesseract.js` em workers reais.
4. Criar indexação local de fontes normativas para RAG.
5. Acoplar WebLLM somente como explicador do resultado estruturado.

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
- Estrutura de código pronta para expansão local-first

O que ainda está como placeholder:

- OCR real
- Leitura real de PDF
- RAG real
- WebLLM real
- Regras tributárias oficiais