# Scaffold inicial de RAG local e camada explicativa

Este checkpoint adiciona uma base arquitetural **mock/placeholder** para contexto explicativo local no EconomizaIA Local.

## O que existe agora

- Contratos tipados para:
  - documentos normativos locais
  - chunks indexados
  - evidências de retrieval
  - resultado de retrieval
  - contexto explicativo agregado
- Índice local mock em memória com busca por sobreposição de palavras-chave
- Geração de `explanationContext` junto com o relatório local
- Exibição do contexto explicativo na prévia do relatório

## O que NÃO existe ainda

- Nenhum texto normativo oficial embarcado
- Nenhum embedding real
- Nenhum reranking neural
- Nenhuma geração com LLM local real
- Nenhuma interpretação fiscal oficial

## Restrições importantes

- Todo conteúdo deste módulo está marcado como `mock` ou `placeholder`
- As referências usadas no índice atual são internas ao protótipo e **não são fontes normativas oficiais**
- A camada explicativa deve continuar subordinada ao resultado estruturado do motor e à revisão humana

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
4. Proibir respostas que inventem base normativa ausente
5. Preferir saída estruturada/JSON para renderização previsível

## Arquitetura alvo sugerida

```txt
simulation result estruturado
  -> retrieval local
  -> explanation context
  -> summarization local (Transformers.js/WebLLM)
  -> UI/relatório
```

## Observação

Este scaffold existe para preparar contratos e fluxo. A troca do mecanismo mock por embeddings/LLM local deve acontecer sem quebrar a integração com o relatório e a rastreabilidade das evidências.
