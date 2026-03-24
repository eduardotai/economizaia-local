# Contrato do Rule Engine (mock)

> Documento curto para orientar evolução do motor tributário sem atribuir caráter oficial aos exemplos atuais.

## Objetivo

Este contrato define a forma dos dados produzidos e consumidos pelo rule engine local do EconomizaIA Local.

Tudo nesta fase é **mock / placeholder / draft técnico**, salvo futura substituição por pacotes normativos revisados por especialista.

## Princípios

- **Não inventar regra oficial**: exemplos servem apenas para exercitar o contrato.
- **Recusar quando faltar dado relevante**: o motor pode retornar `status: "refused"`.
- **Auditoria primeiro**: premissas, lacunas, alertas e timeline fazem parte do resultado.
- **Versionamento explícito**: bundles expõem `version` e `schemaVersion`.

## Estruturas principais

### `RuleBundle`

Representa um pacote versionado de regras.

Campos relevantes:

- `id`, `version`, `schemaVersion`
- `bundleStatus`
- `jurisdiction`
- `disclaimer`, `assumptionsPolicy`, `refusalPolicy`
- `sources[]`
- `rules[]`

### `RuleDefinition`

Representa uma regra individual.

Campos relevantes:

- `status`: ciclo de vida da regra (`mock`, `placeholder`, `draft`, `review_required`)
- `kind`: tipo funcional da regra
- `jurisdiction`: escopo geográfico
- `validity`: vigência (`effectiveFrom`, `effectiveTo`, `status`)
- `citations[]`: citações normativas ou referências internas
- `fallbackPolicy`: comportamento em caso de ambiguidade ou falta de dados

### `SimulationResult`

Resultado completo de uma simulação.

Campos relevantes:

- `status`: `success`, `partial` ou `refused`
- `bundleId`, `bundleVersion`
- `currentScenario`, `suggestedScenario?`
- `summary.decisionStatus`
- `summary.confidence`
- `audit.premises`
- `audit.appliedRules`
- `audit.missingData`
- `audit.warnings`
- `audit.timeline`
- `refusal?`

## Confidence model

A confiança deixa de ser apenas um número solto e passa a incluir:

- banda qualitativa (`very_low` → `very_high`)
- `score`
- `label`
- `rationale`
- `drivers`
- `blockers`
- `reviewRecommendation`

## Insufficient data / refusal

O motor mock pode recusar a conclusão quando faltarem dados mínimos para um resultado auditável.

Exemplo de motivos:

- jurisdição ausente
- atividade vazia
- receita inválida

Nesse caso, o retorno deve trazer:

- `status: "refused"`
- `summary.decisionStatus: "refused"`
- `audit.missingData[]`
- `refusal.reasonCode`
- `refusal.nextSteps[]`

## Snapshots para testes futuros

Snapshots mock ficam em `docs/snapshots/`.

Arquivos atuais:

- `simulation-input-success.mock.json`
- `simulation-output-success.mock.json`
- `simulation-input-insufficient.mock.json`
- `simulation-output-insufficient.mock.json`

Todos são explicitamente artificiais e não representam regra tributária real.
