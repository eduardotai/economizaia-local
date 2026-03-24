# EconomizaIA Local

Starter funcional para um app **Next.js 15 + TypeScript + Tailwind + estilo shadcn/ui + PWA**, desenhado como base **local-first** para evoluir o produto EconomizaIA Local.

> **Importante:** este repositório inicial **não implementa regra fiscal oficial**. Os cálculos exibidos, a pipeline documental e a camada explicativa local são **mocks/placeholders técnicos** para validar arquitetura, UX e integração local.

## Checkpoint atual

### Revisão manual obrigatória + modo rápido manual + regras versionadas

Este checkpoint reorganiza a prioridade do produto para reduzir risco de falsa precisão fiscal:

- **pdf.js priorizado** para PDF digital
- **OCR/Tesseract apenas como fallback técnico**, explicitamente não confiável para cálculo fiscal
- **Revisão/edição manual obrigatória** dos dados extraídos antes de qualquer uso futuro no rule engine
- **Gate explícito** na UI bloqueando cálculo derivado de documento sem revisão manual confirmada
- **Modo rápido manual** com entrada direta de:
  - faturamento
  - despesas
  - regime atual
  - atividade / CNAE
  - período
- **Settings locais** para alternar entre **modo leve** e **modo IA** (preparação de produto/UX)
- **Rule bundle versionado** com contrato explícito de `version`, `hash` e `updatedAt`
- **Aviso visível na UI** sobre a versão atual das regras e necessidade futura de atualização controlada

> **Importante:** este checkpoint continua sendo **mock/placeholder**. Não há regra fiscal oficial, nem cálculo tributário validado por especialista.

### O que mudou na prioridade documental

1. PDF digital tenta leitura com `pdf.js` primeiro.
2. OCR fica somente como fallback/plumbing técnico.
3. Dados extraídos do documento não entram automaticamente em cálculo.
4. O usuário precisa revisar/editar e **confirmar manualmente** os campos.
5. Sem essa confirmação, o app mantém o fluxo documental **bloqueado para cálculo**.

## O que já vem pronto

- App Router com `app/layout.tsx` e `app/page.tsx`
- Tailwind configurado
- Componentes base de UI no estilo shadcn/ui (`Button`, `Card`, `Badge`)
- Manifest PWA inicial
- Estrutura de pastas para domínio, engine, storage, workers, RAG e modelos locais
- Camada inicial de storage com `localForage`
- Rule engine fake/local com trilha de auditoria
- Onboarding anônimo local com persistência básica do perfil
- Workspace de simulação com cenários mock, confiança, lacunas e disclaimers
- Modo rápido manual integrado ao fluxo de simulação
- Pipeline documental local com revisão/edit manual obrigatória
- Bundle de regras mock versionado
- Avisos explícitos de atualização futura das regras
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
docs/
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

## Fluxo de simulação atual

### Modo rápido manual

1. Usuário escolhe o fluxo **Modo rápido manual**.
2. Informa manualmente faturamento, despesas, regime atual, atividade/CNAE e período.
3. O perfil é salvo localmente no navegador.
4. O app usa o `mock-tax-rule-engine` apenas para validar o contrato e a UX.
5. A UI mostra bundle/versionamento, cenários mock, confiança, alertas e disclaimers.

### Fluxo com documentos

1. Usuário envia PDF, imagem ou XML.
2. O app registra o arquivo no storage local do navegador.
3. PDFs digitais usam `pdf.js` como primeira tentativa.
4. OCR aparece só como fallback técnico/stub.
5. O documento termina em estado de **revisão manual obrigatória**.
6. O usuário revisa/edita os campos extraídos.
7. Só após confirmação manual o documento fica marcado como apto para um cálculo futuro.
8. Antes disso, a UI exibe bloqueio explícito do rule engine.

## Contrato de bundle de regras versionado

O bundle local mock agora carrega, no mínimo:

- `version`
- `hash`
- `updatedAt`

Exemplo conceitual:

```ts
{
  version: "0.3.0-mock",
  hash: "mock-sha256-manual-review-required-2026-03-24",
  updatedAt: "2026-03-24T13:45:00.000Z"
}
```

> Esses valores ainda são **mock/placeholders**, mas o contrato foi preparado para atualização futura e aviso de versão mais nova.

## Limites atuais

- Sem backend remoto: todo o processamento continua local-first no navegador.
- `pdf.js` já está conectado, mas ainda não cobre bem PDFs escaneados, criptografados ou semanticamente ruins.
- `Tesseract.js` está isolado via adapter/plumbing, porém o OCR real ainda segue stub e não deve ser tratado como confiável para cálculo fiscal.
- XML recebe parsing estrutural genérico/local, mas continua sem extração oficial de NFe/NFS-e/NFC-e.
- Campos documentais continuam sendo sugestões heurísticas/placeholders auditáveis.
- A revisão manual é obrigatória exatamente para evitar uso indevido dessas sugestões.
- Não há regra tributária oficial nem cálculo fiscal real neste checkpoint.

## Próximos passos sugeridos

1. Persistir settings de produto mais completos para modo leve vs modo IA.
2. Evoluir a revisão manual com estados por campo, histórico e diffs.
3. Criar integração futura entre documentos revisados e input estruturado do rule engine.
4. Substituir o bundle mock por pacote normativo versionado revisado por especialista.
5. Implementar política de update check para bundles locais.
6. Mover `pdf.js` e OCR real para workers dedicados quando a maturidade do fluxo permitir.

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
- Onboarding anônimo local-first com coleta mínima de perfil
- Settings locais de modo leve / modo IA
- Modo rápido manual integrado ao workspace
- Persistência local básica do onboarding/perfil
- Workspace de simulação com premissas, confiança, cenários mock, alertas e lacunas
- Exibição da versão/hash/data do bundle mock
- Upload inicial de documentos com processamento local
- Revisão/edit manual obrigatória de campos extraídos
- Bloqueio explícito do rule engine sem revisão manual confirmada
- Persistência local de documentos ingeridos e auditoria básica

O que ainda está como placeholder:

- OCR real confiável
- Leitura robusta de PDF escaneado
- Parser XML completo
- RAG real com embeddings
- WebLLM real
- Streaming local do explainer
- Regras tributárias oficiais
- Cálculo fiscal real
- Atualização automática/segura de bundles de regras
