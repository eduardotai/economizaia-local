# Contrato do Rule Engine (mock / protótipo local)

> Documento curto para orientar a evolução do motor tributário sem atribuir caráter oficial aos exemplos atuais.

## Objetivo

Este contrato define a forma dos dados produzidos e consumidos pelo rule engine local do EconomizaIA Local.

Tudo nesta fase é **mock / placeholder / protótipo local**, salvo futura substituição por pacotes normativos revisados por especialista.

## Princípios

- **Não inventar regra oficial**: exemplos servem apenas para exercitar o contrato.
- **Recusar quando faltar dado relevante**: o motor pode retornar `status: "refused"`.
- **Recusar quando a revisão humana estiver pendente**: o bundle MVP deixa isso explícito.
- **Auditoria primeiro**: premissas, lacunas, alertas e timeline fazem parte do resultado.
- **Versionamento explícito e auditável**: bundles expõem `version`, `hash`, `updatedAt`, `publishedAt`, `effectiveFrom`, `effectiveTo`, `approvalStatus`, `reviewedBy`, `reviewedAt` e `supersedes` quando aplicável.

## Estruturas principais

### `RuleBundle`

Representa um pacote versionado de regras.

Campos relevantes:

- `id`, `version`, `schemaVersion`
- `hash`, `updatedAt`, `publishedAt`
- `effectiveFrom`, `effectiveTo`
- `approvalStatus`, `reviewedBy`, `reviewedAt`
- `supersedes`
- `bundleStatus`
- `jurisdiction`
- `disclaimer`, `assumptionsPolicy`, `refusalPolicy`
- `labels[]`
- `review`
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
- `fallbackPolicy`: comportamento em caso de ambiguidade, falta de dados ou revisão pendente

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

## Bundle MVP atual

O checkpoint atual troca o starter genérico por um **bundle MVP pequeno e conservador** com recorte explícito:

- uso **local**
- objetivo de **demo/protótipo**
- comparação artificial de cenários
- guardrails fortes para **insufficient_data** e **manual_review**
- sem cobertura tributária completa
- sem fingir oficialidade

### Regras do bundle MVP

1. `guardrail-manual-review-required`
   - política local de governança
   - impede leitura de resultado como algo final/oficial

2. `guardrail-insufficient-data`
   - recusa explícita quando faltam dados mínimos

3. `prototype-local-scenario-comparison`
   - comparação demonstrativa com percentuais placeholder
   - apenas para validar contrato, UI e auditoria

## Confidence model

A confiança inclui:

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
- revisão humana/local pendente

Nesse caso, o retorno deve trazer:

- `status: "refused"`
- `summary.decisionStatus: "refused"`
- `audit.missingData[]`
- `audit.warnings[]`
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
