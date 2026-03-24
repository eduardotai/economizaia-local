# Evolução curta para WebLLM real

Este checkpoint entrega apenas o **scaffold mock/placeholder** da camada explicativa local.

## O que entrou agora

- Contratos de capability/status do local explainer
- Separação entre `modo leve` e `modo IA`
- Serviço mock para resposta explicativa local
- Sessão de chat placeholder
- Botão explícito preparado para lazy-load: **Gerar relatório com explicação IA**
- Integração leve no relatório e workspace de relatório
- Prompt scaffold anti-alucinação mais rígido

## Estado atual

- `mode: light` por padrão
- `provider: disabled` no modo leve
- `availability: ready_light` no modo leve
- `provider: mock` para o caminho futuro de IA
- `availability: ready_placeholder` no caminho de IA mock
- Sem download de modelo
- Sem inferência real
- Sem streaming
- Sem aconselhamento fiscal oficial

## Lazy-load obrigatório

A arquitetura agora assume desde já:

- nada de carregar LLM automaticamente ao abrir o app
- a ativação do modo IA deve ocorrer apenas após ação explícita do usuário
- o rótulo previsto para ativação é: **Gerar relatório com explicação IA**

Enquanto o runtime real não existe, o botão fica como placeholder visual/documental.

## Modo leve sem LLM

O modo padrão do checkpoint é o **modo leve**:

- mostra números do motor local
- usa texto estático/controlado
- não abre chat IA real
- não carrega modelo
- mantém custo e latência mínimos

Esse caminho deve continuar existindo mesmo quando WebLLM real for habilitado.

## Prompt scaffold anti-alucinação

Regra-base preparada no scaffold:

> Você é o assistente fiscal do EconomizaIA Local.  
> Use APENAS os dados extraídos/revisados pelo usuário e as regras oficiais do JSON carregado (versão {version}).  
> Nunca invente números, alíquotas ou regimes.  
> Se faltar informação, diga: 'Preciso de mais dados: X, Y, Z'.  
> Responda em português simples, como se falasse com um MEI.  
> Sempre termine com: 'Este é um cálculo baseado nas regras oficiais de {data}. Consulte seu contador.'

## Privacidade e contexto explicativo

A documentação e a UI deixam explícito que:

- **chain-of-thought é interno/privado**
- a UI não deve exibir raciocínio interno cru
- o contexto explicativo futuro deve vir de **RAG local**
- o modelo não deve depender de memória remota para justificar respostas

## Próximos passos para WebLLM real

1. Criar adapter de runtime para WebLLM separado do serviço mock
2. Detectar capability real do navegador:
   - WebGPU disponível
   - modelo configurado
   - modelo baixado/carregado
3. Evoluir `LocalExplainerCapability` para refletir estados reais:
   - `checking`
   - `ready_light`
   - `ready`
   - `degraded`
   - `error`
4. Disparar download/carga do modelo somente após clique explícito no botão de IA
5. Restringir entrada do modelo a:
   - resumo estruturado da simulação
   - alertas/lacunas
   - evidências recuperadas pelo contexto local
   - versão do bundle/regra oficial carregada
6. Exigir saída estruturada (JSON) antes de renderizar UI/relatório
7. Adicionar telemetria local de sessão sem backend remoto
8. Exibir progresso de download/carga do modelo na UI

## Guardrails obrigatórios

- Nunca gerar cálculo fiscal novo fora do motor determinístico
- Nunca apresentar resposta como parecer oficial
- Sempre explicitar limitações e necessidade de revisão humana
- Rejeitar resposta se faltar contexto mínimo ou se o runtime local falhar
- Não expor chain-of-thought ao usuário final

## Estratégia de troca segura

A troca ideal é manter o contrato público atual e substituir só a implementação:

- hoje: `mode=light` e `provider=disabled` por padrão
- depois: `mode=ai` com `provider=webllm` após clique explícito

Assim a UI e o relatório continuam consumindo os mesmos tipos, com mudança mínima no restante do app.
