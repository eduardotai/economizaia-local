# Scaffold inicial de RAG local e camada explicativa

Este checkpoint endurece a base arquitetural **mock/placeholder** da camada explicativa local no EconomizaIA Local com foco em **anti-alucinação**, **ancoragem local** e **recusa controlada**.

## O que existe agora

- Contratos tipados para:
  - documentos normativos locais
  - chunks indexados
  - evidências de retrieval
  - resultado de retrieval
  - contexto explicativo agregado
  - resposta estruturada do explainer local
  - capability/status do explainer
  - recusa controlada
- Índice local mock em memória com busca por sobreposição de palavras-chave
- Geração de `explanationContext` junto com o relatório local
- Resposta do explainer com:
  - `sections` previsíveis
  - `evidenceAnchor`
  - `capabilityStatus`
  - `refusal` quando faltar base suficiente
- Exibição do contexto explicativo e do status/capability na prévia do relatório

## Endurecimentos anti-alucinação deste checkpoint

### 1. Resposta mais estruturada

A resposta pública do explainer agora evita texto livre solto como único payload e passa a incluir blocos previsíveis:

- `summary`
- `answer`
- `sections[]`
- `evidence[]`
- `evidenceAnchor`
- `capabilityStatus`
- `refusal?`
- `followUps[]`

Isso prepara a camada para futura serialização/renderização em JSON estável antes de plugar um WebLLM real.

### 2. Ancoragem obrigatória em contexto local

A geração mock só pode se apoiar em:

- dados estruturados da simulação
- `bundleVersion` carregado
- `warnings` e `missingData` do audit local
- `explanationContext` vindo do retrieval local

A resposta final expõe explicitamente a âncora usada:

- versão do bundle
- status da simulação
- número de evidências recuperadas
- número de blocos de contexto
- contagem de alertas e lacunas
- IDs de evidência usados

### 3. Recusa controlada

O explainer agora **recusa** em vez de improvisar quando detecta qualquer um destes casos:

- ausência de evidência/contexto local suficiente
- lacunas de dados ainda abertas
- necessidade explícita de revisão humana

Nessa situação, o contrato retorna:

- `status: "refused"`
- `refusal.code`
- `refusal.title`
- `refusal.message`
- `refusal.missingItems[]`
- `refusal.requiredActions[]`

### 4. Capability/status mais claro

A UI e o contrato deixam mais explícito:

- **modo leve** = sem IA gerativa
- **modo IA local sob demanda** = ainda mock/WebLLM-ready
- **provider mock** ≠ modelo real carregado
- **ready_placeholder** ≠ `ready`

Objetivo: evitar que o usuário interprete o estado atual como IA local de produção.

## O que NÃO existe ainda

- Nenhum texto normativo oficial embarcado
- Nenhum embedding real
- Nenhum reranking neural
- Nenhuma geração com WebLLM local real
- Nenhum aconselhamento fiscal oficial
- Nenhuma validação normativa por especialista

## Restrições importantes

- Todo conteúdo deste módulo continua marcado como `mock` ou `placeholder`
- As referências usadas no índice atual são internas ao protótipo e **não são fontes normativas oficiais**
- A camada explicativa continua subordinada ao resultado estruturado do motor e à revisão humana
- Quando houver incerteza, a política correta é **recusar** ou pedir mais dados, nunca completar com invenção

## Como evoluir para Transformers.js

Passo sugerido para evolução local:

1. Manter os contratos atuais de `NormativeChunk`, `RetrievalResult` e `ExplanationContext`
2. Substituir a busca por palavras-chave por embeddings locais gerados com Transformers.js
3. Persistir vetores/chunks no navegador via IndexedDB
4. Adicionar reranking local dos trechos mais relevantes
5. Alimentar a UI e o relatório com evidências recuperadas já estruturadas

Uso esperado:

- embedding model local para chunk/query
- top-k retrieval local
- opcionalmente reranking local antes da apresentação

## Como evoluir para WebLLM

Passo sugerido para geração explicativa local:

1. Recuperar evidências com o fluxo acima
2. Montar um prompt estritamente delimitado pelas evidências recuperadas
3. Pedir ao modelo apenas:
   - resumir evidências
   - explicitar lacunas
   - reforçar disclaimer e necessidade de revisão humana
   - devolver saída estruturada/JSON válida
4. Proibir respostas que inventem base normativa ausente
5. Manter recusa controlada como comportamento padrão em caso de baixa evidência

## Arquitetura alvo sugerida

```txt
simulation result estruturado
  -> retrieval local
  -> explanation context
  -> summarization local (Transformers.js/WebLLM)
  -> validator/normalizer de saída estruturada
  -> UI/relatório
```

## Observação

Este scaffold existe para preparar contratos, rastreabilidade e política de segurança. A troca do mecanismo mock por embeddings/LLM local deve acontecer sem quebrar:

- a integração com o relatório
- a rastreabilidade das evidências
- a comunicação clara de capability/status
- o comportamento conservador de recusa
