# Evolução curta para WebLLM real

Este checkpoint entrega apenas o **scaffold mock/placeholder** da camada explicativa local.

## O que entrou agora

- Contratos de capability/status do local explainer
- Serviço mock para resposta explicativa local
- Sessão de chat placeholder
- Integração leve no relatório e workspace de relatório

## Estado atual

- `provider: mock`
- `availability: ready_placeholder`
- Sem download de modelo
- Sem inferência real
- Sem streaming
- Sem aconselhamento fiscal oficial

## Próximos passos para WebLLM real

1. Criar adapter de runtime para WebLLM separado do serviço mock
2. Detectar capability real do navegador:
   - WebGPU disponível
   - modelo configurado
   - modelo baixado/carregado
3. Evoluir `LocalExplainerCapability` para refletir estados reais:
   - `checking`
   - `ready`
   - `degraded`
   - `error`
4. Restringir entrada do modelo a:
   - resumo estruturado da simulação
   - alertas/lacunas
   - evidências recuperadas pelo contexto local
5. Exigir saída estruturada (JSON) antes de renderizar UI/relatório
6. Adicionar telemetria local de sessão sem backend remoto
7. Exibir progresso de download/carga do modelo na UI

## Guardrails obrigatórios

- Nunca gerar cálculo fiscal novo fora do motor determinístico
- Nunca apresentar resposta como parecer oficial
- Sempre explicitar limitações e necessidade de revisão humana
- Rejeitar resposta se faltar contexto mínimo ou se o runtime local falhar

## Estratégia de troca segura

A troca ideal é manter o contrato público atual e substituir só a implementação:

- hoje: `mock`
- depois: `webllm`

Assim a UI e o relatório continuam consumindo os mesmos tipos, com mudança mínima no restante do app.
