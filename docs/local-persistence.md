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

## Snapshots

Helpers em `lib/local-snapshots.ts`:

- `saveProfileSnapshot`
- `saveDocumentSnapshot`
- `saveSimulationSnapshot`
- `getLatestProfileSnapshot`
- `getLatestDocumentSnapshot`
- `getLatestSimulationSnapshot`

Uso intencional: manter uma recuperação simples de estado local sem adicionar sincronização remota.

## Auditoria local

Helpers em `lib/local-audit.ts` geram eventos coerentes para ações principais:

- salvar perfil local
- concluir ingestão documental
- iniciar/finalizar persistência de simulação e resultado

A auditoria continua explícita, conservadora e 100% local.

## Integração mínima aplicada neste checkpoint

- Preview da simulação mock agora persiste perfil, simulação, resultado, snapshot e eventos de auditoria
- Workspace documental agora persiste snapshot do documento e registra eventos globais de auditoria

## Limites intencionais

- Sem backend remoto
- Sem sync entre dispositivos
- Sem blobs binários avançados neste checkpoint
- Sem event sourcing complexo; apenas trilha local suficiente para inspeção e evolução incremental
