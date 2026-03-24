# EconomizaIA Local

Starter funcional para um app **Next.js 15 + TypeScript + Tailwind + estilo shadcn/ui + PWA**, desenhado como base **local-first** para evoluir o produto EconomizaIA Local.

> **Importante:** este repositório inicial **não implementa regra fiscal oficial**. Os cálculos exibidos e a nova pipeline documental são **mocks/placeholders técnicos** para validar arquitetura, UX e integração local.

## Checkpoint atual

### Scaffold inicial de RAG local e camada explicativa

Este checkpoint adiciona a primeira base arquitetural para contexto explicativo local, ainda sem backend remoto e com tudo explicitamente marcado como mock/placeholder:

- Tipos/contratos para documentos normativos locais, chunks, evidências de retrieval, resultado de retrieval e contexto explicativo
- Índice local mock em memória com retrieval por palavras-chave
- Integração leve com o fluxo de relatório para exibir “contexto explicativo” local
- Preparação de contratos para evolução posterior com Transformers.js e WebLLM
- Nenhum conteúdo normativo oficial embarcado neste estágio

### UI local de inspeção para auditoria e snapshots

Este checkpoint adiciona uma interface simples de inspeção local para reforçar o debug manual e a confiança no fluxo local-first:

- Tela client-side para listar `audit_events` persistidos no navegador
- Tela client-side para listar `snapshots` locais de perfil, documento e simulação
- Exibição de metadados úteis como timestamp, tipo, origem, aggregate/entity ids, refs e payload serializado
- Integração leve com a home atual, sem backend remoto
- Geração de auditoria e snapshots também no fluxo de simulação local

### Relatório estruturado + exportação local inicial

Este checkpoint adiciona a primeira versão do relatório final do usuário, ainda totalmente local-first e explicitamente mock/placeholder:

- Relatório estruturado em pt-BR com resumo executivo, premissas, confiança, alertas/lacunas, contexto explicativo mock e rodapé com disclaimer
- Tela/componente de relatório integrada ao fluxo atual de simulação
- Exportação local inicial em HTML pronto para impressão
- Caminho explícito de impressão/salvar em PDF do navegador como placeholder inicial
- Persistência local básica do relatório e snapshot local adicional

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
- Scaffold inicial de contexto explicativo local acoplado ao relatório

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
3. A pipeline transita explicitamente por `registered -> classifying -> extracting_text -> ocr_queued/extracting_entities -> completed/review_required/failed`.
4. PDFs agora tentam extração textual local inicial com `pdf.js` (`pdfjs-dist`) no navegador.
5. Quando `pdf.js` não consegue ler bem o conteúdo, o app cai em fallback local/stub claramente marcado na auditoria e nos warnings.
6. Imagens e PDFs entram por um adapter isolado de OCR preparado para `Tesseract.js`, mas a execução OCR real ainda segue stub neste checkpoint.
7. XML já pode ser lido localmente como texto bruto, porém o parser semântico/fiscal ainda não foi implementado.
8. Entidades continuam mockadas para validar UX, revisão humana e trilha de auditoria — não são extração confiável para uso produtivo.
9. Cada passo entra na trilha de auditoria local do documento com engine/modo/status explícitos.

### Limites atuais da extração documental

- Sem backend remoto: todo o processamento continua local-first no navegador.
- `pdf.js` já está conectado, mas ainda não cobre bem PDFs escaneados, criptografados ou semanticamente ruins.
- `Tesseract.js` está isolado via adapter/plumbing, porém o OCR real ainda não foi habilitado em worker local.
- XML ainda entra como texto bruto; extração estruturada de NFe/NFS-e continua como próximo passo.
- Entidades exibidas na UI continuam mockadas e devem ser tratadas como placeholders auditáveis.
- Se o documento terminar como `review_required`, isso significa que houve leitura parcial, fallback ou limitação conhecida.

## Contrato do rule engine

Documentação curta deste checkpoint:

- `docs/rule-engine-contract.md`
- `docs/snapshots/simulation-input-success.mock.json`
- `docs/snapshots/simulation-output-success.mock.json`
- `docs/snapshots/simulation-input-insufficient.mock.json`
- `docs/snapshots/simulation-output-insufficient.mock.json`

Esses artefatos documentam o contrato expandido do motor, incluindo confidence bands, premissas, lacunas de dados, alertas, trilha de auditoria e recusa mock por insuficiência de dados.

## Fluxo de relatório e exportação local atual

1. Usuário conclui o onboarding anônimo e gera uma simulação local.
2. O app monta um relatório estruturado em pt-BR com resumo executivo, premissas, confiança, alertas e lacunas.
3. O relatório é salvo localmente no navegador como artefato próprio deste checkpoint.
4. Um snapshot local adicional é criado para apoiar auditoria/revisão futura.
5. A exportação inicial acontece por download de HTML pronto para impressão.
6. O caminho de PDF neste checkpoint é explícito e indireto: usar a impressão do navegador para “Salvar em PDF”.
7. O relatório também monta um contexto explicativo local mock com evidências recuperadas de um índice placeholder.
8. Todo o conteúdo continua marcado como mock/placeholder e não oficial.

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

1. Mover `pdf.js` para worker dedicado e adicionar renderização de páginas para cobrir PDFs escaneados.
2. Habilitar OCR real com `Tesseract.js` em worker local, com idioma/configuração explícitos e progresso por página.
3. Criar revisão manual de entidades/documentos antes de qualquer uso em cálculo.
4. Adicionar parser XML local mais estruturado para NFe/NFS-e e normalização de campos.
5. Substituir entidades mock por extração heurística/local progressiva com confidence e rastreabilidade.
6. Substituir o bundle mock por um pacote normativo versionado revisado por especialista.
7. Evoluir o índice local mock para retrieval com embeddings no navegador.
8. Acoplar WebLLM somente como explicador do resultado estruturado e das evidências recuperadas.

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
- Relatório final inicial integrado ao fluxo de simulação
- Contexto explicativo local mock integrado ao relatório
- Persistência local básica de relatórios estruturados
- Exportação local inicial em HTML e impressão via navegador
- Integração do onboarding com o `mock-tax-rule-engine`
- Painel local de inspeção para auditoria e snapshots persistidos
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
