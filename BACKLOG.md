# EconomizaIA Local — Backlog Tecnico

## Epico 1 — Fundacao do projeto
- [x] Inicializar app Next.js 15 com TypeScript
- [x] Configurar Tailwind e shadcn/ui
- [x] Configurar PWA/offline shell
- [x] Definir arquitetura de pastas (`app`, `features`, `engine`, `db`, `workers`, `rag`, `models`)
- [x] Configurar lint, format, testes e validacao de tipos

## Epico 2 — Persistencia local
- [x] Implementar camada IndexedDB/localForage
- [x] Criar stores de documentos, perfis, simulacoes, resultados, regras e relatorios
- [x] Criar adapters e repositorios locais
- [x] Criar estrategia de versionamento local de dados

## Epico 3 — Upload e extracao documental
- [x] Upload de PDFs e imagens
- [x] Extracao de texto com pdf.js
- [x] OCR com Tesseract.js via worker
- [x] Pipeline de parsing fiscal inicial
- [x] Tela de revisao de campos extraidos
- [x] Web Worker dedicado com Comlink para processamento de documentos
- [x] Revisao manual avancada com estados por campo (needs_review, edited, confirmed)
- [x] Historico local de edicoes por campo
- [x] Formatacao automatica de CNPJ extraido de XML/PDF

## Epico 4 — Dominio tributario e rule engine
- [x] Modelos de dominio tributario
- [x] Contrato do rule bundle versionado
- [x] Motor de calculo deterministico (real-tax-rule-engine com MEI, Simples Nacional Anexos I-V, Lucro Presumido)
- [x] Simulacao de cenarios (atual vs conservador vs exploratorio)
- [x] Confidence bands e politica de recusa
- [x] Trilha de auditoria local
- [x] Bundle real 2026 com citacoes legais (LC 123/2006, CGSN 140/2018, RIR/2018)

## Epico 5 — RAG local e IA explicativa
- [x] Indexacao local de fontes oficiais (normative-chunks.ts)
- [x] Retrieval por contexto normativo
- [x] Integracao com WebLLM (Phi-3.5-mini via WebGPU)
- [x] Prompt seguro do explicador com politica anti-alucinacao
- [x] Chat contextual sobre resultado calculado (scaffold pronto, interacao basica)

## Epico 6 — UX de confianca
- [x] Onboarding anonimo
- [x] Dashboard local com workspace de simulacao
- [x] Cards de economia potencial e alertas
- [x] Exibicao de premissas, regras e fontes
- [x] Mensagens de privacidade e disclaimers em todas as telas criticas
- [x] Gate de prontidao (readiness gate) com checklist e bloqueadores
- [x] Prontidao operacional com score de confiabilidade

## Epico 7 — Relatorios e exportacao
- [x] Gerar relatorio estruturado (HTML auditavel)
- [x] Exportar PDF local (pdfmake)
- [x] Incluir metadados de auditoria e versao normativa
- [ ] Historico local de analises (listagem de relatorios anteriores)
- [x] Exportacao de dados para contador (JSON/CSV)

## Epico 8 — Performance e robustez
- [x] Lazy loading do modelo local (WebLLM on-demand)
- [x] Fallback sem WebGPU (mensagem clara ao usuario)
- [ ] Chunking de documentos grandes
- [ ] Otimizacao para celulares medios
- [ ] Hardening offline-first (testar PWA com npm run build + npm start)

## Epico 9 — Testes
- [x] Testes unitarios do rule engine (readiness gate, operational readiness)
- [x] Testes de regressao fiscal por snapshot (reporting HTML snapshot)
- [x] Testes de parsing documental (document pipeline integration)
- [ ] Testes de UX critica (E2E com Playwright)
- [ ] Testes offline/PWA

## Epico 10 — Governanca e CI
- [x] Licenca MIT
- [x] CONTRIBUTING.md
- [x] CI basico (GitHub Actions: typecheck + build + testes)
- [ ] Badges no README (TypeScript, PWA, Next.js, License)

## Bugs corrigidos
- [x] PDF falha com "No GlobalWorkerOptions.workerSrc" — worker copiado para public/
- [x] Seletores de periodo sem feedback visual — stale closure com setProfile corrigido
- [x] Reiniciar onboarding incompleto — clearAll limpa todos os stores + feedback visual
- [x] CNPJ extraido sem formatacao — mascara XX.XXX.XXX/XXXX-XX aplicada na extracao
- [x] Drop zone sem feedback apos upload — scroll automatico para lista de documentos
