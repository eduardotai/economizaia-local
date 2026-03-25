# Persistência local

Checkpoint focado em reforçar a camada **local-first** sem backend remoto.

## Repositórios locais disponíveis

Todos usam `localForage`/IndexedDB no navegador e ficam centralizados em `db/local-db.ts`.

- `profiles`: perfis do usuário
- `documents`: documentos fiscais estruturados
- `ingestionDocuments`: documentos do fluxo de ingestão
- `simulations`: execuções de simulação
- `results`: resultados persistidos separadamente para leitura futura
- `bundles`: bundles de regras locais
- `audit`: eventos de auditoria globais
- `snapshots`: snapshots locais para recuperação rápida

## Contratos

Os tipos da persistência ficam em `db/persistence-types.ts`.

Pontos principais:

- `PersistedRecord<T>` encapsula `data` + `metadata`
- `PersistedRecordMetadata` explicita versão, timestamps e `localOnly: true`
- `LocalPersistenceContract` descreve os repositórios disponíveis
- `LocalAuditEvent` padroniza auditoria por agregado
- `LocalSnapshot<T>` padroniza snapshots locais

## Por que isso importa para o produto

A persistência local não é apenas uma decisão técnica. Ela sustenta o posicionamento do MVP:

- **privacidade**: dados ficam no dispositivo
- **rastreabilidade**: snapshots e eventos mostram o que aconteceu no fluxo
- **prudência**: a análise pode bloquear sem depender de backend remoto
- **apoio à revisão humana**: o estado da leitura continua observável e recuperável

## Snapshots

Helpers em `lib/local-snapshots.ts`:

- `saveProfileSnapshot`
- `saveDocumentSnapshot`
- `saveSimulationSnapshot`
- `saveReportSnapshot`
- `getLatestProfileSnapshot`
- `getLatestDocumentSnapshot`
- `getLatestSimulationSnapshot`
- `getLatestReportSnapshot`

Uso intencional: manter uma recuperação simples de estado local sem adicionar sincronização remota.

## Auditoria local

Helpers em `lib/local-audit.ts` geram eventos coerentes para ações principais:

- salvar perfil local
- concluir ingestão documental
- iniciar/finalizar persistência de simulação e resultado
- registrar artefatos que ajudam a explicar a leitura local

A auditoria continua explícita, conservadora e 100% local.

## Integração mínima aplicada neste checkpoint

- preview da leitura local persiste perfil, simulação, resultado, snapshot e eventos de auditoria
- workspace documental persiste snapshot do documento e registra eventos globais de auditoria
- workspace de relatório/readiness depende explicitamente de consistência entre snapshots, auditoria local e alinhamento com a simulação vigente
- painel operacional usa esses artefatos locais para demonstrar prontidão sem alegar cobertura fiscal oficial

## Limites intencionais

- sem backend remoto
- sem sync entre dispositivos
- sem blobs binários avançados neste checkpoint
- sem event sourcing complexo; apenas trilha local suficiente para inspeção e evolução incremental
