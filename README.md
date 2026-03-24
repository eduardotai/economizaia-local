# EconomizaIA Local

Starter funcional para um app **Next.js 15 + TypeScript + Tailwind + estilo shadcn/ui + PWA**, desenhado como base **local-first** para evoluir o produto EconomizaIA Local.

> **Importante:** este repositório inicial **não implementa regra fiscal oficial**. Os cálculos exibidos e a nova pipeline documental são **mocks/placeholders técnicos** para validar arquitetura, UX e integração local.

## Checkpoint atual

### Repositórios locais e auditoria expandida

Este checkpoint reforça a camada de persistência local e a trilha de auditoria, mantendo o projeto explicitamente local-first:

- Repositórios locais tipados para perfis, documentos, ingestão documental, simulações, resultados, bundles e eventos de auditoria
- Contratos de persistência mais claros com metadata de versão, timestamps e marcação `localOnly`
- Snapshots locais para perfil, documento e simulação
- Auditoria global coerente para ações principais do fluxo
- Integração mínima no preview de simulação e no workspace documental

### Onboarding anônimo + simulation workspace

Este checkpoint adiciona um fluxo inicial de entrada sem login e um workspace de simulação coerente com a proposta local-first:

- Onboarding anônimo em pt-BR, sem backend remoto
- Coleta mínima de perfil:
  - tipo de usuário
  - faixa de faturamento
  - tipo de atividade
  - regime atual opcional
  - período da simulação
- Persistência local básica do perfil via `localForage`
- Integração com o `mock-tax-rule-engine` já existente
- Workspace com:
  - resumo das premissas capturadas
  - estado atual da confiança
  - cards de cenários mock/placeholder
  - alertas, lacunas e disclaimers explícitos
- Mensagens de privacidade local-first e avisos de não-oficialidade

> **Limite intencional deste checkpoint:** o onboarding salva somente um perfil anônimo local, e todos os resultados da área de simulação continuam sendo **mock/placeholder**, sem cálculo fiscal real.

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

## Fluxo de onboarding e simulação atual

1. Usuário inicia um onboarding anônimo, sem login.
2. O app coleta o perfil mínimo necessário apenas para demonstração local:
   - tipo de usuário
   - faixa de faturamento
   - atividade
   - regime atual opcional
   - período de visualização
3. O perfil é salvo localmente no navegador via `localForage`.
4. O app converte esse perfil mínimo para o contrato aceito pelo `mock-tax-rule-engine`.
5. O motor gera um resultado local com trilha auditável já existente.
6. O workspace renderiza premissas, confiança, cenários mock, alertas e lacunas.
7. Disclaimers deixam explícito que não existe cálculo fiscal oficial neste checkpoint.

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
- `db/local-db.ts` agora expõe repositórios locais tipados e compatibilidade com os acessos já existentes.
- `db/persistence-types.ts` concentra os contratos explícitos da camada local.
- `docs/local-persistence.md` resume a estratégia de persistência, snapshots e auditoria.
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
- Onboarding anônimo local-first com coleta mínima de perfil
- Persistência local básica do onboarding/perfil
- Workspace de simulação com premissas, confiança, cenários mock, alertas e lacunas
- Integração do onboarding com o `mock-tax-rule-engine`
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
- Cálculo fiscal real
- Extração documental confiável para uso produtivo
